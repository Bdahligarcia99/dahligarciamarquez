// client/src/__tests__/importParser.test.js
import { parseImportContent, getFieldsSummary } from '../utils/importParser'

describe('Import Parser Utilities', () => {
  describe('parseImportContent', () => {
    describe('JSON parsing', () => {
      test('parses simple JSON with title and content', () => {
        const input = JSON.stringify({
          title: 'My Test Entry',
          content: '<p>Hello world</p>'
        })
        
        const result = parseImportContent(input, 'auto', false)
        
        expect(result.success).toBe(true)
        expect(result.detectedFormat).toBe('json')
        expect(result.fields.title).toBe('My Test Entry')
        expect(result.fields.content.html).toContain('Hello world')
      })

      test('maps alternative key names (name, body, summary)', () => {
        const input = JSON.stringify({
          name: 'Entry Title',
          body: '<p>Body content</p>',
          summary: 'Brief summary'
        })
        
        const result = parseImportContent(input, 'json', false)
        
        expect(result.success).toBe(true)
        expect(result.fields.title).toBe('Entry Title')
        expect(result.fields.excerpt).toBe('Brief summary')
        expect(result.fields.content).toBeDefined()
      })

      test('handles cover image as string', () => {
        const input = JSON.stringify({
          title: 'Test',
          coverImageUrl: 'https://example.com/image.jpg'
        })
        
        const result = parseImportContent(input, 'json', false)
        
        expect(result.success).toBe(true)
        expect(result.fields.coverImageUrl).toBe('https://example.com/image.jpg')
      })

      test('handles cover image as object with url property', () => {
        const input = JSON.stringify({
          title: 'Test',
          cover: { url: 'https://example.com/image.jpg', alt: 'Test image' }
        })
        
        const result = parseImportContent(input, 'json', false)
        
        expect(result.success).toBe(true)
        expect(result.fields.coverImageUrl).toBe('https://example.com/image.jpg')
        expect(result.fields.coverImageAlt).toBe('Test image')
      })

      test('maps status field correctly', () => {
        const input = JSON.stringify({
          title: 'Test',
          status: 'published'
        })
        
        const result = parseImportContent(input, 'json', false)
        
        expect(result.success).toBe(true)
        expect(result.fields.status).toBe('published')
      })

      test('maps boolean published flag to status', () => {
        const input = JSON.stringify({
          title: 'Test',
          published: true
        })
        
        const result = parseImportContent(input, 'json', false)
        
        expect(result.success).toBe(true)
        expect(result.fields.status).toBe('published')
      })

      test('ignores unknown keys', () => {
        const input = JSON.stringify({
          title: 'Test',
          unknownField: 'should be ignored',
          anotherUnknown: { nested: 'data' }
        })
        
        const result = parseImportContent(input, 'json', false)
        
        expect(result.success).toBe(true)
        expect(result.fields.title).toBe('Test')
        expect(result.fields.unknownField).toBeUndefined()
        expect(result.fields.anotherUnknown).toBeUndefined()
      })

      test('returns error for invalid JSON when mode is json', () => {
        const input = '{ invalid json }'
        
        const result = parseImportContent(input, 'json', false)
        
        expect(result.success).toBe(false)
        expect(result.error).toContain('JSON parsing failed')
      })
    })

    describe('HTML parsing', () => {
      test('extracts title from h1', () => {
        const input = '<h1>My Entry Title</h1><p>Content here</p>'
        
        const result = parseImportContent(input, 'html', false)
        
        expect(result.success).toBe(true)
        expect(result.detectedFormat).toBe('html')
        expect(result.fields.title).toBe('My Entry Title')
      })

      test('extracts cover image from first img', () => {
        const input = '<img src="https://example.com/cover.jpg" alt="Cover"><p>Content</p>'
        
        const result = parseImportContent(input, 'html', false)
        
        expect(result.success).toBe(true)
        expect(result.fields.coverImageUrl).toBe('https://example.com/cover.jpg')
        expect(result.fields.coverImageAlt).toBe('Cover')
      })

      test('extracts short paragraph as excerpt', () => {
        const input = '<p>This is a brief introduction.</p><p>More content here.</p>'
        
        const result = parseImportContent(input, 'html', false)
        
        expect(result.success).toBe(true)
        expect(result.fields.excerpt).toBe('This is a brief introduction.')
      })

      test('remaining HTML becomes content', () => {
        const input = '<h1>Title</h1><p>First paragraph</p><p>Second paragraph</p>'
        
        const result = parseImportContent(input, 'html', false)
        
        expect(result.success).toBe(true)
        expect(result.fields.content).toBeDefined()
        expect(result.fields.content.html).toContain('Second paragraph')
      })
    })

    describe('auto-detect mode', () => {
      test('detects JSON format', () => {
        const input = '{"title": "Test"}'
        
        const result = parseImportContent(input, 'auto', false)
        
        expect(result.success).toBe(true)
        expect(result.detectedFormat).toBe('json')
      })

      test('detects HTML format', () => {
        const input = '<h1>Test Title</h1>'
        
        const result = parseImportContent(input, 'auto', false)
        
        expect(result.success).toBe(true)
        expect(result.detectedFormat).toBe('html')
      })

      test('returns error when format cannot be detected', () => {
        const input = 'Just some plain text without structure'
        
        const result = parseImportContent(input, 'auto', false)
        
        expect(result.success).toBe(false)
        expect(result.error).toContain('Could not detect format')
      })
    })

    describe('overwrite behavior', () => {
      test('does not overwrite existing fields when overwrite is false', () => {
        const input = JSON.stringify({ title: 'New Title', excerpt: 'New Excerpt' })
        const currentFields = { title: 'Existing Title', excerpt: '' }
        
        const result = parseImportContent(input, 'json', false, currentFields)
        
        expect(result.success).toBe(true)
        expect(result.fields.title).toBeUndefined() // Should not overwrite
        expect(result.fields.excerpt).toBe('New Excerpt') // Should fill empty field
      })

      test('overwrites existing fields when overwrite is true', () => {
        const input = JSON.stringify({ title: 'New Title' })
        const currentFields = { title: 'Existing Title' }
        
        const result = parseImportContent(input, 'json', true, currentFields)
        
        expect(result.success).toBe(true)
        expect(result.fields.title).toBe('New Title')
      })
    })

    describe('sanitization', () => {
      test('removes script tags from HTML content', () => {
        const input = JSON.stringify({
          content: '<p>Safe content</p><script>alert("xss")</script>'
        })
        
        const result = parseImportContent(input, 'json', false)
        
        expect(result.success).toBe(true)
        expect(result.fields.content.html).not.toContain('script')
        expect(result.fields.content.html).toContain('Safe content')
      })

      test('removes iframe tags from HTML content', () => {
        const input = '<p>Content</p><iframe src="evil.com"></iframe>'
        
        const result = parseImportContent(input, 'html', false)
        
        expect(result.success).toBe(true)
        expect(result.fields.content.html).not.toContain('iframe')
      })

      test('removes onclick handlers from elements', () => {
        const input = '<p onclick="alert(1)">Click me</p>'
        
        const result = parseImportContent(input, 'html', false)
        
        expect(result.success).toBe(true)
        expect(result.fields.content.html).not.toContain('onclick')
      })
    })

    describe('error handling', () => {
      test('returns error for empty input', () => {
        const result = parseImportContent('', 'auto', false)
        
        expect(result.success).toBe(false)
        expect(result.error).toBe('No content to import')
      })

      test('returns error for whitespace-only input', () => {
        const result = parseImportContent('   \n  ', 'auto', false)
        
        expect(result.success).toBe(false)
        expect(result.error).toBe('No content to import')
      })
    })
  })

  describe('getFieldsSummary', () => {
    test('returns summary for all populated fields', () => {
      const fields = {
        title: 'Test Title',
        excerpt: 'Test excerpt',
        coverImageUrl: 'https://example.com/image.jpg',
        status: 'published'
      }
      
      const summary = getFieldsSummary(fields)
      
      expect(summary).toContain('Title: "Test Title"')
      expect(summary).toContain('Excerpt: "Test excerpt"')
      expect(summary.some(s => s.includes('Cover Image'))).toBe(true)
      expect(summary).toContain('Status: published')
    })

    test('returns empty array for no fields', () => {
      const summary = getFieldsSummary({})
      
      expect(summary).toHaveLength(0)
    })

    test('truncates long titles', () => {
      const fields = {
        title: 'This is a very long title that should be truncated to prevent UI issues'
      }
      
      const summary = getFieldsSummary(fields)
      
      expect(summary[0]).toContain('...')
      expect(summary[0].length).toBeLessThan(80)
    })
  })
})
