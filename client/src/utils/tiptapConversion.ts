/**
 * TipTap Content Conversion Utilities
 * 
 * Provides utilities for converting between HTML and TipTap JSON format.
 * Used by import features to ensure content_rich (TipTap JSON) is always populated.
 * 
 * Uses a headless TipTap editor instance with the same extensions as RichTextEditor
 * to ensure schema compatibility.
 */

import { Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'

// ============================================================
// TYPES
// ============================================================

export interface TipTapContent {
  json: any  // TipTap JSON document
  html: string
}

export interface ConversionResult {
  content: TipTapContent
  success: boolean
  warning?: string
}

// ============================================================
// TIPTAP SCHEMA (matches RichTextEditor.tsx)
// ============================================================

/**
 * Create TipTap extensions matching the main editor schema.
 * Keep this in sync with RichTextEditor.tsx extensions.
 */
function createEditorExtensions() {
  return [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3]
      }
    }),
    Image.configure({
      inline: false,
      allowBase64: true
    }),
    Link.configure({
      openOnClick: false
    }),
    TextAlign.configure({
      types: ['heading', 'paragraph']
    }),
    Underline
  ]
}

// ============================================================
// MINIMAL TIPTAP DOCUMENT CREATION
// ============================================================

/**
 * Create a minimal valid TipTap document with given text content.
 * Used as fallback when conversion fails.
 */
export function createMinimalTipTapDoc(text: string = ''): any {
  if (!text.trim()) {
    // Empty document with single empty paragraph
    return {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: []
        }
      ]
    }
  }
  
  // Split text into paragraphs
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim())
  
  if (paragraphs.length === 0) {
    return {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: text.trim() }]
        }
      ]
    }
  }
  
  return {
    type: 'doc',
    content: paragraphs.map(p => ({
      type: 'paragraph',
      content: [{ type: 'text', text: p.trim() }]
    }))
  }
}

/**
 * Extract plain text from HTML (for fallback scenarios)
 */
function extractPlainText(html: string): string {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    return doc.body.textContent || ''
  } catch {
    // If parsing fails, strip tags manually
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  }
}

// ============================================================
// HTML TO TIPTAP JSON CONVERSION
// ============================================================

/**
 * Convert HTML string to TipTap JSON document using a headless editor.
 * This ensures the output matches the editor's schema.
 */
export function htmlToTipTapJson(html: string): ConversionResult {
  if (!html || !html.trim()) {
    return {
      content: {
        json: createMinimalTipTapDoc(''),
        html: ''
      },
      success: true
    }
  }
  
  try {
    // Create a headless TipTap editor
    const editor = new Editor({
      extensions: createEditorExtensions(),
      content: html,
      // Don't render to DOM
      element: undefined as any
    })
    
    // Get the JSON representation
    const json = editor.getJSON()
    // Get the normalized HTML (may differ from input)
    const normalizedHtml = editor.getHTML()
    
    // Destroy the editor to clean up
    editor.destroy()
    
    // Validate the JSON has content
    if (!json || !json.content || json.content.length === 0) {
      // Editor produced empty content - use fallback
      const plainText = extractPlainText(html)
      return {
        content: {
          json: createMinimalTipTapDoc(plainText),
          html: plainText ? `<p>${plainText}</p>` : ''
        },
        success: true,
        warning: 'Content was simplified during conversion'
      }
    }
    
    return {
      content: {
        json,
        html: normalizedHtml
      },
      success: true
    }
  } catch (error) {
    console.error('HTML to TipTap conversion failed:', error)
    
    // Fallback: create minimal doc from plain text
    const plainText = extractPlainText(html)
    return {
      content: {
        json: createMinimalTipTapDoc(plainText),
        html: plainText ? `<p>${plainText}</p>` : ''
      },
      success: false,
      warning: 'Conversion failed, content simplified to plain text'
    }
  }
}

