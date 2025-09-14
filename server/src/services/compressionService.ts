import sharp from 'sharp'

export interface CompressionOptions {
  quality: 'high' | 'balanced' | 'aggressive' | number
  format?: 'auto' | 'webp' | 'jpeg' | 'png'
  maxWidth?: number
  maxHeight?: number
  convertPhotosToWebP?: boolean
  preservePngForGraphics?: boolean
}

export interface CompressionResult {
  buffer: Buffer
  format: string
  mimeType: string
  originalSize: number
  compressedSize: number
  compressionRatio: number
  width: number
  height: number
}

export class CompressionService {
  /**
   * Compress an image buffer with the specified options
   */
  static async compressImage(
    inputBuffer: Buffer, 
    options: CompressionOptions = {}
  ): Promise<CompressionResult> {
    const originalSize = inputBuffer.length

    // Parse quality setting
    const quality = this.parseQuality(options.quality || 'balanced')
    
    // Initialize Sharp instance
    let sharpInstance = sharp(inputBuffer)
    
    // Get original metadata
    const metadata = await sharpInstance.metadata()
    const originalWidth = metadata.width || 0
    const originalHeight = metadata.height || 0
    
    // Apply dimension constraints if specified
    if (options.maxWidth || options.maxHeight) {
      sharpInstance = sharpInstance.resize(options.maxWidth, options.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
    }
    
    // Determine output format
    const outputFormat = this.determineOutputFormat(metadata, options)
    let outputBuffer: Buffer
    let mimeType: string
    
    switch (outputFormat) {
      case 'webp':
        outputBuffer = await sharpInstance
          .webp({ quality, effort: 6 })
          .toBuffer()
        mimeType = 'image/webp'
        break
        
      case 'jpeg':
        outputBuffer = await sharpInstance
          .jpeg({ 
            quality, 
            progressive: true,
            mozjpeg: true // Better compression
          })
          .toBuffer()
        mimeType = 'image/jpeg'
        break
        
      case 'png':
        outputBuffer = await sharpInstance
          .png({ 
            quality, 
            compressionLevel: 9,
            adaptiveFiltering: true
          })
          .toBuffer()
        mimeType = 'image/png'
        break
        
      default:
        throw new Error(`Unsupported output format: ${outputFormat}`)
    }
    
    // Get final dimensions
    const finalMetadata = await sharp(outputBuffer).metadata()
    const finalWidth = finalMetadata.width || originalWidth
    const finalHeight = finalMetadata.height || originalHeight
    
    const compressedSize = outputBuffer.length
    const compressionRatio = Math.round((1 - compressedSize / originalSize) * 100)
    
    return {
      buffer: outputBuffer,
      format: outputFormat,
      mimeType,
      originalSize,
      compressedSize,
      compressionRatio,
      width: finalWidth,
      height: finalHeight
    }
  }
  
  /**
   * Check if an image should be compressed based on size/dimension thresholds
   */
  static shouldCompress(
    buffer: Buffer, 
    metadata: { width?: number; height?: number },
    settings: { sizeThreshold: number; dimensionThreshold: number }
  ): boolean {
    const sizeInKB = buffer.length / 1024
    const maxDimension = Math.max(metadata.width || 0, metadata.height || 0)
    
    return sizeInKB > settings.sizeThreshold || maxDimension > settings.dimensionThreshold
  }
  
  /**
   * Download an image from URL and compress it
   */
  static async compressFromUrl(
    imageUrl: string, 
    options: CompressionOptions = {}
  ): Promise<CompressionResult & { originalUrl: string }> {
    try {
      // Download image
      const response = await fetch(imageUrl)
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`)
      }
      
      const arrayBuffer = await response.arrayBuffer()
      const inputBuffer = Buffer.from(arrayBuffer)
      
      // Validate it's actually an image
      const metadata = await sharp(inputBuffer).metadata()
      if (!metadata.format) {
        throw new Error('Downloaded content is not a valid image')
      }
      
      // Compress the image
      const result = await this.compressImage(inputBuffer, options)
      
      return {
        ...result,
        originalUrl: imageUrl
      }
    } catch (error) {
      throw new Error(`Failed to compress image from URL: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  /**
   * Parse quality setting to numeric value
   */
  private static parseQuality(quality: 'high' | 'balanced' | 'aggressive' | number): number {
    if (typeof quality === 'number') {
      return Math.max(10, Math.min(100, quality))
    }
    
    switch (quality) {
      case 'high': return 85
      case 'balanced': return 75
      case 'aggressive': return 60
      default: return 75
    }
  }
  
  /**
   * Determine the best output format based on input and options
   */
  private static determineOutputFormat(
    metadata: sharp.Metadata, 
    options: CompressionOptions
  ): 'webp' | 'jpeg' | 'png' {
    // If format is explicitly specified
    if (options.format && options.format !== 'auto') {
      return options.format
    }
    
    const inputFormat = metadata.format
    
    // Preserve PNG for graphics/logos if option is set
    if (options.preservePngForGraphics && inputFormat === 'png') {
      // Check if it might be a graphic (has transparency or limited colors)
      if (metadata.channels === 4 || (metadata.density && metadata.density < 150)) {
        return 'png'
      }
    }
    
    // Convert photos to WebP if option is set
    if (options.convertPhotosToWebP) {
      // Consider it a photo if it's JPEG or large PNG without transparency
      if (inputFormat === 'jpeg' || 
          (inputFormat === 'png' && metadata.channels === 3 && 
           (metadata.width || 0) * (metadata.height || 0) > 100000)) {
        return 'webp'
      }
    }
    
    // Default behavior: preserve format but optimize
    switch (inputFormat) {
      case 'png':
        return 'png'
      case 'webp':
        return 'webp'
      case 'jpeg':
      case 'jpg':
      default:
        return 'jpeg'
    }
  }
  
  /**
   * Get compression statistics for display
   */
  static formatCompressionStats(result: CompressionResult): string {
    const originalSizeMB = (result.originalSize / (1024 * 1024)).toFixed(2)
    const compressedSizeMB = (result.compressedSize / (1024 * 1024)).toFixed(2)
    
    return `Compressed from ${originalSizeMB}MB to ${compressedSizeMB}MB (${result.compressionRatio}% reduction)`
  }
}
