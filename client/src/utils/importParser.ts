/**
 * Import Parser Utility for Entry Editor
 * 
 * Parses JSON or HTML content and maps to Entry Editor fields.
 * Fully compatible with Export Template output (JSON + HTML).
 * 
 * MULTI-ENTRY SUPPORT (Phase 3):
 * - JSON: Accepts single object, array of objects, or { entries: [...] }
 * - HTML: Splits by <article data-entry> or <!-- ENTRY_START --> delimiters
 * 
 * JSON IMPORT:
 * - Accepts JSON objects with keys matching ENTRY_FIELD_DEFINITIONS
 * - Ignores meta/documentation keys (__meta, __notes, etc.)
 * - Maps alternative keys (e.g., "body" → content, "cover" → coverImageUrl)
 * 
 * HTML IMPORT:
 * - PRIORITY 1: Uses data-entry-field attributes from Export Template
 * - PRIORITY 2: Falls back to heuristics (first h1, first img, first p)
 * - Extracts embedded JSON meta script for status/journals/collections
 * 
 * Uses shared field definitions from entryFieldDefinitions.ts
 */

import {
  ENTRY_FIELD_DEFINITIONS,
  IGNORED_JSON_KEYS,
  HTML_FIELD_ATTRIBUTE,
  VALID_STATUS_VALUES,
  isIgnoredJsonKey,
  type EntryStatus
} from './entryFieldDefinitions'
import {
  normalizeImportedContent,
  isValidTipTapJson,
  type ConversionResult
} from './tiptapConversion'

export type ImportMode = 'auto' | 'json' | 'html'

export interface ParsedEntryFields {
  title?: string
  excerpt?: string
  coverImageUrl?: string
  coverImageAlt?: string
  content?: { json: any; html: string }
  status?: EntryStatus
  // Organization (Curator labeling system)
  journals?: string[]      // Array of journal names to match/create
  collections?: string[]   // Array of collection names to match/create
}

export interface ParseResult {
  success: boolean
  fields: ParsedEntryFields
  detectedFormat: 'json' | 'html' | null
  warnings: string[]
  error?: string
  // Enhanced preview info
  detectedFields?: string[]     // List of field names detected
  skippedFields?: string[]      // Fields skipped due to overwrite=false
}

// ============================================================
// SANITIZATION
// ============================================================

/**
 * Simple HTML sanitizer - strips dangerous elements and attributes
 * Removes: scripts, iframes, inline event handlers, dangerous URLs
 */
function sanitizeHtml(html: string): string {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    
    // Remove dangerous elements
    const dangerousElements = doc.querySelectorAll('script, iframe, object, embed, form, style')
    dangerousElements.forEach(el => el.remove())
    
    // Remove event handlers and dangerous attributes from all elements
    const allElements = doc.querySelectorAll('*')
    allElements.forEach(el => {
      const attrs = Array.from(el.attributes)
      attrs.forEach(attr => {
        if (attr.name.startsWith('on') || 
            attr.name === 'formaction' ||
            (attr.name === 'href' && attr.value.toLowerCase().startsWith('javascript:')) ||
            (attr.name === 'src' && attr.value.toLowerCase().startsWith('javascript:')) ||
            (attr.name === 'data' && attr.value.toLowerCase().startsWith('javascript:'))) {
          el.removeAttribute(attr.name)
        }
      })
    })
    
    return doc.body.innerHTML
  } catch (e) {
    console.error('HTML sanitization error:', e)
    return '' // Return empty on error for safety
  }
}

/**
 * Extract plain text from HTML (for fallback scenarios)
 */
function htmlToPlainText(html: string): string {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    return doc.body.textContent || ''
  } catch {
    return ''
  }
}

// ============================================================
// JSON PARSING
// ============================================================

/**
 * Attempt to parse input as JSON
 */
function tryParseJson(input: string): { success: boolean; data?: any; error?: string } {
  try {
    const trimmed = input.trim()
    // Quick check - must start with { or [
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return { success: false, error: 'Input does not appear to be JSON' }
    }
    const data = JSON.parse(trimmed)
    return { success: true, data }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Invalid JSON' }
  }
}

