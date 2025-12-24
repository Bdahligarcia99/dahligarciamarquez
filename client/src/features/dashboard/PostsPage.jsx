// client/src/features/dashboard/PostsPage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabaseAdminGet, supabaseAdminDelete, supabaseAdminPatch } from '../../lib/api'
import { isHTTPError } from '../../lib/httpErrors'
import PostFormModal from './components/PostFormModal'
import StatusBadge from './components/StatusBadge'
// Removed AdminTokenControls - using Supabase JWT auth now

// Placeholder data for Curator - will be replaced with API data later
const PLACEHOLDER_JOURNALS = [
  { id: 'j1', name: 'Travel', icon: '✈️' },
  { id: 'j2', name: 'Personal', icon: '💭' },
  { id: 'j3', name: 'Creative', icon: '🎨' },
]

const PLACEHOLDER_COLLECTIONS = {
  j1: [
    { id: 'c1', name: 'US', journalId: 'j1' },
    { id: 'c2', name: 'Japan', journalId: 'j1' },
    { id: 'c3', name: 'Europe', journalId: 'j1' },
  ],
  j2: [
    { id: 'c4', name: 'Reflections', journalId: 'j2' },
    { id: 'c5', name: 'Goals', journalId: 'j2' },
  ],
  j3: [
    { id: 'c6', name: 'Short Stories', journalId: 'j3' },
  ],
}

const PLACEHOLDER_ENTRIES = {
  c1: [
    { id: 'e1', title: 'California Road Trip' },
    { id: 'e2', title: 'New York Weekend' },
  ],
  c2: [
    { id: 'e3', title: 'Tokyo Nights' },
  ],
  c3: [],
  c4: [
    { id: 'e4', title: 'Year in Review' },
  ],
  c5: [],
  c6: [],
}

