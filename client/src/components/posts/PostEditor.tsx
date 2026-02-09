// Post Editor Component
import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabaseAdminGet, supabaseAdminPost, supabaseAdminPatch } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'
import RichTextEditor, { RichTextEditorRef } from '../editor/RichTextEditor'
import { uploadImage, UploadError } from '../../utils/uploadImage'
import { validateImageUrl, extractImageUrlsFromHtml } from '../../utils/imageValidation'
import { generateCoverImageAlt } from '../../utils/altTextGenerator'
import { parseImportContent, getFieldsSummary, ImportMode, ParsedEntryFields } from '../../utils/importParser'
import { generateTemplate, TemplateFormat, getFieldDescriptions } from '../../utils/templateGenerator'
import { getSupabaseClient } from '../../lib/supabase'
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

// Curator Collection types for the new labeling system
interface CollectionForPicker {
  collection_id: string
  collection_name: string
  collection_slug: string
  collection_icon_emoji: string
  collection_status: string
  journal_id: string
  journal_name: string
  journal_icon_emoji: string
  journal_icon_type: string
  journal_status: string
  entry_count: number
}

interface PostCollection {
  collection_id: string
  collection_name: string
  collection_icon_emoji: string
  journal_id: string
  journal_name: string
  journal_icon_emoji: string
}

// Journal types for direct journal assignment
interface JournalForPicker {
  journal_id: string
  journal_name: string
  journal_slug: string
  journal_icon_emoji: string
  journal_icon_type: string
  journal_icon_image_url: string | null
  journal_status: string
  entry_count: number
  collection_count: number
}

interface PostJournal {
  journal_id: string
  journal_name: string
  journal_icon_emoji: string
}

interface PostEditorProps {
  postId?: string
  onSave?: (post: any) => void
  onCancel?: () => void
}