/**
 * Map JSON data to entry fields
 * - Ignores meta keys (__meta, __notes, etc.)
 * - Maps alternative keys to canonical field names
 * - Respects overwrite toggle
 */
function mapJsonToFields(
  data: any, 
  overwrite: boolean, 
  currentFields: ParsedEntryFields
): { fields: ParsedEntryFields; detected: string[]; skipped: string[] } {
  const result: ParsedEntryFields = {}
  const detected: string[] = []
  const skipped: string[] = []
  
  // Helper to check if we should write to a field
  const shouldWrite = (fieldName: keyof ParsedEntryFields, newValue: any): boolean => {
    if (newValue === undefined || newValue === null || newValue === '') return false
    if (overwrite) return true
    // Only write if current field is empty
    const current = currentFields[fieldName]
    if (current === undefined || current === null) return true
    if (typeof current === 'string' && current.trim() === '') return true
    if (Array.isArray(current) && current.length === 0) return true
    return false
  }
  
  // Helper to find value from multiple possible keys
  const findValue = (keys: string[]): any => {
    for (const key of keys) {
      if (data[key] !== undefined && data[key] !== null && !isIgnoredJsonKey(key)) {
        return data[key]
      }
    }
    return undefined
  }
  
  // Map title
  const titleValue = findValue(['title', 'name', 'heading'])
  if (titleValue !== undefined && typeof titleValue === 'string') {
    detected.push('title')
    if (shouldWrite('title', titleValue)) {
      result.title = titleValue.trim()
    } else {
      skipped.push('title')
    }
  }
  
  // Map excerpt
  const excerptValue = findValue(['excerpt', 'summary', 'description', 'subtitle'])
  if (excerptValue !== undefined && typeof excerptValue === 'string') {
    detected.push('excerpt')
    if (shouldWrite('excerpt', excerptValue)) {
      result.excerpt = excerptValue.trim()
    } else {
      skipped.push('excerpt')
    }
  }
  
  // Map cover image URL
  const coverValue = findValue(['coverImageUrl', 'cover_image_url', 'coverImage', 'cover', 'image', 'thumbnail', 'featured_image'])
  if (coverValue !== undefined) {
    detected.push('coverImageUrl')
    if (typeof coverValue === 'string' && shouldWrite('coverImageUrl', coverValue)) {
      result.coverImageUrl = coverValue.trim()
    } else if (typeof coverValue === 'object' && coverValue.url) {
      if (shouldWrite('coverImageUrl', coverValue.url)) {
        result.coverImageUrl = coverValue.url
      } else {
        skipped.push('coverImageUrl')
      }
      // Also try to get alt text from nested object
      if (coverValue.alt) {
        detected.push('coverImageAlt')
        if (shouldWrite('coverImageAlt', coverValue.alt)) {
          result.coverImageAlt = coverValue.alt
        } else {
          skipped.push('coverImageAlt')
        }
      }
    } else {
      skipped.push('coverImageUrl')
    }
  }
  
  // Map cover image alt (standalone)
  const coverAltValue = findValue(['coverImageAlt', 'cover_image_alt', 'coverAlt', 'imageAlt'])
  if (coverAltValue !== undefined && typeof coverAltValue === 'string') {
    if (!detected.includes('coverImageAlt')) detected.push('coverImageAlt')
    if (shouldWrite('coverImageAlt', coverAltValue)) {
      result.coverImageAlt = coverAltValue.trim()
    } else if (!skipped.includes('coverImageAlt')) {
      skipped.push('coverImageAlt')
    }
  }
  
  // Map content/body - Phase 3.1: Ensure TipTap JSON is always populated
  // Priority order for JSON content:
  // 1. content_rich (direct TipTap JSON)
  // 2. contentJson (alternative key)
  // 3. content.json (nested)
  // 4. content (if it's a TipTap doc)
  // 5. content/body/html/text as HTML string
  
  // First, check for explicit TipTap JSON
  const contentRichValue = findValue(['content_rich', 'contentJson', 'contentRich'])
  const contentValue = findValue(['content', 'body', 'html', 'text', 'content_html', 'markdown'])
  const contentHtmlValue = findValue(['content_html', 'contentHtml'])
  
  let finalContent: { json: any; html: string } | undefined
  let contentWarning: string | undefined
  
  if (contentRichValue !== undefined || contentValue !== undefined) {
    detected.push('content')
    
    if (shouldWrite('content', contentRichValue || contentValue)) {
      // Case 1: Direct TipTap JSON provided via content_rich/contentJson
      if (contentRichValue && typeof contentRichValue === 'object' && isValidTipTapJson(contentRichValue)) {
        // Authoritative TipTap JSON - use directly
        const html = contentHtmlValue || data.content_html || data.contentHtml || ''
        finalContent = { json: contentRichValue, html: typeof html === 'string' ? sanitizeHtml(html) : '' }
      }
      // Case 2: content is an object with json property
      else if (contentValue && typeof contentValue === 'object' && !Array.isArray(contentValue)) {
        if (contentValue.json && isValidTipTapJson(contentValue.json)) {
          // Has valid TipTap JSON
          finalContent = {
            json: contentValue.json,
            html: contentValue.html ? sanitizeHtml(contentValue.html) : ''
          }
        } else if (contentValue.type === 'doc') {
          // contentValue IS the TipTap doc
          const html = contentHtmlValue || ''
          finalContent = {
            json: contentValue,
            html: typeof html === 'string' ? sanitizeHtml(html) : ''
          }
        } else if (contentValue.html) {
          // Only HTML in object - convert to TipTap JSON
          const conversionResult = normalizeImportedContent(sanitizeHtml(contentValue.html))
          finalContent = conversionResult.content
          contentWarning = conversionResult.warning
        }
      }
      // Case 3: String content - treat as HTML and convert
      else if (typeof contentValue === 'string' || typeof contentRichValue === 'string') {
        const htmlString = typeof contentValue === 'string' ? contentValue : String(contentRichValue)
        const sanitized = sanitizeHtml(htmlString)
        const conversionResult = normalizeImportedContent(sanitized)
        finalContent = conversionResult.content
        contentWarning = conversionResult.warning
      }
      
      if (finalContent) {
        result.content = finalContent
      }
    } else {
      skipped.push('content')
    }
  }
  
  // Map status
  const statusValue = findValue(['status', 'state'])
  if (statusValue !== undefined && typeof statusValue === 'string') {
    const normalized = statusValue.toLowerCase().trim() as EntryStatus
    if (VALID_STATUS_VALUES.includes(normalized)) {
      detected.push('status')
      if (shouldWrite('status', normalized)) {
        result.status = normalized
      } else {
        skipped.push('status')
      }
    }
  }
  // Also check for boolean published flag
  if (data.published !== undefined) {
    detected.push('status')
    if (data.published === true && shouldWrite('status', 'published')) {
      result.status = 'published'
    } else if (data.published === false && shouldWrite('status', 'draft')) {
      result.status = 'draft'
    } else if (!skipped.includes('status')) {
      skipped.push('status')
    }
  }
  
  // Map journals
  const journalsValue = findValue(['journals', 'journal', 'categories', 'category'])
  if (journalsValue !== undefined) {
    detected.push('journals')
    const parsed = parseStringArray(journalsValue)
    if (parsed.length > 0 && shouldWrite('journals', parsed)) {
      result.journals = parsed
    } else if (parsed.length > 0) {
      skipped.push('journals')
    }
  }
  
  // Map collections
  const collectionsValue = findValue(['collections', 'collection', 'tags', 'labels', 'label'])
  if (collectionsValue !== undefined) {
    detected.push('collections')
    const parsed = parseStringArray(collectionsValue)
    if (parsed.length > 0 && shouldWrite('collections', parsed)) {
      result.collections = parsed
    } else if (parsed.length > 0) {
      skipped.push('collections')
    }
  }
  
  return { fields: result, detected, skipped }
}

