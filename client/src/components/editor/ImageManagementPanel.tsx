import React, { useState, useEffect } from 'react'
import ImageBadge from './ImageBadge'
import TruncatedText from './TruncatedText'
import SmartTooltip from './SmartTooltip'
import CompressionControls from './CompressionControls'
import { detectImageType, formatImageTooltip, getImageWarning, checkImageHealth, estimateImageSize, ImageMetadata } from '../../utils/imageTypeDetection'
import { extractImageUrlsFromHtml } from '../../utils/imageValidation'
import { useCompressionSettingsStatic } from '../../hooks/useCompressionSettings'
import { compressImageFromUrl } from '../../lib/compressionApi'

// Session-based state for metadata visibility preference
let sessionMetadataVisibility = true
let sessionSmartLayoutEnabled = true

interface ImageInfo {
  url: string
  alt?: string
  metadata: ImageMetadata
  health?: { isAccessible: boolean; loadTime?: number; error?: string }
}

interface ImageManagementPanelProps {
  content: { html: string } | null
  coverImageUrl?: string
  coverImageAlt?: string
  isOpen: boolean
  onToggle: () => void
  focusedImageUrl?: string | null
  onCopyUrl: (url: string) => void
  onReplaceUpload: (currentUrl: string) => void
  onEditAltText: (url: string, currentAlt: string) => void
  onRemoveImage: (url: string) => void
  onUpdateImage?: (oldUrl: string, newUrl: string) => void
}

