import React, { useState, useEffect } from 'react'
import { apiAdminGet } from '../../lib/api'
import LoadingSpinner from '../../components/LoadingSpinner'
import ImageBadge from '../../components/editor/ImageBadge'
import { detectImageType, formatImageTooltip } from '../../utils/imageTypeDetection'

const ImageLibrary = () => {
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedImage, setSelectedImage] = useState(null)
  const [reconciliationStatus, setReconciliationStatus] = useState(null)
  const [reconciling, setReconciling] = useState(false)
  const [reconciliationHistory, setReconciliationHistory] = useState([])

  useEffect(() => {
    fetchImages()
    fetchReconciliationStatus()
  }, [])

  const fetchReconciliationStatus = async () => {
    try {
      const data = await apiAdminGet('/api/images/reconcile/status')
      setReconciliationStatus(data)
      setReconciliationHistory(data.reconciliation_history || [])
    } catch (err) {
      console.error('Error fetching reconciliation status:', err)
      // If reconciliation endpoints aren't available, set a default state
      setReconciliationStatus({
        needs_reconciliation: true,
        current_stats: { total_posts: 0, tracked_images: 0 },
        last_reconciliation: null
      })
    }
  }

  const triggerReconciliation = async () => {
    try {
      setReconciling(true)
      
      // Use the API helper to ensure proper authentication
      const result = await fetch('/api/images/reconcile', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!result.ok) {
        const errorText = await result.text()
        throw new Error(`Reconciliation failed: ${result.status} - ${errorText}`)
      }
      
      const data = await result.json()
      
      // Refresh data after reconciliation
      await fetchImages()
      await fetchReconciliationStatus()
      
      alert(`Reconciliation completed! 
        Posts processed: ${data.stats.posts_processed}
        Images found: ${data.stats.images_found}
        Images added: ${data.stats.images_added}
        Images updated: ${data.stats.images_updated}
        Images removed: ${data.stats.images_removed}`)
        
    } catch (err) {
      console.error('Reconciliation failed:', err)
      alert('Reconciliation failed: ' + err.message)
    } finally {
      setReconciling(false)
    }
  }

  const fetchImages = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await apiAdminGet('/api/images')
      setImages(data.images || [])
    } catch (err) {
      console.error('Error fetching images:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredImages = images.filter(image => {
    // Enhanced filtering logic
    let matchesFilter = false
    if (filter === 'all') {
      matchesFilter = true
    } else if (filter === 'uploaded_files') {
      const imageType = detectImageType(image.url)
      matchesFilter = imageType.isUpload
    } else if (filter === 'external_urls') {
      const imageType = detectImageType(image.url)
      matchesFilter = !imageType.isUpload
    } else {
      matchesFilter = image.source === filter
    }
    
    const matchesSearch = !searchTerm || 
      image.post_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      image.alt_text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      image.owner?.display_name?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown'
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getSourceLabel = (source) => {
    switch (source) {
      case 'upload': return 'Uploaded'
      case 'post_cover': return 'Cover Image'
      case 'post_inline': return 'Inline Image'
      default: return source
    }
  }

  const getSourceColor = (source) => {
    switch (source) {
      case 'upload': return 'bg-blue-100 text-blue-800'
      case 'post_cover': return 'bg-green-100 text-green-800'
      case 'post_inline': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-red-800 font-medium">Error Loading Images</h3>
        <p className="text-red-600 text-sm mt-1">{error}</p>
        <button
          onClick={fetchImages}
          className="mt-2 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
        >
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Image Library</h1>
            <p className="text-gray-600">
              Manage all images across your website - uploaded files, cover images, and inline content
            </p>
          </div>
          
          {/* Reconciliation Controls */}
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={triggerReconciliation}
              disabled={reconciling}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                reconciling 
                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
                  : reconciliationStatus?.needs_reconciliation
                    ? 'bg-orange-600 text-white hover:bg-orange-700'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {reconciling ? (
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Reconciling...
                </div>
              ) : (
                <>
                  🔄 {reconciliationStatus?.needs_reconciliation ? 'Reconcile Now' : 'Full Reconciliation'}
                </>
              )}
            </button>
            
            {reconciliationStatus?.last_reconciliation && (
              <div className="text-sm text-gray-500 text-right">
                <div>Last run: {new Date(reconciliationStatus.last_reconciliation.started_at).toLocaleDateString()}</div>
                <div className={`font-medium ${
                  reconciliationStatus.last_reconciliation.status === 'completed' 
                    ? 'text-green-600' 
                    : reconciliationStatus.last_reconciliation.status === 'failed'
                    ? 'text-red-600'
                    : 'text-orange-600'
                }`}>
                  {reconciliationStatus.last_reconciliation.status === 'completed' && '✅ Success'}
                  {reconciliationStatus.last_reconciliation.status === 'failed' && '❌ Failed'}
                  {reconciliationStatus.last_reconciliation.status === 'running' && '⏳ Running'}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Reconciliation Status Banner */}
        {reconciliationStatus?.needs_reconciliation && (
          <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center gap-2 text-orange-800">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="font-medium">Reconciliation Recommended</span>
            </div>
            <p className="text-orange-700 text-sm mt-1">
              It's been a while since the last reconciliation. Run a full scan to ensure all images are properly tracked.
            </p>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-gray-900">{images.length}</div>
          <div className="text-sm text-gray-600">Total Images</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-blue-600">
            {images.filter(img => img.source === 'upload').length}
          </div>
          <div className="text-sm text-gray-600">Uploaded Files</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-green-600">
            {images.filter(img => img.source === 'post_cover').length}
          </div>
          <div className="text-sm text-gray-600">Cover Images</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-purple-600">
            {images.filter(img => img.source === 'post_inline').length}
          </div>
          <div className="text-sm text-gray-600">Inline Images</div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search Images
            </label>
            <input
              type="text"
              placeholder="Search by post title, alt text, or owner..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Source
            </label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Sources</option>
              <option value="upload">📁 Uploaded Files</option>
              <option value="post_cover">🖼️ Cover Images</option>
              <option value="post_inline">📝 Inline Images</option>
              <option value="uploaded_files">⬆️ All Uploads</option>
              <option value="external_urls">🔗 All External URLs</option>
            </select>
          </div>
        </div>
      </div>

      {/* Image Grid */}
      {filteredImages.length === 0 ? (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No images found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || filter !== 'all' ? 'Try adjusting your search or filter criteria.' : 'Upload some images or create posts with images to get started.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredImages.map((image) => {
            const imageType = detectImageType(image.url)
            const metadata = {
              ...imageType,
              width: image.width,
              height: image.height,
              estimatedSize: image.file_size_bytes ? formatFileSize(image.file_size_bytes) : undefined
            }
            const enhancedTooltip = formatImageTooltip(metadata, image.alt_text)
            
            return (
              <div
                key={image.id}
                className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => setSelectedImage(image)}
                title={enhancedTooltip}
              >
                <div className="aspect-square relative overflow-hidden rounded-t-lg bg-gray-100">
                  <img
                    src={image.url}
                    alt={image.alt_text || 'Image'}
                    className={`w-full h-full object-cover transition-all duration-200 ${
                      imageType.isUpload 
                        ? 'ring-2 ring-blue-200 ring-opacity-0 group-hover:ring-opacity-100' 
                        : 'ring-2 ring-orange-200 ring-opacity-0 group-hover:ring-opacity-100'
                    }`}
                    onError={(e) => {
                      e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQgMTZsNC41ODYtNC41ODZhMiAyIDAgMDEyLjgyOCAwTDE2IDE2bS0yLTJsMS41ODYtMS41ODZhMiAyIDAgMDEyLjgyOCAwTDIwIDE0bS02LTZoLjAxTTYgMjBoMTJhMiAyIDAgMDAyLTJWNmEyIDIgMCAwMC0yLTJINmEyIDIgMCAwMC0yIDJ2MTJhMiAyIDAgMDAyIDJ6IiBzdHJva2U9IiM5Q0E3QjEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+Cjwvc3ZnPgo='
                    }}
                  />
                  
                  {/* Enhanced Badge */}
                  <div className="absolute top-2 left-2">
                    <ImageBadge metadata={metadata} size="sm" />
                  </div>
                  
                  {/* Legacy Source Label (keeping for compatibility) */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSourceColor(image.source)}`}>
                      {getSourceLabel(image.source)}
                    </span>
                  </div>
                  
                  {/* Domain/File Info Overlay */}
                  {(imageType.domain || imageType.fileName) && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-white text-xs truncate">
                        {imageType.domain || imageType.fileName}
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="p-3">
                <div className="text-sm text-gray-900 font-medium truncate">
                  {image.post_title || 'Uploaded Image'}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {formatDate(image.created_at)}
                </div>
                {image.file_size_bytes && (
                  <div className="text-xs text-gray-500">
                    {formatFileSize(image.file_size_bytes)}
                  </div>
                )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Image Detail Modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-gray-900">Image Details</h2>
                <button
                  onClick={() => setSelectedImage(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <img
                    src={selectedImage.url}
                    alt={selectedImage.alt_text || 'Image'}
                    className="w-full rounded-lg"
                  />
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Source</label>
                    <span className={`inline-block px-2 py-1 text-sm font-medium rounded-full ${getSourceColor(selectedImage.source)}`}>
                      {getSourceLabel(selectedImage.source)}
                    </span>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">URL</label>
                    <input
                      type="text"
                      value={selectedImage.url}
                      readOnly
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm"
                      onClick={(e) => e.target.select()}
                    />
                  </div>
                  
                  {selectedImage.post_title && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Post</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedImage.post_title}</p>
                    </div>
                  )}
                  
                  {selectedImage.alt_text && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Alt Text</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedImage.alt_text}</p>
                    </div>
                  )}
                  
                  {(selectedImage.width || selectedImage.height) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Dimensions</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {selectedImage.width} × {selectedImage.height} px
                      </p>
                    </div>
                  )}
                  
                  {selectedImage.file_size_bytes && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">File Size</label>
                      <p className="mt-1 text-sm text-gray-900">{formatFileSize(selectedImage.file_size_bytes)}</p>
                    </div>
                  )}
                  
                  {selectedImage.mime_type && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">MIME Type</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedImage.mime_type}</p>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Created</label>
                    <p className="mt-1 text-sm text-gray-900">{formatDate(selectedImage.created_at)}</p>
                  </div>
                  
                  {selectedImage.owner && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Owner</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {selectedImage.owner.display_name || selectedImage.owner.email}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ImageLibrary