/**
 * Parse a value that could be a string, array of strings, or array of objects with name property
 */
function parseStringArray(value: any): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item: any) => typeof item === 'string' ? item : item?.name || item?.title)
      .filter((item: any) => typeof item === 'string' && item.trim())
      .map((item: string) => item.trim())
  } else if (typeof value === 'string') {
    return value.split(',').map(s => s.trim()).filter(s => s)
  }
  return []
}

// ============================================================
// HTML PARSING
// ============================================================

/**
 * Check if input looks like HTML
 */
function looksLikeHtml(input: string): boolean {
  const trimmed = input.trim()
  return (
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html') ||
    (trimmed.startsWith('<') && trimmed.includes('>'))
  )
}

/**
 * Parse HTML using Export Template markers (data-entry-field attributes)
 * Returns extracted fields and whether markers were found
 */
function parseHtmlWithMarkers(doc: Document): { 
  fields: ParsedEntryFields; 
  hasMarkers: boolean;
  detected: string[];
} {
  const result: ParsedEntryFields = {}
  const detected: string[] = []
  let hasMarkers = false
  
  // Find all elements with data-entry-field attribute
  const markedElements = doc.querySelectorAll(`[${HTML_FIELD_ATTRIBUTE}]`)
  
  if (markedElements.length > 0) {
    hasMarkers = true
  }
  
  markedElements.forEach(el => {
    const fieldType = el.getAttribute(HTML_FIELD_ATTRIBUTE)
    if (!fieldType) return
    
    switch (fieldType) {
      case 'title':
        const titleText = el.textContent?.trim()
        if (titleText) {
          result.title = titleText
          detected.push('title')
        }
        break
        
      case 'excerpt':
        const excerptText = el.textContent?.trim()
        if (excerptText) {
          result.excerpt = excerptText
          detected.push('excerpt')
        }
        break
        
      case 'coverImage':
        const img = el.tagName === 'IMG' ? el : el.querySelector('img')
        if (img) {
          const src = img.getAttribute('src')
          const alt = img.getAttribute('alt')
          if (src) {
            result.coverImageUrl = src
            detected.push('coverImageUrl')
          }
          if (alt) {
            result.coverImageAlt = alt
            detected.push('coverImageAlt')
          }
        }
        break
        
      case 'content':
        // Get the inner HTML of the content marker, sanitized and converted to TipTap JSON
        const contentHtml = el.innerHTML?.trim()
        if (contentHtml) {
          const sanitized = sanitizeHtml(contentHtml)
          const conversionResult = normalizeImportedContent(sanitized)
          result.content = conversionResult.content
          detected.push('content')
        }
        break
        
      case 'meta':
        // Parse embedded JSON for status, journals, collections
        try {
          const metaText = el.textContent?.trim()
          if (metaText) {
            const metaData = JSON.parse(metaText)
            
            // Status
            if (metaData.status && typeof metaData.status === 'string') {
              const normalized = metaData.status.toLowerCase().trim() as EntryStatus
              if (VALID_STATUS_VALUES.includes(normalized)) {
                result.status = normalized
                detected.push('status')
              }
            }
            
            // Journals
            if (metaData.journals) {
              const journals = parseStringArray(metaData.journals)
              if (journals.length > 0) {
                result.journals = journals
                detected.push('journals')
              }
            }
            
            // Collections
            if (metaData.collections) {
              const collections = parseStringArray(metaData.collections)
              if (collections.length > 0) {
                result.collections = collections
                detected.push('collections')
              }
            }
          }
        } catch (e) {
          // Invalid JSON in meta - ignore silently
          console.warn('Failed to parse meta JSON in HTML:', e)
        }
        break
    }
  })
  
  return { fields: result, hasMarkers, detected }
}

