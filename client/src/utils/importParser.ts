// Import Parser Utility for Entry Editor
// Parses JSON or HTML content and maps to Entry Editor fields
// Only populates fields that actually exist in the editor

export type ImportMode = 'auto' | 'json' | 'html'

export interface ParsedEntryFields {
  title?: string
  excerpt?: string
  coverImageUrl?: string
  coverImageAlt?: string
  content?: { json: any; html: string }
  status?: 'draft' | 'published' | 'archived'
}

export interface ParseResult {
  success: boolean
  fields: ParsedEntryFields
  detectedFormat: 'json' | 'html' | null
  warnings: string[]
  error?: string
}

// Simple HTML sanitizer - strips dangerous elements and attributes
// Removes: scripts, iframes, inline event handlers, dangerous URLs
function sanitizeHtml(html: string): string {
  // Create a temporary DOM element to parse the HTML
  const doc = new DOMParser().parseFromString(html, 'text/html')
  
  // Remove dangerous elements
  const dangerousElements = doc.querySelectorAll('script, iframe, object, embed, form')
  dangerousElements.forEach(el => el.remove())
  
  // Remove event handlers and dangerous attributes from all elements
  const allElements = doc.querySelectorAll('*')
  allElements.forEach(el => {
    // Remove event handlers (onclick, onerror, onload, etc.)
    const attrs = Array.from(el.attributes)
    attrs.forEach(attr => {
      if (attr.name.startsWith('on') || 
          attr.name === 'formaction' ||
          (attr.name === 'href' && attr.value.toLowerCase().startsWith('javascript:')) ||
          (attr.name === 'src' && attr.value.toLowerCase().startsWith('javascript:'))) {
        el.removeAttribute(attr.name)
      }
    })
  })
  
  return doc.body.innerHTML
}

// Extract plain text from HTML (for fallback scenarios)
function htmlToPlainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return doc.body.textContent || ''
}

// Attempt to parse input as JSON
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

// Check if input looks like HTML
function looksLikeHtml(input: string): boolean {
  const trimmed = input.trim()
  // Check for common HTML patterns
  return (
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<') && trimmed.includes('>')
  )
}

// Map JSON data to entry fields
// Only maps keys that correspond to actual editor fields
function mapJsonToFields(data: any, overwrite: boolean, currentFields: ParsedEntryFields): ParsedEntryFields {
  const result: ParsedEntryFields = {}
  const warnings: string[] = []
  
  // Helper to check if we should write to a field
  const shouldWrite = (fieldName: keyof ParsedEntryFields, newValue: any): boolean => {
    if (newValue === undefined || newValue === null || newValue === '') return false
    if (overwrite) return true
    // Only write if current field is empty
    const current = currentFields[fieldName]
    return !current || (typeof current === 'string' && current.trim() === '')
  }
  
  // Map title (accept: title, name, heading)
  const titleValue = data.title || data.name || data.heading
  if (shouldWrite('title', titleValue) && typeof titleValue === 'string') {
    result.title = titleValue.trim()
  }
  
  // Map excerpt (accept: excerpt, summary, description, subtitle)
  const excerptValue = data.excerpt || data.summary || data.description || data.subtitle
  if (shouldWrite('excerpt', excerptValue) && typeof excerptValue === 'string') {
    result.excerpt = excerptValue.trim()
  }
  
  // Map cover image (accept: coverImageUrl, cover_image_url, coverImage, cover, image, thumbnail)
  const coverValue = data.coverImageUrl || data.cover_image_url || data.coverImage || 
                     data.cover || data.image || data.thumbnail || data.featured_image
  if (shouldWrite('coverImageUrl', coverValue)) {
    if (typeof coverValue === 'string') {
      result.coverImageUrl = coverValue.trim()
    } else if (typeof coverValue === 'object' && coverValue.url) {
      result.coverImageUrl = coverValue.url
      // Also try to get alt text from nested object
      if (coverValue.alt && !currentFields.coverImageAlt) {
        result.coverImageAlt = coverValue.alt
      }
    }
  }
  
  // Map cover image alt (accept: coverImageAlt, cover_image_alt, coverAlt, imageAlt)
  const coverAltValue = data.coverImageAlt || data.cover_image_alt || data.coverAlt || data.imageAlt
  if (shouldWrite('coverImageAlt', coverAltValue) && typeof coverAltValue === 'string') {
    result.coverImageAlt = coverAltValue.trim()
  }
  
  // Map content/body (accept: content, body, html, text, content_html, content_rich)
  const contentValue = data.content || data.body || data.html || data.text || 
                       data.content_html || data.content_rich || data.markdown
  if (shouldWrite('content', contentValue)) {
    if (typeof contentValue === 'string') {
      // Treat string content as HTML (sanitize it)
      const sanitized = sanitizeHtml(contentValue)
      result.content = { json: null, html: sanitized }
    } else if (typeof contentValue === 'object') {
      // Could be TipTap JSON format or a complex object
      if (contentValue.type === 'doc' || contentValue.content) {
        // Looks like TipTap JSON format
        result.content = { json: contentValue, html: '' }
      } else if (contentValue.html) {
        // Object with html property
        result.content = { json: contentValue.json || null, html: sanitizeHtml(contentValue.html) }
      }
    }
  }
  
  // Map status (accept: status, state, published)
  const statusValue = data.status || data.state
  if (statusValue && typeof statusValue === 'string') {
    const normalized = statusValue.toLowerCase().trim()
    if (['draft', 'published', 'archived'].includes(normalized)) {
      if (shouldWrite('status', normalized)) {
        result.status = normalized as 'draft' | 'published' | 'archived'
      }
    }
  }
  // Also check for boolean published flag
  if (data.published === true && shouldWrite('status', 'published')) {
    result.status = 'published'
  } else if (data.published === false && shouldWrite('status', 'draft')) {
    result.status = 'draft'
  }
  
  return result
}

