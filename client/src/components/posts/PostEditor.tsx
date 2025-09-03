// Post Editor Component
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { Label, getSessionToken } from '../../lib/supabase'
import RichTextEditor, { RichTextEditorRef } from '../editor/RichTextEditor'
import { uploadImage } from '../../utils/uploadImage'

interface PostEditorProps {
  postId?: string
  onSave?: (post: any) => void
  onCancel?: () => void
}

export default function PostEditor({ postId, onSave, onCancel }: PostEditorProps) {
  const { profile } = useAuth()
  const editorRef = useRef<RichTextEditorRef>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState<{ json: any; html: string } | null>(null)
  const [excerpt, setExcerpt] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('draft')
  const [selectedLabels, setSelectedLabels] = useState<string[]>([])
  const [availableLabels, setAvailableLabels] = useState<Label[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingImageInserts, setPendingImageInserts] = useState<{ file: File; alt: string }[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const fetchLabels = async () => {
    try {
      const response = await fetch('/api/labels')
      if (response.ok) {
        const labels = await response.json()
        setAvailableLabels(labels)
      }
    } catch (error) {
      console.error('Error fetching labels:', error)
    }
  }

  const fetchPost = async () => {
    if (!postId) return

    setLoading(true)
    try {
      const token = await getSessionToken()
      const response = await fetch(`/api/posts/${postId}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })

      if (!response.ok) throw new Error('Failed to fetch post')

      const post = await response.json()
      setTitle(post.title || '')
      
      // Handle backward compatibility for content formats
      if (post.content_html) {
        // Prefer HTML format if available
        setContent({ json: post.content_rich || null, html: post.content_html })
      } else if (post.content_rich) {
        // Fallback to rich content (JSON format)
        setContent({ json: post.content_rich, html: '' })
      } else {
        setContent(null)
      }
      
      setExcerpt(post.excerpt || '')
      setCoverImageUrl(post.cover_image_url || '')
      setStatus(post.status || 'draft')
      setSelectedLabels(post.post_labels?.map((pl: any) => pl.labels.id) || [])
    } catch (error) {
      console.error('Error fetching post:', error)
      setError('Failed to load post')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Title is required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const token = await getSessionToken()
      const postData = {
        title: title.trim(),
        content_rich: content?.json || null,
        content_html: content?.html || null,
        excerpt: excerpt.trim() || null,
        cover_image_url: coverImageUrl.trim() || null,
        status,
        label_ids: selectedLabels
      }

      const url = postId ? `/api/posts/${postId}` : '/api/posts'
      const method = postId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(postData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save post')
      }

      const savedPost = await response.json()
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
    setUploadingImage(true)
    setUploadError(null)

    try {
      // Upload the image
      const uploadResult = await uploadImage(payload.file)
      
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

    } catch (error) {
      console.error('Image upload failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload image'
      setUploadError(errorMessage)
    } finally {
      setUploadingImage(false)
    }
  }

  useEffect(() => {
    fetchLabels()
    if (postId) {
      fetchPost()
    }
  }, [postId])

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Loading post...</p>
      </div>
    )
  }

  return (
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
          <input
            type="url"
            id="coverImage"
            value={coverImageUrl}
            onChange={(e) => setCoverImageUrl(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://example.com/image.jpg"
          />
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
            content={content?.json || content}
            onChange={setContent}
            onInsertImage={handleInsertImage}
            className="min-h-[400px]"
          />
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
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : (postId ? 'Update' : 'Create')} Post
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
