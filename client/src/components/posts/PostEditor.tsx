// Post Editor Component
import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { Label, getSessionToken } from '../../lib/supabase'
import RichTextEditor from '../editor/RichTextEditor'

interface PostEditorProps {
  postId?: string
  onSave?: (post: any) => void
  onCancel?: () => void
}

export default function PostEditor({ postId, onSave, onCancel }: PostEditorProps) {
  const { profile } = useAuth()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState(null)
  const [excerpt, setExcerpt] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('draft')
  const [selectedLabels, setSelectedLabels] = useState<string[]>([])
  const [availableLabels, setAvailableLabels] = useState<Label[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      setContent(post.content_rich)
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
        content_rich: content,
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
          <RichTextEditor
            content={content}
            onChange={setContent}
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
