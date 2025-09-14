// Utility functions for detecting and analyzing image types and sources

export interface ImageMetadata {
  isUpload: boolean
  source: 'upload' | 'external'
  domain?: string
  fileName?: string
  extension?: string
  estimatedSize?: string
  width?: number
  height?: number
  isCoverImage?: boolean
}

/**
 * Detect if an image URL is an uploaded file or external URL
 */
export function detectImageType(url: string): Pick<ImageMetadata, 'isUpload' | 'source' | 'domain' | 'fileName' | 'extension'> {
  if (!url) {
    return { isUpload: false, source: 'external' }
  }

  // Check if it's a relative upload path
  if (url.startsWith('/uploads/')) {
    const fileName = url.split('/').pop() || ''
    const extension = fileName.split('.').pop()?.toLowerCase()
    return {
      isUpload: true,
      source: 'upload',
      fileName,
      extension
    }
  }

  // Check if it's an absolute URL to our own domain
  const currentDomain = window.location.hostname
  try {
    const urlObj = new URL(url)
    const isOwnDomain = urlObj.hostname === currentDomain || urlObj.hostname === 'localhost'
    
    if (isOwnDomain && (urlObj.pathname.startsWith('/uploads/') || urlObj.pathname.includes('/uploads/'))) {
      const fileName = urlObj.pathname.split('/').pop() || ''
      const extension = fileName.split('.').pop()?.toLowerCase()
      return {
        isUpload: true,
        source: 'upload',
        fileName,
        extension
      }
    }

    // External URL
    return {
      isUpload: false,
      source: 'external',
      domain: urlObj.hostname,
      fileName: urlObj.pathname.split('/').pop() || '',
      extension: urlObj.pathname.split('.').pop()?.toLowerCase()
    }
  } catch {
    // Invalid URL, treat as external
    return {
      isUpload: false,
      source: 'external'
    }
  }
}

/**
 * Get image dimensions from an image element or URL
 */
export function getImageDimensions(imgElement: HTMLImageElement): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    if (imgElement.naturalWidth && imgElement.naturalHeight) {
      resolve({
        width: imgElement.naturalWidth,
        height: imgElement.naturalHeight
      })
    } else {
      const img = new Image()
      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight
        })
      }
      img.onerror = () => {
        resolve({ width: 0, height: 0 })
      }
      img.src = imgElement.src
    }
  })
}

/**
 * Check if an external URL is accessible and get loading time
 */
export async function checkImageHealth(url: string): Promise<{ 
  isAccessible: boolean
  loadTime?: number
  error?: string
}> {
  if (detectImageType(url).isUpload) {
    // Skip health check for uploaded files
    return { isAccessible: true }
  }

  try {
    const startTime = Date.now()
    const response = await fetch(url, { 
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-cache'
    })
    const loadTime = Date.now() - startTime

    return {
      isAccessible: true,
      loadTime
    }
  } catch (error) {
    return {
      isAccessible: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Estimate file size for external images (rough approximation)
 */
export function estimateImageSize(width: number, height: number, format?: string): string {
  if (!width || !height) return 'Unknown'
  
  const pixels = width * height
  let bytesPerPixel = 3 // Default for JPEG
  
  if (format) {
    const fmt = format.toLowerCase()
    if (fmt.includes('png')) bytesPerPixel = 4
    else if (fmt.includes('webp')) bytesPerPixel = 2
    else if (fmt.includes('gif')) bytesPerPixel = 1
  }
  
  const estimatedBytes = pixels * bytesPerPixel
  
  if (estimatedBytes < 1024) return `~${estimatedBytes}B`
  if (estimatedBytes < 1024 * 1024) return `~${Math.round(estimatedBytes / 1024)}KB`
  return `~${(estimatedBytes / (1024 * 1024)).toFixed(1)}MB`
}

/**
 * Format image metadata into a human-readable tooltip string
 */
export function formatImageTooltip(metadata: ImageMetadata, altText?: string): string {
  const parts: string[] = []
  
  // Alt text
  if (altText?.trim()) {
    parts.push(`Alt: "${altText.trim()}"`)
  }
  
  // Source type
  if (metadata.isUpload) {
    parts.push('Uploaded file')
  } else {
    parts.push(`External URL${metadata.domain ? ` (${metadata.domain})` : ''}`)
  }
  
  // Dimensions
  if (metadata.width && metadata.height) {
    parts.push(`${metadata.width}×${metadata.height}`)
  }
  
  // Size
  if (metadata.estimatedSize) {
    parts.push(metadata.estimatedSize)
  }
  
  return parts.join(' • ')
}

/**
 * Get appropriate warning message for an image
 */
export function getImageWarning(metadata: ImageMetadata, health?: { isAccessible: boolean; loadTime?: number; error?: string }): {
  type: 'error' | 'warning' | 'info' | null
  message: string
} | null {
  // Check for broken external URLs
  if (!metadata.isUpload && health && !health.isAccessible) {
    return {
      type: 'error',
      message: `External image failed to load${health.error ? `: ${health.error}` : ''}`
    }
  }
  
  // Check for slow loading external URLs
  if (!metadata.isUpload && health?.loadTime && health.loadTime > 3000) {
    return {
      type: 'warning',
      message: `External image is slow to load (${Math.round(health.loadTime)}ms)`
    }
  }
  
  // Check for very large images
  if (metadata.width && metadata.height) {
    const pixels = metadata.width * metadata.height
    if (pixels > 4000000) { // > 4MP
      return {
        type: 'info',
        message: 'Large image may affect page load performance'
      }
    }
  }
  
  return null
}
