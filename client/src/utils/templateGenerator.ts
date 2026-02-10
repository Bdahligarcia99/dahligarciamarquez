/**
 * Template Generator for Entry Editor
 * 
 * Generates exportable templates in JSON or HTML format that match
 * the Entry Editor's field structure. These templates are designed
 * to be fully compatible with the Import feature.
 * 
 * Phase 3.1 Update: Templates now include rich-content (TipTap JSON)
 * so imported entries can be saved without content_rich validation errors.
 * 
 * Uses shared field definitions from entryFieldDefinitions.ts
 * 
 * ============================================================
 * EXPORT TEMPLATE CONTRACT
 * ============================================================
 * 
 * JSON Template:
 * - Uses canonical field names from ENTRY_FIELD_DEFINITIONS
 * - Includes __meta section for documentation (ignored by import)
 * - content field uses { json: TipTapDoc, html: string } format
 * - Minimal valid TipTap document included as placeholder
 * 
 * HTML Template:
 * - Uses data-entry-field attributes for field markers
 * - Uses HTML comment markers for field boundaries
 * - Includes embedded JSON script for meta fields (status, journals, collections)
 * - HTML content will be converted to TipTap JSON on import
 * 
 * Multi-Entry Templates:
 * - JSON: Array format [...] or wrapper { entries: [...] }
 * - HTML: Multiple <article data-entry> blocks
 * 
 * ============================================================
 */

import {
  ENTRY_FIELD_DEFINITIONS,
  HTML_FIELD_ATTRIBUTE,
  VALID_STATUS_VALUES,
  getFieldDescriptionsFromDefinitions
} from './entryFieldDefinitions'
import { createMinimalTipTapDoc } from './tiptapConversion'

// ============================================================
// TYPES
// ============================================================

export type TemplateFormat = 'json' | 'json-multi' | 'html' | 'html-multi'

export interface TemplateOptions {
  format: TemplateFormat
  includeComments?: boolean
}

export interface TemplateResult {
  content: string
  format: TemplateFormat
}

// ============================================================
// MINIMAL TIPTAP DOC FOR TEMPLATES
// ============================================================

/**
 * Create a placeholder TipTap document with sample content.
 * This ensures imported templates have valid content_rich for saving.
 */
function createPlaceholderTipTapDoc(): any {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Your entry content goes here. This section supports rich formatting.' }
        ]
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'You can include paragraphs, headings, lists, links, and images.' }
        ]
      }
    ]
  }
}

/**
 * Create an empty TipTap document (single empty paragraph).
 */
function createEmptyTipTapDoc(): any {
  return createMinimalTipTapDoc('')
}

// ============================================================
// JSON TEMPLATES
// ============================================================

/**
 * JSON Template Structure (Phase 3.1 compatible)
 * 
 * The content field uses PostEditor's internal representation:
 * { json: TipTapDoc, html: string }
 * 
 * This ensures:
 * - Import recognizes the structure
 * - content_rich is populated for API save
 * - Backward compatible (old HTML-string templates still work via conversion)
 */
interface JsonTemplateEntry {
  title: string
  excerpt: string
  coverImageUrl: string
  coverImageAlt: string
  // Phase 3.1: Rich content as object with TipTap JSON
  content: {
    json: any      // TipTap document
    html: string   // HTML representation
  }
  status: 'draft' | 'published' | 'archived'
  journals: string[]
  collections: string[]
}

interface JsonTemplateSingle extends JsonTemplateEntry {
  __meta: {
    description: string
    version: string
    generatedAt: string
    richContentNote: string
    fields: {
      [key: string]: {
        type: string
        required: boolean
        description: string
      }
    }
  }
}

interface JsonTemplateMulti {
  __meta: {
    description: string
    version: string
    generatedAt: string
    richContentNote: string
    entryCount: number
  }
  entries: JsonTemplateEntry[]
}

/**
 * Generate a single-entry JSON template
 */
