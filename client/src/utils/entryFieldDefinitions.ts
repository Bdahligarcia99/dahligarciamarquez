/**
 * Shared Entry Field Definitions
 * 
 * Single source of truth for Entry Editor field names, types, and mapping rules.
 * Used by both Import and Export Template features.
 * 
 * ============================================================
 * ENTRY EDITOR FIELDS
 * ============================================================
 */

/**
 * Valid status values for entries
 */
export const VALID_STATUS_VALUES = ['draft', 'published', 'archived'] as const
export type EntryStatus = typeof VALID_STATUS_VALUES[number]

/**
 * Field definitions with types and requirements
 */
export interface FieldDefinition {
  field: string
  type: 'string' | 'string[]' | 'enum' | 'object' | 'html'
  required: boolean
  description: string
  jsonKeys: string[]        // All JSON keys that map to this field
  htmlMarker?: string       // data-entry-field attribute value
}

/**
 * Complete field definitions for the Entry Editor
 * Each entry includes:
 * - field: internal field name
 * - type: field type
 * - required: whether field is required
 * - jsonKeys: all JSON keys that should map to this field (first is canonical)
 * - htmlMarker: the data-entry-field attribute value used in HTML templates
 */
export const ENTRY_FIELD_DEFINITIONS: FieldDefinition[] = [
  {
    field: 'title',
    type: 'string',
    required: true,
    description: 'Entry title',
    jsonKeys: ['title', 'name', 'heading'],
    htmlMarker: 'title'
  },
  {
    field: 'excerpt',
    type: 'string',
    required: false,
    description: 'Brief summary or description',
    jsonKeys: ['excerpt', 'summary', 'description', 'subtitle'],
    htmlMarker: 'excerpt'
  },
  {
    field: 'coverImageUrl',
    type: 'string',
    required: false,
    description: 'URL to cover image',
    jsonKeys: ['coverImageUrl', 'cover_image_url', 'coverImage', 'cover', 'image', 'thumbnail', 'featured_image'],
    htmlMarker: 'coverImage'
  },
  {
    field: 'coverImageAlt',
    type: 'string',
    required: false,
    description: 'Alt text for cover image',
    jsonKeys: ['coverImageAlt', 'cover_image_alt', 'coverAlt', 'imageAlt'],
    htmlMarker: 'coverImage' // Alt is extracted from the img element within coverImage marker
  },
  {
    field: 'content',
    type: 'html',
    required: false,
    description: 'Entry body content as HTML',
    jsonKeys: ['content', 'body', 'html', 'text', 'content_html', 'content_rich', 'markdown'],
    htmlMarker: 'content'
  },
  {
    field: 'status',
    type: 'enum',
    required: false,
    description: 'Publication status: draft | published | archived',
    jsonKeys: ['status', 'state'],
    htmlMarker: 'meta' // Status is in the JSON meta script
  },
  {
    field: 'journals',
    type: 'string[]',
    required: false,
    description: 'Journal names for organization',
    jsonKeys: ['journals', 'journal', 'categories', 'category'],
    htmlMarker: 'meta' // Journals are in the JSON meta script
  },
  {
    field: 'collections',
    type: 'string[]',
    required: false,
    description: 'Collection names for organization',
    jsonKeys: ['collections', 'collection', 'tags', 'labels', 'label'],
    htmlMarker: 'meta' // Collections are in the JSON meta script
  }
]

/**
 * JSON keys that should be ignored during import
 * (meta/documentation keys from Export Template)
 */
export const IGNORED_JSON_KEYS = ['__meta', '__notes', '__template', '_meta', '_notes']

/**
 * HTML data attribute name for field markers
 */
export const HTML_FIELD_ATTRIBUTE = 'data-entry-field'

/**
 * HTML comment marker pattern for field boundaries
 * Format: <!-- ENTRY_FIELD:fieldName --> ... <!-- /ENTRY_FIELD:fieldName -->
 */
export const HTML_COMMENT_MARKER_START = 'ENTRY_FIELD:'
export const HTML_COMMENT_MARKER_END = '/ENTRY_FIELD:'

/**
 * Get all JSON keys that map to a specific field
 */
export function getJsonKeysForField(fieldName: string): string[] {
  const def = ENTRY_FIELD_DEFINITIONS.find(d => d.field === fieldName)
  return def?.jsonKeys || []
}

/**
 * Get the HTML marker for a specific field
 */
export function getHtmlMarkerForField(fieldName: string): string | undefined {
  const def = ENTRY_FIELD_DEFINITIONS.find(d => d.field === fieldName)
  return def?.htmlMarker
}

/**
 * Check if a JSON key should be ignored
 */
export function isIgnoredJsonKey(key: string): boolean {
  return IGNORED_JSON_KEYS.includes(key)
}

/**
 * Get field descriptions for UI display
 */
export function getFieldDescriptionsFromDefinitions(): Array<{
  field: string
  type: string
  required: boolean
  description: string
}> {
  return ENTRY_FIELD_DEFINITIONS.map(def => ({
    field: def.field,
    type: def.type === 'string[]' ? 'string[]' : def.type,
    required: def.required,
    description: def.description
  }))
}