/**
 * Parse HTML using heuristic fallback (first h1, first img, first p)
 * Used when Export Template markers are not present
 */
function parseHtmlWithHeuristics(doc: Document): {
  fields: ParsedEntryFields;
  detected: string[];
} {
  const result: ParsedEntryFields = {}
  const detected: string[] = []
  
  // Clone the document so we can remove elements without affecting the original
  const workDoc = doc.cloneNode(true) as Document
  
  // Extract title from first <h1>
  const h1 = workDoc.querySelector('h1')
  if (h1) {
    const titleText = h1.textContent?.trim()
    if (titleText) {
      result.title = titleText
      detected.push('title')
      h1.remove() // Remove from body so it doesn't appear in content
    }
  }
  
  // Extract cover image from first <img> (before removing for content)
  const firstImg = workDoc.querySelector('img')
  if (firstImg) {
    const src = firstImg.getAttribute('src')
    if (src && !src.startsWith('data:')) { // Skip inline data URIs as cover
      result.coverImageUrl = src
      detected.push('coverImageUrl')
      
      const alt = firstImg.getAttribute('alt')
      if (alt) {
        result.coverImageAlt = alt
        detected.push('coverImageAlt')
      }
      firstImg.remove() // Remove from body
    }
  }
  
  // Extract excerpt from first <p> (if short enough)
  const firstP = workDoc.querySelector('p')
  if (firstP) {
    const text = firstP.textContent?.trim()
    if (text && text.length > 0 && text.length < 300) {
      result.excerpt = text
      detected.push('excerpt')
      // Don't remove - it might also be part of the content
    }
  }
  
  // Remaining body becomes content - convert to TipTap JSON
  const bodyHtml = workDoc.body.innerHTML.trim()
  if (bodyHtml) {
    const sanitized = sanitizeHtml(bodyHtml)
    const conversionResult = normalizeImportedContent(sanitized)
    result.content = conversionResult.content
    detected.push('content')
  }
  
  return { fields: result, detected }
}