// Parse HTML content and extract fields
function parseHtmlToFields(html: string, overwrite: boolean, currentFields: ParsedEntryFields): ParsedEntryFields {
  const result: ParsedEntryFields = {}
  const doc = new DOMParser().parseFromString(html, 'text/html')
  
  // Helper to check if we should write to a field
  const shouldWrite = (fieldName: keyof ParsedEntryFields, newValue: any): boolean => {
    if (newValue === undefined || newValue === null || newValue === '') return false
    if (overwrite) return true
    const current = currentFields[fieldName]
    return !current || (typeof current === 'string' && current.trim() === '')
  }
  
  // Extract title from first <h1>
  const h1 = doc.querySelector('h1')
  if (h1 && shouldWrite('title', h1.textContent)) {
    result.title = h1.textContent?.trim() || ''
    h1.remove() // Remove from body so it doesn't appear in content
  }
  
  // Extract cover image from first <img> (if it's near the top, before main content)
  const firstImg = doc.querySelector('img')
  if (firstImg && shouldWrite('coverImageUrl', firstImg.src)) {
    const src = firstImg.getAttribute('src')
    if (src) {
      result.coverImageUrl = src
      // Get alt text too
      const alt = firstImg.getAttribute('alt')
      if (alt && shouldWrite('coverImageAlt', alt)) {
        result.coverImageAlt = alt
      }
      firstImg.remove() // Remove from body
    }
  }
  
  // Extract excerpt from first <p> (if short enough to be an excerpt)
  const firstP = doc.querySelector('p')
  if (firstP && shouldWrite('excerpt', firstP.textContent)) {
    const text = firstP.textContent?.trim() || ''
    // Only use as excerpt if it's reasonably short (under 300 chars)
    if (text.length > 0 && text.length < 300) {
      result.excerpt = text
      // Don't remove - it might also be part of the content
    }
  }
  
  // Remaining body becomes content
  const bodyHtml = doc.body.innerHTML.trim()
  if (bodyHtml && shouldWrite('content', bodyHtml)) {
    result.content = { json: null, html: sanitizeHtml(bodyHtml) }
  }
  
  return result
}

// Main parse function
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
  
  if (mode === 'json' || mode === 'auto') {
    const jsonResult = tryParseJson(trimmedInput)
    
    if (jsonResult.success) {
      detectedFormat = 'json'
      fields = mapJsonToFields(jsonResult.data, overwrite, currentFields)
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
      fields = parseHtmlToFields(trimmedInput, overwrite, currentFields)
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
  
  if (fieldCount === 0) {
    warnings.push('No mappable fields were found in the input.')
  }
  
  return {
    success: true,
    fields,
    detectedFormat,
    warnings
  }
}

// Get a summary of detected fields for preview
export function getFieldsSummary(fields: ParsedEntryFields): string[] {
  const summary: string[] = []
  
  if (fields.title) summary.push(`Title: "${fields.title.substring(0, 50)}${fields.title.length > 50 ? '...' : ''}"`)
  if (fields.excerpt) summary.push(`Excerpt: "${fields.excerpt.substring(0, 50)}${fields.excerpt.length > 50 ? '...' : ''}"`)
  if (fields.coverImageUrl) summary.push(`Cover Image: ${fields.coverImageUrl.substring(0, 40)}...`)
  if (fields.coverImageAlt) summary.push(`Cover Alt: "${fields.coverImageAlt}"`)
  if (fields.content) summary.push(`Content: ${fields.content.html ? 'HTML content' : 'JSON content'}`)
  if (fields.status) summary.push(`Status: ${fields.status}`)
  
  return summary
}
