// Post Editor Component
import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiAdminGet, apiAdminPost, apiAdminPatch } from '../../lib/api'
import RichTextEditor, { RichTextEditorRef } from '../editor/RichTextEditor'
import { uploadImage, UploadError } from '../../utils/uploadImage'
import { validateImageUrl, extractImageUrlsFromHtml } from '../../utils/imageValidation'
import { generateCoverImageAlt } from '../../utils/altTextGenerator'
import ImageManagementPanel from '../editor/ImageManagementPanel'
import CompressionControls from '../editor/CompressionControls'
import SmartTooltip from '../editor/SmartTooltip'
import { useCompressionSettingsStatic } from '../../hooks/useCompressionSettings'
import { compressImageFromUrl } from '../../lib/compressionApi'

// Session-based state for preview preferences
let sessionCoverPreviewState = false

interface Label {
  id: string
  name: string
}

interface PostEditorProps {
  postId?: string
  onSave?: (post: any) => void
  onCancel?: () => void
}

export default function PostEditor({ onSave, onCancel }: PostEditorProps) {
  const { id: routePostId } = useParams()
  const navigate = useNavigate()
  const postId = routePostId
  const editorRef = useRef<RichTextEditorRef>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState<{ json: any; html: string } | null>(null)
  const [excerpt, setExcerpt] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [coverImageAlt, setCoverImageAlt] = useState('')
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('draft')
  const [selectedLabels, setSelectedLabels] = useState<string[]>([])
  const [availableLabels, setAvailableLabels] = useState<Label[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [pendingImageInserts, setPendingImageInserts] = useState<{ file: File; alt: string }[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [showCoverPreview, setShowCoverPreview] = useState(sessionCoverPreviewState)
  const [showImagePanel, setShowImagePanel] = useState(false)
  const [focusedImageUrl, setFocusedImageUrl] = useState<string | null>(null)
  
  // Compression states for cover image
  const [coverCompressionEnabled, setCoverCompressionEnabled] = useState(false)
  const [coverCompressionQuality, setCoverCompressionQuality] = useState<'high' | 'balanced' | 'aggressive' | 'custom'>('balanced')
  const [coverCustomQuality, setCoverCustomQuality] = useState(75)
  const [coverCompressionResult, setCoverCompressionResult] = useState<{ url: string; stats: string } | null>(null)
  const [coverCompressing, setCoverCompressing] = useState(false)
  
  // Get compression settings
  const { settings: compressionSettings, isCompressionEnabled } = useCompressionSettingsStatic()

  // Update session state when local state changes
  const handleCoverPreviewChange = (checked: boolean) => {
    setShowCoverPreview(checked)
    sessionCoverPreviewState = checked
  }
  
  // Handle cover image compression
  const handleCoverImageCompress = async () => {
    if (!coverImageUrl.trim()) return
    
    setCoverCompressing(true)
    setCoverCompressionResult(null)
    
    try {
      const quality = coverCompressionQuality === 'custom' ? coverCustomQuality : coverCompressionQuality
      const result = await compressImageFromUrl(coverImageUrl.trim(), { quality })
      
      setCoverCompressionResult({
        url: result.url,
        stats: `${result.compressionRatio}% smaller (${formatFileSize(result.originalSize)} → ${formatFileSize(result.compressedSize)})`
      })
      
      setUploadError(null)
    } catch (error) {
      console.error('Cover image compression failed:', error)
      setUploadError(error instanceof Error ? error.message : 'Failed to compress cover image')
    } finally {
      setCoverCompressing(false)
    }
  }
  
  // Helper function for file size formatting
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  
  // Removed viewMode state - now using dedicated preview route

  const fetchLabels = async () => {
    try {
      const labels = await apiAdminGet('/api/labels')
      setAvailableLabels(labels)
    } catch (error) {
      console.error('Error fetching labels:', error)
    }
  }

  const fetchPost = async () => {
    if (!postId) return

    setLoading(true)
    try {
      const post = await apiAdminGet(`/api/posts/${postId}`)
      
      // Safe destructuring with defaults
      const {
        title = '',
        content_text = '',
        content_html = null,
        content_rich = null,
        excerpt = '',
        cover_image_url = '',
        cover_image_alt = '',
        status = 'draft',
        post_labels = []
      } = post || {}
      
      setTitle(title || '')
      
      // Handle content formats - prioritize rich content for full editing experience
      if (content_rich) {
        // Use rich content (JSON format) - primary format for rich text editor
        setContent({ json: content_rich, html: content_html || '' })
      } else if (content_html) {
        // Fallback to HTML format if available
        setContent({ json: null, html: content_html })
      } else if (content_text) {
        // Fallback to plain text content - convert to simple paragraph
        const simpleContent = content_text ? `<p>${content_text.replace(/\n/g, '</p><p>')}</p>` : ''
        setContent({ json: null, html: simpleContent })
      } else {
        // Empty content
        setContent({ json: null, html: '' })
      }
      
      setExcerpt(excerpt || '')
      setCoverImageUrl(cover_image_url || '')
      setCoverImageAlt(cover_image_alt || '')
      setStatus(status)
      setSelectedLabels(Array.isArray(post_labels) ? post_labels.map((pl: any) => pl?.labels?.id).filter(Boolean) : [])
    } catch (error) {
      console.error('Error fetching post:', error)
      
      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('404') || error.message.includes('not found')) {
          setError('Post not found. It may have been deleted or you may not have permission to view it.')
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          setError('You are not authorized to edit this post. Please check your admin token.')
        } else {
          setError(`Failed to load post: ${error.message}`)
        }
      } else {
        setError('Failed to load post. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!title?.trim()) {
      setError('Title is required')
      return
    }

    // Validate cover image alt text if cover image is present
    if (coverImageUrl?.trim() && !coverImageAlt?.trim()) {
      setError('Cover image alt text is required when a cover image is provided')
      return
    }

    setSaving(true)
    setError(null)

    try {
      // Validate image URLs before saving
      const urlsToValidate: string[] = []
      
      // Add cover image URL if present
      if (coverImageUrl?.trim()) {
        urlsToValidate.push(coverImageUrl.trim())
      }
      
      // Extract and add content image URLs
      if (content?.html) {
        const contentImageUrls = extractImageUrlsFromHtml(content.html)
        urlsToValidate.push(...contentImageUrls)
      }
      
      // Validate all URLs
      if (urlsToValidate.length > 0) {
        const validationResults = await Promise.all(
          urlsToValidate.map(url => validateImageUrl(url))
        )
        
        const invalidUrls = validationResults
          .map((result, index) => ({ url: urlsToValidate[index], result }))
          .filter(({ result }) => !result.isValid)
        
        if (invalidUrls.length > 0) {
          const errorMessages = invalidUrls.map(({ url, result }) => 
            `${url}: ${result.error}`
          ).join('\n')
          
          setError(`Invalid image URLs found:\n${errorMessages}`)
          return
        }
      }

      // Extract plain text from content for content_text field
      const contentText = content?.html ? 
        content.html.replace(/<[^>]*>/g, '').trim() : ''

      const postData = {
        title: title?.trim() || '',
        content_rich: content?.json || null,
        content_html: content?.html || null,
        content_text: contentText,
        excerpt: excerpt?.trim() || null,
        cover_image_url: (coverCompressionResult?.url || coverImageUrl)?.trim() || null,
        cover_image_alt: coverImageAlt?.trim() || null,
        status,
        label_ids: selectedLabels
      }

      let savedPost
      if (postId) {
        // Edit existing post
        savedPost = await apiAdminPatch(`/api/posts/${postId}`, postData)
        setError(null)
        // Show success message briefly
        setSuccessMessage('Post saved successfully!')
        setTimeout(() => setSuccessMessage(null), 3000)
      } else {
        // Create new post
        savedPost = await apiAdminPost('/api/posts', postData)
        // Navigate back to posts list after creation
        navigate('/dashboard/posts')
      }

      onSave?.(savedPost)
    } catch (error) {
      console.error('Error saving post:', error)
      setError(error instanceof Error ? error.message : 'Failed to save post')
    } finally {
      setSaving(false)
    }
  }

  const toggleLabel = (labelId: string) => {
    setSelectedLabels(prev =>
      prev.includes(labelId)
        ? prev.filter(id => id !== labelId)
        : [...prev, labelId]
    )
  }

    const handleInsertImage = async (payload: { file: File; alt: string }) => {
    console.log('Starting image upload...', payload.file.name);
    setUploadingImage(true)
    setUploadError(null)

    try {
      // Upload the image
      console.log('Calling uploadImage...');
      const uploadResult = await uploadImage(payload.file)
      console.log('Upload successful:', uploadResult);
      
      // Insert the figure into the editor
      editorRef.current?.insertFigure({
        src: uploadResult.url,
        alt: payload.alt,
        caption: '' // Empty caption by default
      })

      console.log('Image uploaded and inserted:', {
        fileName: payload.file.name,
        url: uploadResult.url,
        dimensions: `${uploadResult.width}x${uploadResult.height}`,
        alt: payload.alt
      })
      
      // Additional debugging: log the current editor content after insertion
      setTimeout(() => {
        const currentHtml = editorRef.current?.editor?.getHTML();
        console.log('Editor HTML after image insertion:', currentHtml);
        
        // Test if the image URL is actually accessible
        const testImage = new Image();
        testImage.onload = () => {
          console.log('✅ Image URL is accessible:', uploadResult.url);
        };
        testImage.onerror = (error) => {
          console.error('❌ Image URL is NOT accessible:', uploadResult.url, error);
        };
        testImage.src = uploadResult.url;
      }, 100)

    } catch (error) {
      console.error('Image upload failed:', error)
      
      // Handle typed upload errors
      if (error && typeof error === 'object' && 'kind' in error) {
        const uploadError = error as UploadError
        if (uploadError.kind === 'uploads-disabled') {
          setUploadError('Image uploads are not configured in this environment.')
        } else {
          setUploadError(uploadError.message)
        }
      } else if (error instanceof Error) {
        setUploadError(error.message)
      } else {
        setUploadError('Failed to upload image')
      }
    } finally {
      setUploadingImage(false)
    }
  }

  // Image management functions
  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setSuccessMessage('URL copied to clipboard')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (error) {
      setError('Failed to copy URL')
      setTimeout(() => setError(null), 3000)
    }
  }

  const handleReplaceUpload = (currentUrl: string) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        setUploadingImage(true)
        const result = await uploadImage(file)
        
        // Replace the URL in the content
        if (content?.html && result.url) {
          const newHtml = content.html.replace(new RegExp(currentUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), result.url)
          setContent({ ...content, html: newHtml })
          setSuccessMessage('Image replaced with upload')
          setTimeout(() => setSuccessMessage(null), 3000)
        }
      } catch (error) {
        console.error('Upload error:', error)
        if (error && typeof error === 'object' && 'message' in error) {
          setUploadError(error.message)
        } else {
          setUploadError('Failed to upload replacement image')
        }
      } finally {
        setUploadingImage(false)
      }
    }
    input.click()
  }

  const handleEditAltText = (url: string, currentAlt: string) => {
    const newAlt = prompt('Edit alt text:', currentAlt)
    if (newAlt !== null && content?.html) {
      // Find and update the alt text in the HTML
      const parser = new DOMParser()
      const doc = parser.parseFromString(content.html, 'text/html')
      const imgs = doc.querySelectorAll('img')
      
      for (const img of Array.from(imgs)) {
        if (img.src === url) {
          img.alt = newAlt
        }
      }
      
      const newHtml = doc.body.innerHTML
      setContent({ ...content, html: newHtml })
      setSuccessMessage('Alt text updated')
      setTimeout(() => setSuccessMessage(null), 3000)
    }
  }

  const handleRemoveImage = (url: string) => {
    if (confirm('Are you sure you want to remove this image?')) {
      const editor = editorRef.current?.editor
      
      if (editor) {
        // Use the editor's API to find and remove the image
        const { doc } = editor.state
        let imagePos = null
        
        // Find the position of the image node with matching src
        doc.descendants((node, pos) => {
          if (node.type.name === 'image' && node.attrs.src === url) {
            imagePos = pos
            return false // Stop searching
          }
          return true
        })
        
        if (imagePos !== null) {
          // Remove the image using the editor's transaction system
          const tr = editor.state.tr.delete(imagePos, imagePos + 1)
          editor.view.dispatch(tr)
          
          // Clear focus mode if the removed image was focused
          if (focusedImageUrl === url) {
            setFocusedImageUrl(null)
          }
          
          setSuccessMessage('Image removed')
          setTimeout(() => setSuccessMessage(null), 3000)
        } else {
          console.warn('Image not found in editor content:', url)
        }
      } else {
        // Fallback to HTML manipulation if editor is not available
        if (content?.html) {
          const parser = new DOMParser()
          const doc = parser.parseFromString(content.html, 'text/html')
          const imgs = doc.querySelectorAll('img')
          let imageFound = false
          
          for (const img of Array.from(imgs)) {
            if (img.src === url) {
              img.remove()
              imageFound = true
            }
          }
          
          if (imageFound) {
            const newHtml = doc.body.innerHTML
            setContent({ ...content, html: newHtml })
            
            // Clear focus mode if the removed image was focused
            if (focusedImageUrl === url) {
              setFocusedImageUrl(null)
            }
            
            setSuccessMessage('Image removed')
            setTimeout(() => setSuccessMessage(null), 3000)
          } else {
            console.warn('Image not found in HTML content:', url)
          }
        }
      }
    }
  }

  const handleUpdateImage = (oldUrl: string, newUrl: string) => {
    const editor = editorRef.current?.editor
    
    if (editor) {
      // Update image URLs in the editor content
      const { doc } = editor.state
      const tr = editor.state.tr
      let updated = false
      
      // Find and update all image nodes with matching src
      doc.descendants((node, pos) => {
        if (node.type.name === 'image' && node.attrs.src === oldUrl) {
          const newAttrs = { ...node.attrs, src: newUrl }
          tr.setNodeMarkup(pos, null, newAttrs)
          updated = true
        }
        return true
      })
      
      if (updated) {
        editor.view.dispatch(tr)
      }
    } else {
      // Fallback to HTML manipulation if editor is not available
      if (content?.html) {
        const updatedHtml = content.html.replace(
          new RegExp(`src="${oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g'),
          `src="${newUrl}"`
        )
        setContent({ ...content, html: updatedHtml })
      }
    }
    
    // Update cover image if it matches
    if (coverImageUrl === oldUrl) {
      setCoverImageUrl(newUrl)
    }
    
    setSuccessMessage('Image compressed and updated')
    setTimeout(() => setSuccessMessage(null), 3000)
  }

  // Handle double-click on image to focus in management panel
  const handleImageDoubleClick = (imageUrl: string) => {
    setFocusedImageUrl(imageUrl)
    setShowImagePanel(true)
  }

  // Handle image panel toggle - reset focus mode when opening normally
  const handleImagePanelToggle = () => {
    if (!showImagePanel) {
      // Opening panel normally - clear focus mode
      setFocusedImageUrl(null)
    }
    setShowImagePanel(!showImagePanel)
  }

  useEffect(() => {
    fetchLabels()
    if (postId) {
      fetchPost()
    }
  }, [postId])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-8">
          <div className="inline-flex items-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-600">{postId ? 'Loading post...' : 'Loading editor...'}</p>
          </div>
        </div>
      </div>
    )
  }

  // View mode removed - now using dedicated PostPreview component at /posts/:id/preview

  // Render edit mode
  const renderEditMode = () => (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          {postId ? 'Edit Post' : 'Create New Post'}
        </h1>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          {successMessage}
        </div>
      )}

      {/* Image Management Toggle */}
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setShowImagePanel(!showImagePanel)}
          className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
            showImagePanel
              ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Image Management
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Title *
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter post title"
            required
          />
        </div>

        {/* Excerpt */}
        <div>
          <label htmlFor="excerpt" className="block text-sm font-medium text-gray-700 mb-1">
            Excerpt
          </label>
          <textarea
            id="excerpt"
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Brief description of the post"
          />
        </div>

        {/* Cover Image URL */}
        <div>
          <label htmlFor="coverImage" className="block text-sm font-medium text-gray-700 mb-1">
            Cover Image URL
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              id="coverImage"
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://example.com/image.jpg"
            />
            <button
              type="button"
              onClick={() => {
                // Create a temporary file input for cover image upload
                const input = document.createElement('input')
                input.type = 'file'
                input.accept = '.png,.jpg,.jpeg,.webp'
                input.onchange = async (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0]
                  if (file) {
                    try {
                      setUploadingImage(true)
                      const uploadedUrl = await uploadImage(file)
                      setCoverImageUrl(uploadedUrl)
                      
                      // Auto-generate alt text from filename
                      const generatedAlt = generateCoverImageAlt({
                        filename: file.name,
                        postTitle: title
                      })
                      setCoverImageAlt(generatedAlt)
                      
                      setUploadError(null)
                    } catch (error) {
                      console.error('Cover image upload failed:', error)
                      setUploadError(error instanceof Error ? error.message : 'Failed to upload cover image')
                    } finally {
                      setUploadingImage(false)
                    }
                  }
                }
                input.click()
              }}
              disabled={uploadingImage}
              className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploadingImage ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              )}
            </button>
          </div>
          
          {/* Cover Image Alt Text */}
          <div className="mt-4">
            <label htmlFor="coverImageAlt" className="block text-sm font-medium text-gray-700 mb-1">
              Cover Image Alt Text *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="coverImageAlt"
                value={coverImageAlt}
                onChange={(e) => setCoverImageAlt(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe the cover image for accessibility"
              />
              <button
                type="button"
                onClick={() => {
                  const generatedAlt = generateCoverImageAlt({
                    url: coverImageUrl,
                    postTitle: title
                  })
                  setCoverImageAlt(generatedAlt)
                }}
                disabled={!coverImageUrl?.trim()}
                className="px-3 py-2 text-sm bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Auto-generate alt text from image filename"
              >
                Auto-generate
              </button>
            </div>
          </div>
          
          {/* Show Preview Checkbox */}
          <div className="mt-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={showCoverPreview}
                onChange={(e) => handleCoverPreviewChange(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
              />
              <span className="ml-2 text-sm text-gray-600">Show Preview</span>
            </label>
          </div>
          
          {/* Cover Image Compression Controls */}
          {coverImageUrl?.trim() && (
            <div className="mt-3 p-3 bg-gray-50 rounded-md">
              <CompressionControls
                enabled={coverCompressionEnabled}
                quality={coverCompressionQuality}
                customQuality={coverCustomQuality}
                onEnabledChange={setCoverCompressionEnabled}
                onQualityChange={setCoverCompressionQuality}
                onCustomQualityChange={setCoverCustomQuality}
                disabled={!isCompressionEnabled}
                disabledTooltip="Please turn on compression in settings"
                size="sm"
              />
              
              {isCompressionEnabled && coverCompressionEnabled && (
                <div className="mt-3 flex items-center space-x-2">
                  <button
                    onClick={handleCoverImageCompress}
                    disabled={coverCompressing}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      coverCompressing
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
                    }`}
                  >
                    {coverCompressing ? 'Compressing...' : 'Compress Cover Image'}
                  </button>
                  
                  {coverCompressionResult && (
                    <div className="text-xs text-green-600 font-medium">
                      ✓ {coverCompressionResult.stats}
                    </div>
                  )}
                </div>
              )}
              
              {coverCompressionResult && (
                <div className="mt-2 text-xs text-gray-600">
                  <SmartTooltip content="The compressed image will be used when you save the post">
                    <span className="underline decoration-dotted">Using compressed version</span>
                  </SmartTooltip>
                </div>
              )}
            </div>
          )}
          
          {/* Cover Image Preview */}
          {coverImageUrl?.trim() && showCoverPreview && (
            <div className="mt-3">
              <div className="relative border border-gray-300 rounded-lg overflow-hidden bg-gray-50">
                <img
                  src={coverImageUrl}
                  alt="Cover image preview"
                  className="w-full h-48 object-cover"
                  onError={(e) => {
                    // Hide broken image preview
                    const img = e.target as HTMLImageElement
                    img.style.display = 'none'
                    // Show error message
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
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100" style={{ display: 'none' }}>
                  <div className="text-center">
                    <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <p className="text-sm text-gray-500">Failed to load image</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Content *
          </label>
          
          {/* Upload Status */}
          {uploadingImage && (
            <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
              <span className="inline-flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Uploading image...
              </span>
            </div>
          )}

          {uploadError && (
            <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
              <span className="font-medium">Upload failed:</span> {uploadError}
            </div>
          )}
          
          <RichTextEditor
            ref={editorRef}
            content={content?.json || content?.html || null}
            onChange={setContent}
            onInsertImage={handleInsertImage}
            onImageDoubleClick={handleImageDoubleClick}
            className="min-h-[400px]"
          />
          
          {/* Helpful tip for image interaction */}
          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span><strong>Tip:</strong> Double-click any image in your content to open the image manager where you can edit, compress, or replace it.</span>
            </div>
          </div>
        </div>

        {/* Labels */}
        {availableLabels.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Labels
            </label>
            <div className="flex flex-wrap gap-2">
              {availableLabels.map((label) => (
                <button
                  key={label.id}
                  type="button"
                  onClick={() => toggleLabel(label.id)}
                  className={`px-3 py-1 rounded-full text-sm border ${
                    selectedLabels.includes(label.id)
                      ? 'bg-blue-100 border-blue-300 text-blue-800'
                      : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {label.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Status and Actions */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-200">
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'draft' | 'published' | 'archived')}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onCancel ? onCancel() : navigate('/dashboard/posts')}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Back to Posts
            </button>
            {postId && (
              <button
                type="button"
                onClick={() => navigate(`/posts/${postId}/preview`)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Preview as Reader
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : (postId ? 'Save' : 'Create')} Post
            </button>
          </div>
        </div>
      </form>
    </div>
  )

  // Main render logic - choose between view and edit modes
  return (
    <>
      {error && (
        <div className="max-w-4xl mx-auto p-6">
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        </div>
      )}

      {successMessage && (
        <div className="max-w-4xl mx-auto p-6">
          <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            {successMessage}
          </div>
        </div>
      )}

      {renderEditMode()}

      {/* Image Management Panel */}
      <ImageManagementPanel
        content={content}
        coverImageUrl={coverImageUrl}
        coverImageAlt={coverImageAlt}
        isOpen={showImagePanel}
        onToggle={handleImagePanelToggle}
        focusedImageUrl={focusedImageUrl}
        onCopyUrl={handleCopyUrl}
        onReplaceUpload={handleReplaceUpload}
        onEditAltText={handleEditAltText}
        onRemoveImage={handleRemoveImage}
        onUpdateImage={handleUpdateImage}
      />
    </>
  )
}
