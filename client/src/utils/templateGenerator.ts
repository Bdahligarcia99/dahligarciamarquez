/**
 * Template Generator for Entry Editor
 * 
 * Generates exportable templates in JSON or HTML format that match
 * the Entry Editor's field structure. These templates are designed
 * to be compatible with the Import feature.
 * 
 * ============================================================
 * ENTRY EDITOR FIELDS (discovered from PostEditor.tsx):
 * ============================================================
 * 
 * CORE FIELDS:
 * - title (string, required) - Entry title
 * - excerpt (string, optional) - Brief description/summary
 * - coverImageUrl (string, optional) - URL to cover image
 * - coverImageAlt (string, required if cover exists) - Alt text for accessibility
 * - content (object: { json: any; html: string }) - Rich text content
 *   - The editor stores both JSON (TipTap/ProseMirror) and HTML representations
 *   - For templates, we use the HTML representation as it's more portable
 * - status (enum: 'draft' | 'published' | 'archived') - Publication status
 * 
 * ORGANIZATION FIELDS:
 * - journals (string array) - Journal names for categorization
 * - collections (string array) - Collection names for grouping
 *   - Import supports: journals, journal, categories, category
 *   - Import supports: collections, collection, tags, labels
 * 
 * EXPLICIT DISTINCTIONS:
 * - Content format: HTML string vs JSON structure (templates use HTML for portability)
 * - Cover image: URL string (templates use coverImageUrl, not image object ID)
 * - Status: Uses exact enum values ('draft', 'published', 'archived')
 * ============================================================
 */

export type TemplateFormat = 'json' | 'html'

export interface TemplateOptions {
  format: TemplateFormat
  includeComments?: boolean
}

export interface TemplateResult {
  content: string
  format: TemplateFormat
}

/**
 * JSON Template Structure
 * 
 * Matches the Import feature's recognized keys.
 * Uses empty placeholders appropriate to each field type.
 */
interface JsonTemplate {
  // Meta section for documentation (ignored by import)
  __meta: {
    description: string
    version: string
    generatedAt: string
    fields: {
      [key: string]: {
        type: string
        required: boolean
        description: string
      }
    }
  }
  // Actual entry fields
  title: string
  excerpt: string
  coverImageUrl: string
  coverImageAlt: string
  content: string
  status: 'draft' | 'published' | 'archived'
  journals: string[]
  collections: string[]
}

/**
 * Generate a JSON template for entry import
 */
function generateJsonTemplate(): string {
  const template: JsonTemplate = {
    __meta: {
      description: 'Entry template for dahligarciamarquez. The __meta section is ignored during import.',
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      fields: {
        title: { type: 'string', required: true, description: 'Entry title' },
        excerpt: { type: 'string', required: false, description: 'Brief summary or description' },
        coverImageUrl: { type: 'string', required: false, description: 'URL to cover image' },
        coverImageAlt: { type: 'string', required: false, description: 'Alt text for cover image (required if cover exists)' },
        content: { type: 'string (HTML)', required: false, description: 'Entry body content as HTML' },
        status: { type: 'enum', required: false, description: 'Publication status: draft, published, or archived' },
        journals: { type: 'string[]', required: false, description: 'Journal names (new ones will be auto-created)' },
        collections: { type: 'string[]', required: false, description: 'Collection names (new ones will be auto-created)' }
      }
    },
    title: '',
    excerpt: '',
    coverImageUrl: '',
    coverImageAlt: '',
    content: '',
    status: 'draft',
    journals: [],
    collections: []
  }

  return JSON.stringify(template, null, 2)
}

/**
 * Generate an HTML template for entry import
 * 
 * Uses data attributes to mark fields for machine detection.
 * The importer extracts:
 * - First <h1> → title
 * - First <img> → cover image
 * - First <p> → excerpt (if short)
 * - Remaining content → body
 * 
 * We add data-entry-field attributes for explicit field mapping.
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
    '  <title>Entry Template</title>',
    '</head>',
    '<body>',
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
    '  <article data-entry-field="content">',
    '    <p>Your entry content goes here. This section supports rich HTML formatting.</p>',
    '    <p>You can include:</p>',
    '    <ul>',
    '      <li>Paragraphs and headings</li>',
    '      <li>Lists (ordered and unordered)</li>',
    '      <li>Links and images</li>',
    '      <li>Blockquotes and code blocks</li>',
    '    </ul>',
    '  </article>',
    '  <!-- /ENTRY_FIELD:content -->',
    '',
    '  <!-- ENTRY_FIELD:meta (optional, for JSON-like metadata) -->',
    '  <script type="application/json" data-entry-field="meta">',
    '  {',
    '    "status": "draft",',
    '    "journals": [],',
    '    "collections": []',
    '  }',
    '  </script>',
    '  <!-- /ENTRY_FIELD:meta -->',
    '',
    '</body>',
    '</html>'
  ]

  return lines.join('\n')
}

/**
 * Generate a template in the specified format
 * 
 * @param format - 'json' or 'html'
 * @returns Template content as a string
 */
export function generateTemplate(format: TemplateFormat): TemplateResult {
  try {
    let content: string

    switch (format) {
      case 'json':
        content = generateJsonTemplate()
        break
      case 'html':
        content = generateHtmlTemplate()
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
      content: format === 'json' 
        ? '{\n  "title": "",\n  "content": ""\n}'
        : '<h1>Entry Title</h1>\n<p>Content goes here.</p>',
      format
    }
  }
}

/**
 * Get a list of all supported fields with their descriptions
 * Useful for UI display
 */
export function getFieldDescriptions(): Array<{
  field: string
  type: string
  required: boolean
  description: string
}> {
  return [
    { field: 'title', type: 'string', required: true, description: 'Entry title' },
    { field: 'excerpt', type: 'string', required: false, description: 'Brief summary or description' },
    { field: 'coverImageUrl', type: 'string', required: false, description: 'URL to cover image' },
    { field: 'coverImageAlt', type: 'string', required: false, description: 'Alt text for cover image' },
    { field: 'content', type: 'HTML string', required: false, description: 'Entry body content' },
    { field: 'status', type: 'enum', required: false, description: 'draft | published | archived' },
    { field: 'journals', type: 'string[]', required: false, description: 'Journal names for organization' },
    { field: 'collections', type: 'string[]', required: false, description: 'Collection names for organization' }
  ]
}