/**
 * Parse HTML content and extract fields
 * PRIORITY 1: Use Export Template markers (data-entry-field)
 * PRIORITY 2: Fall back to heuristics
 */
function parseHtmlToFields(
  html: string, 
  overwrite: boolean, 
  currentFields: ParsedEntryFields
): { fields: ParsedEntryFields; detected: string[]; skipped: string[] } {
  const detected: string[] = []
  const skipped: string[] = []
  
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    
    // First, try to parse with Export Template markers
    const markerResult = parseHtmlWithMarkers(doc)
    
    let extractedFields: ParsedEntryFields
    let extractedDetected: string[]
    
    if (markerResult.hasMarkers) {
      // Use marker-based extraction
      extractedFields = markerResult.fields
      extractedDetected = markerResult.detected
    } else {
      // Fall back to heuristics
      const heuristicResult = parseHtmlWithHeuristics(doc)
      extractedFields = heuristicResult.fields
      extractedDetected = heuristicResult.detected
    }
    
    // Apply overwrite logic
    const result: ParsedEntryFields = {}
    
    const shouldWrite = (fieldName: keyof ParsedEntryFields, newValue: any): boolean => {
      if (newValue === undefined || newValue === null || newValue === '') return false
      if (overwrite) return true
      const current = currentFields[fieldName]
      if (current === undefined || current === null) return true
      if (typeof current === 'string' && current.trim() === '') return true
      if (Array.isArray(current) && current.length === 0) return true
      return false
    }
    
    // Apply each extracted field with overwrite check
    for (const field of extractedDetected) {
      detected.push(field)
      const value = extractedFields[field as keyof ParsedEntryFields]
      
      if (shouldWrite(field as keyof ParsedEntryFields, value)) {
        (result as any)[field] = value
      } else {
        skipped.push(field)
      }
    }
    
    return { fields: result, detected, skipped }
  } catch (e) {
    console.error('HTML parsing error:', e)
    return { fields: {}, detected: [], skipped: [] }
  }
}

// ============================================================
// MAIN PARSE FUNCTION
// ============================================================

/**
 * Main parse function
 * Handles both JSON and HTML import with full Export Template compatibility
 */
