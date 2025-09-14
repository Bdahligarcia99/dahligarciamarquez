// Image URL validation utilities

export interface ImageValidationResult {
  isValid: boolean
  error?: string
  width?: number
  height?: number
  size?: number
}

/**
 * Validates if a URL points to a valid, accessible image
 * @param url The image URL to validate
 * @param timeout Optional timeout in milliseconds (default: 10000)
 * @returns Promise with validation result
 */
export async function validateImageUrl(url: string, timeout = 10000): Promise<ImageValidationResult> {
  if (!url || !url.trim()) {
    return { isValid: false, error: 'URL is required' }
  }

  const trimmedUrl = url.trim()

  // Basic URL format validation
  try {
    new URL(trimmedUrl)
  } catch {
    return { isValid: false, error: 'Invalid URL format' }
  }

  // Check if URL looks like an image
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?.*)?$/i
  const hasImageExtension = imageExtensions.test(trimmedUrl)
  
  // If it doesn't have an image extension, we'll still try to load it
  // but show a warning that it might not be an image
  
  return new Promise((resolve) => {
    const img = new Image()
    const timeoutId = setTimeout(() => {
      resolve({ 
        isValid: false, 
        error: 'Image failed to load within timeout period (network issue or invalid image)' 
      })
    }, timeout)

    img.onload = () => {
      clearTimeout(timeoutId)
      resolve({
        isValid: true,
        width: img.naturalWidth,
        height: img.naturalHeight,
        // Note: We can't get file size from URL loading, only dimensions
      })
    }

    img.onerror = () => {
      clearTimeout(timeoutId)
      let error = 'Failed to load image from URL'
      
      if (!hasImageExtension) {
        error = 'URL does not appear to point to a valid image file'
      } else if (trimmedUrl.startsWith('http://')) {
        error = 'Image failed to load. Try using HTTPS or check if the URL is accessible'
      } else {
        error = 'Image failed to load. Please check if the URL is correct and accessible'
      }
      
      resolve({ isValid: false, error })
    }

    // Set crossOrigin to handle CORS issues gracefully
    img.crossOrigin = 'anonymous'
    img.src = trimmedUrl
  })
}

/**
 * Validates multiple image URLs
 * @param urls Array of URLs to validate
 * @returns Promise with array of validation results
 */
export async function validateImageUrls(urls: string[]): Promise<ImageValidationResult[]> {
  const validationPromises = urls.map(url => validateImageUrl(url))
  return Promise.all(validationPromises)
}

/**
 * Extracts image URLs from HTML content
 * @param html HTML content to scan
 * @returns Array of image URLs found in the content
 */
export function extractImageUrlsFromHtml(html: string): string[] {
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
  const urls: string[] = []
  let match

  while ((match = imgRegex.exec(html)) !== null) {
    urls.push(match[1])
  }

  return urls
}

/**
 * Checks if a string looks like an image URL (basic heuristic)
 * @param url String to check
 * @returns boolean indicating if it looks like an image URL
 */
export function looksLikeImageUrl(url: string): boolean {
  if (!url || !url.trim()) return false
  
  try {
    new URL(url.trim())
  } catch {
    return false
  }

  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?.*)?$/i
  return imageExtensions.test(url.trim())
}
