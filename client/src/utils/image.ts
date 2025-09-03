// Image utility functions for loading dimensions and compression

/**
 * Load image dimensions from a file
 */
export function loadImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight
      })
    }
    
    img.onerror = () => {
      reject(new Error('Failed to load image'))
    }
    
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Compress an image file using canvas
 */
export function compressImage(
  file: File, 
  opts: { maxDim?: number; quality?: number } = {}
): Promise<File> {
  const { maxDim = 2000, quality = 0.82 } = opts
  
  return new Promise((resolve, reject) => {
    const img = new Image()
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        if (!ctx) {
          reject(new Error('Canvas context not available'))
          return
        }
        
        // Calculate new dimensions
        const { width: originalWidth, height: originalHeight } = img
        const maxSide = Math.max(originalWidth, originalHeight)
        
        let newWidth = originalWidth
        let newHeight = originalHeight
        
        if (maxSide > maxDim) {
          const scale = maxDim / maxSide
          newWidth = Math.round(originalWidth * scale)
          newHeight = Math.round(originalHeight * scale)
        }
        
        // Set canvas size
        canvas.width = newWidth
        canvas.height = newHeight
        
        // Draw and compress image
        ctx.drawImage(img, 0, 0, newWidth, newHeight)
        
        // Try WebP first, fallback to JPEG
        const tryWebP = () => {
          canvas.toBlob((webpBlob) => {
            if (webpBlob) {
              // WebP success
              const webpFile = createCompressedFile(webpBlob, file.name, 'webp')
              resolve(webpFile)
            } else {
              // WebP failed, try JPEG
              tryJPEG()
            }
          }, 'image/webp', quality)
        }
        
        const tryJPEG = () => {
          canvas.toBlob((jpegBlob) => {
            if (jpegBlob) {
              const jpegFile = createCompressedFile(jpegBlob, file.name, 'jpeg')
              resolve(jpegFile)
            } else {
              reject(new Error('Image compression failed'))
            }
          }, 'image/jpeg', quality)
        }
        
        tryWebP()
        
      } catch (error) {
        reject(error)
      } finally {
        // Clean up object URL
        URL.revokeObjectURL(img.src)
      }
    }
    
    img.onerror = () => {
      reject(new Error('Failed to load image for compression'))
    }
    
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Create a new File object from compressed blob with appropriate filename
 */
function createCompressedFile(blob: Blob, originalName: string, format: 'webp' | 'jpeg'): File {
  // Extract filename without extension
  const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '')
  
  // Determine new extension and mime type
  const extension = format === 'webp' ? 'webp' : 'jpg'
  const mimeType = format === 'webp' ? 'image/webp' : 'image/jpeg'
  
  const newFilename = `${nameWithoutExt}.${extension}`
  
  return new File([blob], newFilename, {
    type: mimeType,
    lastModified: Date.now()
  })
}

/**
 * Check if an image file is considered large based on thresholds
 */
export async function isLargeImage(file: File): Promise<boolean> {
  const SIZE_THRESHOLD = 800 * 1024 // 800KB
  const DIMENSION_THRESHOLD = 2000 // 2000px
  
  // Check file size first (quick check)
  if (file.size > SIZE_THRESHOLD) {
    return true
  }
  
  try {
    // Check dimensions
    const { width, height } = await loadImageDimensions(file)
    return width > DIMENSION_THRESHOLD || height > DIMENSION_THRESHOLD
  } catch (error) {
    // If we can't load dimensions, just use file size
    return false
  }
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
}

/**
 * Format image dimensions
 */
export function formatDimensions(width: number, height: number): string {
  return `${width} × ${height} px`
}