export function parseImportContent(
  input: string,
  mode: ImportMode,
  overwrite: boolean,
  currentFields: ParsedEntryFields = {}
): ParseResult {
  const warnings: string[] = []
  
  if (!input || !input.trim()) {
    return {
      success: false,
      fields: {},
      detectedFormat: null,
      warnings: [],
      error: 'No content to import'
    }
  }
  
  const trimmedInput = input.trim()
  
  // Determine format based on mode
  let detectedFormat: 'json' | 'html' | null = null
  let fields: ParsedEntryFields = {}
  let detectedFields: string[] = []
  let skippedFields: string[] = []
  
  if (mode === 'json' || mode === 'auto') {
    const jsonResult = tryParseJson(trimmedInput)
    
    if (jsonResult.success) {
      detectedFormat = 'json'
      const mapResult = mapJsonToFields(jsonResult.data, overwrite, currentFields)
      fields = mapResult.fields
      detectedFields = mapResult.detected
      skippedFields = mapResult.skipped
      
      // Add warning about ignored meta keys
      const ignoredKeys = Object.keys(jsonResult.data).filter(isIgnoredJsonKey)
      if (ignoredKeys.length > 0) {
        warnings.push(`Ignored documentation keys: ${ignoredKeys.join(', ')}`)
      }
    } else if (mode === 'json') {
      // Explicitly JSON mode but parsing failed
      return {
        success: false,
        fields: {},
        detectedFormat: null,
        warnings: [],
        error: `JSON parsing failed: ${jsonResult.error}`
      }
    }
  }
  
  if ((mode === 'html' || mode === 'auto') && !detectedFormat) {
    if (mode === 'html' || looksLikeHtml(trimmedInput)) {
      detectedFormat = 'html'
      const htmlResult = parseHtmlToFields(trimmedInput, overwrite, currentFields)
      fields = htmlResult.fields
      detectedFields = htmlResult.detected
      skippedFields = htmlResult.skipped
    } else if (mode === 'auto') {
      // Auto mode but doesn't look like JSON or HTML
      return {
        success: false,
        fields: {},
        detectedFormat: null,
        warnings: [],
        error: 'Could not detect format. Input does not appear to be valid JSON or HTML.'
      }
    }
  }
  
  if (!detectedFormat) {
    return {
      success: false,
      fields: {},
      detectedFormat: null,
      warnings: [],
      error: 'Could not parse input in the specified format.'
    }
  }
  
  // Check if we actually extracted any fields
  const fieldCount = Object.keys(fields).filter(k => fields[k as keyof ParsedEntryFields] !== undefined).length
  
  if (fieldCount === 0 && detectedFields.length === 0) {
    warnings.push('No mappable fields were found in the input.')
  }
  
  // Add info about skipped fields
  if (skippedFields.length > 0) {
    warnings.push(`Skipped (overwrite off): ${skippedFields.join(', ')}`)
  }
  
  return {
    success: true,
    fields,
    detectedFormat,
    warnings,
    detectedFields,
    skippedFields
  }
}

// ============================================================
// SUMMARY HELPERS
// ============================================================

/**
 * Get a summary of detected fields for preview
 */
export function getFieldsSummary(fields: ParsedEntryFields): string[] {
  const summary: string[] = []
  
  if (fields.title) summary.push(`Title: "${fields.title.substring(0, 50)}${fields.title.length > 50 ? '...' : ''}"`)
  if (fields.excerpt) summary.push(`Excerpt: "${fields.excerpt.substring(0, 50)}${fields.excerpt.length > 50 ? '...' : ''}"`)
  if (fields.coverImageUrl) summary.push(`Cover Image: ${fields.coverImageUrl.substring(0, 40)}${fields.coverImageUrl.length > 40 ? '...' : ''}`)
  if (fields.coverImageAlt) summary.push(`Cover Alt: "${fields.coverImageAlt.substring(0, 30)}${fields.coverImageAlt.length > 30 ? '...' : ''}"`)
  if (fields.content) summary.push(`Content: ${fields.content.html ? 'HTML content' : 'JSON content'}`)
  if (fields.status) summary.push(`Status: ${fields.status}`)
  if (fields.journals && fields.journals.length > 0) {
    summary.push(`Journals: ${fields.journals.join(', ')}`)
  }
  if (fields.collections && fields.collections.length > 0) {
    summary.push(`Collections: ${fields.collections.join(', ')}`)
  }
  
  return summary
}

/**
 * Get a detailed preview showing which fields will be applied vs skipped
 */