// ============================================================
// TIPTAP JSON VALIDATION
// ============================================================

/**
 * Check if a value looks like a valid TipTap JSON document.
 */
export function isValidTipTapJson(json: any): boolean {
  if (!json || typeof json !== 'object') {
    return false
  }
  
  // TipTap docs have type: 'doc' and content array
  if (json.type !== 'doc') {
    return false
  }
  
  if (!Array.isArray(json.content)) {
    return false
  }
  
  return true
}

/**
 * Validate and normalize TipTap JSON.
 * Returns the JSON if valid, or creates a minimal doc if invalid.
 */
export function validateAndNormalizeTipTapJson(json: any): { json: any; wasValid: boolean } {
  if (isValidTipTapJson(json)) {
    return { json, wasValid: true }
  }
  
  // If it's a content array without the doc wrapper, wrap it
  if (Array.isArray(json) && json.length > 0) {
    return {
      json: { type: 'doc', content: json },
      wasValid: false
    }
  }
  
  // Invalid - create minimal doc
  return {
    json: createMinimalTipTapDoc(''),
    wasValid: false
  }
}

// ============================================================
// CONTENT NORMALIZATION
// ============================================================

/**
 * Normalize imported content to ensure both json and html are populated.
 * This is the main entry point for import content processing.
 * 
 * Input can be:
 * - { json, html } - both provided
 * - { json } - only TipTap JSON
 * - { html } - only HTML string
 * - string - treated as HTML
 * - null/undefined - creates empty content
 * 
 * Output is always: { json: ValidTipTapDoc, html: string }
 */
export function normalizeImportedContent(content: any): ConversionResult {
  // Null/undefined - empty content
  if (content === null || content === undefined) {
    return {
      content: {
        json: createMinimalTipTapDoc(''),
        html: ''
      },
      success: true
    }
  }
  
  // String - treat as HTML
  if (typeof content === 'string') {
    return htmlToTipTapJson(content)
  }
  
  // Object with both json and html
  if (typeof content === 'object') {
    const hasJson = content.json !== undefined && content.json !== null
    const hasHtml = typeof content.html === 'string' && content.html.trim()
    
    if (hasJson) {
      // Validate and use provided JSON
      const { json, wasValid } = validateAndNormalizeTipTapJson(content.json)
      
      // Generate HTML from JSON if not provided
      let html = content.html || ''
      if (!html && wasValid) {
        try {
          const editor = new Editor({
            extensions: createEditorExtensions(),
            content: json,
            element: undefined as any
          })
          html = editor.getHTML()
          editor.destroy()
        } catch (e) {
          console.warn('Failed to generate HTML from JSON:', e)
        }
      }
      
      return {
        content: { json, html },
        success: true,
        warning: wasValid ? undefined : 'TipTap JSON was normalized'
      }
    }
    
    if (hasHtml) {
      // Only HTML provided - convert to JSON
      return htmlToTipTapJson(content.html)
    }
    
    // Object but no usable content
    return {
      content: {
        json: createMinimalTipTapDoc(''),
        html: ''
      },
      success: true,
      warning: 'No content found in import'
    }
  }
  
  // Unknown type - empty content
  return {
    content: {
      json: createMinimalTipTapDoc(''),
      html: ''
    },
    success: false,
    warning: 'Unknown content format'
  }
}

// ============================================================
// CONTENT VALIDATION FOR SAVE
// ============================================================

/**
 * Check if content is valid for saving (has required rich content).
 */
export function isContentValidForSave(content: TipTapContent | null | undefined): {
  valid: boolean
  error?: string
} {
  if (!content) {
    return { valid: false, error: 'Content is required' }
  }
  
  if (!content.json) {
    return { valid: false, error: 'Rich content (TipTap JSON) is required' }
  }
  
  if (!isValidTipTapJson(content.json)) {
    return { valid: false, error: 'Invalid rich content format' }
  }
  
  return { valid: true }
}
