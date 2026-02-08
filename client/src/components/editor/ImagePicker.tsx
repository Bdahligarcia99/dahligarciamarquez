// Image Picker Modal Component
import { useState, useRef, useEffect } from 'react'
import { isLargeImage, loadImageDimensions, compressImage, formatFileSize, formatDimensions } from '../../utils/image'
import { generateAltText } from '../../utils/altTextGenerator'
import { useCompressionSettingsStatic } from '../../hooks/useCompressionSettings'
import { compressImageFromUrl } from '../../lib/compressionApi'
import { supabaseAdminGet } from '../../lib/api'
import { getAllPageWallpapers } from '../../lib/wallpaperApi'
import CompressionControls from './CompressionControls'

// Session-based state for preview preferences
let sessionImagePickerPreviewState = false

interface LibraryImage {
  id: string
  url: string
  alt_text?: string
  source: string
  post_title?: string
  page_id?: string
  file_size_bytes?: number
  width?: number
  height?: number
}

interface ImagePickerProps {
  open: boolean
  onClose: () => void
  onConfirm: (payload: { file?: File; url?: string; alt: string }) => void
  showLibraryOption?: boolean // Whether to show the "Browse Library" tab
}

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export default function ImagePicker({ open, onClose, onConfirm, showLibraryOption = true }: ImagePickerProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [altText, setAltText] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [errors, setErrors] = useState<{ file?: string; url?: string; alt?: string }>({})
  const [isLarge, setIsLarge] = useState(false)
  const [originalDimensions, setOriginalDimensions] = useState<{ width: number; height: number } | null>(null)
  const [isCompressing, setIsCompressing] = useState(false)
  const [compressionResult, setCompressionResult] = useState<{ 
    originalSize: number; 
    newSize: number; 
    originalDimensions: { width: number; height: number };
    newDimensions: { width: number; height: number };
  } | null>(null)
  const [inputMethod, setInputMethod] = useState<'url' | 'file' | 'library'>('url')
  const [showPreview, setShowPreview] = useState(sessionImagePickerPreviewState)
  
  // Library browser state
  const [libraryImages, setLibraryImages] = useState<LibraryImage[]>([])
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'upload' | 'wallpaper' | 'post_cover' | 'post_inline'>('all')
  const [librarySearch, setLibrarySearch] = useState('')
  const [selectedLibraryImage, setSelectedLibraryImage] = useState<LibraryImage | null>(null)
  
  // Compression settings and state
  const { settings: compressionSettings, isCompressionEnabled } = useCompressionSettingsStatic()
  const [compressionEnabled, setCompressionEnabled] = useState(false)
  
  // Check if legacy compression is enabled
  const isLegacyCompressionEnabled = compressionSettings?.enable_legacy_compression ?? true
  const [compressionQuality, setCompressionQuality] = useState<'high' | 'balanced' | 'aggressive' | 'custom'>('balanced')
  const [customQuality, setCustomQuality] = useState(75)
  const [urlCompressionResult, setUrlCompressionResult] = useState<{
    originalUrl: string
    compressedUrl: string
    stats: string
  } | null>(null)

  // Update session state when local state changes
  const handlePreviewToggle = (checked: boolean) => {
    setShowPreview(checked)
    sessionImagePickerPreviewState = checked
  }

  // Fetch library images when switching to library tab
  const fetchLibraryImages = async () => {
    setLibraryLoading(true)
    try {
      // Fetch regular images
      const data = await supabaseAdminGet('/api/images')
      const images: LibraryImage[] = data.images || []
      
      // Fetch wallpapers
      const wallpaperResult = await getAllPageWallpapers()
      if (wallpaperResult.data?.wallpapers) {
        Object.entries(wallpaperResult.data.wallpapers).forEach(([pageId, wallpaper]: [string, any]) => {
          if (wallpaper?.url) {
            images.push({
              id: `wallpaper-${pageId}`,
              url: wallpaper.url,
              alt_text: wallpaper.alt || `${pageId} page wallpaper`,
              source: 'wallpaper',
              post_title: `${pageId.charAt(0).toUpperCase() + pageId.slice(1)} Wallpaper`,
              page_id: pageId
            })
          }
        })
      }
      
      setLibraryImages(images)
    } catch (err) {
      console.error('Failed to fetch library images:', err)
    } finally {
      setLibraryLoading(false)
    }
  }

  // Handle selecting an image from the library
  const handleLibraryImageSelect = (image: LibraryImage) => {
    setSelectedLibraryImage(image)
    setPreviewUrl(image.url)
    // Auto-fill alt text if available
    if (image.alt_text && !altText.trim()) {
      setAltText(image.alt_text)
    }
    // Clear file and URL inputs
    setSelectedFile(null)
    setImageUrl('')
    setErrors({})
  }

  const modalRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const altInputRef = useRef<HTMLInputElement>(null)
  const insertButtonRef = useRef<HTMLButtonElement>(null)

  // Focus management and escape handling
  useEffect(() => {
    if (open) {
      // Focus the modal when it opens
      modalRef.current?.focus()
      
      // Handle escape key
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          handleClose()
        }
      }
      
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  // Fetch library images when switching to library tab
  useEffect(() => {
    if (inputMethod === 'library' && libraryImages.length === 0) {
      fetchLibraryImages()
    }
  }, [inputMethod])

  // Clean up preview URL when component unmounts or file changes
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return 'Please select a PNG, JPG, or WebP image file.'
    }
    
    if (file.size > MAX_FILE_SIZE) {
      return `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB. Current size: ${(file.size / 1024 / 1024).toFixed(1)}MB.`
    }
    
    return null
  }

  const handleFileSelect = async (file: File) => {
    const fileError = validateFile(file)
    
    if (fileError) {
      setErrors(prev => ({ ...prev, file: fileError }))
      setSelectedFile(null)
      setPreviewUrl(null)
      setIsLarge(false)
      setOriginalDimensions(null)
      setCompressionResult(null)
      return
    }

    // Clear previous preview URL
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }

    // Clear URL input when file is selected
    setImageUrl('')
    setInputMethod('file')
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setErrors(prev => ({ ...prev, file: undefined, url: undefined }))
    setCompressionResult(null)
    
    // Auto-generate alt text from filename if alt text is empty
    if (!altText.trim()) {
      const generatedAlt = generateAltText({
        filename: file.name
      })
      setAltText(generatedAlt)
    }

    // Check if image is large and load dimensions
    try {
      const [large, dimensions] = await Promise.all([
        isLargeImage(file),
        loadImageDimensions(file)
      ])
      
      setIsLarge(large)
      setOriginalDimensions(dimensions)
    } catch (error) {
      console.warn('Failed to check image size/dimensions:', error)
      setIsLarge(false)
      setOriginalDimensions(null)
    }
  }

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value
    setImageUrl(url)
    
    if (url.trim()) {
      // Clear file selection when URL is entered
      if (selectedFile) {
        setSelectedFile(null)
        if (previewUrl && previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(previewUrl)
        }
        setIsLarge(false)
        setOriginalDimensions(null)
        setCompressionResult(null)
      }
      setInputMethod('url')
      setErrors(prev => ({ ...prev, url: undefined, file: undefined }))
      
      // Set preview URL for immediate display (but don't cause layout shifts)
      setPreviewUrl(url.trim())
    } else {
      // Only revoke blob URLs when clearing
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl)
      }
      setPreviewUrl(null)
      setErrors(prev => ({ ...prev, url: undefined }))
    }
  }

  const handleCompressUrl = async () => {
    if (!imageUrl.trim()) return

    setIsCompressing(true)
    setErrors(prev => ({ ...prev, url: undefined }))

    try {
      const quality = compressionQuality === 'custom' ? customQuality : compressionQuality
      const result = await compressImageFromUrl(imageUrl, { quality })
      
      setUrlCompressionResult({
        originalUrl: imageUrl,
        compressedUrl: result.url,
        stats: result.compressionStats
      })
      
      // Auto-generate alt text from URL if alt text is empty
      if (!altText.trim()) {
        const generatedAlt = generateAltText({
          url: imageUrl
        })
        setAltText(generatedAlt)
      }
    } catch (error) {
      console.error('URL compression failed:', error)
      setErrors(prev => ({ 
        ...prev, 
        url: error instanceof Error ? error.message : 'Failed to compress image from URL'
      }))
    } finally {
      setIsCompressing(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    // Only set drag over to false if we're leaving the drop zone entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleAltTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setAltText(value)
    
    if (value.trim()) {
      setErrors(prev => ({ ...prev, alt: undefined }))
    }
  }

  const handleCompress = async () => {
    if (!selectedFile || !originalDimensions) return

    setIsCompressing(true)
    
    try {
      const compressedFile = await compressImage(selectedFile)
      const compressedDimensions = await loadImageDimensions(compressedFile)
      
      // Clear previous preview URL
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
      
      // Update state with compressed file
      setSelectedFile(compressedFile)
      setPreviewUrl(URL.createObjectURL(compressedFile))
      setIsLarge(false) // Compressed file should no longer be large
      setCompressionResult({
        originalSize: selectedFile.size,
        newSize: compressedFile.size,
        originalDimensions,
        newDimensions: compressedDimensions
      })
      
      // Focus the Insert button after compression
      setTimeout(() => {
        insertButtonRef.current?.focus()
      }, 100)
      
    } catch (error) {
      console.error('Compression failed:', error)
      setErrors(prev => ({ ...prev, file: 'Failed to compress image. Please try a different image.' }))
    } finally {
      setIsCompressing(false)
    }
  }

  const handleKeepOriginal = () => {
    setIsLarge(false) // Hide the warning
    // Focus the Insert button
    setTimeout(() => {
      insertButtonRef.current?.focus()
    }, 100)
  }

  const handleClose = () => {
    // Clean up state
    setSelectedFile(null)
    setImageUrl('')
    setAltText('')
    setErrors({})
    setIsDragOver(false)
    setIsLarge(false)
    setOriginalDimensions(null)
    setIsCompressing(false)
    setCompressionResult(null)
    setInputMethod('url')
    // Note: Don't reset showPreview to maintain session preference
    
    // Reset library state
    setSelectedLibraryImage(null)
    setLibraryFilter('all')
    setLibrarySearch('')
    
    // Only revoke blob URLs (uploaded files), not external URLs
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl(null)
    
    onClose()
  }

  const handleConfirm = () => {
    const newErrors: { file?: string; url?: string; alt?: string } = {}
    
    if (!selectedFile && !imageUrl.trim() && !selectedLibraryImage) {
      newErrors.file = 'Please select an image file, enter an image URL, or choose from library.'
    }
    
    if (!altText.trim()) {
      newErrors.alt = 'Alt text is required for accessibility.'
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      
      // Focus the first error field
      if (newErrors.alt && altInputRef.current) {
        altInputRef.current.focus()
      }
      
      return
    }
    
    // Pass either file, URL, or library image URL to parent
    if (selectedFile) {
      onConfirm({ file: selectedFile, alt: altText.trim() })
    } else if (selectedLibraryImage) {
      onConfirm({ url: selectedLibraryImage.url, alt: altText.trim() })
    } else {
      // Use compressed URL if available, otherwise use original URL
      const finalUrl = urlCompressionResult?.compressedUrl || imageUrl.trim()
      onConfirm({ url: finalUrl, alt: altText.trim() })
    }
    
    handleClose()
  }

  const isValid = (selectedFile || imageUrl.trim() || selectedLibraryImage) && altText.trim() && !errors.file && !errors.alt && !errors.url

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div
        ref={modalRef}
        role="dialog"
        aria-labelledby="image-picker-title"
        aria-modal="true"
        tabIndex={-1}
        className="bg-gray-900 rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto border border-gray-700"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 id="image-picker-title" className="text-lg font-semibold text-gray-100">
            Insert Image
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close dialog"
            className="text-gray-400 hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs - only show if library option is enabled */}
        {showLibraryOption && (
          <div className="border-b border-gray-700 px-6">
            <nav className="flex space-x-6">
              <button
                onClick={() => {
                  setInputMethod('url')
                  setSelectedLibraryImage(null)
                }}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  inputMethod !== 'library'
                    ? 'border-cyan-500 text-cyan-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
                }`}
              >
                URL / Upload
              </button>
              <button
                onClick={() => {
                  setInputMethod('library')
                  setSelectedFile(null)
                  setImageUrl('')
                }}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                  inputMethod === 'library'
                    ? 'border-cyan-500 text-cyan-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Browse Library
              </button>
            </nav>
          </div>
        )}

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Library Browser */}
          {inputMethod === 'library' && (
            <div className="space-y-4">
              {/* Search and Filter */}
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Search images..."
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
                <select
                  value={libraryFilter}
                  onChange={(e) => setLibraryFilter(e.target.value as any)}
                  className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                >
                  <option value="all">All</option>
                  <option value="upload">Uploaded</option>
                  <option value="wallpaper">Wallpapers</option>
                  <option value="post_cover">Cover Images</option>
                  <option value="post_inline">Inline</option>
                </select>
              </div>
              
              {/* Image Grid */}
              {libraryLoading ? (
                <div className="flex items-center justify-center py-12">
                  <svg className="animate-spin h-8 w-8 text-cyan-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                  {libraryImages
                    .filter(img => {
                      const matchesFilter = libraryFilter === 'all' || img.source === libraryFilter
                      const matchesSearch = !librarySearch || 
                        img.alt_text?.toLowerCase().includes(librarySearch.toLowerCase()) ||
                        img.post_title?.toLowerCase().includes(librarySearch.toLowerCase())
                      return matchesFilter && matchesSearch
                    })
                    .map((image) => (
                      <button
                        key={image.id}
                        onClick={() => handleLibraryImageSelect(image)}
                        className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                          selectedLibraryImage?.id === image.id
                            ? 'border-cyan-500 ring-2 ring-cyan-500/30'
                            : 'border-gray-600 hover:border-gray-500'
                        }`}
                      >
                        <img
                          src={image.url}
                          alt={image.alt_text || 'Library image'}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik0xNiAzMkwyMi41ODYgMjUuNDE0QzIzLjM2NyAyNC42MzMgMjQuNjMzIDI0LjYzMyAyNS40MTQgMjUuNDE0TDMyIDMyTTI4IDI4TDMwLjU4NiAyNS40MTRDMzEuMzY3IDI0LjYzMyAzMi42MzMgMjQuNjMzIDMzLjQxNCAyNS40MTRMMzYgMjhNMjYgMjBIMjYuMDFNMTggMzZIMzBDMzIuMjA5IDM2IDM0IDM0LjIwOSAzNCAzMlYxNkMzNCAxMy43OTEgMzIuMjA5IDEyIDMwIDEySDE4QzE1Ljc5MSAxMiAxNCAxMy43OTEgMTQgMTZWMzJDMTQgMzQuMjA5IDE1Ljc5MSAzNiAxOCAzNloiIHN0cm9rZT0iIzZCNzI4MCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+'
                          }}
                        />
                        {selectedLibraryImage?.id === image.id && (
                          <div className="absolute top-1 right-1 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                        {/* Source badge */}
                        <div className="absolute bottom-1 left-1">
                          <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                            image.source === 'wallpaper' ? 'bg-amber-900/80 text-amber-300' :
                            image.source === 'upload' ? 'bg-cyan-900/80 text-cyan-300' :
                            image.source === 'post_cover' ? 'bg-green-900/80 text-green-300' :
                            'bg-purple-900/80 text-purple-300'
                          }`}>
                            {image.source === 'wallpaper' ? '🏞️' :
                             image.source === 'upload' ? '📁' :
                             image.source === 'post_cover' ? '🖼️' : '📝'}
                          </span>
                        </div>
                      </button>
                    ))}
                </div>
              )}
              
              {/* No results */}
              {!libraryLoading && libraryImages.filter(img => {
                const matchesFilter = libraryFilter === 'all' || img.source === libraryFilter
                const matchesSearch = !librarySearch || 
                  img.alt_text?.toLowerCase().includes(librarySearch.toLowerCase()) ||
                  img.post_title?.toLowerCase().includes(librarySearch.toLowerCase())
                return matchesFilter && matchesSearch
              }).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm">No images found</p>
                </div>
              )}
              
              {/* Selected image preview */}
              {selectedLibraryImage && (
                <div className="p-3 bg-cyan-900/30 rounded-lg border border-cyan-700">
                  <div className="flex items-center gap-3">
                    <img
                      src={selectedLibraryImage.url}
                      alt={selectedLibraryImage.alt_text || 'Selected image'}
                      className="w-16 h-16 object-cover rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-200 truncate">
                        {selectedLibraryImage.post_title || 'Library Image'}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {selectedLibraryImage.alt_text || 'No alt text'}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedLibraryImage(null)
                        setPreviewUrl(null)
                        setAltText('')
                      }}
                      className="text-gray-400 hover:text-gray-200"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* URL / Upload Content */}
          {inputMethod !== 'library' && (
            <>
          {/* Image URL Input - at the top */}
          <div>
            <label htmlFor="image-url" className="block text-sm font-medium text-gray-300 mb-2">
              Image URL
            </label>
            <input
              type="url"
              id="image-url"
              value={imageUrl}
              onChange={handleUrlChange}
              aria-invalid={!!errors.url}
              className={`w-full px-3 py-2 bg-gray-800 border rounded-md text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${
                errors.url ? 'border-red-500' : 'border-gray-600'
              }`}
              placeholder="https://example.com/image.jpg"
            />
            {errors.url && (
              <p className="mt-1 text-sm text-red-400" role="alert">
                {errors.url}
              </p>
            )}
            
            {/* New Compression System - URL */}
            {imageUrl.trim() && (
              <div className="mt-3 p-3 bg-cyan-900/30 rounded-md border border-cyan-700">
                <div className="flex items-center mb-2">
                  <svg className="w-4 h-4 text-cyan-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                  </svg>
                  <h4 className="text-sm font-medium text-cyan-300">New Compression System</h4>
                </div>
                <p className="text-xs text-cyan-400/70 mb-3">Server-side Sharp compression with configurable quality and format options</p>
                <CompressionControls
                  enabled={compressionEnabled}
                  quality={compressionQuality}
                  customQuality={customQuality}
                  onEnabledChange={setCompressionEnabled}
                  onQualityChange={setCompressionQuality}
                  onCustomQualityChange={setCustomQuality}
                  disabled={!isCompressionEnabled}
                  disabledTooltip="Please turn on compression in settings"
                  size="sm"
                />
                
                {isCompressionEnabled && compressionEnabled && (
                  <div className="mt-3 flex items-center space-x-2">
                    <button
                      onClick={handleCompressUrl}
                      disabled={isCompressing}
                      className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                        isCompressing
                          ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                          : 'bg-cyan-600 text-white hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500'
                      }`}
                    >
                      {isCompressing ? 'Compressing...' : 'Download & Compress'}
                    </button>
                    
                    {urlCompressionResult && (
                      <div className="text-xs text-green-400 font-medium">
                        ✓ {urlCompressionResult.stats}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-900 text-gray-500">or</span>
            </div>
          </div>

          {/* File Drop Zone */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Select Image
            </label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                isDragOver
                  ? 'border-cyan-400 bg-cyan-900/20'
                  : errors.file
                  ? 'border-red-500 bg-red-900/20'
                  : 'border-gray-600 hover:border-gray-500'
              }`}
            >
              <svg
                className={`mx-auto h-12 w-12 ${
                  isDragOver ? 'text-cyan-400' : 'text-gray-500'
                }`}
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="mt-4">
                <p className="text-sm text-gray-400">
                  Drop an image here, or{' '}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-cyan-400 hover:text-cyan-300 font-medium focus:outline-none focus:underline"
                  >
                    choose a file
                  </button>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  PNG, JPG, WebP up to 5MB
                </p>
              </div>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp"
              onChange={handleFileInputChange}
              className="hidden"
            />
            
            {errors.file && (
              <p className="mt-2 text-sm text-red-400" role="alert">
                {errors.file}
              </p>
            )}
            
            {/* New Compression System - File */}
            {selectedFile && (
              <div className="mt-3 p-3 bg-cyan-900/30 rounded-md border border-cyan-700">
                <div className="flex items-center mb-2">
                  <svg className="w-4 h-4 text-cyan-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                  </svg>
                  <h4 className="text-sm font-medium text-cyan-300">New Compression System</h4>
                </div>
                <p className="text-xs text-cyan-400/70 mb-3">Server-side Sharp compression with configurable quality and format options</p>
                <CompressionControls
                  enabled={compressionEnabled}
                  quality={compressionQuality}
                  customQuality={customQuality}
                  onEnabledChange={setCompressionEnabled}
                  onQualityChange={setCompressionQuality}
                  onCustomQualityChange={setCustomQuality}
                  disabled={!isCompressionEnabled}
                  disabledTooltip="Please turn on compression in settings"
                  size="sm"
                />
              </div>
            )}
          </div>

          {/* Legacy Compression Warning */}
          {isLegacyCompressionEnabled && isLarge && selectedFile && originalDimensions && !compressionResult && (
            <div 
              role="status" 
              className="bg-amber-900/30 border border-amber-700 rounded-lg p-4"
            >
              <div className="flex items-start">
                <svg className="w-5 h-5 text-amber-400 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-amber-300 mb-1">
                    Large image detected. This may slow page loads.
                  </h4>
                  <p className="text-sm text-amber-400/80 mb-1">
                    Original: {formatDimensions(originalDimensions.width, originalDimensions.height)}, {formatFileSize(selectedFile.size)}
                  </p>
                  <p className="text-xs text-amber-400/60 mb-3">
                    <span className="font-medium">Legacy Compression:</span> Client-side, Canvas-based, fixed 82% quality
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCompress}
                      disabled={isCompressing}
                      className="px-3 py-1 text-sm font-medium text-white bg-amber-600 rounded hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
                    >
                      {isCompressing ? 'Compressing...' : 'Compress (Legacy)'}
                    </button>
                    <button
                      type="button"
                      onClick={handleKeepOriginal}
                      className="px-3 py-1 text-sm font-medium text-amber-300 bg-amber-900/50 border border-amber-600 rounded hover:bg-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      Keep original
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Legacy Compression Disabled Message */}
          {!isLegacyCompressionEnabled && isLarge && selectedFile && originalDimensions && !compressionResult && (
            <div className="border border-gray-700 bg-gray-800 rounded-lg p-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-gray-500 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-gray-300 mb-1">
                    Large image detected
                  </h4>
                  <p className="text-sm text-gray-400 mb-1">
                    Original: {formatDimensions(originalDimensions.width, originalDimensions.height)}, {formatFileSize(selectedFile.size)}
                  </p>
                  <p className="text-xs text-gray-500">
                    Legacy compression is disabled. Use the new compression controls below for better quality and options.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Compression Result */}
          {compressionResult && (
            <div 
              role="status" 
              className="bg-green-900/30 border border-green-700 rounded-lg p-4"
            >
              <div className="flex items-start">
                <svg className="w-5 h-5 text-green-400 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-green-300 mb-2">
                    Image compressed successfully
                  </h4>
                  <p className="text-sm text-green-400/80">
                    Compressed from {formatDimensions(compressionResult.originalDimensions.width, compressionResult.originalDimensions.height)}, {formatFileSize(compressionResult.originalSize)} → {formatDimensions(compressionResult.newDimensions.width, compressionResult.newDimensions.height)}, {formatFileSize(compressionResult.newSize)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Show Preview Checkbox - only show if there's content to preview */}
          {(previewUrl || selectedFile || imageUrl.trim()) && (
            <div className="flex items-center">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={showPreview}
                  onChange={(e) => handlePreviewToggle(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500 focus:ring-2"
                />
                <span className="ml-2 text-sm text-gray-400">Show Preview</span>
              </label>
            </div>
          )}

          {/* Image Preview - Fixed height container to prevent layout shifts */}
          {previewUrl && showPreview && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Preview
              </label>
              <div className="border border-gray-700 rounded-lg p-4 bg-gray-800">
                <div className="relative w-full h-48 flex items-center justify-center">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-w-full max-h-full object-contain rounded"
                    onError={(e) => {
                      // Handle broken image gracefully without layout shift
                      const img = e.target as HTMLImageElement
                      img.style.display = 'none'
                      // Show error message in same space
                      const errorDiv = img.nextElementSibling as HTMLElement
                      if (errorDiv) errorDiv.style.display = 'flex'
                    }}
                    onLoad={(e) => {
                      // Show successful image, hide error message
                      const img = e.target as HTMLImageElement
                      img.style.display = 'block'
                      const errorDiv = img.nextElementSibling as HTMLElement
                      if (errorDiv) errorDiv.style.display = 'none'
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-700 rounded" style={{ display: 'none' }}>
                    <div className="text-center">
                      <svg className="w-8 h-8 text-gray-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <p className="text-sm text-gray-400">Failed to load image</p>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 text-center mt-2">
                  {selectedFile ? (
                    `${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB)`
                  ) : (
                    `URL: ${imageUrl.length > 50 ? imageUrl.substring(0, 50) + '...' : imageUrl}`
                  )}
                </p>
              </div>
            </div>
          )}
            </>
          )}

          {/* Alt Text Input */}
          <div>
            <label htmlFor="alt-text" className="block text-sm font-medium text-gray-300 mb-1">
              Alt Text *
            </label>
            <div className="flex gap-2">
              <input
                ref={altInputRef}
                type="text"
                id="alt-text"
                value={altText}
                onChange={handleAltTextChange}
                aria-invalid={!!errors.alt}
                aria-describedby={errors.alt ? 'alt-text-error' : 'alt-text-help'}
                className={`flex-1 px-3 py-2 bg-gray-800 border rounded-md text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${
                  errors.alt ? 'border-red-500' : 'border-gray-600'
                }`}
                placeholder="Describe the image for screen readers"
              />
              <button
                type="button"
                onClick={() => {
                  const generatedAlt = generateAltText({
                    filename: selectedFile?.name,
                    url: imageUrl
                  })
                  setAltText(generatedAlt)
                }}
                disabled={!selectedFile && !imageUrl.trim()}
                className="px-3 py-2 text-sm bg-gray-700 border border-gray-600 text-gray-300 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Auto-generate alt text from filename"
              >
                Auto-generate
              </button>
            </div>
            {errors.alt ? (
              <p id="alt-text-error" className="mt-1 text-sm text-red-400" role="alert">
                {errors.alt}
              </p>
            ) : (
              <p id="alt-text-help" className="mt-1 text-sm text-gray-500">
                Describe what the image shows for accessibility
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-700">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-600 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            Cancel
          </button>
          <button
            ref={insertButtonRef}
            type="button"
            onClick={handleConfirm}
            disabled={!isValid}
            className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 border border-transparent rounded-md hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Insert
          </button>
        </div>
      </div>
    </div>
  )
}
