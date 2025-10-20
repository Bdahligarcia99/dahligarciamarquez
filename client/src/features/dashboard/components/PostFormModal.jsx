// client/src/features/dashboard/components/PostFormModal.jsx
import { useState, useEffect } from 'react'
import { supabaseAdminPost, supabaseAdminPatch } from '../../../lib/api'

const PostFormModal = ({ isOpen, onClose, onSuccess, editPost = null }) => {
  const [title, setTitle] = useState('')
  const [contentText, setContentText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const isEditing = !!editPost

  useEffect(() => {
    if (isOpen) {
      if (editPost) {
        setTitle(editPost.title)
        setContentText(editPost.content_text || '') // Use content_text field
      } else {
        setTitle('')
        setContentText('')
      }
      setError(null)
    }
  }, [isOpen, editPost])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const postData = { title, content_text: contentText }
      let result

      if (isEditing) {
        result = await supabaseAdminPatch(`/api/posts/${editPost.id}`, postData)
      } else {
        result = await supabaseAdminPost('/api/posts', postData)
      }

      onSuccess(result)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h2 className="text-xl font-bold mb-4">
          {isEditing ? 'Edit Post' : 'Create New Post'}
        </h2>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={loading}
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Content
            </label>
            <textarea
              value={contentText}
              onChange={(e) => setContentText(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={loading}
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Saving...' : (isEditing ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default PostFormModal
