// HTML sanitization utility for post content
import sanitizeHtml from 'sanitize-html'

/**
 * Sanitize HTML content for blog posts
 * Allows safe formatting while blocking dangerous tags and attributes
 */
export function sanitizePostHtml(html: string): string {
  return sanitizeHtml(html, {
    // Allowed HTML tags
    allowedTags: [
      'p', 'h1', 'h2', 'h3', 'strong', 'b', 'em', 'i', 'u', 's',
      'a', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
      'img', 'figure', 'figcaption', 'br', 'hr', 'span'
    ],

    // Allowed attributes per tag
    allowedAttributes: {
      // All tags can have class attribute (for alignment classes)
      '*': ['class'],
      // Links can have href, title, and we'll add rel automatically
      'a': ['href', 'title', 'target'],
      // Images need src, alt, and optional dimensions/title
      'img': ['src', 'alt', 'title', 'width', 'height']
    },

    // Allowed CSS classes (for alignment)
    allowedClasses: {
      '*': ['align-left', 'align-center', 'align-right']
    },

    // Remove disallowed attributes
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
      img: ['http', 'https', 'data'] // Allow data URIs for images
    },

    // Transform functions to add security attributes
    transformTags: {
      // Add rel="noopener noreferrer" to external links with target="_blank"
      'a': function(tagName, attribs) {
        const href = attribs.href
        const target = attribs.target

        // If target="_blank", ensure rel includes noopener noreferrer
        if (target === '_blank') {
          const existingRel = attribs.rel || ''
          const relParts = existingRel.split(/\s+/).filter(Boolean)
          
          if (!relParts.includes('noopener')) {
            relParts.push('noopener')
          }
          if (!relParts.includes('noreferrer')) {
            relParts.push('noreferrer')
          }
          
          return {
            tagName: 'a',
            attribs: {
              ...attribs,
              rel: relParts.join(' ')
            }
          }
        }

        return {
          tagName: 'a',
          attribs
        }
      }
    },

    // Strip all style attributes except text-align
    allowedStyles: {
      '*': {
        'text-align': [/^(left|center|right|justify)$/]
      }
    },

    // Remove dangerous tags completely
    disallowedTagsMode: 'discard',
    
    // Don't allow any custom tags
    allowedIframeHostnames: [], // No iframes allowed

    // Parser options
    parseStyleAttributes: true
  })
}

/**
 * Calculate estimated reading time for text content
 * @param text Plain text content
 * @param wordsPerMinute Average reading speed (default: 200 wpm)
 * @returns Reading time in minutes
 */
export function calculateReadingTime(text: string, wordsPerMinute: number = 200): number {
  if (!text || typeof text !== 'string') {
    return 0
  }

  // Count words (split by whitespace and filter out empty strings)
  const words = text.trim().split(/\s+/).filter(Boolean).length
  
  // Calculate reading time in minutes, minimum 1 minute
  const readingTime = Math.max(1, Math.ceil(words / wordsPerMinute))
  
  return readingTime
}

/**
 * Extract plain text from HTML for reading time calculation
 * @param html HTML content
 * @returns Plain text content
 */
export function extractTextFromHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return ''
  }

  // Use sanitize-html to strip all tags and get just text
  return sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
    textFilter: function(text) {
      // Clean up whitespace
      return text.replace(/\s+/g, ' ').trim()
    }
  })
}