function generateJsonTemplate(): string {
  const placeholderDoc = createPlaceholderTipTapDoc()
  const placeholderHtml = '<p>Your entry content goes here. This section supports rich formatting.</p><p>You can include paragraphs, headings, lists, links, and images.</p>'
  
  const template: JsonTemplateSingle = {
    __meta: {
      description: 'Entry template for dahligarciamarquez. The __meta section is ignored during import.',
      version: '2.0.0',
      generatedAt: new Date().toISOString(),
      richContentNote: 'The content field includes TipTap JSON (content.json) for rich editing. HTML-only content will be auto-converted on import.',
      fields: {
        title: { type: 'string', required: true, description: 'Entry title' },
        excerpt: { type: 'string', required: false, description: 'Brief summary or description' },
        coverImageUrl: { type: 'string', required: false, description: 'URL to cover image' },
        coverImageAlt: { type: 'string', required: false, description: 'Alt text for cover image (required if cover exists)' },
        content: { type: 'object { json, html }', required: true, description: 'Entry body as TipTap JSON + HTML. HTML-only strings also accepted.' },
        status: { type: 'enum', required: false, description: 'Publication status: draft, published, or archived' },
        journals: { type: 'string[]', required: false, description: 'Journal names (new ones will be auto-created)' },
        collections: { type: 'string[]', required: false, description: 'Collection names (new ones will be auto-created)' }
      }
    },
    title: 'Your Entry Title',
    excerpt: 'A brief summary or description of your entry.',
    coverImageUrl: 'https://example.com/your-cover-image.jpg',
    coverImageAlt: 'Description of the cover image',
    content: {
      json: placeholderDoc,
      html: placeholderHtml
    },
    status: 'draft',
    journals: ['Example Journal'],
    collections: ['Example Collection']
  }

  return JSON.stringify(template, null, 2)
}

/**
 * Generate a multi-entry JSON template
 */
function generateJsonMultiTemplate(): string {
  const placeholderDoc1 = {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Content for the first entry.' }] }
    ]
  }
  const placeholderDoc2 = {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Content for the second entry.' }] }
    ]
  }
  
  const template: JsonTemplateMulti = {
    __meta: {
      description: 'Multi-entry template for batch import. The __meta section is ignored during import.',
      version: '2.0.0',
      generatedAt: new Date().toISOString(),
      richContentNote: 'Each entry includes TipTap JSON for rich content. HTML-only strings also accepted.',
      entryCount: 2
    },
    entries: [
      {
        title: 'First Entry Title',
        excerpt: 'Summary of the first entry.',
        coverImageUrl: '',
        coverImageAlt: '',
        content: {
          json: placeholderDoc1,
          html: '<p>Content for the first entry.</p>'
        },
        status: 'draft',
        journals: [],
        collections: []
      },
      {
        title: 'Second Entry Title',
        excerpt: 'Summary of the second entry.',
        coverImageUrl: '',
        coverImageAlt: '',
        content: {
          json: placeholderDoc2,
          html: '<p>Content for the second entry.</p>'
        },
        status: 'draft',
        journals: [],
        collections: []
      }
    ]
  }

  return JSON.stringify(template, null, 2)
}

// ============================================================
// HTML TEMPLATES
// ============================================================

/**
 * Generate a single-entry HTML template
 * 
 * Uses data attributes to mark fields for machine detection.
 * HTML content will be converted to TipTap JSON on import.
 */
function generateHtmlTemplate(): string {
  const lines = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="UTF-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '  <!-- Entry Template for dahligarciamarquez -->',
    '  <!-- Fields are marked with data-entry-field attributes for import -->',
    '  <!-- HTML content will be auto-converted to rich format on import -->',
    '  <title>Entry Template</title>',
    '</head>',
    '<body>',
    '',
    '<article data-entry>',
    '',
    '  <!-- ENTRY_FIELD:title -->',
    '  <h1 data-entry-field="title">Your Entry Title Here</h1>',
    '  <!-- /ENTRY_FIELD:title -->',
    '',
    '  <!-- ENTRY_FIELD:coverImage -->',
    '  <figure data-entry-field="coverImage">',
    '    <img src="https://example.com/your-cover-image.jpg" alt="Cover image description" />',
    '  </figure>',
    '  <!-- /ENTRY_FIELD:coverImage -->',
    '',
    '  <!-- ENTRY_FIELD:excerpt -->',
    '  <p data-entry-field="excerpt"><em>A brief summary or description of your entry.</em></p>',
    '  <!-- /ENTRY_FIELD:excerpt -->',
    '',
    '  <!-- ENTRY_FIELD:content -->',
    '  <div data-entry-field="content">',
    '    <p>Your entry content goes here. This section supports rich HTML formatting.</p>',
    '    <p>You can include:</p>',
    '    <ul>',
    '      <li>Paragraphs and headings</li>',
    '      <li>Lists (ordered and unordered)</li>',
    '      <li>Links and images</li>',
    '      <li>Blockquotes and code blocks</li>',
    '    </ul>',
    '    <p>This HTML will be converted to TipTap rich content on import.</p>',
    '  </div>',
    '  <!-- /ENTRY_FIELD:content -->',
    '',
    '  <!-- ENTRY_FIELD:meta (optional, for JSON metadata) -->',
    '  <script type="application/json" data-entry-field="meta">',
    '  {',
    '    "status": "draft",',
    '    "journals": ["Example Journal"],',
    '    "collections": ["Example Collection"]',
    '  }',
    '  </script>',
    '  <!-- /ENTRY_FIELD:meta -->',
    '',
    '</article>',
    '',
    '</body>',
    '</html>'
  ]

  return lines.join('\n')
}

