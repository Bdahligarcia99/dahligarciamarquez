// client/src/features/posts/Posts.jsx
import { useState, useEffect } from 'react'
import { apiGet, apiPost } from '../../lib/api'

export default function Posts() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Form state
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [posting, setPosting] = useState(false)
  const [formError, setFormError] = useState(null)

  // Load posts on mount
  useEffect(() => {
    loadPosts()
  }, [])

  const loadPosts = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await apiGet('/api/posts')
      setPosts(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validation
    if (!title.trim() || !body.trim()) {
      setFormError('Title and body are required')
      return
    }

    try {
      setPosting(true)
      setFormError(null)
      
      const newPost = await apiPost('/api/posts', {
        title: title.trim(),
        body: body.trim()
      })
      
      // Prepend new post to local state
      setPosts(prev => [newPost, ...prev])
      
      // Clear form
      setTitle('')
      setBody('')
    } catch (err) {
      setFormError(err.message)
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Posts</h2>
      
      {/* Create Post Form */}
      <div className="bg-white p-6 rounded-lg shadow-sm border mb-8">
        <h3 className="text-lg font-semibold mb-4">Create New Post</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter post title"
              disabled={posting}
            />
          </div>
          
          <div>
            <label htmlFor="body" className="block text-sm font-medium text-gray-700 mb-1">
              Body
            </label>
            <textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows="4"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter post content"
              disabled={posting}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <button
              type="submit"
              disabled={posting || !title.trim() || !body.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {posting ? 'Creating...' : 'Create Post'}
            </button>
            
            {formError && (
              <span className="text-red-600 text-sm">{formError}</span>
            )}
          </div>
        </form>
      </div>

      {/* Posts List */}
      <div>
        {loading && (
          <div className="text-center py-8 text-gray-600">
            Loading posts...
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
            Couldn't load posts: {error}
          </div>
        )}

        {!loading && !error && posts.length === 0 && (
          <div className="text-center py-8 text-gray-600">
            No posts yet.
          </div>
        )}

        {!loading && !error && posts.length > 0 && (
          <div className="space-y-6">
            {posts.map((post) => (
              <article key={post.id} className="bg-white p-6 rounded-lg shadow-sm border">
                <header className="mb-3">
                  <h3 className="text-xl font-semibold text-gray-900 mb-1">
                    {post.title}
                  </h3>
                  <time className="text-sm text-gray-500">
                    {new Date(post.created_at).toLocaleString()}
                  </time>
                </header>
                <div className="text-gray-700 whitespace-pre-wrap">
                  {post.body}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