const PostsPage = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('editor')
  const [posts, setPosts] = useState([])
  const [filteredPosts, setFilteredPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPost, setEditingPost] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [updatingStatusId, setUpdatingStatusId] = useState(null)
  
  // Curator state
  const [selectedJournal, setSelectedJournal] = useState(null)
  const [selectedCollection, setSelectedCollection] = useState(null)
  const [showUnassigned, setShowUnassigned] = useState(false)
  const [showNewJournalModal, setShowNewJournalModal] = useState(false)
  const [showNewCollectionModal, setShowNewCollectionModal] = useState(false)
  const [showAddEntryModal, setShowAddEntryModal] = useState(false)

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
        (post.content_text || '').toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredPosts(filtered)
    }
  }, [posts, searchTerm])

  const fetchPosts = async () => {
    try {
      setLoading(true)
      setError(null)
      const postsData = await supabaseAdminGet('/api/posts/admin')
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
      await supabaseAdminDelete(`/api/posts/${postId}`)
      
      // Optimistic update
      setPosts(prev => prev.filter(post => post.id !== postId))
    } catch (err) {
      console.error('Failed to delete post:', err)
      alert(`Failed to delete post: ${err.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  const handleStatusChange = async (postId, newStatus) => {
    try {
      setUpdatingStatusId(postId)
      
      // Update via API
      const response = await supabaseAdminPatch(`/api/posts/${postId}`, { status: newStatus })
      const updatedPost = response.post || response
      
      // Optimistic update
      setPosts(prev => prev.map(post => 
        post.id === postId ? { ...post, status: newStatus } : post
      ))
    } catch (err) {
      console.error('Failed to update status:', err)
      alert(`Failed to update status: ${err.message}`)
    } finally {
      setUpdatingStatusId(null)
    }
  }

  const openEditModal = (post) => {
    navigate(`/dashboard/posts/${post.id}/edit`)
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
    <div className="space-y-6 w-full max-w-4xl p-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Entries</h1>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('editor')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'editor'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Editor
          </button>
          <button
            onClick={() => setActiveTab('curator')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'curator'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Curator
          </button>
        </nav>
      </div>

      {/* Editor Tab Content */}
      {activeTab === 'editor' && (
        <>
          <div className="flex justify-end">
            <button
              onClick={() => navigate('/dashboard/posts/new')}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              New Entry
            </button>
          </div>

          {/* Search Filter */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <input
              type="text"
              placeholder="Search entries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Entries Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading entries...</div>
            ) : error ? (
              <div className="p-8">
                {isHTTPError(error, 500) ? (
                  <div className="p-4 bg-red-50 border border-red-200 rounded">
                    <h3 className="font-medium text-red-800 mb-2">Server configuration issue</h3>
                    <p className="text-sm text-red-700 mb-2">
                      There may be a server configuration issue. Please check the server logs.
                    </p>
                    <button 
                      onClick={fetchPosts}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Retry
                    </button>
                  </div>
                ) : isHTTPError(error, 401) ? (
                  <div className="p-4 bg-red-50 border border-red-200 rounded">
                    <h3 className="font-medium text-red-800 mb-2">Authentication required</h3>
                    <p className="text-sm text-red-700 mb-2">
                      Please sign in to access admin features.
                    </p>
                    <button 
                      onClick={() => navigate('/auth/signin')}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Sign In
                    </button>
                  </div>
                ) : (
                  <div className="p-4 bg-red-50 border border-red-200 rounded">
                    <h3 className="font-medium text-red-800 mb-2">Failed to load entries</h3>
                    <pre className="text-sm text-red-700">{String(error)}</pre>
                  </div>
                )}
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                {searchTerm ? 'No entries match your search' : 'No entries found'}
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
                            {post.content_text || ''}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {new Date(post.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={post.status || 'draft'}
                            onChange={(e) => handleStatusChange(post.id, e.target.value)}
                            disabled={updatingStatusId === post.id}
                            className={`px-3 py-1 border rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              post.status === 'published' 
                                ? 'bg-green-50 text-green-700 border-green-200' 
                                : post.status === 'draft'
                                ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                : 'bg-gray-50 text-gray-700 border-gray-200'
                            } ${updatingStatusId === post.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            <option value="draft">Draft</option>
                            <option value="published">Published</option>
                            <option value="archived">Archived</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            onClick={() => openEditModal(post)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            View/Edit
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
        </>
      )}

      {/* Curator Tab Content */}
      {activeTab === 'curator' && (
        <div className="w-full space-y-6">
          
          {/* JOURNALS ROW */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Journals
            </h3>
            <div className="flex flex-wrap gap-4">
              {PLACEHOLDER_JOURNALS.map(journal => (
                <button
                  key={journal.id}
                  onClick={() => {
                    setSelectedJournal(selectedJournal === journal.id ? null : journal.id)
                    setSelectedCollection(null)
                  }}
                  className={`flex flex-col items-center justify-center w-28 h-28 rounded-lg border-2 transition-all ${
                    selectedJournal === journal.id
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className="text-3xl mb-2">{journal.icon}</span>
                  <span className="text-sm font-medium">{journal.name}</span>
                </button>
              ))}
              
              {/* New Journal Button */}
              <button
                onClick={() => setShowNewJournalModal(true)}
                className="flex flex-col items-center justify-center w-28 h-28 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100 text-gray-400 hover:text-gray-500 transition-all"
              >
                <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-xs font-medium">New Journal</span>
              </button>
            </div>
          </div>

          {/* COLLECTIONS ROW */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Collections {selectedJournal && `in "${PLACEHOLDER_JOURNALS.find(j => j.id === selectedJournal)?.name}"`}
            </h3>
            
            {!selectedJournal ? (
              <div className="text-center py-8 text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm">Select a journal to view collections</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-4">
                {(PLACEHOLDER_COLLECTIONS[selectedJournal] || []).map(collection => (
                  <button
                    key={collection.id}
                    onClick={() => setSelectedCollection(selectedCollection === collection.id ? null : collection.id)}
                    className={`flex flex-col items-center justify-center w-28 h-28 rounded-lg border-2 transition-all ${
                      selectedCollection === collection.id
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <svg className="w-8 h-8 mb-2 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <span className="text-sm font-medium">{collection.name}</span>
                  </button>
                ))}
                
                {/* New Collection Button */}
                <button
                  onClick={() => setShowNewCollectionModal(true)}
                  className="flex flex-col items-center justify-center w-28 h-28 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100 text-gray-400 hover:text-gray-500 transition-all"
                >
                  <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-xs font-medium">New Collection</span>
                </button>
              </div>
            )}
          </div>

          {/* ENTRIES ROW */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Entries {selectedCollection && `in "${(PLACEHOLDER_COLLECTIONS[selectedJournal] || []).find(c => c.id === selectedCollection)?.name}"`}
            </h3>
            
            {!selectedCollection ? (
              <div className="text-center py-8 text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm">Select a collection to view entries</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-4">
                {(PLACEHOLDER_ENTRIES[selectedCollection] || []).map(entry => (
                  <div
                    key={entry.id}
                    className="flex flex-col items-center justify-center w-28 h-28 rounded-lg border-2 border-gray-200 bg-white text-gray-700 relative group"
                  >
                    <button
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-100 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-200"
                      title="Remove from collection"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <svg className="w-8 h-8 mb-2 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-xs font-medium text-center px-2 truncate w-full">{entry.title}</span>
                  </div>
                ))}
                
                {/* Add Entry Button */}
                <button
                  onClick={() => setShowAddEntryModal(true)}
                  className="flex flex-col items-center justify-center w-28 h-28 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100 text-gray-400 hover:text-gray-500 transition-all"
                >
                  <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-xs font-medium">Add Entry</span>
                </button>
                
                {(PLACEHOLDER_ENTRIES[selectedCollection] || []).length === 0 && (
                  <p className="text-sm text-gray-400 self-center ml-4">No entries in this collection yet</p>
                )}
              </div>
            )}
          </div>

          {/* UNASSIGNED ENTRIES */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <button
              onClick={() => setShowUnassigned(!showUnassigned)}
              className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span className="font-medium text-gray-700">Unassigned Entries</span>
                <span className="text-sm text-gray-400">(5)</span>
              </div>
              <svg 
                className={`w-5 h-5 text-gray-400 transition-transform ${showUnassigned ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showUnassigned && (
              <div className="px-6 pb-6 border-t border-gray-100">
                <div className="flex flex-wrap gap-4 pt-4">
                  {['Draft Post', 'Random Ideas', 'Notes', 'Untitled', 'Quick Thought'].map((title, i) => (
                    <div
                      key={i}
                      className="flex flex-col items-center justify-center w-28 h-28 rounded-lg border-2 border-gray-200 bg-gray-50 text-gray-500"
                    >
                      <svg className="w-8 h-8 mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-xs font-medium text-center px-2">{title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* MODALS (Placeholders) */}
          {showNewJournalModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold mb-4">Create New Journal</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="e.g., Travel Adventures" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Icon (emoji)</label>
                    <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="e.g., 📚" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={() => setShowNewJournalModal(false)} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
                  <button onClick={() => setShowNewJournalModal(false)} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Create Journal</button>
                </div>
              </div>
            </div>
          )}

          {showNewCollectionModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold mb-4">Create New Collection</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="e.g., Summer 2024" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={() => setShowNewCollectionModal(false)} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
                  <button onClick={() => setShowNewCollectionModal(false)} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Create Collection</button>
                </div>
              </div>
            </div>
          )}

          {showAddEntryModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold mb-4">Add Entry to Collection</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Search entries</label>
                    <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Search..." />
                  </div>
                  <div className="border border-gray-200 rounded-md max-h-60 overflow-y-auto">
                    {['Draft Post', 'Random Ideas', 'Notes', 'Untitled', 'Quick Thought'].map((title, i) => (
                      <label key={i} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0">
                        <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" />
                        <span className="text-sm text-gray-700">{title}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={() => setShowAddEntryModal(false)} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
                  <button onClick={() => setShowAddEntryModal(false)} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Add Selected</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default PostsPage
