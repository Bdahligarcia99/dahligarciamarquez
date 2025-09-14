// Alt text generation utilities

/**
 * Extracts filename from URL or file path
 * @param urlOrPath URL or file path
 * @returns Clean filename without extension
 */
export function extractFilename(urlOrPath: string): string {
  try {
    // Handle URLs
    if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
      const url = new URL(urlOrPath)
      const pathname = url.pathname
      const filename = pathname.split('/').pop() || ''
      return cleanFilename(filename)
    }
    
    // Handle file paths
    const filename = urlOrPath.split('/').pop() || urlOrPath.split('\\').pop() || ''
    return cleanFilename(filename)
  } catch {
    // If URL parsing fails, try to extract from string
    const parts = urlOrPath.split('/')
    const filename = parts[parts.length - 1] || ''
    return cleanFilename(filename)
  }
}

/**
 * Cleans filename by removing extension and formatting
 * @param filename Raw filename
 * @returns Cleaned, human-readable filename
 */
function cleanFilename(filename: string): string {
  if (!filename) return ''
  
  // Remove file extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')
  
  // Replace common separators with spaces
  let cleaned = nameWithoutExt
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  
  // Capitalize first letter of each word
  cleaned = cleaned.replace(/\b\w/g, (char) => char.toUpperCase())
  
  return cleaned || 'Image'
}

/**
 * Generates alt text from various sources
 * @param options Generation options
 * @returns Generated alt text
 */
export function generateAltText(options: {
  filename?: string
  url?: string
  postTitle?: string
  fallback?: string
}): string {
  const { filename, url, postTitle, fallback = 'Image' } = options
  
  // Try filename first (most specific)
  if (filename) {
    const alt = extractFilename(filename)
    if (alt && alt !== 'Image') {
      return alt
    }
  }
  
  // Try URL next
  if (url) {
    const alt = extractFilename(url)
    if (alt && alt !== 'Image') {
      return alt
    }
  }
  
  // Use post title as context
  if (postTitle) {
    return `Image for "${postTitle}"`
  }
  
  // Final fallback
  return fallback
}

/**
 * Generates cover image alt text
 * @param options Generation options
 * @returns Generated cover image alt text
 */
export function generateCoverImageAlt(options: {
  filename?: string
  url?: string
  postTitle?: string
}): string {
  const { filename, url, postTitle } = options
  
  // Try filename/URL first
  const basicAlt = generateAltText({ filename, url })
  if (basicAlt && basicAlt !== 'Image') {
    return `Cover image: ${basicAlt}`
  }
  
  // Use post title
  if (postTitle) {
    return `Cover image for "${postTitle}"`
  }
  
  return 'Cover image'
}
