// client/src/__tests__/metadata.test.js
import { pageTitle, defaultMeta, setDocumentTitle, setMetaDescription } from '../utils/metadata'
import { SITE_NAME } from '../config/branding'

describe('Metadata Utilities', () => {
  describe('pageTitle', () => {
    test('returns site name when no custom title provided', () => {
      expect(pageTitle()).toBe(SITE_NAME)
      expect(pageTitle(undefined)).toBe(SITE_NAME)
      expect(pageTitle('')).toBe(SITE_NAME)
    })

    test('returns formatted title with custom title', () => {
      expect(pageTitle('About')).toBe(`About – ${SITE_NAME}`)
      expect(pageTitle('Contact Us')).toBe(`Contact Us – ${SITE_NAME}`)
      expect(pageTitle('My Story')).toBe(`My Story – ${SITE_NAME}`)
    })

    test('handles special characters in titles', () => {
      expect(pageTitle('Story: "The Journey"')).toBe(`Story: "The Journey" – ${SITE_NAME}`)
      expect(pageTitle('Home & About')).toBe(`Home & About – ${SITE_NAME}`)
    })
  })

  describe('defaultMeta', () => {
    test('returns default metadata object with site name only', () => {
      const meta = defaultMeta()
      
      expect(meta.title).toBe(SITE_NAME)
      expect(meta.description).toBe(`Personal stories and experiences from ${SITE_NAME}`)
      expect(meta.openGraph.title).toBe(SITE_NAME)
      expect(meta.openGraph.siteName).toBe(SITE_NAME)
      expect(meta.openGraph.type).toBe('website')
      expect(meta.twitter.title).toBe(SITE_NAME)
      expect(meta.twitter.card).toBe('summary_large_image')
    })

    test('returns metadata with custom title', () => {
      const meta = defaultMeta('About Page')
      const expectedTitle = `About Page – ${SITE_NAME}`
      
      expect(meta.title).toBe(expectedTitle)
      expect(meta.openGraph.title).toBe(expectedTitle)
      expect(meta.twitter.title).toBe(expectedTitle)
    })

    test('returns metadata with custom description', () => {
      const customDescription = 'This is a custom page description'
      const meta = defaultMeta('Custom Page', customDescription)
      
      expect(meta.description).toBe(customDescription)
      expect(meta.openGraph.description).toBe(customDescription)
      expect(meta.twitter.description).toBe(customDescription)
    })

    test('returns metadata with both custom title and description', () => {
      const customTitle = 'Blog Post'
      const customDescription = 'An amazing blog post about life'
      const meta = defaultMeta(customTitle, customDescription)
      const expectedTitle = `${customTitle} – ${SITE_NAME}`
      
      expect(meta.title).toBe(expectedTitle)
      expect(meta.description).toBe(customDescription)
      expect(meta.openGraph.title).toBe(expectedTitle)
      expect(meta.openGraph.description).toBe(customDescription)
      expect(meta.twitter.title).toBe(expectedTitle)
      expect(meta.twitter.description).toBe(customDescription)
    })
  })

  describe('setDocumentTitle', () => {
    test('sets document title to site name when no custom title', () => {
      setDocumentTitle()
      expect(document.title).toBe(SITE_NAME)
    })

    test('sets document title with custom title', () => {
      setDocumentTitle('Test Page')
      expect(document.title).toBe(`Test Page – ${SITE_NAME}`)
    })

    test('handles empty string as no custom title', () => {
      setDocumentTitle('')
      expect(document.title).toBe(SITE_NAME)
    })
  })

  describe('setMetaDescription', () => {
    beforeEach(() => {
      // Clear any existing meta description
      const existingMeta = document.querySelector('meta[name="description"]')
      if (existingMeta) {
        existingMeta.remove()
      }
    })

    test('creates new meta description tag when none exists', () => {
      const description = 'Test description'
      setMetaDescription(description)
      
      const metaTag = document.querySelector('meta[name="description"]')
      expect(metaTag).toBeInTheDocument()
      expect(metaTag.getAttribute('content')).toBe(description)
    })

    test('updates existing meta description tag', () => {
      // Create initial meta tag
      const initialDescription = 'Initial description'
      setMetaDescription(initialDescription)
      
      // Update with new description
      const newDescription = 'Updated description'
      setMetaDescription(newDescription)
      
      const metaTags = document.querySelectorAll('meta[name="description"]')
      expect(metaTags).toHaveLength(1)
      expect(metaTags[0].getAttribute('content')).toBe(newDescription)
    })
  })
})
