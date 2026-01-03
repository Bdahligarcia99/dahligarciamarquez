// client/src/features/dashboard/PostsPage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabaseAdminGet, supabaseAdminDelete, supabaseAdminPatch } from '../../lib/api'
import { isHTTPError } from '../../lib/httpErrors'
import PostFormModal from './components/PostFormModal'
import StatusBadge from './components/StatusBadge'
import EmojiPicker from '../../components/EmojiPicker'
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
  const [sortBy, setSortBy] = useState('created_at') // 'title', 'created_at', 'status'
  const [sortDirection, setSortDirection] = useState('desc') // 'asc' or 'desc'
  const [organizationView, setOrganizationView] = useState('journal') // 'journal' or 'collection'
  
  // Curator state
  const [selectedJournal, setSelectedJournal] = useState(null)
  const [selectedCollection, setSelectedCollection] = useState(null)
  const [showUnassigned, setShowUnassigned] = useState(false)
  const [showNewJournalModal, setShowNewJournalModal] = useState(false)
  const [showNewCollectionModal, setShowNewCollectionModal] = useState(false)
  const [showAddEntryModal, setShowAddEntryModal] = useState(false)
  const [newJournalName, setNewJournalName] = useState('')
  const [newJournalEmoji, setNewJournalEmoji] = useState('📚')
  const [newJournalStatus, setNewJournalStatus] = useState('draft')
  const [newJournalIconType, setNewJournalIconType] = useState('emoji') // 'emoji' or 'image'
  const [newJournalImageUrl, setNewJournalImageUrl] = useState('')
  const [newJournalImageFile, setNewJournalImageFile] = useState(null)
  const [newJournalImagePreview, setNewJournalImagePreview] = useState(null)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [newCollectionStatus, setNewCollectionStatus] = useState('draft')

  useEffect(() => {
    fetchPosts()
  }, [])

  useEffect(() => {
    // Client-side filtering and sorting
    let result = posts
    
    // Filter
    if (searchTerm.trim() !== '') {
      result = result.filter(post =>
        post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (post.content_text || '').toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    
    // Sort
    result = [...result].sort((a, b) => {
      let aVal, bVal
      
      switch (sortBy) {
        case 'title':
          aVal = (a.title || '').toLowerCase()
          bVal = (b.title || '').toLowerCase()
          break
        case 'status':
          aVal = a.status || 'draft'
          bVal = b.status || 'draft'
          break
        case 'created_at':
        default:
          aVal = new Date(a.created_at).getTime()
          bVal = new Date(b.created_at).getTime()
          break
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
    
    setFilteredPosts(result)
  }, [posts, searchTerm, sortBy, sortDirection])
  
  const handleSort = (column) => {
    if (sortBy === column) {
      // Toggle direction if same column
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      // New column, default to ascending for title, descending for date
      setSortBy(column)
      setSortDirection(column === 'created_at' ? 'desc' : 'asc')
    }
  }

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
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('title')}
                      >
                        <span className={`transition-colors ${
                          sortBy === 'title'
                            ? 'text-blue-700 font-semibold'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}>
                          Title {sortBy === 'title' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </span>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('created_at')}
                      >
                        <span className={`transition-colors ${
                          sortBy === 'created_at'
                            ? 'text-blue-700 font-semibold'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}>
                          Created At {sortBy === 'created_at' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </span>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('status')}
                      >
                        <span className={`transition-colors ${
                          sortBy === 'status'
                            ? 'text-blue-700 font-semibold'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}>
                          Status {sortBy === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </span>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setOrganizationView('journal')}
                            className={`px-2 py-0.5 rounded text-xs transition-colors ${
                              organizationView === 'journal'
                                ? 'bg-blue-100 text-blue-700 font-semibold'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            Journal
                          </button>
                          <span className="text-gray-300">/</span>
                          <button
                            onClick={() => setOrganizationView('collection')}
                            className={`px-2 py-0.5 rounded text-xs transition-colors ${
                              organizationView === 'collection'
                                ? 'bg-blue-100 text-blue-700 font-semibold'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            Collection
                          </button>
                        </div>
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
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {organizationView === 'journal' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs">
                              <span className="text-gray-400">—</span>
                              <span className="text-gray-500">Unassigned</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs">
                              <span className="text-gray-400">—</span>
                              <span className="text-gray-500">Unassigned</span>
                            </span>
                          )}
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

          {/* UNASSIGNED ENTRIES - Shows actual posts from database */}
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
                <span className="text-sm text-gray-400">
                  ({loading ? '...' : posts.length})
                </span>
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
                {loading ? (
                  <div className="py-8 text-center text-gray-400">
                    <svg className="w-6 h-6 animate-spin mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Loading entries...
                  </div>
                ) : posts.length === 0 ? (
                  <div className="py-8 text-center text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm">No entries found</p>
                    <button 
                      onClick={() => navigate('/dashboard/posts/new')}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                    >
                      Create your first entry →
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-4 pt-4">
                    {posts.map((post) => (
                      <div
                        key={post.id}
                        className="flex flex-col items-center justify-center w-28 h-28 rounded-lg border-2 border-gray-200 bg-gray-50 text-gray-500 relative group cursor-pointer hover:border-gray-300 hover:bg-gray-100 transition-colors"
                        onClick={() => navigate(`/dashboard/posts/${post.id}/edit`)}
                        title={`${post.title}\nStatus: ${post.status || 'draft'}\nCreated: ${new Date(post.created_at).toLocaleDateString()}`}
                      >
                        {/* Status indicator */}
                        <div className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full ${
                          post.status === 'published' ? 'bg-green-500' :
                          post.status === 'archived' ? 'bg-gray-400' :
                          'bg-yellow-500'
                        }`} title={post.status || 'draft'} />
                        
                        {/* Cover image or icon */}
                        {post.cover_image_url ? (
                          <img 
                            src={post.cover_image_url} 
                            alt=""
                            className="w-10 h-10 object-cover rounded mb-1"
                          />
                        ) : (
                          <svg className="w-8 h-8 mb-1 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        )}
                        
                        <span className="text-xs font-medium text-center px-1 truncate w-full">
                          {post.title || 'Untitled'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* MODALS (Placeholders) */}
          {showNewJournalModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-semibold mb-4">Create New Journal</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input 
                      type="text" 
                      value={newJournalName}
                      onChange={(e) => setNewJournalName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md" 
                      placeholder="e.g., Travel Adventures" 
                    />
                  </div>
                  
                  {/* Icon Type Toggle */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Icon Type</label>
                    <div className="flex gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setNewJournalIconType('emoji')}
                        className={`flex-1 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                          newJournalIconType === 'emoji'
                            ? 'bg-blue-50 border-blue-300 text-blue-700'
                            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span className="flex items-center justify-center gap-1.5">
                          <span className="text-lg">😀</span>
                          Emoji
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewJournalIconType('image')}
                        className={`flex-1 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                          newJournalIconType === 'image'
                            ? 'bg-blue-50 border-blue-300 text-blue-700'
                            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span className="flex items-center justify-center gap-1.5">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Image
                        </span>
                      </button>
                    </div>
                    
                    {/* Emoji Picker */}
                    {newJournalIconType === 'emoji' && (
                      <EmojiPicker 
                        selectedEmoji={newJournalEmoji}
                        onSelect={setNewJournalEmoji}
                      />
                    )}
                    
                    {/* Image Picker */}
                    {newJournalIconType === 'image' && (
                      <div className="space-y-3">
                        {/* Image Preview */}
                        {(newJournalImagePreview || newJournalImageUrl) && (
                          <div className="flex justify-center">
                            <div className="relative">
                              <img 
                                src={newJournalImagePreview || newJournalImageUrl}
                                alt="Journal icon preview"
                                className="w-20 h-20 object-cover rounded-lg border-2 border-gray-200"
                                onError={(e) => {
                                  e.target.style.display = 'none'
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setNewJournalImageUrl('')
                                  setNewJournalImageFile(null)
                                  if (newJournalImagePreview) {
                                    URL.revokeObjectURL(newJournalImagePreview)
                                    setNewJournalImagePreview(null)
                                  }
                                }}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        )}
                        
                        {/* URL Input */}
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Image URL</label>
                          <input
                            type="url"
                            value={newJournalImageUrl}
                            onChange={(e) => {
                              setNewJournalImageUrl(e.target.value)
                              setNewJournalImageFile(null)
                              if (newJournalImagePreview) {
                                URL.revokeObjectURL(newJournalImagePreview)
                                setNewJournalImagePreview(null)
                              }
                            }}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                            placeholder="https://example.com/image.jpg"
                          />
                        </div>
                        
                        {/* Divider */}
                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-200" />
                          </div>
                          <div className="relative flex justify-center text-xs">
                            <span className="px-2 bg-white text-gray-400">or</span>
                          </div>
                        </div>
                        
                        {/* File Upload */}
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Upload Image</label>
                          <div className="flex gap-2">
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) {
                                  setNewJournalImageFile(file)
                                  setNewJournalImageUrl('')
                                  if (newJournalImagePreview) {
                                    URL.revokeObjectURL(newJournalImagePreview)
                                  }
                                  setNewJournalImagePreview(URL.createObjectURL(file))
                                }
                              }}
                              className="hidden"
                              id="journal-image-upload"
                            />
                            <label
                              htmlFor="journal-image-upload"
                              className="flex-1 px-3 py-2 text-sm text-center border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors"
                            >
                              <span className="flex items-center justify-center gap-2 text-gray-600">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                                {newJournalImageFile ? newJournalImageFile.name : 'Choose file...'}
                              </span>
                            </label>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">PNG, JPG, WebP, GIF up to 5MB</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setNewJournalStatus('draft')}
                        className={`flex-1 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                          newJournalStatus === 'draft'
                            ? 'bg-yellow-50 border-yellow-300 text-yellow-700'
                            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span className="flex items-center justify-center gap-1.5">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Draft
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewJournalStatus('published')}
                        className={`flex-1 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                          newJournalStatus === 'published'
                            ? 'bg-green-50 border-green-300 text-green-700'
                            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span className="flex items-center justify-center gap-1.5">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Published
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewJournalStatus('archived')}
                        className={`flex-1 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                          newJournalStatus === 'archived'
                            ? 'bg-gray-100 border-gray-400 text-gray-700'
                            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span className="flex items-center justify-center gap-1.5">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                          </svg>
                          Archived
                        </span>
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5">
                      {newJournalStatus === 'draft' && 'Only visible to you while editing'}
                      {newJournalStatus === 'published' && 'Visible to all visitors'}
                      {newJournalStatus === 'archived' && 'Hidden from public, preserved for reference'}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button 
                    onClick={() => {
                      setShowNewJournalModal(false)
                      setNewJournalName('')
                      setNewJournalEmoji('📚')
                      setNewJournalStatus('draft')
                      setNewJournalIconType('emoji')
                      setNewJournalImageUrl('')
                      setNewJournalImageFile(null)
                      if (newJournalImagePreview) {
                        URL.revokeObjectURL(newJournalImagePreview)
                        setNewJournalImagePreview(null)
                      }
                    }} 
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      // TODO: Save journal to database
                      const iconData = newJournalIconType === 'emoji' 
                        ? { type: 'emoji', value: newJournalEmoji }
                        : { type: 'image', value: newJournalImageUrl || newJournalImageFile }
                      console.log('Creating journal:', { 
                        name: newJournalName, 
                        icon: iconData, 
                        status: newJournalStatus 
                      })
                      setShowNewJournalModal(false)
                      setNewJournalName('')
                      setNewJournalEmoji('📚')
                      setNewJournalStatus('draft')
                      setNewJournalIconType('emoji')
                      setNewJournalImageUrl('')
                      setNewJournalImageFile(null)
                      if (newJournalImagePreview) {
                        URL.revokeObjectURL(newJournalImagePreview)
                        setNewJournalImagePreview(null)
                      }
                    }} 
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Create Journal
                  </button>
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
                    <input 
                      type="text" 
                      value={newCollectionName}
                      onChange={(e) => setNewCollectionName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md" 
                      placeholder="e.g., Summer 2024" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setNewCollectionStatus('draft')}
                        className={`flex-1 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                          newCollectionStatus === 'draft'
                            ? 'bg-yellow-50 border-yellow-300 text-yellow-700'
                            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span className="flex items-center justify-center gap-1.5">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Draft
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewCollectionStatus('published')}
                        className={`flex-1 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                          newCollectionStatus === 'published'
                            ? 'bg-green-50 border-green-300 text-green-700'
                            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span className="flex items-center justify-center gap-1.5">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Published
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewCollectionStatus('archived')}
                        className={`flex-1 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                          newCollectionStatus === 'archived'
                            ? 'bg-gray-100 border-gray-400 text-gray-700'
                            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span className="flex items-center justify-center gap-1.5">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                          </svg>
                          Archived
                        </span>
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5">
                      {newCollectionStatus === 'draft' && 'Only visible to you while editing'}
                      {newCollectionStatus === 'published' && 'Visible to all visitors'}
                      {newCollectionStatus === 'archived' && 'Hidden from public, preserved for reference'}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button 
                    onClick={() => {
                      setShowNewCollectionModal(false)
                      setNewCollectionName('')
                      setNewCollectionStatus('draft')
                    }} 
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      // TODO: Save collection to database
                      console.log('Creating collection:', { 
                        name: newCollectionName, 
                        status: newCollectionStatus,
                        journalId: selectedJournal 
                      })
                      setShowNewCollectionModal(false)
                      setNewCollectionName('')
                      setNewCollectionStatus('draft')
                    }} 
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Create Collection
                  </button>
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
                    <input 
                      type="text" 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md" 
                      placeholder="Search by title..." 
                    />
                  </div>
                  <div className="border border-gray-200 rounded-md max-h-60 overflow-y-auto">
                    {loading ? (
                      <div className="p-4 text-center text-gray-400">Loading entries...</div>
                    ) : filteredPosts.length === 0 ? (
                      <div className="p-4 text-center text-gray-400">
                        {searchTerm ? 'No entries match your search' : 'No entries available'}
                      </div>
                    ) : (
                      filteredPosts.map((post) => (
                        <label key={post.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0">
                          <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-gray-700 block truncate">{post.title || 'Untitled'}</span>
                            <span className="text-xs text-gray-400">
                              {post.status || 'draft'} • {new Date(post.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          {/* Status dot */}
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            post.status === 'published' ? 'bg-green-500' :
                            post.status === 'archived' ? 'bg-gray-400' :
                            'bg-yellow-500'
                          }`} />
                        </label>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {filteredPosts.length} {filteredPosts.length === 1 ? 'entry' : 'entries'} available
                  </p>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button 
                    onClick={() => {
                      setShowAddEntryModal(false)
                      setSearchTerm('')
                    }} 
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      // TODO: Save selected entries to collection
                      setShowAddEntryModal(false)
                      setSearchTerm('')
                    }} 
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Add Selected
                  </button>
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