/**
 * Generate a multi-entry HTML template
 * 
 * Uses <article data-entry> blocks as delimiters for multi-entry import.
 */
function generateHtmlMultiTemplate(): string {
  const lines = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="UTF-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '  <!-- Multi-Entry Template for dahligarciamarquez -->',
    '  <!-- Each <article data-entry> block is imported as a separate entry -->',
    '  <title>Multi-Entry Template</title>',
    '</head>',
    '<body>',
    '',
    '<!-- ============================================================ -->',
    '<!-- ENTRY 1 -->',
    '<!-- ============================================================ -->',
    '<article data-entry>',
    '',
    '  <h1 data-entry-field="title">First Entry Title</h1>',
    '',
    '  <p data-entry-field="excerpt">Summary of the first entry.</p>',
    '',
    '  <div data-entry-field="content">',
    '    <p>Content for the first entry.</p>',
    '    <p>Add your rich HTML content here.</p>',
    '  </div>',
    '',
    '  <script type="application/json" data-entry-field="meta">',
    '  { "status": "draft", "journals": [], "collections": [] }',
    '  </script>',
    '',
    '</article>',
    '',
    '<!-- ============================================================ -->',
    '<!-- ENTRY 2 -->',
    '<!-- ============================================================ -->',
    '<article data-entry>',
    '',
    '  <h1 data-entry-field="title">Second Entry Title</h1>',
    '',
    '  <figure data-entry-field="coverImage">',
    '    <img src="https://example.com/cover-2.jpg" alt="Cover for second entry" />',
    '  </figure>',
    '',
    '  <p data-entry-field="excerpt">Summary of the second entry.</p>',
    '',
    '  <div data-entry-field="content">',
    '    <p>Content for the second entry.</p>',
    '    <p>This can have different formatting and structure.</p>',
    '  </div>',
    '',
    '  <script type="application/json" data-entry-field="meta">',
    '  { "status": "draft", "journals": [], "collections": [] }',
    '  </script>',
    '',
    '</article>',
    '',
    '<!-- Add more <article data-entry> blocks for additional entries -->',
    '',
    '</body>',
    '</html>'
  ]

  return lines.join('\n')
}

// ============================================================
// MAIN EXPORT FUNCTION
// ============================================================

/**
 * Generate a template in the specified format
 * 
 * @param format - 'json', 'json-multi', 'html', or 'html-multi'
 * @returns Template content as a string
 */
export function generateTemplate(format: TemplateFormat): TemplateResult {
  try {
    let content: string

    switch (format) {
      case 'json':
        content = generateJsonTemplate()
        break
      case 'json-multi':
        content = generateJsonMultiTemplate()
        break
      case 'html':
        content = generateHtmlTemplate()
        break
      case 'html-multi':
        content = generateHtmlMultiTemplate()
        break
      default:
        // Fallback to JSON if unknown format
        content = generateJsonTemplate()
    }

    return { content, format }
  } catch (error) {
    // Never throw - return a safe fallback
    console.error('Template generation error:', error)
    return {
      content: format.includes('json') 
        ? '{\n  "title": "",\n  "content": { "json": { "type": "doc", "content": [] }, "html": "" }\n}'
        : '<article data-entry><h1>Entry Title</h1><p>Content goes here.</p></article>',
      format
    }
  }
}

/**
 * Get a list of all supported fields with their descriptions
 * Uses shared definitions from entryFieldDefinitions.ts
 */
export function getFieldDescriptions(): Array<{
  field: string
  type: string
  required: boolean
  description: string
}> {
  return getFieldDescriptionsFromDefinitions()
}

/**
 * Get format descriptions for UI display
 */
export function getFormatDescriptions(): Array<{
  format: TemplateFormat
  label: string
  description: string
}> {
  return [
    {
      format: 'json',
      label: 'JSON (Single)',
      description: 'Single entry with full TipTap rich content'
    },
    {
      format: 'json-multi',
      label: 'JSON (Multi)',
      description: 'Multiple entries in { entries: [...] } wrapper'
    },
    {
      format: 'html',
      label: 'HTML (Single)',
      description: 'Single entry with data-entry-field markers'
    },
    {
      format: 'html-multi',
      label: 'HTML (Multi)',
      description: 'Multiple <article data-entry> blocks'
    }
  ]
}
