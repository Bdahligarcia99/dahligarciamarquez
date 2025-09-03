// Image Picker Modal Component
import { useState, useRef, useEffect } from 'react'
import { isLargeImage, loadImageDimensions, compressImage, formatFileSize, formatDimensions } from '../../utils/image'

interface ImagePickerProps {
  open: boolean
  onClose: () => void
  onConfirm: (payload: { file: File; alt: string }) => void
}

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export default function ImagePicker({ open, onClose, onConfirm }: ImagePickerProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [altText, setAltText] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [errors, setErrors] = useState<{ file?: string; alt?: string }>({})
  const [isLarge, setIsLarge] = useState(false)
  const [originalDimensions, setOriginalDimensions] = useState<{ width: number; height: number } | null>(null)
  const [isCompressing, setIsCompressing] = useState(false)
  const [compressionResult, setCompressionResult] = useState<{ 
    originalSize: number; 
    newSize: number; 
    originalDimensions: { width: number; height: number };
    newDimensions: { width: number; height: number };
  } | null>(null)

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

    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setErrors(prev => ({ ...prev, file: undefined }))
    setCompressionResult(null)

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
    setAltText('')
    setErrors({})
    setIsDragOver(false)
    setIsLarge(false)
    setOriginalDimensions(null)
    setIsCompressing(false)
    setCompressionResult(null)
    
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    
    onClose()
  }

  const handleConfirm = () => {
    const newErrors: { file?: string; alt?: string } = {}
    
    if (!selectedFile) {
      newErrors.file = 'Please select an image file.'
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
    
    onConfirm({ file: selectedFile!, alt: altText.trim() })
    handleClose()
  }

  const isValid = selectedFile && altText.trim() && !errors.file && !errors.alt

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div
        ref={modalRef}
        role="dialog"
        aria-labelledby="image-picker-title"
        aria-modal="true"
        tabIndex={-1}
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 id="image-picker-title" className="text-lg font-semibold text-gray-900">
            Insert Image
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close dialog"
            className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* File Drop Zone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Image
            </label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                isDragOver
                  ? 'border-blue-400 bg-blue-50'
                  : errors.file
                  ? 'border-red-300 bg-red-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <svg
                className={`mx-auto h-12 w-12 ${
                  isDragOver ? 'text-blue-400' : 'text-gray-400'
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
                <p className="text-sm text-gray-600">
                  Drop an image here, or{' '}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-blue-600 hover:text-blue-500 font-medium focus:outline-none focus:underline"
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
              <p className="mt-2 text-sm text-red-600" role="alert">
                {errors.file}
              </p>
            )}
          </div>

          {/* Large Image Warning */}
          {isLarge && selectedFile && originalDimensions && !compressionResult && (
            <div 
              role="status" 
              className="bg-yellow-50 border border-yellow-200 rounded-lg p-4"
            >
              <div className="flex items-start">
                <svg className="w-5 h-5 text-yellow-400 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-yellow-800 mb-2">
                    Large image detected. This may slow page loads.
                  </h4>
                  <p className="text-sm text-yellow-700 mb-3">
                    Original: {formatDimensions(originalDimensions.width, originalDimensions.height)}, {formatFileSize(selectedFile.size)}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCompress}
                      disabled={isCompressing}
                      className="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {isCompressing ? 'Compressing...' : 'Compress'}
                    </button>
                    <button
                      type="button"
                      onClick={handleKeepOriginal}
                      className="px-3 py-1 text-sm font-medium text-yellow-800 bg-yellow-100 border border-yellow-300 rounded hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    >
                      Keep original
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Compression Result */}
          {compressionResult && (
            <div 
              role="status" 
              className="bg-green-50 border border-green-200 rounded-lg p-4"
            >
              <div className="flex items-start">
                <svg className="w-5 h-5 text-green-400 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-green-800 mb-2">
                    Image compressed successfully
                  </h4>
                  <p className="text-sm text-green-700">
                    Compressed from {formatDimensions(compressionResult.originalDimensions.width, compressionResult.originalDimensions.height)}, {formatFileSize(compressionResult.originalSize)} → {formatDimensions(compressionResult.newDimensions.width, compressionResult.newDimensions.height)}, {formatFileSize(compressionResult.newSize)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Image Preview */}
          {previewUrl && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preview
              </label>
              <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-w-full max-h-48 mx-auto rounded"
                />
                <p className="text-xs text-gray-500 text-center mt-2">
                  {selectedFile?.name} ({(selectedFile!.size / 1024).toFixed(1)} KB)
                </p>
              </div>
            </div>
          )}

          {/* Alt Text Input */}
          <div>
            <label htmlFor="alt-text" className="block text-sm font-medium text-gray-700 mb-1">
              Alt Text *
            </label>
            <input
              ref={altInputRef}
              type="text"
              id="alt-text"
              value={altText}
              onChange={handleAltTextChange}
              aria-invalid={!!errors.alt}
              aria-describedby={errors.alt ? 'alt-text-error' : 'alt-text-help'}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.alt ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Describe the image for screen readers"
            />
            {errors.alt ? (
              <p id="alt-text-error" className="mt-1 text-sm text-red-600" role="alert">
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
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            ref={insertButtonRef}
            type="button"
            onClick={handleConfirm}
            disabled={!isValid}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Insert
          </button>
        </div>
      </div>
    </div>
  )
}