export function getDetailedFieldsSummary(
  fields: ParsedEntryFields,
  detectedFields: string[] = [],
  skippedFields: string[] = []
): { applied: string[]; skipped: string[] } {
  const applied = getFieldsSummary(fields)
  const skipped = skippedFields.map(field => {
    switch (field) {
      case 'title': return 'Title (existing value kept)'
      case 'excerpt': return 'Excerpt (existing value kept)'
      case 'coverImageUrl': return 'Cover Image (existing value kept)'
      case 'coverImageAlt': return 'Cover Alt (existing value kept)'
      case 'content': return 'Content (existing value kept)'
      case 'status': return 'Status (existing value kept)'
      case 'journals': return 'Journals (existing value kept)'
      case 'collections': return 'Collections (existing value kept)'
      default: return `${field} (existing value kept)`
    }
  })
  
  return { applied, skipped }
}

// ============================================================
// MULTI-ENTRY PARSING (Phase 3)
// ============================================================

export interface MultiParseResult {
  success: boolean
  entries: ParsedEntryFields[]
  detectedFormat: 'json' | 'html' | null
  isMultiple: boolean
  warnings: string[]
  error?: string
}

/**
 * Split HTML content by entry delimiters
 * Supports:
 * - <article data-entry>...</article> blocks
 * - <!-- ENTRY_START --> ... <!-- ENTRY_END --> blocks
 */
function splitHtmlByEntryDelimiters(html: string): { segments: string[]; hasDelimiters: boolean } {
  // Try article[data-entry] first
  const articlePattern = /<article[^>]*data-entry[^>]*>([\s\S]*?)<\/article>/gi
  const articleMatches = [...html.matchAll(articlePattern)]
  
  if (articleMatches.length > 1) {
    return {
      segments: articleMatches.map(m => m[1] || m[0]),
      hasDelimiters: true
    }
  }
  
  // Try ENTRY_START/ENTRY_END comments
  const commentPattern = /<!--\s*ENTRY_START\s*-->([\s\S]*?)<!--\s*ENTRY_END\s*-->/gi
  const commentMatches = [...html.matchAll(commentPattern)]
  
  if (commentMatches.length > 1) {
    return {
      segments: commentMatches.map(m => m[1] || m[0]),
      hasDelimiters: true
    }
  }
  
  // No multi-entry delimiters found
  return { segments: [html], hasDelimiters: false }
}

/**
 * Extract array of entry objects from JSON data
 * Supports:
 * - Single object: { title: "..." }
 * - Array of objects: [{ title: "..." }, { title: "..." }]
 * - Wrapper object: { entries: [...] } or { items: [...] }
 * - Template wrapper: { __meta: {...}, entries: [...] }
 */
function extractJsonEntryArray(data: any): { items: any[]; isMultiple: boolean; isWrapper: boolean } {
  // Check if it's an array
  if (Array.isArray(data)) {
    return { items: data, isMultiple: data.length > 1, isWrapper: false }
  }
  
  // Not an object - can't extract
  if (!data || typeof data !== 'object') {
    return { items: [], isMultiple: false, isWrapper: false }
  }
  
  // Check if it has an entries wrapper (including template format with __meta)
  if (Array.isArray(data.entries)) {
    return { items: data.entries, isMultiple: data.entries.length > 1, isWrapper: true }
  }
  
  // Check for items wrapper (alternative)
  if (Array.isArray(data.items)) {
    return { items: data.items, isMultiple: data.items.length > 1, isWrapper: true }
  }
  
  // Check if this is a wrapper object that SHOULD have entries but doesn't
  // (e.g., { __meta: {...} } without entries array - malformed template)
  const hasMetaOnly = data.__meta && Object.keys(data).filter(k => k !== '__meta').length === 0
  if (hasMetaOnly) {
    console.warn('[importParser] Wrapper object detected with __meta but no entries array')
    return { items: [], isMultiple: false, isWrapper: true }
  }
  
  // Check if object has __meta alongside other keys (partial template format)
  if (data.__meta) {
    // Extract non-meta content as potential single entry
    const entryData = { ...data }
    delete entryData.__meta
    
    // If after removing __meta, we have recognizable entry keys, treat as single entry
    const hasEntryKeys = ['title', 'content', 'body', 'excerpt', 'coverImageUrl'].some(k => k in entryData)
    if (hasEntryKeys && Object.keys(entryData).length > 0) {
      return { items: [entryData], isMultiple: false, isWrapper: false }
    }
    
    // Object only had __meta and unrecognized keys
    return { items: [], isMultiple: false, isWrapper: true }
  }
  
  // Single object (no wrapper)
  return { items: [data], isMultiple: false, isWrapper: false }
}

