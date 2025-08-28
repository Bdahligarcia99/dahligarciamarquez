// client/src/features/dashboard/PostsPage.jsx
import { useState, useEffect } from 'react'
import { apiGet, apiDelete } from '../../lib/api'
import PostFormModal from './components/PostFormModal'
import StatusBadge from './components/StatusBadge'

const PostsPage = () => {
  const [posts, setPosts] = useState([])
  const [filteredPosts, setFilteredPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPost, setEditingPost] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    fetchPosts()
  }, [])

  useEffect(() => {
    // Client-side filtering
    if (searchTerm.trim() === '') {
      setFilteredPosts(posts)
    } else {
      const filtered = posts.filter(post =>
        post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.body.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredPosts(filtered)
    }
  }, [posts, searchTerm])

  const fetchPosts = async () => {
    try {
      setLoading(true)
      setError(null)
      const postsData = await apiGet('/api/posts')
      // Handle both old format (array) and new format (object with items)
      setPosts(Array.isArray(postsData) ? postsData : postsData.items || [])
    } catch (err) {
      console.error('Failed to fetch posts:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePost = (newPost) => {
    // Optimistic update
    setPosts(prev => [newPost, ...prev])
  }

  const handleEditPost = (updatedPost) => {
    // Optimistic update
    setPosts(prev => prev.map(post => 
      post.id === updatedPost.id ? updatedPost : post
    ))
  }

  const handleDeletePost = async (postId) => {
    if (!confirm('Are you sure you want to delete this post?')) return

    try {
      setDeletingId(postId)
      await apiDelete(`/api/posts/${postId}`)
      
      // Optimistic update
      setPosts(prev => prev.filter(post => post.id !== postId))
    } catch (err) {
      console.error('Failed to delete post:', err)
      alert(`Failed to delete post: ${err.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  const openEditModal = (post) => {
    setEditingPost(post)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingPost(null)
  }

  const handleModalSuccess = (result) => {
    if (editingPost) {
      handleEditPost(result)
    } else {
      handleCreatePost(result)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Posts</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
        >
          New Post
        </button>
      </div>

      {/* Search Filter */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <input
          type="text"
          placeholder="Search posts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Posts Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading posts...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">Error: {error}</div>
        ) : filteredPosts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {searchTerm ? 'No posts match your search' : 'No posts found'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPosts.map((post) => (
                  <tr key={post.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{post.title}</div>
                      <div className="text-sm text-gray-500 truncate max-w-xs">
                        {post.body}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(post.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status="success" label={post.status || 'published'} />
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => openEditModal(post)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeletePost(post.id)}
                        disabled={deletingId === post.id}
                        className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
                      >
                        {deletingId === post.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Post Form Modal */}
      <PostFormModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSuccess={handleModalSuccess}
        editPost={editingPost}
      />
    </div>
  )
}

export default PostsPage