const ImageManagementPanel: React.FC<ImageManagementPanelProps> = ({
  content,
  coverImageUrl,
  coverImageAlt,
  isOpen,
  onToggle,
  focusedImageUrl,
  onCopyUrl,
  onReplaceUpload,
  onEditAltText,
  onRemoveImage,
  onUpdateImage
}) => {
  const [images, setImages] = useState<ImageInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [showMetadata, setShowMetadata] = useState(sessionMetadataVisibility)
  const [smartLayout, setSmartLayout] = useState(sessionSmartLayoutEnabled)
  
  // Compression settings
  const { settings: compressionSettings, isCompressionEnabled } = useCompressionSettingsStatic()
  const [compressionStates, setCompressionStates] = useState<Record<string, {
    enabled: boolean;
    quality: 'high' | 'balanced' | 'aggressive' | 'custom';
    customQuality: number;
    compressing: boolean;
    result?: { url: string; stats: string };
  }>>({})

  // Update session state when local state changes
  const handleMetadataToggle = (checked: boolean) => {
    setShowMetadata(checked)
    sessionMetadataVisibility = checked
  }

  const handleSmartLayoutToggle = (checked: boolean) => {
    setSmartLayout(checked)
    sessionSmartLayoutEnabled = checked
  }

  // Compression handlers
  const handleCompressionSettingChange = (imageUrl: string, key: string, value: any) => {
    setCompressionStates(prev => ({
      ...prev,
      [imageUrl]: {
        ...prev[imageUrl],
        [key]: value
      }
    }))
  }

  const handleCompressImage = async (imageUrl: string) => {
    const state = compressionStates[imageUrl]
    if (!state || !isCompressionEnabled) return

    setCompressionStates(prev => ({
      ...prev,
      [imageUrl]: { ...prev[imageUrl], compressing: true }
    }))

    try {
      const quality = state.quality === 'custom' ? state.customQuality : state.quality
      const result = await compressImageFromUrl(imageUrl, { quality })
      
      setCompressionStates(prev => ({
        ...prev,
        [imageUrl]: {
          ...prev[imageUrl],
          compressing: false,
          result: { url: result.url, stats: result.compressionStats }
        }
      }))

      // Notify parent component about the image update
      if (onUpdateImage) {
        onUpdateImage(imageUrl, result.url)
      }
    } catch (error) {
      console.error('Failed to compress image:', error)
      setCompressionStates(prev => ({
        ...prev,
        [imageUrl]: { ...prev[imageUrl], compressing: false }
      }))
    }
  }

  // Initialize compression state for new images
  const getCompressionState = (imageUrl: string) => {
    if (!compressionStates[imageUrl]) {
      setCompressionStates(prev => ({
        ...prev,
        [imageUrl]: {
          enabled: false,
          quality: 'balanced',
          customQuality: 75,
          compressing: false
        }
      }))
    }
    return compressionStates[imageUrl] || {
      enabled: false,
      quality: 'balanced' as const,
      customQuality: 75,
      compressing: false
    }
  }

  useEffect(() => {
    const extractImages = async () => {
      setLoading(true)
      try {
        const imageInfos: ImageInfo[] = []
        
        // Add cover image if it exists
        if (coverImageUrl?.trim()) {
          const baseMetadata = detectImageType(coverImageUrl)
          
          // Try to get dimensions for cover image by loading it
          let dimensions = { width: undefined, height: undefined }
          let estimatedSize = undefined
          
          try {
            const img = new Image()
            await new Promise((resolve, reject) => {
              const timeoutId = setTimeout(() => {
                console.warn('Cover image load timeout:', coverImageUrl)
                resolve(false)
              }, 10000) // 10 second timeout
              
              img.onload = () => {
                clearTimeout(timeoutId)
                dimensions = {
                  width: img.naturalWidth,
                  height: img.naturalHeight
                }
                estimatedSize = estimateImageSize(img.naturalWidth, img.naturalHeight, baseMetadata.extension)
                resolve(true)
              }
              img.onerror = () => {
                clearTimeout(timeoutId)
                console.warn('Failed to load cover image for dimensions:', coverImageUrl)
                resolve(false)
              }
              
              // Handle CORS issues gracefully
              img.crossOrigin = 'anonymous'
              img.src = coverImageUrl
            })
          } catch (error) {
            // If we can't load the image, continue without dimensions
            console.warn('Could not load cover image for dimensions:', error)
          }
          
          const metadata = {
            ...baseMetadata,
            ...dimensions,
            estimatedSize,
            isCoverImage: true
          }
          
          // Check health for external URLs
          let health
          if (!metadata.isUpload) {
            health = await checkImageHealth(coverImageUrl)
          }
          
          imageInfos.push({
            url: coverImageUrl,
            alt: coverImageAlt || '',
            metadata,
            health
          })
        }

        // Extract images from rich content HTML
        if (content?.html) {
          const imageUrls = extractImageUrlsFromHtml(content.html)
          const parser = new DOMParser()
          const doc = parser.parseFromString(content.html, 'text/html')
          const imgElements = doc.querySelectorAll('img')
          
          for (const img of Array.from(imgElements)) {
            const url = img.src
            const alt = img.alt || ''
            
            // Skip if this is the same as cover image (avoid duplicates)
            if (coverImageUrl && url === coverImageUrl) {
              continue
            }
            
            const baseMetadata = detectImageType(url)
            
            // Try to get accurate dimensions by loading the image
            let dimensions = { width: img.naturalWidth || undefined, height: img.naturalHeight || undefined }
            let estimatedSize = undefined
            
            // If naturalWidth/Height are not available, try loading the image
            if (!dimensions.width || !dimensions.height) {
              try {
                const testImg = new Image()
                await new Promise((resolve, reject) => {
                  const timeoutId = setTimeout(() => resolve(false), 5000) // 5 second timeout
                  
                  testImg.onload = () => {
                    clearTimeout(timeoutId)
                    dimensions = {
                      width: testImg.naturalWidth,
                      height: testImg.naturalHeight
                    }
                    resolve(true)
                  }
                  testImg.onerror = () => {
                    clearTimeout(timeoutId)
                    resolve(false)
                  }
                  
                  testImg.crossOrigin = 'anonymous'
                  testImg.src = url
                })
              } catch (error) {
                console.warn('Failed to load content image dimensions:', url, error)
              }
            }
            
            // Calculate estimated size if we have dimensions
            if (dimensions.width && dimensions.height) {
              estimatedSize = estimateImageSize(dimensions.width, dimensions.height, baseMetadata.extension)
            }
            
            const metadata = {
              ...baseMetadata,
              ...dimensions,
              estimatedSize
            }
            
            // Check health for external URLs
            let health
            if (!metadata.isUpload) {
              health = await checkImageHealth(url)
            }
            
            imageInfos.push({
              url,
              alt,
              metadata,
              health
            })
          }
        }
        
        setImages(imageInfos)
      } catch (error) {
        console.error('Failed to extract images:', error)
        setImages([])
      } finally {
        setLoading(false)
      }
    }

    extractImages()
  }, [content, coverImageUrl, coverImageAlt])

  // Apply focus filtering if focusedImageUrl is set
  const filteredImages = focusedImageUrl 
    ? images.filter(img => img.url === focusedImageUrl)
    : images

  const coverImage = filteredImages.find(img => img.metadata.isCoverImage)
  const contentImages = filteredImages.filter(img => !img.metadata.isCoverImage)
  const uploadedImages = contentImages.filter(img => img.metadata.isUpload)
  const externalImages = contentImages.filter(img => !img.metadata.isUpload)

  return (
    <div className={`fixed right-0 top-0 h-screen bg-white border-l border-gray-200 shadow-lg transition-transform duration-300 z-40 flex flex-col ${
      isOpen ? 'translate-x-0' : 'translate-x-full'
    }`} style={{ width: '320px' }}>
      {/* Header - Fixed */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0 bg-white shadow-sm">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">
            {focusedImageUrl ? 'Focused Image' : 'Image Management'}
          </h3>
          {focusedImageUrl && (
            <button
              onClick={onToggle}
              className="text-sm text-blue-600 hover:text-blue-800 underline mt-1"
            >
              ← View All Images
            </button>
          )}
          
          {/* Metadata Toggles */}
          <div className="flex flex-col gap-2 mt-2">
            <label className="flex items-center text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showMetadata}
                onChange={(e) => handleMetadataToggle(e.target.checked)}
                className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Show detailed metadata
            </label>
            
            {showMetadata && (
              <label className="flex items-center text-sm text-gray-600 cursor-pointer ml-4">
                <input
                  type="checkbox"
                  checked={smartLayout}
                  onChange={(e) => handleSmartLayoutToggle(e.target.checked)}
                  className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Smart layout (expand long data)
              </label>
            )}
          </div>
        </div>
        <SmartTooltip content="Close panel">
          <button
            onClick={onToggle}
            className="p-1 rounded-md hover:bg-gray-100 transition-colors"
          >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          </button>
        </SmartTooltip>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <svg className="w-6 h-6 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="ml-2 text-sm text-gray-600">Analyzing images...</span>
          </div>
        ) : filteredImages.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm text-gray-500">
              {focusedImageUrl ? 'Focused image not found' : 'No images found in this post'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-gray-50 rounded-lg p-3">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Summary</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center">
                  <ImageBadge metadata={{ isUpload: true, source: 'upload' }} size="sm" className="mr-2" />
                  <span>{uploadedImages.length} Uploaded</span>
                </div>
                <div className="flex items-center">
                  <ImageBadge metadata={{ isUpload: false, source: 'external' }} size="sm" className="mr-2" />
                  <span>{externalImages.length} External</span>
                </div>
              </div>
              {coverImage && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <div className="flex items-center text-sm">
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800 mr-2">
                      🖼️ Cover
                    </span>
                    <span className="text-gray-600">1 Cover Image</span>
                  </div>
                </div>
              )}
            </div>

            {/* Cover Image Section */}
            {coverImage && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800 mr-2">
                    🖼️ Cover Image
                  </span>
                </h4>
                <div className="space-y-3">
                  <ImageItem
                    key={`cover-${coverImage.url}`}
                    image={coverImage}
                    showMetadata={showMetadata}
                    smartLayout={smartLayout}
                    onCopyUrl={onCopyUrl}
                    onReplaceUpload={onReplaceUpload}
                    onEditAltText={onEditAltText}
                    onRemoveImage={onRemoveImage}
                    compressionState={getCompressionState(coverImage.url)}
                    isCompressionEnabled={isCompressionEnabled}
                    onCompressionSettingChange={handleCompressionSettingChange}
                    onCompressImage={handleCompressImage}
                  />
                </div>
              </div>
            )}

            {/* Uploaded Images */}
            {uploadedImages.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                  <ImageBadge metadata={{ isUpload: true, source: 'upload' }} size="sm" className="mr-2" />
                  Uploaded Files ({uploadedImages.length})
                </h4>
                <div className="space-y-3">
                  {uploadedImages.map((image, index) => (
                    <ImageItem
                      key={`upload-${index}`}
                      image={image}
                      showMetadata={showMetadata}
                      smartLayout={smartLayout}
                      onCopyUrl={onCopyUrl}
                      onReplaceUpload={onReplaceUpload}
                      onEditAltText={onEditAltText}
                      onRemoveImage={onRemoveImage}
                      compressionState={getCompressionState(image.url)}
                      isCompressionEnabled={isCompressionEnabled}
                      onCompressionSettingChange={handleCompressionSettingChange}
                      onCompressImage={handleCompressImage}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* External Images */}
            {externalImages.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                  <ImageBadge metadata={{ isUpload: false, source: 'external' }} size="sm" className="mr-2" />
                  External URLs ({externalImages.length})
                </h4>
                <div className="space-y-3">
                  {externalImages.map((image, index) => (
                    <ImageItem
                      key={`external-${index}`}
                      image={image}
                      showMetadata={showMetadata}
                      smartLayout={smartLayout}
                      onCopyUrl={onCopyUrl}
                      onReplaceUpload={onReplaceUpload}
                      onEditAltText={onEditAltText}
                      onRemoveImage={onRemoveImage}
                      compressionState={getCompressionState(image.url)}
                      isCompressionEnabled={isCompressionEnabled}
                      onCompressionSettingChange={handleCompressionSettingChange}
                      onCompressImage={handleCompressImage}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Individual image item component
const ImageItem: React.FC<{
  image: ImageInfo
  showMetadata: boolean
  smartLayout: boolean
  onCopyUrl: (url: string) => void
  onReplaceUpload: (currentUrl: string) => void
  onEditAltText: (url: string, currentAlt: string) => void
  onRemoveImage: (url: string) => void
  compressionState?: {
    enabled: boolean;
    quality: 'high' | 'balanced' | 'aggressive' | 'custom';
    customQuality: number;
    compressing: boolean;
    result?: { url: string; stats: string };
  }
  isCompressionEnabled?: boolean
  onCompressionSettingChange?: (imageUrl: string, key: string, value: any) => void
  onCompressImage?: (imageUrl: string) => void
}> = ({ 
  image, 
  showMetadata, 
  smartLayout, 
  onCopyUrl, 
  onReplaceUpload, 
  onEditAltText, 
  onRemoveImage,
  compressionState,
  isCompressionEnabled,
  onCompressionSettingChange,
  onCompressImage
}) => {
  const warning = getImageWarning(image.metadata, image.health)
  
  // Helper function to determine if data should be displayed full-width
  const shouldUseFullWidth = (text: string, threshold: number = 25) => {
    return smartLayout && text && text.length > threshold
  }
  
  // Categorize metadata fields by length for smart layout
  const urlNeedsFullWidth = shouldUseFullWidth(image.url, 30)
  const altTextNeedsFullWidth = shouldUseFullWidth(image.alt || '', 40)
  const filenameNeedsFullWidth = shouldUseFullWidth(image.metadata.fileName || '', 20)
  const domainNeedsFullWidth = shouldUseFullWidth(image.metadata.domain || '', 15)
  
  return (
    <div className="border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors">
      {/* Image Preview */}
      <div className="flex items-start space-x-3 mb-3">
        <div className="relative">
          <img
            src={image.url}
            alt={image.alt}
            className="w-12 h-12 object-cover rounded border"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.style.display = 'none'
            }}
          />
          <div className="absolute -top-1 -right-1">
            <ImageBadge metadata={image.metadata} size="sm" />
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <SmartTooltip content={image.url}>
            <p className="text-xs font-medium text-gray-900 truncate">
              {image.metadata.isCoverImage ? 'Cover Image' : (image.metadata.fileName || image.metadata.domain || 'Image')}
            </p>
          </SmartTooltip>
          <div className="flex items-center gap-2 mt-1">
            {image.metadata.isCoverImage ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                🖼️ Cover
              </span>
            ) : (
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                image.metadata.isUpload 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'bg-orange-100 text-orange-800'
              }`}>
                {image.metadata.isUpload ? '📁 Upload' : '🔗 External'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Smart Metadata Layout - Conditionally Rendered */}
      {showMetadata && (
        <div className="mb-3 space-y-2">
          {/* Alt Text - Full width if long */}
          <div className={altTextNeedsFullWidth ? "w-full" : ""}>
            <p className="text-xs text-gray-600 mb-1">Alt text:</p>
            <div className="text-xs bg-gray-50 rounded px-2 py-1 min-h-[24px]">
              {image.alt ? (
                smartLayout ? (
                  <span className="text-xs text-gray-700 break-words">{image.alt}</span>
                ) : (
                  <TruncatedText
                    text={image.alt}
                    maxLength={60}
                    className="text-xs text-gray-700"
                  />
                )
              ) : (
                <span className="text-gray-400 italic">No alt text</span>
              )}
            </div>
          </div>
          
          {/* URL - Full width if long */}
          <div className={urlNeedsFullWidth ? "w-full" : ""}>
            <p className="text-xs text-gray-600 mb-1">URL:</p>
            <div className="text-xs bg-gray-50 rounded px-2 py-1 font-mono text-gray-700">
              {smartLayout ? (
                <span className="break-all">{image.url}</span>
              ) : (
                <TruncatedText
                  text={image.url}
                  maxLength={20}
                  className="font-mono text-xs text-gray-700"
                />
              )}
            </div>
          </div>
          
          {/* Filename - Full width if long */}
          {image.metadata.fileName && filenameNeedsFullWidth && (
            <div className="w-full">
              <p className="text-xs text-gray-600 mb-1">Filename:</p>
              <div className="text-xs bg-gray-50 rounded px-2 py-1 font-mono text-gray-700">
                <span className="break-all">{image.metadata.fileName}</span>
              </div>
            </div>
          )}
          
          {/* Domain - Full width if long */}
          {image.metadata.domain && !image.metadata.isUpload && domainNeedsFullWidth && (
            <div className="w-full">
              <p className="text-xs text-gray-600 mb-1">Domain:</p>
              <div className="text-xs bg-gray-50 rounded px-2 py-1 font-mono text-gray-700">
                <span className="break-all">{image.metadata.domain}</span>
              </div>
            </div>
          )}
          
          {/* Compact Grid for Short Data */}
          <div className="grid grid-cols-2 gap-3">
            {/* Dimensions */}
            <div>
              <p className="text-xs text-gray-600 mb-1">Dimensions:</p>
              {image.metadata.width && image.metadata.height ? (
                <span className="text-xs text-gray-700 font-mono">
                  {image.metadata.width} × {image.metadata.height}px
                </span>
              ) : (
                <span className="text-xs text-gray-400 italic">Unable to detect</span>
              )}
            </div>
            
            {/* File Size */}
            <div>
              <p className="text-xs text-gray-600 mb-1">File Size:</p>
              {image.metadata.estimatedSize ? (
                <span className="text-xs text-gray-700">{image.metadata.estimatedSize}</span>
              ) : (
                <span className="text-xs text-gray-400 italic">Unable to estimate</span>
              )}
            </div>
            
            {/* File Format */}
            {image.metadata.extension && (
              <div>
                <p className="text-xs text-gray-600 mb-1">Format:</p>
                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                  .{image.metadata.extension.toUpperCase()}
                </span>
              </div>
            )}
            
            {/* Source Type */}
            <div>
              <p className="text-xs text-gray-600 mb-1">Source:</p>
              <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                image.metadata.isCoverImage 
                  ? 'bg-purple-100 text-purple-800'
                  : image.metadata.isUpload 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-orange-100 text-orange-800'
              }`}>
                {image.metadata.isCoverImage 
                  ? '🖼️ Cover'
                  : image.metadata.isUpload 
                    ? '📁 Upload' 
                    : '🔗 External'
                }
              </span>
            </div>
            
            {/* Short Filename in Grid */}
            {image.metadata.fileName && !filenameNeedsFullWidth && (
              <div>
                <p className="text-xs text-gray-600 mb-1">Filename:</p>
                {smartLayout ? (
                  <span className="text-xs text-gray-700 font-mono break-all">{image.metadata.fileName}</span>
                ) : (
                  <TruncatedText
                    text={image.metadata.fileName}
                    maxLength={12}
                    className="text-xs text-gray-700 font-mono"
                  />
                )}
              </div>
            )}
            
            {/* Short Domain in Grid */}
            {image.metadata.domain && !image.metadata.isUpload && !domainNeedsFullWidth && (
              <div>
                <p className="text-xs text-gray-600 mb-1">Domain:</p>
                {smartLayout ? (
                  <span className="text-xs text-gray-700 font-mono break-all">{image.metadata.domain}</span>
                ) : (
                  <TruncatedText
                    text={image.metadata.domain}
                    maxLength={12}
                    className="text-xs text-gray-700 font-mono"
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Warning */}
      {warning && (
        <div className={`mb-3 p-2 rounded text-xs ${
          warning.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
          warning.type === 'warning' ? 'bg-yellow-50 text-yellow-800 border border-yellow-200' :
          'bg-blue-50 text-blue-800 border border-blue-200'
        }`}>
          {warning.message}
        </div>
      )}

      {/* Compression Controls */}
      {compressionState && isCompressionEnabled && onCompressionSettingChange && onCompressImage && (
        <div className="mb-3 p-3 bg-blue-50 rounded-md border border-blue-200">
          <div className="flex items-center mb-2">
            <svg className="w-4 h-4 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
            </svg>
            <h5 className="text-sm font-medium text-blue-800">New Compression System</h5>
          </div>
          <p className="text-xs text-blue-600 mb-3">Server-side Sharp compression with configurable quality</p>
          
          <CompressionControls
            enabled={compressionState.enabled}
            quality={compressionState.quality}
            customQuality={compressionState.customQuality}
            onEnabledChange={(enabled) => onCompressionSettingChange(image.url, 'enabled', enabled)}
            onQualityChange={(quality) => onCompressionSettingChange(image.url, 'quality', quality)}
            onCustomQualityChange={(quality) => onCompressionSettingChange(image.url, 'customQuality', quality)}
            disabled={false}
            size="sm"
          />
          
          {compressionState.enabled && (
            <div className="mt-3 flex items-center space-x-2">
              <button
                onClick={() => onCompressImage(image.url)}
                disabled={compressionState.compressing}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  compressionState.compressing
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
                }`}
              >
                {compressionState.compressing ? 'Compressing...' : 'Compress Image'}
              </button>
              
              {compressionState.result && (
                <div className="text-xs text-green-600 font-medium">
                  ✓ {compressionState.result.stats}
                </div>
              )}
            </div>
          )}
          
          {compressionState.result && (
            <div className="mt-2 text-xs text-gray-600">
              <SmartTooltip content="The compressed image will replace the original in your post">
                <span className="underline decoration-dotted">Compressed version will be used</span>
              </SmartTooltip>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-1">
        <SmartTooltip content="Copy URL">
          <button
            onClick={() => onCopyUrl(image.url)}
            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded transition-colors"
          >
            📋 Copy URL
          </button>
        </SmartTooltip>
        
        {!image.metadata.isUpload && (
          <SmartTooltip content="Replace with upload">
            <button
              onClick={() => onReplaceUpload(image.url)}
              className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs rounded transition-colors"
            >
              ⬆️ Upload
            </button>
          </SmartTooltip>
        )}
        
        <SmartTooltip content="Edit alt text">
          <button
            onClick={() => onEditAltText(image.url, image.alt || '')}
            className="px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 text-xs rounded transition-colors"
          >
            ✏️ Alt
          </button>
        </SmartTooltip>
        
        <SmartTooltip content="Remove image">
          <button
            onClick={() => onRemoveImage(image.url)}
            className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-xs rounded transition-colors"
          >
            🗑️ Remove
          </button>
        </SmartTooltip>
      </div>
    </div>
  )
}

export default ImageManagementPanel