/**
 * Parse content that may contain multiple entries
 * Returns an array of ParsedEntryFields, one per detected entry
 */
export function parseMultipleEntries(
  input: string,
  mode: ImportMode,
  overwrite: boolean = true  // Default to overwrite since these are new entries
): MultiParseResult {
  const warnings: string[] = []
  
  if (!input || !input.trim()) {
    return {
      success: false,
      entries: [],
      detectedFormat: null,
      isMultiple: false,
      warnings: [],
      error: 'No content to import'
    }
  }
  
  const trimmedInput = input.trim()
  let detectedFormat: 'json' | 'html' | null = null
  let entries: ParsedEntryFields[] = []
  let isMultiple = false
  
  // Try JSON first (if mode allows)
  if (mode === 'json' || mode === 'auto') {
    const jsonResult = tryParseJson(trimmedInput)
    
    if (jsonResult.success) {
      detectedFormat = 'json'
      const { items, isMultiple: jsonMultiple, isWrapper } = extractJsonEntryArray(jsonResult.data)
      isMultiple = jsonMultiple
      
      // Check for empty wrapper (malformed template)
      if (isWrapper && items.length === 0) {
        warnings.push('JSON wrapper detected but no entries array found. Expected { entries: [...] }')
      }
      
      // Parse each item
      for (const item of items) {
        if (item && typeof item === 'object') {
          const mapResult = mapJsonToFields(item, overwrite, {})
          if (Object.keys(mapResult.fields).length > 0) {
            entries.push(mapResult.fields)
          } else {
            // Log which item had no mappable fields
            const itemKeys = Object.keys(item).slice(0, 5).join(', ')
            console.warn(`[importParser] Entry skipped - no mappable fields found. Keys: ${itemKeys}`)
          }
          
          // Collect warnings for first item only (to avoid noise)
          if (entries.length === 1) {
            const ignoredKeys = Object.keys(item).filter(isIgnoredJsonKey)
            if (ignoredKeys.length > 0) {
              warnings.push(`Ignored documentation keys: ${ignoredKeys.join(', ')}`)
            }
          }
        }
      }
      
      if (entries.length === 0 && items.length > 0) {
        warnings.push(`Found ${items.length} items but none had recognizable entry fields (title, content, etc.)`)
      } else if (entries.length === 0) {
        warnings.push('No valid entries found in JSON')
      }
    } else if (mode === 'json') {
      return {
        success: false,
        entries: [],
        detectedFormat: null,
        isMultiple: false,
        warnings: [],
        error: `JSON parsing failed: ${jsonResult.error}`
      }
    }
  }
  
  // Try HTML if JSON didn't work
  if ((mode === 'html' || mode === 'auto') && !detectedFormat) {
    if (mode === 'html' || looksLikeHtml(trimmedInput)) {
      detectedFormat = 'html'
      
      // Check for multi-entry delimiters
      const { segments, hasDelimiters } = splitHtmlByEntryDelimiters(trimmedInput)
      isMultiple = hasDelimiters && segments.length > 1
      
      // Parse each segment
      for (const segment of segments) {
        const htmlResult = parseHtmlToFields(segment, overwrite, {})
        if (Object.keys(htmlResult.fields).length > 0) {
          entries.push(htmlResult.fields)
        }
      }
      
      if (entries.length === 0) {
        warnings.push('No valid entries found in HTML')
      }
    } else if (mode === 'auto') {
      return {
        success: false,
        entries: [],
        detectedFormat: null,
        isMultiple: false,
        warnings: [],
        error: 'Could not detect format. Input does not appear to be valid JSON or HTML.'
      }
    }
  }
  
  if (!detectedFormat) {
    return {
      success: false,
      entries: [],
      detectedFormat: null,
      isMultiple: false,
      warnings: [],
      error: 'Could not parse input in the specified format.'
    }
  }
  
  return {
    success: entries.length > 0,
    entries,
    detectedFormat,
    isMultiple,
    warnings,
    error: entries.length === 0 ? 'No mappable entries found' : undefined
  }
}
