// client/src/features/dashboard/PostsPage.jsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabaseAdminGet, supabaseAdminDelete, supabaseAdminPatch } from '../../lib/api'
import { isHTTPError } from '../../lib/httpErrors'
import { getSupabaseClient } from '../../lib/supabase'
import PostFormModal from './components/PostFormModal'
import StatusBadge from './components/StatusBadge'
import EmojiPicker from '../../components/EmojiPicker'
// Removed AdminTokenControls - using Supabase JWT auth now

const PostsPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  
  // Contextual navigation: track if we came from the Entry Editor
  const [cameFromEditor, setCameFromEditor] = useState(false)
  const [returnToPostId, setReturnToPostId] = useState(null)
  
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
  
  // Curator state - data from database
  const [journals, setJournals] = useState([])
  const [collections, setCollections] = useState([]) // collections for selected journal
  const [collectionEntries, setCollectionEntries] = useState([]) // entries for selected collection
  const [curatorLoading, setCuratorLoading] = useState(false)
  
  // Curator state - UI
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
  const [newJournalHasWallpaper, setNewJournalHasWallpaper] = useState(false)
  const [newJournalWallpaperUrl, setNewJournalWallpaperUrl] = useState('')
  const [newJournalWallpaperFile, setNewJournalWallpaperFile] = useState(null)
  const [newJournalWallpaperPreview, setNewJournalWallpaperPreview] = useState(null)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [newCollectionStatus, setNewCollectionStatus] = useState('draft')
  const [selectedEntryForAction, setSelectedEntryForAction] = useState(null)
  const [showEntryActionModal, setShowEntryActionModal] = useState(false)
  const [showAttributesView, setShowAttributesView] = useState(false)
  const [selectedPostsToAdd, setSelectedPostsToAdd] = useState([]) // For add entry modal
  
  // Post organization assignments (for entries table display)
  const [postAssignments, setPostAssignments] = useState({}) // { postId: { journals: [...], collections: [...] } }

  useEffect(() => {
    fetchPosts()
  }, [])

  // Handle contextual navigation from Entry Editor
  useEffect(() => {
    if (location.state?.fromEditor) {
      setCameFromEditor(true)
      setReturnToPostId(location.state.returnToPostId || null)
      setActiveTab('curator')
      
      // Clear the location state to prevent re-triggering on navigation within page
      // This uses replaceState to avoid adding to history
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

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
      const postsArray = Array.isArray(postsData) ? postsData : postsData.items || []
      setPosts(postsArray)
      
      // Fetch organization assignments for all posts
      if (postsArray.length > 0) {
        await fetchPostAssignments(postsArray.map(p => p.id))
      }
    } catch (err) {
      console.error('Failed to fetch posts:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  
  // Fetch journal and collection assignments for posts
  const fetchPostAssignments = async (postIds) => {
    const supabase = getSupabaseClient()
    if (!supabase || postIds.length === 0) return
    
    try {
      // Fetch journal assignments
      const { data: journalEntries, error: journalError } = await supabase
        .from('journal_entries')
        .select(`
          post_id,
          journals (
            id,
            name,
            icon_emoji
          )
        `)
        .in('post_id', postIds)
      
      if (journalError) {
        console.error('Error fetching journal assignments:', journalError)
      }
      
      // Fetch collection assignments
      const { data: collectionEntries, error: collectionError } = await supabase
        .from('collection_entries')
        .select(`
          post_id,
          collections (
            id,
            name,
            icon_emoji,
            journal_id,
            journals (
              id,
              name,
              icon_emoji
            )
          )
        `)
        .in('post_id', postIds)
      
      if (collectionError) {
        console.error('Error fetching collection assignments:', collectionError)
      }
      
      // Build assignments map
      const assignments = {}
      
      // Initialize all posts with empty arrays
      postIds.forEach(id => {
        assignments[id] = { journals: [], collections: [] }
      })
      
      // Add journal assignments
      if (journalEntries) {
        journalEntries.forEach(entry => {
          if (entry.journals && assignments[entry.post_id]) {
            assignments[entry.post_id].journals.push(entry.journals)
          }
        })
      }
      
      // Add collection assignments
      if (collectionEntries) {
        collectionEntries.forEach(entry => {
          if (entry.collections && assignments[entry.post_id]) {
            assignments[entry.post_id].collections.push({
              ...entry.collections,
              journal: entry.collections.journals
            })
          }
        })
      }
      
      setPostAssignments(assignments)
    } catch (err) {
      console.error('Error fetching post assignments:', err)
    }
  }

  // ============================================================================
  // CURATOR API FUNCTIONS
  // ============================================================================
  
  // Fetch all journals
  const fetchJournals = useCallback(async () => {
    const supabase = getSupabaseClient()
    if (!supabase) return
    
    setCuratorLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_user_journals')
      if (error) throw error
      setJournals(data || [])
    } catch (err) {
      console.error('Failed to fetch journals:', err)
    } finally {
      setCuratorLoading(false)
    }
  }, [])
  
  // Fetch collections for selected journal
  const fetchCollections = useCallback(async (journalId) => {
    if (!journalId) {
      setCollections([])
      return
    }
    
    const supabase = getSupabaseClient()
    if (!supabase) return
    
    setCuratorLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_journal_collections', { p_journal_id: journalId })
      if (error) throw error
      setCollections(data || [])
    } catch (err) {
      console.error('Failed to fetch collections:', err)
    } finally {
      setCuratorLoading(false)
    }
  }, [])
  
  // Fetch entries for selected collection
  const fetchCollectionEntries = useCallback(async (collectionId) => {
    if (!collectionId) {
      setCollectionEntries([])
      return
    }
    
    const supabase = getSupabaseClient()
    if (!supabase) return
    
    setCuratorLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_collection_entries', { p_collection_id: collectionId })
      if (error) throw error
      setCollectionEntries(data || [])
    } catch (err) {
      console.error('Failed to fetch collection entries:', err)
    } finally {
      setCuratorLoading(false)
    }
  }, [])
  
  // Create a new journal
  const createJournal = async (journalData) => {
    const supabase = getSupabaseClient()
    if (!supabase) return null
    
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData?.user) throw new Error('Not authenticated')
      
      const { data, error } = await supabase
        .from('journals')
        .insert({
          owner_id: userData.user.id,
          name: journalData.name,
          icon_type: journalData.iconType || 'emoji',
          icon_emoji: journalData.iconEmoji || '📚',
          icon_image_url: journalData.iconImageUrl || null,
          status: journalData.status || 'draft',
          wallpaper_url: journalData.wallpaperUrl || null,
          wallpaper_blur: journalData.wallpaperBlur || 0
        })
        .select()
        .single()
      
      if (error) throw error
      
      // Refresh journals list
      await fetchJournals()
      return data
    } catch (err) {
      console.error('Failed to create journal:', err)
      throw err
    }
  }
  
  // Create a new collection
  const createCollection = async (collectionData) => {
    const supabase = getSupabaseClient()
    if (!supabase) return null
    
    try {
      const { data, error } = await supabase
        .from('collections')
        .insert({
          journal_id: collectionData.journalId,
          name: collectionData.name,
          status: collectionData.status || 'draft'
        })
        .select()
        .single()
      
      if (error) throw error
      
      // Refresh collections list
      await fetchCollections(collectionData.journalId)
      return data
    } catch (err) {
      console.error('Failed to create collection:', err)
      throw err
    }
  }
  
  // Add post to collection
  const addPostToCollection = async (collectionId, postId) => {
    const supabase = getSupabaseClient()
    if (!supabase) return null
    
    try {
      const { data, error } = await supabase.rpc('add_post_to_collection', {
        p_collection_id: collectionId,
        p_post_id: postId
      })
      
      if (error) throw error
      
      // Refresh entries list
      await fetchCollectionEntries(collectionId)
      return data
    } catch (err) {
      console.error('Failed to add post to collection:', err)
      throw err
    }
  }
  
  // Remove post from collection
  const removePostFromCollection = async (collectionId, postId) => {
    const supabase = getSupabaseClient()
    if (!supabase) return false
    
    try {
      const { data, error } = await supabase.rpc('remove_post_from_collection', {
        p_collection_id: collectionId,
        p_post_id: postId
      })
      
      if (error) throw error
      
      // Refresh entries list
      await fetchCollectionEntries(collectionId)
      return data
    } catch (err) {
      console.error('Failed to remove post from collection:', err)
      throw err
    }
  }
  
  // Delete journal
  const deleteJournal = async (journalId) => {
    const supabase = getSupabaseClient()
    if (!supabase) return false
    
    try {
      const { error } = await supabase
        .from('journals')
        .delete()
        .eq('id', journalId)
      
      if (error) throw error
      
      // Clear selection and refresh
      if (selectedJournal === journalId) {
        setSelectedJournal(null)
        setSelectedCollection(null)
        setCollections([])
        setCollectionEntries([])
      }
      await fetchJournals()
      return true
    } catch (err) {
      console.error('Failed to delete journal:', err)
      throw err
    }
  }
  
  // Delete collection
  const deleteCollection = async (collectionId) => {
    const supabase = getSupabaseClient()
    if (!supabase) return false
    
    try {
      const { error } = await supabase
        .from('collections')
        .delete()
        .eq('id', collectionId)
      
      if (error) throw error
      
      // Clear selection and refresh
      if (selectedCollection === collectionId) {
        setSelectedCollection(null)
        setCollectionEntries([])
      }
      await fetchCollections(selectedJournal)
      return true
    } catch (err) {
      console.error('Failed to delete collection:', err)
      throw err
    }
  }
  
  // Fetch journals when curator tab is active
  useEffect(() => {
    if (activeTab === 'curator') {
      fetchJournals()
    }
  }, [activeTab, fetchJournals])
  
  // Fetch collections when journal is selected
  useEffect(() => {
    fetchCollections(selectedJournal)
  }, [selectedJournal, fetchCollections])
  
  // Fetch entries when collection is selected
  useEffect(() => {
    fetchCollectionEntries(selectedCollection)
  }, [selectedCollection, fetchCollectionEntries])

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

      {/* Tab Navigation - hide Entries tab when coming from Editor */}
      {!cameFromEditor && (
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
              Entries
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
      )}

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
                        Organization
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
                                : post.status === 'private'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : post.status === 'system'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-gray-50 text-gray-700 border-gray-200'
                            } ${updatingStatusId === post.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            <option value="draft">Draft</option>
                            <option value="published">Published</option>
                            <option value="private">Private</option>
                            <option value="system">System</option>
                            <option value="archived">Archived</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {(() => {
                            const assignments = postAssignments[post.id] || { journals: [], collections: [] }
                            const hasJournals = assignments.journals.length > 0
                            const hasCollections = assignments.collections.length > 0
                            
                            if (!hasJournals && !hasCollections) {
                              return (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs">
                                  <span className="text-gray-400">—</span>
                                  <span className="text-gray-500">Unassigned</span>
                                </span>
                              )
                            }
                            
                            return (
                              <div className="flex flex-col gap-1.5">
                                {/* Journals (direct assignments) */}
                                {hasJournals && (
                                  <div className="flex flex-wrap gap-1">
                                    {assignments.journals.map(journal => (
                                      <span 
                                        key={journal.id}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-xs"
                                        title={`Journal: ${journal.name}`}
                                      >
                                        <span>{journal.icon_emoji || '📚'}</span>
                                        <span className="max-w-[100px] truncate font-medium">{journal.name}</span>
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {/* Collections (with parent journal shown) */}
                                {hasCollections && (
                                  <div className="flex flex-wrap gap-1">
                                    {assignments.collections.map(collection => (
                                      <span 
                                        key={collection.id}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded text-xs"
                                        title={`Collection: ${collection.name} (in ${collection.journal?.name || 'Unknown Journal'})`}
                                      >
                                        <span className="text-gray-400">{collection.journal?.icon_emoji || '📚'}</span>
                                        <span className="text-gray-400 max-w-[60px] truncate">{collection.journal?.name || '?'}</span>
                                        <span className="text-gray-300">/</span>
                                        <span>{collection.icon_emoji || '📁'}</span>
                                        <span className="max-w-[80px] truncate font-medium">{collection.name}</span>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })()}
                        </td>
                        <td className="px-6 py-4 text-right space-x-3">
                          <button
                            onClick={() => window.open(`/blog/${post.slug}?from=dashboard`, '_blank')}
                            className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                            title="Preview as reader"
                          >
                            View
                          </button>
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
        </>
      )}

      {/* Curator Tab Content */}
      {activeTab === 'curator' && (
        <div className="w-full space-y-6">
          
          {/* Back to Editor Button - only shown when navigated from Editor */}
          {cameFromEditor && (
            <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2 text-purple-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm">
                  You're viewing the Curator from the Entry Editor.
                  {returnToPostId && ' Changes here will be reflected in your entry.'}
                </span>
              </div>
              <button
                onClick={() => {
                  setCameFromEditor(false)
                  if (returnToPostId) {
                    navigate(`/dashboard/posts/${returnToPostId}/edit`)
                  } else {
                    navigate('/dashboard/posts/new')
                  }
                }}
                className="px-3 py-1.5 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                </svg>
                Back to Editor
              </button>
            </div>
          )}
          
          {/* JOURNALS ROW */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Journals
            </h3>
            <div className="flex flex-wrap gap-4">
              {journals.map(journal => (
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
                  {journal.icon_type === 'image' && journal.icon_image_url ? (
                    <img src={journal.icon_image_url} alt="" className="w-10 h-10 object-cover rounded mb-2" />
                  ) : (
                    <span className="text-3xl mb-2">{journal.icon_emoji || '📚'}</span>
                  )}
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
              Collections {selectedJournal && `in "${journals.find(j => j.id === selectedJournal)?.name}"`}
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
                {collections.map(collection => (
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
              Entries {selectedCollection && `in "${collections.find(c => c.id === selectedCollection)?.name}"`}
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
                {collectionEntries.map(entry => (
                  <div
                    key={entry.entry_id || entry.post_id}
                    className="flex flex-col items-center justify-center w-28 h-28 rounded-lg border-2 border-gray-200 bg-white text-gray-700 relative group"
                  >
                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        if (window.confirm('Remove this entry from the collection?')) {
                          try {
                            await removePostFromCollection(selectedCollection, entry.post_id)
                          } catch (err) {
                            alert('Failed to remove entry. Please try again.')
                          }
                        }
                      }}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-100 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-200"
                      title="Remove from collection"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    {entry.post_cover_image_url ? (
                      <img src={entry.post_cover_image_url} alt="" className="w-8 h-8 mb-2 object-cover rounded" />
                    ) : (
                      <svg className="w-8 h-8 mb-2 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )}
                    <span className="text-xs font-medium text-center px-2 truncate w-full">{entry.post_title}</span>
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
                
                {collectionEntries.length === 0 && (
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
                        onClick={() => {
                          setSelectedEntryForAction(post)
                          setShowEntryActionModal(true)
                          setShowAttributesView(false)
                        }}
                        title={`${post.title}\nStatus: ${post.status || 'draft'}\nCreated: ${new Date(post.created_at).toLocaleDateString()}`}
                      >
                        {/* Status indicator */}
                        <div className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full ${
                          post.status === 'published' ? 'bg-green-500' :
                          post.status === 'private' ? 'bg-purple-500' :
                          post.status === 'system' ? 'bg-blue-500' :
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
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => setNewJournalStatus('draft')}
                        className={`px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
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
                        className={`px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
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
                        onClick={() => setNewJournalStatus('private')}
                        className={`px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                          newJournalStatus === 'private'
                            ? 'bg-purple-50 border-purple-300 text-purple-700'
                            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span className="flex items-center justify-center gap-1.5">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          Private
                        </span>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewJournalStatus('system')}
                        className={`px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                          newJournalStatus === 'system'
                            ? 'bg-blue-50 border-blue-300 text-blue-700'
                            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span className="flex items-center justify-center gap-1.5">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          System
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewJournalStatus('archived')}
                        className={`px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
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
                      {newJournalStatus === 'private' && 'Only viewable by specific people or through specific access'}
                      {newJournalStatus === 'system' && 'Used by the web application (e.g., Terms of Service, Bio)'}
                      {newJournalStatus === 'archived' && 'Hidden from public, preserved for reference'}
                    </p>
                  </div>
                  
                  {/* Wallpaper Section */}
                  <div className="pt-4 border-t border-gray-200">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newJournalHasWallpaper}
                        onChange={(e) => {
                          setNewJournalHasWallpaper(e.target.checked)
                          if (!e.target.checked) {
                            // Clear wallpaper data when unchecked
                            setNewJournalWallpaperUrl('')
                            setNewJournalWallpaperFile(null)
                            if (newJournalWallpaperPreview) {
                              URL.revokeObjectURL(newJournalWallpaperPreview)
                              setNewJournalWallpaperPreview(null)
                            }
                          }
                        }}
                        className="w-5 h-5 border-gray-300 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="text-sm font-medium text-gray-700">Assign wallpaper</span>
                    </label>
                    <p className="text-xs text-gray-500 mt-1 ml-8">
                      Use a custom background image for pages related to this journal
                    </p>
                    
                    {newJournalHasWallpaper && (
                      <div className="mt-4 ml-8 space-y-3">
                        {/* Wallpaper Preview */}
                        {(newJournalWallpaperPreview || newJournalWallpaperUrl) && (
                          <div className="mb-3">
                            <div className="relative rounded-lg overflow-hidden border border-gray-200">
                              <img 
                                src={newJournalWallpaperPreview || newJournalWallpaperUrl}
                                alt="Wallpaper preview"
                                className="w-full h-32 object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none'
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setNewJournalWallpaperUrl('')
                                  setNewJournalWallpaperFile(null)
                                  if (newJournalWallpaperPreview) {
                                    URL.revokeObjectURL(newJournalWallpaperPreview)
                                    setNewJournalWallpaperPreview(null)
                                  }
                                }}
                                className="absolute top-2 right-2 w-7 h-7 bg-black bg-opacity-50 text-white rounded-full flex items-center justify-center hover:bg-opacity-70"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        )}
                        
                        {/* Wallpaper URL Input */}
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Image URL</label>
                          <input
                            type="url"
                            value={newJournalWallpaperUrl}
                            onChange={(e) => {
                              setNewJournalWallpaperUrl(e.target.value)
                              setNewJournalWallpaperFile(null)
                              if (newJournalWallpaperPreview) {
                                URL.revokeObjectURL(newJournalWallpaperPreview)
                                setNewJournalWallpaperPreview(null)
                              }
                            }}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                            placeholder="https://example.com/wallpaper.jpg"
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
                        
                        {/* Wallpaper File Upload */}
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Upload Image</label>
                          <div className="flex gap-2">
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/jpg,image/webp"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) {
                                  setNewJournalWallpaperFile(file)
                                  setNewJournalWallpaperUrl('')
                                  if (newJournalWallpaperPreview) {
                                    URL.revokeObjectURL(newJournalWallpaperPreview)
                                  }
                                  setNewJournalWallpaperPreview(URL.createObjectURL(file))
                                }
                              }}
                              className="hidden"
                              id="journal-wallpaper-upload"
                            />
                            <label
                              htmlFor="journal-wallpaper-upload"
                              className="flex-1 px-3 py-2 text-sm text-center border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors"
                            >
                              <span className="flex items-center justify-center gap-2 text-gray-600">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                {newJournalWallpaperFile ? newJournalWallpaperFile.name : 'Choose wallpaper...'}
                              </span>
                            </label>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">Recommended: Wide landscape image (1920x1080 or larger)</p>
                        </div>
                      </div>
                    )}
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
                      setNewJournalHasWallpaper(false)
                      setNewJournalWallpaperUrl('')
                      setNewJournalWallpaperFile(null)
                      if (newJournalWallpaperPreview) {
                        URL.revokeObjectURL(newJournalWallpaperPreview)
                        setNewJournalWallpaperPreview(null)
                      }
                    }} 
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={async () => {
                      if (!newJournalName.trim()) return
                      
                      try {
                        await createJournal({
                          name: newJournalName.trim(),
                          iconType: newJournalIconType,
                          iconEmoji: newJournalEmoji,
                          iconImageUrl: newJournalImageUrl || null,
                          status: newJournalStatus,
                          wallpaperUrl: newJournalHasWallpaper ? (newJournalWallpaperUrl || null) : null,
                          wallpaperBlur: 0
                        })
                        
                        // Reset form and close modal
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
                        setNewJournalHasWallpaper(false)
                        setNewJournalWallpaperUrl('')
                        setNewJournalWallpaperFile(null)
                        if (newJournalWallpaperPreview) {
                          URL.revokeObjectURL(newJournalWallpaperPreview)
                          setNewJournalWallpaperPreview(null)
                        }
                      } catch (err) {
                        console.error('Failed to create journal:', err)
                        alert('Failed to create journal. Please try again.')
                      }
                    }} 
                    disabled={!newJournalName.trim()}
                    className={`px-4 py-2 rounded-md hover:bg-blue-700 ${
                      newJournalName.trim() 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
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
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => setNewCollectionStatus('draft')}
                        className={`px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
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
                        className={`px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
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
                        onClick={() => setNewCollectionStatus('private')}
                        className={`px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                          newCollectionStatus === 'private'
                            ? 'bg-purple-50 border-purple-300 text-purple-700'
                            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span className="flex items-center justify-center gap-1.5">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          Private
                        </span>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewCollectionStatus('system')}
                        className={`px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                          newCollectionStatus === 'system'
                            ? 'bg-blue-50 border-blue-300 text-blue-700'
                            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span className="flex items-center justify-center gap-1.5">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          System
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewCollectionStatus('archived')}
                        className={`px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
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
                      {newCollectionStatus === 'private' && 'Only viewable by specific people or through specific access'}
                      {newCollectionStatus === 'system' && 'Used by the web application (e.g., Terms of Service, Bio)'}
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
                    onClick={async () => {
                      if (!newCollectionName.trim() || !selectedJournal) return
                      
                      try {
                        await createCollection({
                          journalId: selectedJournal,
                          name: newCollectionName.trim(),
                          status: newCollectionStatus
                        })
                        
                        setShowNewCollectionModal(false)
                        setNewCollectionName('')
                        setNewCollectionStatus('draft')
                      } catch (err) {
                        console.error('Failed to create collection:', err)
                        alert('Failed to create collection. Please try again.')
                      }
                    }} 
                    disabled={!newCollectionName.trim() || !selectedJournal}
                    className={`px-4 py-2 rounded-md ${
                      newCollectionName.trim() && selectedJournal
                        ? 'bg-blue-600 text-white hover:bg-blue-700' 
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
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
                      filteredPosts
                        .filter(post => !collectionEntries.some(e => e.post_id === post.id))
                        .map((post) => (
                        <label key={post.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 text-blue-600 rounded"
                            checked={selectedPostsToAdd.includes(post.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPostsToAdd(prev => [...prev, post.id])
                              } else {
                                setSelectedPostsToAdd(prev => prev.filter(id => id !== post.id))
                              }
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-gray-700 block truncate">{post.title || 'Untitled'}</span>
                            <span className="text-xs text-gray-400">
                              {post.status || 'draft'} • {new Date(post.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          {/* Status dot */}
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            post.status === 'published' ? 'bg-green-500' :
                            post.status === 'private' ? 'bg-purple-500' :
                            post.status === 'system' ? 'bg-blue-500' :
                            post.status === 'archived' ? 'bg-gray-400' :
                            'bg-yellow-500'
                          }`} />
                        </label>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {selectedPostsToAdd.length > 0 
                      ? `${selectedPostsToAdd.length} selected` 
                      : `${filteredPosts.filter(p => !collectionEntries.some(e => e.post_id === p.id)).length} entries available`
                    }
                  </p>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button 
                    onClick={() => {
                      setShowAddEntryModal(false)
                      setSearchTerm('')
                      setSelectedPostsToAdd([])
                    }} 
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={async () => {
                      if (selectedPostsToAdd.length === 0 || !selectedCollection) return
                      
                      try {
                        // Add all selected posts to the collection
                        for (const postId of selectedPostsToAdd) {
                          await addPostToCollection(selectedCollection, postId)
                        }
                        
                        setShowAddEntryModal(false)
                        setSearchTerm('')
                        setSelectedPostsToAdd([])
                      } catch (err) {
                        console.error('Failed to add entries:', err)
                        alert('Failed to add some entries. Please try again.')
                      }
                    }} 
                    disabled={selectedPostsToAdd.length === 0}
                    className={`px-4 py-2 rounded-md ${
                      selectedPostsToAdd.length > 0
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    Add Selected ({selectedPostsToAdd.length})
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Entry Action Modal */}
          {showEntryActionModal && selectedEntryForAction && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
                {!showAttributesView ? (
                  <>
                    {/* Main Menu */}
                    <div className="flex items-center gap-3 mb-4">
                      {selectedEntryForAction.cover_image_url ? (
                        <img 
                          src={selectedEntryForAction.cover_image_url} 
                          alt=""
                          className="w-12 h-12 object-cover rounded"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {selectedEntryForAction.title || 'Untitled'}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {selectedEntryForAction.status || 'draft'} • {new Date(selectedEntryForAction.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          setShowEntryActionModal(false)
                          navigate(`/dashboard/posts/${selectedEntryForAction.id}/edit`)
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left"
                      >
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <div>
                          <span className="font-medium text-gray-900">Edit Entry</span>
                          <p className="text-xs text-gray-500">Open in editor</p>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => setShowAttributesView(true)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left"
                      >
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                        </svg>
                        <div>
                          <span className="font-medium text-gray-900">Edit Attributes</span>
                          <p className="text-xs text-gray-500">Change status or delete</p>
                        </div>
                      </button>
                    </div>
                    
                    <button 
                      onClick={() => {
                        setShowEntryActionModal(false)
                        setSelectedEntryForAction(null)
                      }}
                      className="w-full mt-4 px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    {/* Attributes View */}
                    <div className="flex items-center gap-2 mb-4">
                      <button
                        onClick={() => setShowAttributesView(false)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <h3 className="font-semibold text-gray-900">Edit Attributes</h3>
                    </div>
                    
                    <div className="space-y-4">
                      {/* Status */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={async () => {
                              await handleStatusChange(selectedEntryForAction.id, 'draft')
                              setSelectedEntryForAction({...selectedEntryForAction, status: 'draft'})
                            }}
                            className={`flex-1 min-w-[80px] px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                              selectedEntryForAction.status === 'draft' || !selectedEntryForAction.status
                                ? 'bg-yellow-50 border-yellow-300 text-yellow-700'
                                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            Draft
                          </button>
                          <button
                            onClick={async () => {
                              await handleStatusChange(selectedEntryForAction.id, 'published')
                              setSelectedEntryForAction({...selectedEntryForAction, status: 'published'})
                            }}
                            className={`flex-1 min-w-[80px] px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                              selectedEntryForAction.status === 'published'
                                ? 'bg-green-50 border-green-300 text-green-700'
                                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            Published
                          </button>
                          <button
                            onClick={async () => {
                              await handleStatusChange(selectedEntryForAction.id, 'archived')
                              setSelectedEntryForAction({...selectedEntryForAction, status: 'archived'})
                            }}
                            className={`flex-1 min-w-[80px] px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                              selectedEntryForAction.status === 'archived'
                                ? 'bg-gray-100 border-gray-400 text-gray-700'
                                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            Archived
                          </button>
                          <button
                            onClick={async () => {
                              await handleStatusChange(selectedEntryForAction.id, 'private')
                              setSelectedEntryForAction({...selectedEntryForAction, status: 'private'})
                            }}
                            className={`flex-1 min-w-[80px] px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                              selectedEntryForAction.status === 'private'
                                ? 'bg-purple-50 border-purple-300 text-purple-700'
                                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            Private
                          </button>
                          <button
                            onClick={async () => {
                              await handleStatusChange(selectedEntryForAction.id, 'system')
                              setSelectedEntryForAction({...selectedEntryForAction, status: 'system'})
                            }}
                            className={`flex-1 min-w-[80px] px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                              selectedEntryForAction.status === 'system'
                                ? 'bg-blue-50 border-blue-300 text-blue-700'
                                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            System
                          </button>
                        </div>
                      </div>
                      
                      {/* Delete */}
                      <div className="pt-4 border-t border-gray-200">
                        <button
                          onClick={async () => {
                            if (confirm(`Are you sure you want to delete "${selectedEntryForAction.title}"?`)) {
                              await handleDeletePost(selectedEntryForAction.id)
                              setShowEntryActionModal(false)
                              setSelectedEntryForAction(null)
                            }
                          }}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete Entry
                        </button>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => {
                        setShowEntryActionModal(false)
                        setSelectedEntryForAction(null)
                        setShowAttributesView(false)
                      }}
                      className="w-full mt-4 px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
                    >
                      Done
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default PostsPage
