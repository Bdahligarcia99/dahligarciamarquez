import React, { useState, useEffect, useRef } from 'react'
import ImageBadge from './ImageBadge'
import SmartTooltip from './SmartTooltip'
import { 
  detectImageType, 
  getImageDimensions, 
  checkImageHealth, 
  estimateImageSize,
  formatImageTooltip,
  getImageWarning,
  ImageMetadata 
} from '../../utils/imageTypeDetection'

interface EnhancedImageProps {
  src: string
  alt?: string
  className?: string
  style?: React.CSSProperties
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void
  onError?: (e: React.SyntheticEvent<HTMLImageElement>) => void
  showBadge?: boolean
  showWarnings?: boolean
  onCopyUrl?: (url: string) => void
  onReplaceUpload?: (currentUrl: string) => void
}

const EnhancedImage: React.FC<EnhancedImageProps> = ({
  src,
  alt,
  className = '',
  style,
  onLoad,
  onError,
  showBadge = true,
  showWarnings = true,
  onCopyUrl,
  onReplaceUpload
}) => {
  const imgRef = useRef<HTMLImageElement>(null)
  const [metadata, setMetadata] = useState<ImageMetadata | null>(null)
  const [health, setHealth] = useState<{ isAccessible: boolean; loadTime?: number; error?: string } | null>(null)
  const [showActions, setShowActions] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!src) return

    const baseMetadata = detectImageType(src)
    setMetadata(baseMetadata)

    // Check health for external URLs
    if (!baseMetadata.isUpload) {
      checkImageHealth(src).then(setHealth)
    }
  }, [src])

  const handleImageLoad = async (e: React.SyntheticEvent<HTMLImageElement>) => {
    setIsLoading(false)
    const imgElement = e.target as HTMLImageElement
    
    try {
      const dimensions = await getImageDimensions(imgElement)
      const estimatedSize = estimateImageSize(dimensions.width, dimensions.height, metadata?.extension)
      
      setMetadata(prev => prev ? {
        ...prev,
        width: dimensions.width,
        height: dimensions.height,
        estimatedSize
      } : null)
    } catch (error) {
      console.warn('Failed to get image dimensions:', error)
    }

    onLoad?.(e)
  }

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setIsLoading(false)
    setHealth({ isAccessible: false, error: 'Failed to load image' })
    onError?.(e)
  }

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(src)
      // Could show a toast notification here
    } catch (error) {
      console.error('Failed to copy URL:', error)
    }
  }

  const warning = metadata && health ? getImageWarning(metadata, health) : null
  const tooltip = metadata ? formatImageTooltip(metadata, alt) : alt || ''

  return (
    <div 
      className="relative inline-block group"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Main Image with Smart Tooltip */}
      <SmartTooltip content={tooltip} delay={500}>
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          className={`${className} ${metadata?.isUpload ? 'ring-2 ring-blue-200' : 'ring-2 ring-orange-200'} ring-opacity-0 group-hover:ring-opacity-100 transition-all duration-200`}
          style={style}
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
      </SmartTooltip>

      {/* Loading Indicator */}
      {isLoading && (
        <div className="absolute inset-0 bg-gray-100 animate-pulse rounded flex items-center justify-center">
          <svg className="w-6 h-6 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      )}

      {/* Badge */}
      {showBadge && metadata && !isLoading && (
        <div className="absolute top-2 left-2">
          <ImageBadge metadata={metadata} size="sm" />
        </div>
      )}

      {/* Warning */}
      {showWarnings && warning && !isLoading && (
        <div className="absolute top-2 right-2">
          <div 
            className={`
              px-2 py-1 rounded text-xs font-medium shadow-md
              ${warning.type === 'error' ? 'bg-red-500 text-white' : ''}
              ${warning.type === 'warning' ? 'bg-yellow-500 text-white' : ''}
              ${warning.type === 'info' ? 'bg-blue-500 text-white' : ''}
            `}
            title={warning.message}
          >
            {warning.type === 'error' && '⚠️'}
            {warning.type === 'warning' && '⚠️'}
            {warning.type === 'info' && 'ℹ️'}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {showActions && (onCopyUrl || onReplaceUpload) && !isLoading && (
        <div className="absolute bottom-2 right-2 flex gap-1">
          {onCopyUrl && (
            <button
              onClick={handleCopyUrl}
              className="px-2 py-1 bg-gray-800 bg-opacity-80 text-white text-xs rounded hover:bg-opacity-100 transition-opacity"
              title="Copy URL"
            >
              📋
            </button>
          )}
          {onReplaceUpload && !metadata?.isUpload && (
            <button
              onClick={() => onReplaceUpload(src)}
              className="px-2 py-1 bg-blue-600 bg-opacity-80 text-white text-xs rounded hover:bg-opacity-100 transition-opacity"
              title="Replace with upload"
            >
              ⬆️
            </button>
          )}
        </div>
      )}

    </div>
  )
}

export default EnhancedImage
