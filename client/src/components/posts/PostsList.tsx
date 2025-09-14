// Posts List Component with filtering
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Post, Label, getSessionToken } from '../../lib/supabase'

interface PostsListProps {
  showDrafts?: boolean
  labelFilter?: string
}

export default function PostsList({ showDrafts = false, labelFilter }: PostsListProps) {
  const { user, profile } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [labels, setLabels] = useState<Label[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLabel, setSelectedLabel] = useState(labelFilter || '')
  const [searchQuery, setSearchQuery] = useState('')

  const fetchLabels = async () => {
    try {
      const response = await fetch('/api/labels')
      if (response.ok) {
        const data = await response.json()
        setLabels(data)
      }
    } catch (error) {
      console.error('Error fetching labels:', error)
    }
  }

  const fetchPosts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedLabel) params.append('label', selectedLabel)
      if (searchQuery) params.append('search', searchQuery)

      let url = '/api/posts'
      if (showDrafts && profile?.role === 'admin') {
        url = '/api/posts/admin'
      }

      if (params.toString()) {
        url += `?${params.toString()}`
      }

      const headers: Record<string, string> = {}
      if (showDrafts && user) {
        const token = await getSessionToken()
        if (token) headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(url, { headers })
      if (!response.ok) throw new Error('Failed to fetch posts')

      const result = await response.json()
      setPosts(result.data || [])
    } catch (error) {
      console.error('Error fetching posts:', error)
    } finally {
      setLoading(false)
    }
  }

  const deletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return

    try {
      const token = await getSessionToken()
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete post')
      }

      setPosts(posts.filter(post => post.id !== postId))
    } catch (error) {
      console.error('Error deleting post:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete post')
    }
  }

  useEffect(() => {
    fetchLabels()
  }, [])

  useEffect(() => {
    fetchPosts()
  }, [selectedLabel, searchQuery, showDrafts, profile])

  const getStatusBadge = (status: string) => {
    const colors = {
      draft: 'bg-yellow-100 text-yellow-800',
      published: 'bg-green-100 text-green-800',
      archived: 'bg-gray-100 text-gray-800'
    }
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${colors[status as keyof typeof colors]}`}>
        {status}
      </span>
    )
  }

  const canEdit = (post: Post) => {
    return user && (post.author_id === user.id || profile?.role === 'admin')
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">
          {showDrafts ? 'Manage Posts' : 'Stories & Posts'}
        </h1>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search posts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <select
              value={selectedLabel}
              onChange={(e) => setSelectedLabel(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Labels</option>
              {labels.map((label) => (
                <option key={label.id} value={label.slug}>
                  {label.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-8">
          <p className="text-gray-600">Loading posts...</p>
        </div>
      )}

      {/* Posts Grid */}
      {!loading && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <article key={post.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
              {/* Cover Image */}
              {post.cover_image_url && (
                <img
                  src={post.cover_image_url}
                  alt={post.cover_image_alt || post.title || 'Cover image'}
                  className="w-full h-48 object-cover"
                />
              )}

              <div className="p-4">
                {/* Status & Labels */}
                <div className="flex items-center justify-between mb-2">
                  {showDrafts && getStatusBadge(post.status)}
                  <div className="flex flex-wrap gap-1">
                    {post.post_labels?.slice(0, 2).map((pl) => (
                      <span
                        key={pl.labels.id}
                        className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
                      >
                        {pl.labels.name}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <h2 className="text-lg font-semibold mb-2 line-clamp-2">
                  <Link
                    to={`/posts/${post.slug}`}
                    className="hover:text-blue-600"
                  >
                    {post.title}
                  </Link>
                </h2>

                {/* Excerpt */}
                {post.excerpt && (
                  <p className="text-gray-600 text-sm mb-3 line-clamp-3">
                    {post.excerpt}
                  </p>
                )}

                {/* Meta */}
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div>
                    {post.profiles?.display_name && (
                      <span>by {post.profiles.display_name}</span>
                    )}
                  </div>
                  <div>
                    {new Date(post.created_at).toLocaleDateString()}
                  </div>
                </div>

                {/* Actions */}
                {canEdit(post) && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-200">
                    <Link
                      to={`/admin/posts/${post.id}/edit`}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      View/Edit
                    </Link>
                    <button
                      onClick={() => deletePost(post.id)}
                      className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && posts.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-600 text-lg mb-4">
            {searchQuery || selectedLabel
              ? 'No posts found matching your criteria'
              : showDrafts
              ? 'No posts created yet'
              : 'No published posts yet'
            }
          </p>
          {showDrafts && profile?.role === 'admin' && (
            <Link
              to="/admin/posts/new"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Create Your First Post
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
