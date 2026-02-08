import React, { useState, useEffect } from 'react'
import { supabaseAdminGet, supabaseAdminPost } from '../../lib/api'
import { getSupabaseClient } from '../../lib/supabase'
import LoadingSpinner from '../../components/LoadingSpinner'
import ImageBadge from '../../components/editor/ImageBadge'
import ImagePicker from '../../components/editor/ImagePicker'
import { detectImageType, formatImageTooltip } from '../../utils/imageTypeDetection'
import { getAllPageWallpapers } from '../../lib/wallpaperApi'

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
  const [imagePickerOpen, setImagePickerOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showFullUrl, setShowFullUrl] = useState(false)
  
  // Deduplication state
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false)
  const [duplicates, setDuplicates] = useState(null)
  const [duplicatesLoading, setDuplicatesLoading] = useState(false)
  const [deduplicating, setDeduplicating] = useState(false)
  
  // Gallery display options
  const [collapseSharedImages, setCollapseSharedImages] = useState(false)

  useEffect(() => {
    fetchImages()
    fetchReconciliationStatus()
  }, [])

  const fetchReconciliationStatus = async () => {
    try {
      const data = await supabaseAdminGet('/api/images/reconcile/status')
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

  // Scan for duplicate images
  const scanForDuplicates = async () => {
    try {
      setDuplicatesLoading(true)
      setShowDuplicatesModal(true)
      
      const data = await supabaseAdminGet('/api/images/duplicates')
      setDuplicates(data)
    } catch (err) {
      console.error('Failed to scan for duplicates:', err)
      alert('Failed to scan for duplicates: ' + err.message)
      setShowDuplicatesModal(false)
    } finally {
      setDuplicatesLoading(false)
    }
  }
  
  // Run deduplication
  const runDeduplication = async (dryRun = false) => {
    try {
      setDeduplicating(true)
      
      const data = await supabaseAdminPost('/api/images/deduplicate', { dryRun })
      
      if (!dryRun) {
        alert(`Deduplication complete!\n\nRemoved: ${data.stats.recordsRemoved} duplicate records\nKept: ${data.stats.recordsKept} original records`)
        setShowDuplicatesModal(false)
        setDuplicates(null)
        // Refresh images
        await fetchImages()
      } else {
        // Update the duplicates view with dry run results
        setDuplicates(prev => ({
          ...prev,
          dryRunResult: data
        }))
      }
    } catch (err) {
      console.error('Deduplication failed:', err)
      alert('Deduplication failed: ' + err.message)
    } finally {
      setDeduplicating(false)
    }
  }

  const triggerReconciliation = async () => {
    try {
      setReconciling(true)
      
      // Use Supabase auth for API call
      const data = await supabaseAdminPost('/api/images/reconcile', {})
      
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

  const handleImageUpload = async (file) => {
    if (!file) return null

    setUploading(true)
    try {
      // Validate file
      const maxSize = 5 * 1024 * 1024 // 5MB
      if (file.size > maxSize) {
        throw new Error(`File size must be less than ${maxSize / 1024 / 1024}MB`)
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Only JPEG, PNG, WebP, and GIF images are allowed')
      }

      // Get Supabase auth token
      const supabase = getSupabaseClient()
      if (!supabase) {
        throw new Error('Supabase not configured')
      }
      
      const { data: { session }, error: authError } = await supabase.auth.getSession()
      if (authError || !session?.access_token) {
        throw new Error('Authentication required to upload images')
      }

      // Create FormData for file upload
      const formData = new FormData()
      formData.append('image', file)

      // Upload via admin API endpoint with Supabase auth
      const response = await fetch('/api/images/uploads/image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Upload failed: ${response.status} - ${errorText}`)
      }

      const result = await response.json()
      console.log('✅ Upload successful:', result)
      console.log('📁 Upload result details:', {
        url: result.url,
        path: result.path,
        hasMetadata: !!result.width && !!result.height
      })
      
      // Now store the image metadata in the images table so it appears in the library
      try {
        console.log('💾 Storing image metadata for library...')
        await supabaseAdminPost('/api/images/metadata', {
          path: result.path,
          mime_type: file.type,
          file_size_bytes: file.size,
          width: result.width,
          height: result.height,
          is_public: true
        })
        console.log('✅ Image metadata stored successfully')
      } catch (metadataError) {
        console.warn('⚠️ Could not store image metadata:', metadataError)
      }
      
      return result.url || result.publicUrl
    } catch (error) {
      console.error('Image upload failed:', error)
      alert(error instanceof Error ? error.message : 'Image upload failed')
      return null
    } finally {
      setUploading(false)
    }
  }

  const handleImagePickerConfirm = async (payload) => {
    setImagePickerOpen(false)
    
    if (payload.file) {
      // Handle file upload
      const uploadedUrl = await handleImageUpload(payload.file)
      if (uploadedUrl) {
        console.log('🔄 Refreshing image library after upload...')
        
        // Refresh the image library to show the new upload
        await fetchImages()
        
        // Switch to uploaded files filter to show the result
        setFilter('uploaded_files')
        
        console.log('📊 Library refreshed, current filter:', 'uploaded_files')
        
        // Show success message
        alert(`Image uploaded successfully! It will appear in the "Uploaded Files" section.`)
      }
    } else if (payload.url) {
      // For URL-based images, we don't upload them directly to our storage
      // Instead, we could add them to a "bookmarks" or "external images" collection
      alert('URL-based images are not stored in the library. They remain as external references.')
    }
  }

  const fetchImages = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log('🔍 Fetching images from /api/images...')
      
      const data = await supabaseAdminGet('/api/images')
      console.log('📦 API Response:', data)
      
      const images = data.images || []
      
      // Also fetch wallpapers
      console.log('🖼️ Fetching wallpapers...')
      const wallpaperResult = await getAllPageWallpapers()
      const wallpaperImages = []
      
      if (wallpaperResult.data?.wallpapers) {
        Object.entries(wallpaperResult.data.wallpapers).forEach(([pageId, wallpaper]) => {
          if (wallpaper?.url) {
            wallpaperImages.push({
              id: `wallpaper-${pageId}`,
              url: wallpaper.url,
              alt_text: wallpaper.alt || `${pageId} page wallpaper`,
              source: 'wallpaper',
              post_title: `${pageId.charAt(0).toUpperCase() + pageId.slice(1)} Wallpaper`,
              page_id: pageId,
              blur: wallpaper.blur || 0,
              created_at: new Date().toISOString() // Wallpapers don't have created_at, use current time
            })
          }
        })
        console.log('🖼️ Wallpapers fetched:', wallpaperImages.length)
      }
      
      // Combine regular images with wallpapers
      const allImages = [...images, ...wallpaperImages]
      
      // Debug: Show upload count for troubleshooting
      const uploadCount = allImages.filter(img => img.source === 'upload').length
      const wallpaperCount = allImages.filter(img => img.source === 'wallpaper').length
      console.log('📊 Images fetched:', {
        total: allImages.length,
        uploaded: uploadCount,
        wallpapers: wallpaperCount,
        processing_mode: data.processing_mode,
        stats: data.stats,
        sources: allImages.reduce((acc, img) => {
          acc[img.source] = (acc[img.source] || 0) + 1
          return acc
        }, {}),
        recentUploads: allImages
          .filter(img => img.source === 'upload')
          .slice(0, 3)
          .map(img => ({ url: img.url, created_at: img.created_at })),
        uploadedImageUrls: allImages
          .filter(img => img.source === 'upload')
          .map(img => img.url)
      })
      
      if (uploadCount === 0) {
        console.log('ℹ️ No uploaded files found. All images are from post content.')
      }
      
      setImages(allImages)
    } catch (err) {
      console.error('❌ Error fetching images:', err)
      console.error('Error details:', {
        name: err.name,
        message: err.message,
        stack: err.stack
      })
      setError(err.message || 'Unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  // First, apply filters
  const baseFilteredImages = images.filter(image => {
    // Enhanced filtering logic
    let matchesFilter = false
    if (filter === 'all') {
      matchesFilter = true
    } else if (filter === 'uploaded_files') {
      // Check both source property and URL pattern for uploaded files
      const imageType = detectImageType(image.url)
      matchesFilter = image.source === 'upload' || imageType.isUpload
    } else if (filter === 'external_urls') {
      const imageType = detectImageType(image.url)
      matchesFilter = !imageType.isUpload && image.source !== 'upload' && image.source !== 'wallpaper'
    } else if (filter === 'wallpaper') {
      matchesFilter = image.source === 'wallpaper'
    } else {
      matchesFilter = image.source === filter
    }
    
    const matchesSearch = !searchTerm || 
      image.post_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      image.alt_text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      image.page_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      image.owner?.display_name?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesFilter && matchesSearch
  })
  
  // Then, optionally collapse shared images (same URL across posts)
  const filteredImages = collapseSharedImages 
    ? (() => {
        const urlMap = new Map()
        baseFilteredImages.forEach(image => {
          if (!urlMap.has(image.url)) {
            // First occurrence - include it with tracking info
            urlMap.set(image.url, {
              ...image,
              _sharedCount: 1,
              _sharedPosts: [image.post_title || image.page_id || 'Unknown']
            })
          } else {
            // Duplicate URL - increment count and add post name
            const existing = urlMap.get(image.url)
            existing._sharedCount++
            const postName = image.post_title || image.page_id || 'Unknown'
            if (!existing._sharedPosts.includes(postName)) {
              existing._sharedPosts.push(postName)
            }
          }
        })
        return Array.from(urlMap.values())
      })()
    : baseFilteredImages

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
      case 'wallpaper': return 'Wallpaper'
      default: return source
    }
  }

  const getSourceColor = (source) => {
    switch (source) {
      case 'upload': return 'bg-blue-100 text-blue-800'
      case 'post_cover': return 'bg-green-100 text-green-800'
      case 'post_inline': return 'bg-purple-100 text-purple-800'
      case 'wallpaper': return 'bg-amber-100 text-amber-800'
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
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-red-800 font-medium text-lg">Error Loading Images</h3>
          <p className="text-red-600 mt-2">{error}</p>
          <div className="mt-4 space-x-2">
            <button
              onClick={fetchImages}
              className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            <p>Check the browser console (F12) for more details.</p>
          </div>
        </div>
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
          
          {/* Upload and Reconciliation Controls */}
          <div className="flex flex-col items-end gap-3">
            {/* Upload Button */}
            <button
              onClick={() => setImagePickerOpen(true)}
              disabled={uploading}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                uploading
                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500'
              }`}
            >
              {uploading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Uploading...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Upload Images
                </>
              )}
            </button>
            
            {/* Scan Duplicates Button */}
            <button
              onClick={scanForDuplicates}
              disabled={duplicatesLoading}
              className="px-4 py-2 rounded-lg font-medium transition-colors bg-purple-600 text-white hover:bg-purple-700 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {duplicatesLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Scanning...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Scan Duplicates
                </>
              )}
            </button>
            
            {/* Reconciliation Button */}
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
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
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-amber-600">
            {images.filter(img => img.source === 'wallpaper').length}
          </div>
          <div className="text-sm text-gray-600">Wallpapers</div>
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
              <option value="uploaded_files">📁 Uploaded Files</option>
              <option value="post_cover">🖼️ Cover Images</option>
              <option value="post_inline">📝 Inline Images</option>
              <option value="wallpaper">🏞️ Wallpapers</option>
              <option value="external_urls">🔗 External URLs</option>
            </select>
          </div>
          
          {/* 
            TODO: Journals & Collections Filter
            ====================================
            This filter will allow filtering images by:
            - Journal (parent collection)
            - Collection (group of related entries)
            
            Requires completion of: dashboard/entries/curator
            
            Data structure needed:
            - journals table with id, name, description
            - collections table with id, journal_id, name
            - posts.collection_id foreign key
            
            API endpoints needed:
            - GET /api/journals - list all journals
            - GET /api/journals/:id/collections - list collections in journal
          */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Journal / Collection
            </label>
            <div className="relative">
              <select
                disabled
                className="px-3 py-2 pr-8 border border-gray-200 rounded-md bg-gray-50 text-gray-400 cursor-not-allowed appearance-none"
                title="Coming soon - requires Curator feature"
              >
                <option>All Journals</option>
                {/* 
                  Future options will be dynamically loaded:
                  <option value="journal:uuid">📚 Journal Name</option>
                  <option value="collection:uuid">  └─ 📁 Collection Name</option>
                */}
              </select>
              {/* Coming Soon Badge */}
              <span className="absolute -top-2 -right-2 px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full border border-amber-200">
                Soon
              </span>
            </div>
          </div>
          
          {/* Collapse Shared Images Toggle */}
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={collapseSharedImages}
                  onChange={(e) => setCollapseSharedImages(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-gray-300 rounded-full peer peer-checked:bg-purple-600 transition-colors"></div>
                <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
              </div>
              <span className="text-sm text-gray-700 group-hover:text-gray-900">
                Collapse shared
              </span>
              <span className="text-xs text-gray-400" title="When enabled, images used in multiple posts appear only once">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
            </label>
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
            {filter === 'uploaded_files' 
              ? 'No uploaded files found. Use the image upload button in the post editor to add images to your library.' 
              : searchTerm || filter !== 'all' 
                ? 'Try adjusting your search or filter criteria.' 
                : 'Upload some images or create posts with images to get started.'}
          </p>
        </div>
      ) : (
        <>
          {/* Collapse mode info banner */}
          {collapseSharedImages && baseFilteredImages.length !== filteredImages.length && (
            <div className="mb-4 px-4 py-3 bg-purple-50 border border-purple-200 rounded-lg flex items-center gap-3">
              <svg className="w-5 h-5 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-purple-800">
                <span className="font-medium">Collapsed view:</span> Showing {filteredImages.length} unique images (hiding {baseFilteredImages.length - filteredImages.length} duplicates). 
                Images with a <span className="inline-flex items-center bg-purple-600 text-white px-1.5 py-0.5 rounded text-xs font-bold mx-1">
                  <svg className="w-2.5 h-2.5 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  2+
                </span> badge are shared across multiple posts.
              </span>
            </div>
          )}
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredImages.map((image, index) => {
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
                key={`${image.id}-${index}`}
                className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow cursor-pointer group flex flex-col"
                onClick={() => { setSelectedImage(image); setShowFullUrl(false); }}
                title={enhancedTooltip}
              >
                <div className="aspect-square relative overflow-hidden rounded-t-lg bg-gray-100 flex-shrink-0">
                  <img
                    src={image.url}
                    alt={image.alt_text || 'Image'}
                    className={`w-full h-full object-cover transition-all duration-200 ${
                      imageType.isUpload 
                        ? 'ring-2 ring-blue-200 ring-opacity-0 group-hover:ring-opacity-100' 
                        : 'ring-2 ring-orange-200 ring-opacity-0 group-hover:ring-opacity-100'
                    }`}
                    style={{ maxWidth: '100%', maxHeight: '100%' }}
                    onError={(e) => {
                      e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQgMTZsNC41ODYtNC41ODZhMiAyIDAgMDEyLjgyOCAwTDE2IDE2bS0yLTJsMS41ODYtMS41ODZhMiAyIDAgMDEyLjgyOCAwTDIwIDE0bS02LTZoLj01TTYgMjBoMTJhMiAyIDAgMDAyLTJWNmEyIDIgMCAwMC0yLTJINmEyIDIgMCAwMC0yIDJ2MTJhMiAyIDAgMDAyIDJ6IiBzdHJva2U9IiM5Q0E3QjEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+Cjwvc3ZnPgo='
                    }}
                  />
                  
                  {/* Enhanced Badge */}
                  <div className="absolute top-2 left-2">
                    <ImageBadge metadata={metadata} size="sm" />
                  </div>
                  
                  {/* Shared Count Badge (when collapsed) */}
                  {collapseSharedImages && image._sharedCount > 1 && (
                    <div 
                      className="absolute top-2 right-2 bg-purple-600 text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1"
                      title={`Used in ${image._sharedCount} places: ${image._sharedPosts?.join(', ')}`}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      {image._sharedCount}
                    </div>
                  )}
                  
                  {/* Legacy Source Label (keeping for compatibility) */}
                  <div className={`absolute ${collapseSharedImages && image._sharedCount > 1 ? 'top-10' : 'top-2'} right-2 opacity-0 group-hover:opacity-100 transition-opacity`}>
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
                
                <div className="p-3 flex-grow flex flex-col justify-between min-h-0">
                  <div>
                    {collapseSharedImages && image._sharedCount > 1 ? (
                      <>
                        <div className="text-sm text-gray-900 font-medium truncate flex items-center gap-1">
                          <span className="text-purple-600">{image._sharedCount} posts</span>
                        </div>
                        <div className="text-xs text-gray-500 truncate mt-0.5" title={image._sharedPosts?.join(', ')}>
                          {image._sharedPosts?.slice(0, 2).join(', ')}{image._sharedPosts?.length > 2 && '...'}
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-gray-900 font-medium truncate">
                        {image.post_title || image.page_id || 'Uploaded Image'}
                      </div>
                    )}
                  </div>
                  <div className="mt-1 space-y-1">
                    <div className="text-xs text-gray-500">
                      {formatDate(image.created_at)}
                    </div>
                    {image.file_size_bytes && (
                      <div className="text-xs text-gray-500">
                        {formatFileSize(image.file_size_bytes)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          </div>
        </>
      )}

      {/* Image Detail Modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-gray-900">Image Details</h2>
                <button
                  onClick={() => { setSelectedImage(null); setShowFullUrl(false); }}
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
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700">URL</label>
                      {selectedImage.url.length > 50 && (
                        <button
                          onClick={() => setShowFullUrl(!showFullUrl)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {showFullUrl ? 'Show less' : 'Show more'}
                        </button>
                      )}
                    </div>
                    {showFullUrl ? (
                      <div 
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm break-all cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedImage.url)
                          alert('URL copied to clipboard!')
                        }}
                        title="Click to copy"
                      >
                        {selectedImage.url}
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={selectedImage.url}
                        readOnly
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm"
                        onClick={(e) => e.target.select()}
                      />
                    )}
                  </div>
                  
                  {selectedImage.post_title && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        {selectedImage.source === 'wallpaper' ? 'Page' : 'Post'}
                      </label>
                      <p className="mt-1 text-sm text-gray-900">{selectedImage.post_title}</p>
                    </div>
                  )}
                  
                  {selectedImage.source === 'wallpaper' && selectedImage.blur > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Blur Effect</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedImage.blur}px</p>
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
      
      {/* Image Upload Modal */}
      <ImagePicker
        open={imagePickerOpen}
        onClose={() => setImagePickerOpen(false)}
        onConfirm={handleImagePickerConfirm}
        showLibraryOption={false}
      />
      
      {/* Duplicates Modal */}
      {showDuplicatesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Image Duplicates Scanner
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Scan for duplicate image URLs and clean up redundant records
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowDuplicatesModal(false)
                    setDuplicates(null)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {duplicatesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <svg className="animate-spin h-8 w-8 text-purple-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="ml-3 text-gray-500">Scanning for duplicates...</span>
                </div>
              ) : duplicates ? (
                <div className="space-y-6">
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                      <div className="text-2xl font-bold text-purple-700">{duplicates.stats.totalDuplicateUrls}</div>
                      <div className="text-sm text-purple-600">URLs with Multiple Uses</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                      <div className="text-2xl font-bold text-red-700">{duplicates.stats.trueDuplicates}</div>
                      <div className="text-sm text-red-600">True Duplicates (removable)</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <div className="text-2xl font-bold text-green-700">{duplicates.stats.sharedImages}</div>
                      <div className="text-sm text-green-600">Shared Across Posts (valid)</div>
                    </div>
                  </div>
                  
                  {/* Explanation */}
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <div className="text-sm text-blue-800">
                        <p className="font-medium mb-1">How deduplication works:</p>
                        <ul className="list-disc list-inside space-y-1 text-blue-700">
                          <li><strong>True duplicates</strong> are the same URL appearing multiple times in the same post - these can be safely removed</li>
                          <li><strong>Shared images</strong> are the same URL used in different posts - these are valid and will be kept</li>
                          <li>After deduplication, shared images will show all associated post names</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  
                  {/* Duplicates List */}
                  {duplicates.duplicates.length > 0 ? (
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-3">Duplicate URLs</h3>
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {duplicates.duplicates.map((dup, idx) => (
                          <div 
                            key={idx}
                            className={`rounded-lg border p-4 ${
                              dup.isDuplicate ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
                            }`}
                          >
                            <div className="flex gap-4">
                              <img 
                                src={dup.url} 
                                alt="Duplicate"
                                className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                                onError={(e) => {
                                  e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjRjNGNEY2Ii8+PC9zdmc+'
                                }}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                                    dup.isDuplicate ? 'bg-red-200 text-red-800' : 'bg-green-200 text-green-800'
                                  }`}>
                                    {dup.isDuplicate ? '🗑️ Removable' : '✓ Valid'}
                                  </span>
                                  <span className="text-sm text-gray-500">
                                    {dup.totalCount} occurrences in {dup.uniquePosts} post{dup.uniquePosts > 1 ? 's' : ''}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500 truncate mb-2" title={dup.url}>
                                  {dup.url.length > 80 ? dup.url.substring(0, 80) + '...' : dup.url}
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {dup.posts.map((post, pidx) => (
                                    <span key={pidx} className="px-2 py-1 text-xs bg-white rounded border border-gray-200">
                                      {post.title}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <svg className="w-16 h-16 mx-auto text-green-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h3 className="text-lg font-medium text-gray-900">No Duplicates Found</h3>
                      <p className="text-gray-500 mt-1">Your image library is clean!</p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            
            {/* Footer */}
            {duplicates && duplicates.stats.trueDuplicates > 0 && (
              <div className="p-6 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">{duplicates.stats.potentialSavings}</span> duplicate records can be removed
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => runDeduplication(true)}
                      disabled={deduplicating}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                    >
                      Preview Changes
                    </button>
                    <button
                      onClick={() => runDeduplication(false)}
                      disabled={deduplicating}
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {deduplicating ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Removing...
                        </>
                      ) : (
                        <>Remove Duplicates</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ImageLibrary
