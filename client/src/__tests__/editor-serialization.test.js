// client/src/__tests__/editor-serialization.test.js
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'

/**
 * Test HTML serialization and parsing round-trip for the editor
 * This ensures content is preserved when saving/loading HTML
 */
describe('Editor HTML Serialization', () => {
  let editor

  beforeEach(() => {
    // Create a headless editor for testing
    editor = new Editor({
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3]
          }
        }),
        TextAlign.configure({
          types: ['heading', 'paragraph']
        }),
        Underline
      ],
      content: ''
    })
  })

  afterEach(() => {
    if (editor) {
      editor.destroy()
    }
  })

  test('preserves paragraph content in round-trip', () => {
    const originalHTML = '<p>This is a simple paragraph.</p>'
    
    editor.commands.setContent(originalHTML)
    const serializedHTML = editor.getHTML()
    
    expect(serializedHTML).toBe(originalHTML)
  })

  test('preserves headings in round-trip', () => {
    const testCases = [
      '<h1>Heading 1</h1>',
      '<h2>Heading 2</h2>',
      '<h3>Heading 3</h3>'
    ]

    testCases.forEach(originalHTML => {
      editor.commands.setContent(originalHTML)
      const serializedHTML = editor.getHTML()
      
      expect(serializedHTML).toBe(originalHTML)
    })
  })

  test('preserves inline formatting in round-trip', () => {
    const testCases = [
      '<p><strong>Bold text</strong></p>',
      '<p><em>Italic text</em></p>',
      '<p><u>Underlined text</u></p>',
      '<p><s>Strikethrough text</s></p>',
      '<p><strong><em>Bold and italic</em></strong></p>',
      '<p><strong><u><em>Bold, underlined, and italic</em></u></strong></p>'
    ]

    testCases.forEach(originalHTML => {
      editor.commands.setContent(originalHTML)
      const serializedHTML = editor.getHTML()
      
      expect(serializedHTML).toBe(originalHTML)
    })
  })

  test('preserves text alignment in round-trip', () => {
    const testCases = [
      '<p style="text-align: left">Left aligned</p>',
      '<p style="text-align: center">Center aligned</p>',
      '<p style="text-align: right">Right aligned</p>',
      '<h1 style="text-align: center">Centered heading</h1>',
      '<h2 style="text-align: right">Right aligned heading</h2>'
    ]

    testCases.forEach(originalHTML => {
      editor.commands.setContent(originalHTML)
      const serializedHTML = editor.getHTML()
      
      expect(serializedHTML).toBe(originalHTML)
    })
  })

  test('preserves lists in round-trip', () => {
    const testCases = [
      '<ul><li><p>Bullet item 1</p></li><li><p>Bullet item 2</p></li></ul>',
      '<ol><li><p>Numbered item 1</p></li><li><p>Numbered item 2</p></li></ol>',
      '<ul><li><p><strong>Bold</strong> bullet item</p></li></ul>'
    ]

    testCases.forEach(originalHTML => {
      editor.commands.setContent(originalHTML)
      const serializedHTML = editor.getHTML()
      
      expect(serializedHTML).toBe(originalHTML)
    })
  })

  test('preserves blockquotes in round-trip', () => {
    const originalHTML = '<blockquote><p>This is a quote</p></blockquote>'
    
    editor.commands.setContent(originalHTML)
    const serializedHTML = editor.getHTML()
    
    expect(serializedHTML).toBe(originalHTML)
  })

  test('preserves code blocks in round-trip', () => {
    const originalHTML = '<pre><code>const hello = "world";</code></pre>'
    
    editor.commands.setContent(originalHTML)
    const serializedHTML = editor.getHTML()
    
    expect(serializedHTML).toBe(originalHTML)
  })

  test('preserves complex nested content', () => {
    const originalHTML = `<h1>Main Title</h1><p>This is a paragraph with <strong>bold</strong> and <em>italic</em> text.</p><h2 style="text-align: center">Centered Subtitle</h2><ul><li><p>First item with <u>underlined</u> text</p></li><li><p>Second item with <s>strikethrough</s></p></li></ul><blockquote><p>A quote with <strong><em>bold italic</em></strong> text</p></blockquote><p style="text-align: right">Right-aligned paragraph</p>`
    
    editor.commands.setContent(originalHTML)
    const serializedHTML = editor.getHTML()
    
    expect(serializedHTML).toBe(originalHTML)
  })

  test('handles empty content correctly', () => {
    editor.commands.setContent('')
    const serializedHTML = editor.getHTML()
    
    // Empty editor should produce empty paragraph or empty content
    expect(serializedHTML).toMatch(/^(<p><\/p>|)$/)
  })

  test('JSON to HTML conversion maintains formatting', () => {
    const testJSON = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Test Heading' }]
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'This is ' },
            { type: 'text', marks: [{ type: 'bold' }], text: 'bold' },
            { type: 'text', text: ' and ' },
            { type: 'text', marks: [{ type: 'italic' }], text: 'italic' },
            { type: 'text', text: ' text.' }
          ]
        }
      ]
    }

    editor.commands.setContent(testJSON)
    const htmlOutput = editor.getHTML()
    
    expect(htmlOutput).toContain('<h1>Test Heading</h1>')
    expect(htmlOutput).toContain('<strong>bold</strong>')
    expect(htmlOutput).toContain('<em>italic</em>')
  })

  test('HTML to JSON conversion preserves structure', () => {
    const testHTML = '<h1>Title</h1><p>Paragraph with <strong>bold</strong> text.</p>'
    
    editor.commands.setContent(testHTML)
    const jsonOutput = editor.getJSON()
    
    expect(jsonOutput.type).toBe('doc')
    expect(jsonOutput.content).toHaveLength(2)
    expect(jsonOutput.content[0].type).toBe('heading')
    expect(jsonOutput.content[0].attrs.level).toBe(1)
    expect(jsonOutput.content[1].type).toBe('paragraph')
    
    // Check that bold mark is preserved
    const boldText = jsonOutput.content[1].content.find(node => 
      node.marks && node.marks.some(mark => mark.type === 'bold')
    )
    expect(boldText).toBeDefined()
    expect(boldText.text).toBe('bold')
  })
})