export default function PostEditor({ onSave, onCancel }: PostEditorProps) {
  const { id: routePostId } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
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
  
  // Curator state (new labeling system)
  const [availableJournals, setAvailableJournals] = useState<JournalForPicker[]>([])
  const [selectedJournals, setSelectedJournals] = useState<string[]>([])
  const [availableCollections, setAvailableCollections] = useState<CollectionForPicker[]>([])
  const [selectedCollections, setSelectedCollections] = useState<string[]>([])
  const [curatorLoading, setCuratorLoading] = useState(false)
  
  // Inline creation state
  const [showNewJournalForm, setShowNewJournalForm] = useState(false)
  const [showNewCollectionForm, setShowNewCollectionForm] = useState(false)
  const [newJournalName, setNewJournalName] = useState('')
  const [newJournalEmoji, setNewJournalEmoji] = useState('📚')
  const [newCollectionName, setNewCollectionName] = useState('')
  const [newCollectionEmoji, setNewCollectionEmoji] = useState('📁')
  const [newCollectionJournalId, setNewCollectionJournalId] = useState('')
  const [creatingJournal, setCreatingJournal] = useState(false)
  const [creatingCollection, setCreatingCollection] = useState(false)
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
  
  // Import modal states
  const [showImportModal, setShowImportModal] = useState(false)
  const [importInput, setImportInput] = useState('')
  const [importMode, setImportMode] = useState<ImportMode>('auto')
  const [importOverwrite, setImportOverwrite] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importPreview, setImportPreview] = useState<{ fields: ParsedEntryFields; summary: string[] } | null>(null)
  
  // Export Template modal states
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [templateFormat, setTemplateFormat] = useState<TemplateFormat>('json')
  const [templateContent, setTemplateContent] = useState('')
  const [templateCopied, setTemplateCopied] = useState(false)
  
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
      const labels = await supabaseAdminGet('/api/labels')
      setAvailableLabels(labels)
    } catch (error) {
      console.error('Error fetching labels:', error)
    }
  }

  // Fetch available journals and collections from Curator system
  const fetchCuratorData = async () => {
    setCuratorLoading(true)
    try {
      const supabase = getSupabaseClient()
      if (!supabase) {
        console.error('Supabase client not available')
        return
      }
      
      // Check if user is authenticated
      const { data: sessionData } = await supabase.auth.getSession()
      console.log('📚 Curator fetch - Session:', sessionData?.session ? 'authenticated' : 'not authenticated')
      
      // Try RPC functions first
      const [journalsResult, collectionsResult] = await Promise.all([
        supabase.rpc('get_all_journals_for_picker'),
        supabase.rpc('get_all_collections_for_picker')
      ])
      
      console.log('📚 Journals RPC result:', journalsResult)
      console.log('📚 Collections RPC result:', collectionsResult)
      
      // If RPC works, use it
      if (!journalsResult.error && journalsResult.data) {
        setAvailableJournals(journalsResult.data)
      } else {
        console.warn('📚 RPC failed, trying direct table access for journals:', journalsResult.error)
        // Fallback: direct table access (subject to RLS)
        const { data: journalsDirect, error: journalsDirectError } = await supabase
          .from('journals')
          .select('id, name, slug, icon_emoji, icon_type, icon_image_url, status')
          .order('display_order', { ascending: true })
          .order('name', { ascending: true })
        
        if (journalsDirectError) {
          console.error('📚 Direct journals fetch also failed:', journalsDirectError)
        } else {
          // Map to expected format
          const mappedJournals: JournalForPicker[] = (journalsDirect || []).map(j => ({
            journal_id: j.id,
            journal_name: j.name,
            journal_slug: j.slug || '',
            journal_icon_emoji: j.icon_emoji || '📚',
            journal_icon_type: j.icon_type || 'emoji',
            journal_icon_image_url: j.icon_image_url,
            journal_status: j.status || 'draft',
            entry_count: 0,
            collection_count: 0
          }))
          setAvailableJournals(mappedJournals)
          console.log('📚 Loaded journals via direct access:', mappedJournals.length)
        }
      }
      
      if (!collectionsResult.error && collectionsResult.data) {
        setAvailableCollections(collectionsResult.data)
      } else {
        console.warn('📚 RPC failed, trying direct table access for collections:', collectionsResult.error)
        // Fallback: direct table access with journal join
        const { data: collectionsDirect, error: collectionsDirectError } = await supabase
          .from('collections')
          .select(`
            id, name, slug, icon_emoji, status, journal_id,
            journals:journal_id (id, name, icon_emoji, icon_type, status)
          `)
          .order('display_order', { ascending: true })
          .order('name', { ascending: true })
        
        if (collectionsDirectError) {
          console.error('📚 Direct collections fetch also failed:', collectionsDirectError)
        } else {
          // Map to expected format
          const mappedCollections: CollectionForPicker[] = (collectionsDirect || []).map((c: any) => ({
            collection_id: c.id,
            collection_name: c.name,
            collection_slug: c.slug || '',
            collection_icon_emoji: c.icon_emoji || '📁',
            collection_status: c.status || 'draft',
            journal_id: c.journal_id,
            journal_name: c.journals?.name || '',
            journal_icon_emoji: c.journals?.icon_emoji || '📚',
            journal_icon_type: c.journals?.icon_type || 'emoji',
            journal_status: c.journals?.status || 'draft',
            entry_count: 0
          }))
          setAvailableCollections(mappedCollections)
          console.log('📚 Loaded collections via direct access:', mappedCollections.length)
        }
      }
    } catch (error) {
      console.error('📚 Error fetching curator data:', error)
    } finally {
      setCuratorLoading(false)
    }
  }

  // Fetch journals and collections for current post
  const fetchPostCuratorAssignments = async (postIdToFetch: string) => {
    try {
      const supabase = getSupabaseClient()
      
      // Fetch both in parallel
      const [journalsResult, collectionsResult] = await Promise.all([
        supabase.rpc('get_post_journals', { p_post_id: postIdToFetch }),
        supabase.rpc('get_post_collections', { p_post_id: postIdToFetch })
      ])
      
      if (journalsResult.error) throw journalsResult.error
      if (collectionsResult.error) throw collectionsResult.error
      
      setSelectedJournals((journalsResult.data || []).map((j: PostJournal) => j.journal_id))
      setSelectedCollections((collectionsResult.data || []).map((c: PostCollection) => c.collection_id))
    } catch (error) {
      console.error('Error fetching post curator assignments:', error)
    }
  }

  // Toggle journal selection
  const toggleJournal = async (journalId: string) => {
    const isSelected = selectedJournals.includes(journalId)
    
    // Optimistic update
    if (isSelected) {
      setSelectedJournals(prev => prev.filter(id => id !== journalId))
    } else {
      setSelectedJournals(prev => [...prev, journalId])
    }

    // If post exists, immediately update in database
    if (postId) {
      try {
        const supabase = getSupabaseClient()
        
        if (isSelected) {
          const { error } = await supabase.rpc('remove_post_from_journal', {
            p_journal_id: journalId,
            p_post_id: postId
          })
          if (error) throw error
        } else {
          const { error } = await supabase.rpc('add_post_to_journal', {
            p_journal_id: journalId,
            p_post_id: postId
          })
          if (error) throw error
        }
      } catch (error) {
        console.error('Error updating journal:', error)
        // Revert optimistic update on error
        if (isSelected) {
          setSelectedJournals(prev => [...prev, journalId])
        } else {
          setSelectedJournals(prev => prev.filter(id => id !== journalId))
        }
        setError('Failed to update journal assignment')
        setTimeout(() => setError(null), 3000)
      }
    }
  }

  // Toggle collection selection
  const toggleCollection = async (collectionId: string) => {
    const isSelected = selectedCollections.includes(collectionId)
    
    // Optimistic update
    if (isSelected) {
      setSelectedCollections(prev => prev.filter(id => id !== collectionId))
    } else {
      setSelectedCollections(prev => [...prev, collectionId])
    }

    // If post exists, immediately update in database
    if (postId) {
      try {
        const supabase = getSupabaseClient()
        
        if (isSelected) {
          const { error } = await supabase.rpc('remove_post_from_collection', {
            p_collection_id: collectionId,
            p_post_id: postId
          })
          if (error) throw error
        } else {
          const { error } = await supabase.rpc('add_post_to_collection', {
            p_collection_id: collectionId,
            p_post_id: postId
          })
          if (error) throw error
        }
      } catch (error) {
        console.error('Error updating collection:', error)
        // Revert optimistic update on error
        if (isSelected) {
          setSelectedCollections(prev => [...prev, collectionId])
        } else {
          setSelectedCollections(prev => prev.filter(id => id !== collectionId))
        }
        setError('Failed to update collection assignment')
        setTimeout(() => setError(null), 3000)
      }
    }
  }

  // Create new journal inline
  const createJournalInline = async () => {
    if (!newJournalName.trim()) return
    
    setCreatingJournal(true)
    try {
      const supabase = getSupabaseClient()
      const { data: userData } = await supabase.auth.getUser()
      
      if (!userData.user) {
        throw new Error('Must be logged in to create a journal')
      }
      
      const { data, error } = await supabase
        .from('journals')
        .insert({
          name: newJournalName.trim(),
          icon_emoji: newJournalEmoji || '📚',
          icon_type: 'emoji',
          owner_id: userData.user.id,
          status: 'draft'
        })
        .select()
        .single()
      
      if (error) throw error
      
      // Immediately add the new journal to the UI (optimistic update)
      // This ensures it appears even if the RPC fetch has issues
      if (data) {
        const newJournal: JournalForPicker = {
          journal_id: data.id,
          journal_name: data.name,
          journal_slug: data.slug || '',
          journal_icon_emoji: data.icon_emoji || '📚',
          journal_icon_type: data.icon_type || 'emoji',
          journal_icon_image_url: data.icon_image_url || null,
          journal_status: data.status || 'draft',
          entry_count: 0,
          collection_count: 0
        }
        setAvailableJournals(prev => [...prev, newJournal])
        
        // Auto-select the new journal
        setSelectedJournals(prev => [...prev, data.id])
        
        // If editing existing post, add to journal immediately
        if (postId) {
          await supabase.rpc('add_post_to_journal', {
            p_journal_id: data.id,
            p_post_id: postId
          })
        }
      }
      
      // Also refresh from server to get accurate counts
      fetchCuratorData()
      
      // Reset form
      setNewJournalName('')
      setNewJournalEmoji('📚')
      setShowNewJournalForm(false)
      
      setSuccessMessage('Journal created!')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (error) {
      console.error('Error creating journal:', error)
      setError(error instanceof Error ? error.message : 'Failed to create journal')
      setTimeout(() => setError(null), 3000)
    } finally {
      setCreatingJournal(false)
    }
  }

  // Create new collection inline
  const createCollectionInline = async () => {
    if (!newCollectionName.trim() || !newCollectionJournalId) return
    
    setCreatingCollection(true)
    try {
      const supabase = getSupabaseClient()
      
      const { data, error } = await supabase
        .from('collections')
        .insert({
          name: newCollectionName.trim(),
          icon_emoji: newCollectionEmoji || '📁',
          journal_id: newCollectionJournalId,
          status: 'draft'
        })
        .select()
        .single()
      
      if (error) throw error
      
      // Immediately add the new collection to the UI (optimistic update)
      // Find the parent journal for display info
      if (data) {
        const parentJournal = availableJournals.find(j => j.journal_id === newCollectionJournalId)
        const newCollection: CollectionForPicker = {
          collection_id: data.id,
          collection_name: data.name,
          collection_slug: data.slug || '',
          collection_icon_emoji: data.icon_emoji || '📁',
          collection_status: data.status || 'draft',
          journal_id: newCollectionJournalId,
          journal_name: parentJournal?.journal_name || '',
          journal_icon_emoji: parentJournal?.journal_icon_emoji || '📚',
          journal_icon_type: parentJournal?.journal_icon_type || 'emoji',
          journal_status: parentJournal?.journal_status || 'draft',
          entry_count: 0
        }
        setAvailableCollections(prev => [...prev, newCollection])
        
        // Auto-select the new collection
        setSelectedCollections(prev => [...prev, data.id])
        
        // If editing existing post, add to collection immediately
        if (postId) {
          await supabase.rpc('add_post_to_collection', {
            p_collection_id: data.id,
            p_post_id: postId
          })
        }
      }
      
      // Also refresh from server to get accurate counts
      fetchCuratorData()
      
      // Reset form
      setNewCollectionName('')
      setNewCollectionEmoji('📁')
      setNewCollectionJournalId('')
      setShowNewCollectionForm(false)
      
      setSuccessMessage('Collection created!')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (error) {
      console.error('Error creating collection:', error)
      setError(error instanceof Error ? error.message : 'Failed to create collection')
      setTimeout(() => setError(null), 3000)
    } finally {
      setCreatingCollection(false)
    }
  }

  const fetchPost = async () => {
    if (!postId) return

    setLoading(true)
    try {
      const response = await supabaseAdminGet(`/api/posts/${postId}`)
      const post = response.post || response // Handle both wrapped and direct responses
      
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
          setError('You are not authorized to edit this post. Please sign in with admin privileges.')
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

    // Ensure user is authenticated and has a profile
    if (!user?.id && !profile?.id) {
      setError('You must be signed in to create or edit posts')
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
        label_ids: selectedLabels,
        author_id: profile?.id || user?.id // Use profile ID (which matches database) or fallback to user ID
      }

      let savedPost
      if (postId) {
        // Edit existing post
        savedPost = await supabaseAdminPatch(`/api/posts/${postId}`, postData)
        setError(null)
        // Show success message briefly
        setSuccessMessage('Post saved successfully!')
        setTimeout(() => setSuccessMessage(null), 3000)
      } else {
        // Create new post
        savedPost = await supabaseAdminPost('/api/posts', postData)
        
        // Add to selected journals and collections (for new posts)
        if (savedPost?.id) {
          const supabase = getSupabaseClient()
          
          // Add to journals
          for (const journalId of selectedJournals) {
            try {
              await supabase.rpc('add_post_to_journal', {
                p_journal_id: journalId,
                p_post_id: savedPost.id
              })
            } catch (journalError) {
              console.error('Error adding to journal:', journalError)
            }
          }
          
          // Add to collections
          for (const collectionId of selectedCollections) {
            try {
              await supabase.rpc('add_post_to_collection', {
                p_collection_id: collectionId,
                p_post_id: savedPost.id
              })
            } catch (collectionError) {
              console.error('Error adding to collection:', collectionError)
            }
          }
        }
        
        // Navigate back to entries list after creation
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

  // Import modal handlers
  const handleImportOpen = () => {
    setShowImportModal(true)
    setImportInput('')
    setImportMode('auto')
    setImportOverwrite(false)
    setImportError(null)
    setImportPreview(null)
  }

  const handleImportClose = () => {
    setShowImportModal(false)
    setImportInput('')
    setImportError(null)
    setImportPreview(null)
  }

  const handleImportParse = () => {
    setImportError(null)
    setImportPreview(null)
    
    // Get current field values for overwrite logic
    const currentFields: ParsedEntryFields = {
      title: title || undefined,
      excerpt: excerpt || undefined,
      coverImageUrl: coverImageUrl || undefined,
      coverImageAlt: coverImageAlt || undefined,
      content: content || undefined,
      status: status as 'draft' | 'published' | 'archived'
    }
    
    const result = parseImportContent(importInput, importMode, importOverwrite, currentFields)
    
    if (!result.success) {
      setImportError(result.error || 'Failed to parse input')
      return
    }
    
    const summary = getFieldsSummary(result.fields)
    
    if (summary.length === 0 && (!result.detectedFields || result.detectedFields.length === 0)) {
      setImportError('No mappable fields found in the input. The content may not contain recognizable entry fields.')
      return
    }
    
    // Build comprehensive preview info
    const previewLines: string[] = [
      `Detected format: ${result.detectedFormat?.toUpperCase()}`
    ]
    
    // Show what will be applied
    if (summary.length > 0) {
      previewLines.push('', '--- Fields to apply ---')
      previewLines.push(...summary)
    }
    
    // Show skipped fields if any
    if (result.skippedFields && result.skippedFields.length > 0) {
      previewLines.push('', '--- Skipped (existing values kept) ---')
      previewLines.push(...result.skippedFields.map(f => `• ${f}`))
    }
    
    // Show warnings
    if (result.warnings && result.warnings.length > 0) {
      previewLines.push('', '--- Notes ---')
      previewLines.push(...result.warnings)
    }
    
    setImportPreview({
      fields: result.fields,
      summary: previewLines
    })
  }

  const handleImportApply = async () => {
    if (!importPreview?.fields) return
    
    const fields = importPreview.fields
    
    // Apply each parsed field to state
    if (fields.title !== undefined) {
      setTitle(fields.title)
    }
    if (fields.excerpt !== undefined) {
      setExcerpt(fields.excerpt)
    }
    if (fields.coverImageUrl !== undefined) {
      setCoverImageUrl(fields.coverImageUrl)
    }
    if (fields.coverImageAlt !== undefined) {
      setCoverImageAlt(fields.coverImageAlt)
    }
    if (fields.content !== undefined) {
      setContent(fields.content)
      // If we have HTML content, also update the editor
      if (fields.content.html && editorRef.current?.editor) {
        editorRef.current.editor.commands.setContent(fields.content.html)
      } else if (fields.content.json && editorRef.current?.editor) {
        editorRef.current.editor.commands.setContent(fields.content.json)
      }
    }
    if (fields.status !== undefined) {
      setStatus(fields.status)
    }
    
    const supabase = getSupabaseClient()
    const { data: userData } = await supabase.auth.getUser()
    const newJournalIds: string[] = []
    const newCollectionIds: string[] = []
    
    // Process journals - match existing or create new
    if (fields.journals && fields.journals.length > 0) {
      const matchedJournalIds: string[] = []
      const journalsToCreate: string[] = []
      
      for (const importedName of fields.journals) {
        const normalizedImport = importedName.toLowerCase().trim()
        const match = availableJournals.find(j => 
          j.journal_name.toLowerCase().trim() === normalizedImport ||
          j.journal_slug?.toLowerCase() === normalizedImport
        )
        if (match) {
          matchedJournalIds.push(match.journal_id)
        } else {
          journalsToCreate.push(importedName.trim())
        }
      }
      
      // Create new journals
      if (journalsToCreate.length > 0 && userData?.user) {
        for (const journalName of journalsToCreate) {
          try {
            const { data, error } = await supabase
              .from('journals')
              .insert({
                name: journalName,
                icon_emoji: '📚',
                icon_type: 'emoji',
                owner_id: userData.user.id,
                status: 'draft'
              })
              .select()
              .single()
            
            if (!error && data?.id) {
              newJournalIds.push(data.id)
            }
          } catch (err) {
            console.error('Error creating journal:', journalName, err)
          }
        }
      }
      
      // Select all matched + newly created journals
      const allJournalIds = [...matchedJournalIds, ...newJournalIds]
      if (allJournalIds.length > 0) {
        setSelectedJournals(prev => [...new Set([...prev, ...allJournalIds])])
      }
    }
    
    // Refresh journals if we created new ones (needed for collection creation)
    if (newJournalIds.length > 0) {
      await fetchCuratorData()
    }
    
    // Process collections - match existing or create new
    if (fields.collections && fields.collections.length > 0) {
      const matchedCollectionIds: string[] = []
      const collectionsToCreate: string[] = []
      
      for (const importedName of fields.collections) {
        const normalizedImport = importedName.toLowerCase().trim()
        const match = availableCollections.find(c => 
          c.collection_name.toLowerCase().trim() === normalizedImport ||
          c.collection_slug?.toLowerCase() === normalizedImport
        )
        if (match) {
          matchedCollectionIds.push(match.collection_id)
        } else {
          collectionsToCreate.push(importedName.trim())
        }
      }
      
      // Create new collections - need a journal to put them in
      if (collectionsToCreate.length > 0) {
        // Use first selected/created journal, or first available journal
        let targetJournalId = newJournalIds[0] || selectedJournals[0]
        
        // If still no journal, get the first available one
        if (!targetJournalId && availableJournals.length > 0) {
          targetJournalId = availableJournals[0].journal_id
        }
        
        // If we have a newly created journal that's not in availableJournals yet, fetch fresh data
        if (!targetJournalId && newJournalIds.length > 0) {
          const freshJournals = await supabase.rpc('get_all_journals_for_picker')
          if (freshJournals.data && freshJournals.data.length > 0) {
            targetJournalId = freshJournals.data[0].journal_id
          }
        }
        
        if (targetJournalId) {
          for (const collectionName of collectionsToCreate) {
            try {
              const { data, error } = await supabase
                .from('collections')
                .insert({
                  name: collectionName,
                  icon_emoji: '📁',
                  journal_id: targetJournalId,
                  status: 'draft'
                })
                .select()
                .single()
              
              if (!error && data?.id) {
                newCollectionIds.push(data.id)
              }
            } catch (err) {
              console.error('Error creating collection:', collectionName, err)
            }
          }
        }
      }
      
      // Select all matched + newly created collections
      const allCollectionIds = [...matchedCollectionIds, ...newCollectionIds]
      if (allCollectionIds.length > 0) {
        setSelectedCollections(prev => [...new Set([...prev, ...allCollectionIds])])
      }
    }
    
    // Refresh curator data if we created anything new
    if (newJournalIds.length > 0 || newCollectionIds.length > 0) {
      await fetchCuratorData()
    }
    
    // Build success message
    const createdItems: string[] = []
    if (newJournalIds.length > 0) {
      createdItems.push(`${newJournalIds.length} journal${newJournalIds.length > 1 ? 's' : ''}`)
    }
    if (newCollectionIds.length > 0) {
      createdItems.push(`${newCollectionIds.length} collection${newCollectionIds.length > 1 ? 's' : ''}`)
    }
    
    const successMsg = createdItems.length > 0 
      ? `Content imported! Created ${createdItems.join(' and ')}.`
      : 'Content imported successfully!'
    
    setSuccessMessage(successMsg)
    setTimeout(() => setSuccessMessage(null), 4000)
    
    handleImportClose()
  }

  // Export Template modal handlers
  const handleTemplateOpen = () => {
    setShowTemplateModal(true)
    setTemplateFormat('json')
    const result = generateTemplate('json')
    setTemplateContent(result.content)
    setTemplateCopied(false)
  }

  const handleTemplateClose = () => {
    setShowTemplateModal(false)
    setTemplateContent('')
    setTemplateCopied(false)
  }

  const handleTemplateFormatChange = (format: TemplateFormat) => {
    setTemplateFormat(format)
    const result = generateTemplate(format)
    setTemplateContent(result.content)
    setTemplateCopied(false)
  }

  const handleTemplateCopy = async () => {
    try {
      await navigator.clipboard.writeText(templateContent)
      setTemplateCopied(true)
      setTimeout(() => setTemplateCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy template:', error)
    }
  }

  useEffect(() => {
    fetchLabels()
    fetchCuratorData()
    if (postId) {
      fetchPost()
      fetchPostCuratorAssignments(postId)
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
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/dashboard/posts')}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            title="Back to Entries"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold">
            {postId ? 'Edit Entry' : 'Create New Entry'}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Import Button */}
          <button
            type="button"
            onClick={handleImportOpen}
            className="px-3 py-2 text-sm font-medium bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
            title="Import content from JSON or HTML"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import
          </button>
          {/* Export Template Button */}
          <button
            type="button"
            onClick={handleTemplateOpen}
            className="px-3 py-2 text-sm font-medium bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
            title="Export a template for creating entries"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Template
          </button>
          {/* View Curator Button */}
          <button
            type="button"
            onClick={() => navigate('/dashboard/posts', { 
              state: { fromEditor: true, returnToPostId: postId } 
            })}
            className="px-3 py-2 text-sm font-medium bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors flex items-center gap-2"
            title="View and manage Journals & Collections"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Curator
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard/posts')}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Back to Entries
          </button>
        </div>
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

        {/* Curator Organization (Journals & Collections) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">
              Organization
              {curatorLoading && (
                <span className="ml-2 text-xs text-gray-500">(loading...)</span>
              )}
            </label>
            {(selectedJournals.length > 0 || selectedCollections.length > 0) && (
              <span className="text-xs text-gray-500">
                {selectedJournals.length > 0 && `${selectedJournals.length} journal${selectedJournals.length !== 1 ? 's' : ''}`}
                {selectedJournals.length > 0 && selectedCollections.length > 0 && ', '}
                {selectedCollections.length > 0 && `${selectedCollections.length} collection${selectedCollections.length !== 1 ? 's' : ''}`}
              </span>
            )}
          </div>

          {/* Journals Section */}
          <div className="border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">Journals</span>
                <span className="text-xs text-gray-400">(direct assignment)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowNewJournalForm(!showNewJournalForm)}
                className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-colors flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New
              </button>
            </div>
            
            {/* Inline Journal Creation Form */}
            {showNewJournalForm && (
              <div className="mb-3 p-2 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newJournalEmoji}
                    onChange={(e) => setNewJournalEmoji(e.target.value)}
                    className="w-10 px-2 py-1 text-center border border-gray-300 rounded text-sm"
                    maxLength={2}
                    title="Emoji icon"
                  />
                  <input
                    type="text"
                    value={newJournalName}
                    onChange={(e) => setNewJournalName(e.target.value)}
                    placeholder="Journal name..."
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        createJournalInline()
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={createJournalInline}
                    disabled={!newJournalName.trim() || creatingJournal}
                    className="px-2 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creatingJournal ? '...' : 'Add'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewJournalForm(false)
                      setNewJournalName('')
                      setNewJournalEmoji('📚')
                    }}
                    className="px-2 py-1 text-gray-500 hover:text-gray-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
            
            {availableJournals.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {availableJournals.map((journal) => (
                  <button
                    key={journal.journal_id}
                    type="button"
                    onClick={() => toggleJournal(journal.journal_id)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors flex items-center gap-1.5 ${
                      selectedJournals.includes(journal.journal_id)
                        ? 'bg-purple-100 border-purple-300 text-purple-800'
                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300'
                    }`}
                  >
                    <span>{journal.journal_icon_emoji || '📚'}</span>
                    <span>{journal.journal_name}</span>
                    <span className="text-xs opacity-60">({journal.entry_count})</span>
                  </button>
                ))}
              </div>
            ) : !curatorLoading ? (
              <p className="text-xs text-gray-500 italic">No journals yet. Create one above!</p>
            ) : null}
          </div>

          {/* Collections Section */}
          <div className="border border-blue-200 rounded-lg p-3 bg-blue-50/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">Collections</span>
                <span className="text-xs text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">recommended</span>
              </div>
              <button
                type="button"
                onClick={() => setShowNewCollectionForm(!showNewCollectionForm)}
                disabled={availableJournals.length === 0}
                className="text-xs px-2 py-1 rounded border border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-400 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                title={availableJournals.length === 0 ? 'Create a journal first' : 'Create new collection'}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New
              </button>
            </div>
            
            {/* Inline Collection Creation Form */}
            {showNewCollectionForm && (
              <div className="mb-3 p-2 bg-blue-100 rounded-lg border border-blue-200">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newCollectionEmoji}
                      onChange={(e) => setNewCollectionEmoji(e.target.value)}
                      className="w-10 px-2 py-1 text-center border border-gray-300 rounded text-sm"
                      maxLength={2}
                      title="Emoji icon"
                    />
                    <input
                      type="text"
                      value={newCollectionName}
                      onChange={(e) => setNewCollectionName(e.target.value)}
                      placeholder="Collection name..."
                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newCollectionJournalId) {
                          e.preventDefault()
                          createCollectionInline()
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewCollectionForm(false)
                        setNewCollectionName('')
                        setNewCollectionEmoji('📁')
                        setNewCollectionJournalId('')
                      }}
                      className="px-2 py-1 text-gray-500 hover:text-gray-700"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">in:</span>
                    <select
                      value={newCollectionJournalId}
                      onChange={(e) => setNewCollectionJournalId(e.target.value)}
                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Select a journal...</option>
                      {availableJournals.map((journal) => (
                        <option key={journal.journal_id} value={journal.journal_id}>
                          {journal.journal_icon_emoji} {journal.journal_name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={createCollectionInline}
                      disabled={!newCollectionName.trim() || !newCollectionJournalId || creatingCollection}
                      className="px-2 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {creatingCollection ? '...' : 'Add'}
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {availableCollections.length > 0 ? (
              <div className="space-y-3">
                {/* Group collections by journal for display */}
                {Object.entries(
                  availableCollections.reduce((acc, collection) => {
                    const journalKey = collection.journal_id
                    if (!acc[journalKey]) {
                      acc[journalKey] = {
                        journal_name: collection.journal_name,
                        journal_icon_emoji: collection.journal_icon_emoji,
                        journal_icon_type: collection.journal_icon_type,
                        collections: []
                      }
                    }
                    acc[journalKey].collections.push(collection)
                    return acc
                  }, {} as Record<string, { journal_name: string; journal_icon_emoji: string; journal_icon_type: string; collections: CollectionForPicker[] }>)
                ).map(([journalId, journal]) => (
                  <div key={journalId}>
                    <div className="flex items-center gap-1.5 mb-1.5 text-xs text-gray-500">
                      <span>{journal.journal_icon_emoji || '📚'}</span>
                      <span>{journal.journal_name}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 ml-4">
                      {journal.collections.map((collection) => (
                        <button
                          key={collection.collection_id}
                          type="button"
                          onClick={() => toggleCollection(collection.collection_id)}
                          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors flex items-center gap-1.5 ${
                            selectedCollections.includes(collection.collection_id)
                              ? 'bg-blue-100 border-blue-300 text-blue-800'
                              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                          }`}
                        >
                          <span>{collection.collection_icon_emoji || '📁'}</span>
                          <span>{collection.collection_name}</span>
                          <span className="text-xs opacity-60">({collection.entry_count})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : !curatorLoading ? (
              <p className="text-xs text-gray-500 italic">
                {availableJournals.length === 0 
                  ? 'Create a journal first, then add collections to it.' 
                  : 'No collections yet. Create one above!'}
              </p>
            ) : null}
          </div>

          {/* Helper text */}
          <p className="text-xs text-gray-500">
            Entries can belong to multiple journals and/or collections. Collections are recommended for better organization.
          </p>
        </div>

        {/* Legacy Labels (if any exist) */}
        {availableLabels.length > 0 && (
          <div className="pt-3 border-t border-gray-100">
            <label className="block text-sm font-medium text-gray-500 mb-2">
              Legacy Labels
              <span className="ml-2 text-xs text-gray-400">(deprecated - use Collections above)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {availableLabels.map((label) => (
                <button
                  key={label.id}
                  type="button"
                  onClick={() => toggleLabel(label.id)}
                  className={`px-3 py-1 rounded-full text-sm border ${
                    selectedLabels.includes(label.id)
                      ? 'bg-gray-200 border-gray-400 text-gray-700'
                      : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
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
              Back to Entries
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard/posts', { 
                state: { fromEditor: true, returnToPostId: postId } 
              })}
              className="px-4 py-2 border border-purple-300 rounded-md text-purple-700 bg-purple-50 hover:bg-purple-100 flex items-center gap-2"
              title="View and manage Journals & Collections"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Curator
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

        {/* Bottom notifications - so you don't have to scroll up */}
        {error && (
          <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mt-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            {successMessage}
          </div>
        )}
      </form>
    </div>
  )

  // Main render logic - choose between view and edit modes
  return (
    <>
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

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Import Entry</h2>
                <p className="text-sm text-gray-500 mt-0.5">Paste JSON or HTML content to populate entry fields</p>
              </div>
              <button
                type="button"
                onClick={handleImportClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4 flex-1 overflow-y-auto">
              {/* Textarea for paste */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Paste content
                </label>
                <textarea
                  value={importInput}
                  onChange={(e) => {
                    setImportInput(e.target.value)
                    setImportError(null)
                    setImportPreview(null)
                  }}
                  className="w-full h-48 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm resize-none"
                  placeholder='Paste JSON like {"title": "My Entry", "content": "..."} or HTML content'
                />
              </div>

              {/* Mode selector and Overwrite toggle */}
              <div className="flex flex-wrap items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Format:</label>
                  <select
                    value={importMode}
                    onChange={(e) => {
                      setImportMode(e.target.value as ImportMode)
                      setImportError(null)
                      setImportPreview(null)
                    }}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="auto">Auto-detect</option>
                    <option value="json">JSON</option>
                    <option value="html">HTML</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={importOverwrite}
                    onChange={(e) => {
                      setImportOverwrite(e.target.checked)
                      setImportPreview(null)
                    }}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Overwrite existing fields</span>
                </label>
              </div>

              {/* Parse button */}
              <button
                type="button"
                onClick={handleImportParse}
                disabled={!importInput.trim()}
                className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Preview Import
              </button>

              {/* Parse error display */}
              {importError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-red-700">{importError}</p>
                  </div>
                </div>
              )}

              {/* Detected fields preview */}
              {importPreview && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-medium text-green-800">Detected Fields</span>
                  </div>
                  <ul className="space-y-1">
                    {importPreview.summary.map((item, index) => (
                      <li key={index} className="text-sm text-green-700 flex items-start gap-2">
                        <span className="text-green-500 mt-1">•</span>
                        <span className="break-all">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Help text */}
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-1">
                <p className="text-xs text-blue-700">
                  <strong>JSON keys recognized:</strong> title, name, heading, excerpt, summary, description, 
                  coverImageUrl, cover, image, content, body, html, text, status, published
                </p>
                <p className="text-xs text-blue-700">
                  <strong>Organization:</strong> journals, journal, categories → Journals; 
                  collections, collection, tags, labels → Collections
                </p>
                <p className="text-xs text-blue-700">
                  <strong>HTML extraction:</strong> First &lt;h1&gt; → title, first &lt;img&gt; → cover image, 
                  first &lt;p&gt; → excerpt (if short), remaining → content
                </p>
                <p className="text-xs text-green-700 mt-1">
                  <strong>Auto-create:</strong> Non-existing journals/collections will be created automatically.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3 bg-gray-50">
              <button
                type="button"
                onClick={handleImportClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportApply}
                disabled={!importPreview}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Export Template</h2>
                <p className="text-sm text-gray-500 mt-0.5">Copy this template to create entries externally</p>
              </div>
              <button
                type="button"
                onClick={handleTemplateClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4 flex-1 overflow-y-auto">
              {/* Format selector */}
              <div className="flex items-center gap-4 mb-4">
                <label className="text-sm font-medium text-gray-700">Format:</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleTemplateFormatChange('json')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      templateFormat === 'json'
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTemplateFormatChange('html')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      templateFormat === 'html'
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    HTML
                  </button>
                </div>
              </div>

              {/* Copy button */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-600">Template content:</span>
                <button
                  type="button"
                  onClick={handleTemplateCopy}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                    templateCopied
                      ? 'bg-green-100 text-green-700 border border-green-300'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {templateCopied ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy to Clipboard
                    </>
                  )}
                </button>
              </div>

              {/* Template textarea (read-only) */}
              <textarea
                value={templateContent}
                readOnly
                className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {/* Hint line */}
              <p className="mt-3 text-sm text-gray-500 italic">
                This template matches the current Entry Editor fields. Use it with the Import feature to create new entries.
              </p>

              {/* Field descriptions */}
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs font-medium text-blue-800 mb-2">Supported Fields:</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {getFieldDescriptions().map((field) => (
                    <div key={field.field} className="flex items-start gap-1 text-xs">
                      <span className="font-mono text-blue-700">{field.field}</span>
                      <span className="text-gray-500">
                        ({field.type}){field.required && <span className="text-red-500">*</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Format-specific notes */}
              <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                {templateFormat === 'json' ? (
                  <p className="text-xs text-gray-600">
                    <strong>JSON Note:</strong> The <code className="bg-gray-200 px-1 rounded">__meta</code> section 
                    is for documentation only and will be ignored during import. Fill in the actual field values 
                    and use the Import feature to load your entry.
                  </p>
                ) : (
                  <p className="text-xs text-gray-600">
                    <strong>HTML Note:</strong> Fields are marked with <code className="bg-gray-200 px-1 rounded">data-entry-field</code> attributes 
                    and HTML comments for easy identification. The importer extracts the first &lt;h1&gt; as title, 
                    first &lt;img&gt; as cover, and remaining content as body.
                  </p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3 bg-gray-50">
              <button
                type="button"
                onClick={handleTemplateClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
