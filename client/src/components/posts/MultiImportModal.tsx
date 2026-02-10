/**
 * Multi-Import Modal Component (Phase 3)
 * 
 * Handles importing multiple entries via JSON or HTML, creating draft registry
 * entries for each, and providing a review queue UI for editing and saving.
 * 
 * Features:
 * - Multi-entry detection (JSON arrays, HTML delimiters)
 * - Draft registry integration for each imported entry
 * - Review queue with validation status
 * - Per-draft editing via PostEditor in registry mode
 * - Batch and individual save operations
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { parseMultipleEntries, getFieldsSummary, ImportMode, ParsedEntryFields } from '../../utils/importParser'
import { useDraftRegistry, type RegistryDraftState } from '../../context/DraftRegistryContext'
import { supabaseAdminPost, supabaseAdminPatch } from '../../lib/api'
import { getSupabaseClient } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { isContentValidForSave, isValidTipTapJson } from '../../utils/tiptapConversion'
import PostEditor from './PostEditor'

interface MultiImportModalProps {
  isOpen: boolean
  onClose: () => void
  /** Called when any draft is successfully saved */
  onSaveSuccess?: (savedPostId: string) => void
  /** Available journals for auto-matching during import */
  availableJournals?: Array<{ journal_id: string; journal_name: string; journal_slug?: string }>
  /** Available collections for auto-matching during import */
  availableCollections?: Array<{ collection_id: string; collection_name: string; collection_slug?: string }>
  /** Initial input (pre-populated from regular import modal) */
  initialInput?: string
  /** Initial mode (pre-populated from regular import modal) */
  initialMode?: ImportMode
  /** Auto-parse on open (skip to review queue immediately) */
  autoParseOnOpen?: boolean
}

type ModalView = 'input' | 'review' | 'edit'

interface SaveResult {
  draftId: string
  success: boolean
  postId?: string
  error?: string
}

// Constants
const MAX_DRAFTS = 10
const NEAR_CAPACITY_THRESHOLD = 8

export default function MultiImportModal({
  isOpen,
  onClose,
  onSaveSuccess,
  availableJournals = [],
  availableCollections = [],
  initialInput = '',
  initialMode = 'auto',
  autoParseOnOpen = false
}: MultiImportModalProps) {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const draftRegistry = useDraftRegistry()
  
  // Input state
  const [importInput, setImportInput] = useState(initialInput)
  const [importMode, setImportMode] = useState<ImportMode>(initialMode)
  const [parseError, setParseError] = useState<string | null>(null)
  const [parseWarnings, setParseWarnings] = useState<string[]>([])
  
  // Review queue state
  const [view, setView] = useState<ModalView>('input')
  const [importedDraftIds, setImportedDraftIds] = useState<string[]>([])
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(new Set())
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null)
  
  // Edit state (for embedded PostEditor)
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null)
  
  // Save state
  const [saving, setSaving] = useState(false)
  const [saveProgress, setSaveProgress] = useState<{ current: number; total: number } | null>(null)
  const [saveResults, setSaveResults] = useState<SaveResult[]>([])
  
  // Draft Registry management state
  const [showRegistryModal, setShowRegistryModal] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [clearOnCancel, setClearOnCancel] = useState(false)
  const [sessionDraftIds, setSessionDraftIds] = useState<Set<string>>(new Set())
  const [clearMessage, setClearMessage] = useState<string | null>(null)
  
  // Get drafts from registry
  const importedDrafts = importedDraftIds
    .map(id => draftRegistry.getDraft(id))
    .filter((d): d is RegistryDraftState => d !== null)
  
  // Track if we should auto-parse on next render
  const [shouldAutoParse, setShouldAutoParse] = useState(false)
  
  // Registry status helpers
  const registryCount = draftRegistry.draftCount
  const isRegistryEmpty = registryCount === 0
  const isNearCapacity = registryCount >= NEAR_CAPACITY_THRESHOLD
  const isFull = registryCount >= MAX_DRAFTS
  const availableSlots = MAX_DRAFTS - registryCount
  
  // Handle modal close with optional auto-clear
  const handleClose = useCallback(() => {
    if (clearOnCancel && sessionDraftIds.size > 0) {
      // Clear only drafts created in this session
      console.log(`[MultiImport] Auto-clearing ${sessionDraftIds.size} session drafts`)
      for (const draftId of sessionDraftIds) {
        draftRegistry.removeDraft(draftId)
      }
      setClearMessage(`Cleared ${sessionDraftIds.size} draft(s) from this session`)
      setTimeout(() => setClearMessage(null), 3000)
    }
    onClose()
  }, [clearOnCancel, sessionDraftIds, draftRegistry, onClose])
  
  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Don't clear drafts immediately - let user close and reopen
      setView('input')
      setImportInput('')
      setParseError(null)
      setParseWarnings([])
      setSelectedDraftIds(new Set())
      setActiveDraftId(null)
      setEditingDraftId(null)
      setSaving(false)
      setSaveProgress(null)
      setSaveResults([])
      setShouldAutoParse(false)
      setShowRegistryModal(false)
      setShowClearConfirm(false)
      // Reset session tracking when modal reopens
      setSessionDraftIds(new Set())
      // Don't reset clearOnCancel - let user preference persist
    }
  }, [isOpen])
  
  // Handle initial input when modal opens
  useEffect(() => {
    if (isOpen && initialInput) {
      setImportInput(initialInput)
      setImportMode(initialMode)
      
      // Set flag to auto-parse
      if (autoParseOnOpen && initialInput.trim()) {
        setShouldAutoParse(true)
      }
    }
  }, [isOpen, initialInput, initialMode, autoParseOnOpen])
  
  // Parse input and create drafts
  const handleParse = useCallback(() => {
    setParseError(null)
    setParseWarnings([])
    
    // Step 1: Parse the input content
    let result
    try {
      result = parseMultipleEntries(importInput, importMode)
    } catch (parseError) {
      console.error('[MultiImport] Parse error:', parseError)
      setParseError(`Import parsing failed: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`)
      return
    }
    
    // Step 2: Check if parsing succeeded
    if (!result.success) {
      const errorMsg = result.error || 'No entries found in import'
      console.warn('[MultiImport] Parse failed:', errorMsg, { warnings: result.warnings })
      setParseError(errorMsg)
      setParseWarnings(result.warnings)
      return
    }
    
    if (result.entries.length === 0) {
      console.warn('[MultiImport] No entries detected', { detectedFormat: result.detectedFormat, warnings: result.warnings })
      setParseError('No entries detected in import. Check that your content has recognizable entry fields (title, content, etc.).')
      setParseWarnings(result.warnings)
      return
    }
    
    setParseWarnings(result.warnings)
    
    // Step 3: Check draft registry capacity BEFORE attempting to create
    const currentDraftCount = draftRegistry.draftCount
    const maxDrafts = 10 // REGISTRY_LIMITS.MAX_DRAFTS
    const availableSlots = maxDrafts - currentDraftCount
    
    if (availableSlots <= 0) {
      console.warn('[MultiImport] Registry full', { currentDraftCount, maxDrafts })
      setParseError(`Draft registry is full (${currentDraftCount}/${maxDrafts}). Please save or discard existing drafts before importing more.`)
      return
    }
    
    if (result.entries.length > availableSlots) {
      console.warn('[MultiImport] Not enough slots', { entries: result.entries.length, availableSlots })
      setParseError(`Import has ${result.entries.length} entries but only ${availableSlots} draft slots available. Please save or discard existing drafts first.`)
      return
    }
    
    // Step 4: Create a draft for each parsed entry
    const newDraftIds: string[] = []
    const failedEntries: { index: number; title: string; reason: string }[] = []
    
    for (let i = 0; i < result.entries.length; i++) {
      const fields = result.entries[i]
      const entryTitle = fields.title || `Entry ${i + 1}`
      
      try {
        // Match journals/collections to IDs
        const journalIds = matchJournals(fields.journals || [], availableJournals)
        const collectionIds = matchCollections(fields.collections || [], availableCollections)
        
        const draftId = draftRegistry.createDraft({
          title: fields.title || '',
          excerpt: fields.excerpt || '',
          coverImageUrl: fields.coverImageUrl || '',
          coverImageAlt: fields.coverImageAlt || '',
          content: fields.content || null,
          status: (fields.status as any) || 'draft',
          selectedJournals: journalIds,
          selectedCollections: collectionIds
        }, 'import')
        
        if (draftId) {
          newDraftIds.push(draftId)
          // Track this as a session draft for potential auto-clear on cancel
          setSessionDraftIds(prev => new Set([...prev, draftId]))
        } else {
          // createDraft returned null - likely hit MAX_DRAFTS
          failedEntries.push({ index: i, title: entryTitle, reason: 'Draft limit reached' })
          console.warn(`[MultiImport] Failed to create draft for entry ${i + 1}:`, entryTitle)
        }
      } catch (draftError) {
        console.error(`[MultiImport] Error creating draft for entry ${i + 1}:`, draftError)
        failedEntries.push({ 
          index: i, 
          title: entryTitle, 
          reason: draftError instanceof Error ? draftError.message : 'Unknown error' 
        })
      }
    }
    
    // Step 5: Handle results
    if (newDraftIds.length === 0) {
      // All entries failed
      let errorMsg = 'Could not create drafts. '
      if (failedEntries.length > 0) {
        errorMsg += `Failed entries: ${failedEntries.map(e => `"${e.title}" (${e.reason})`).join(', ')}`
      } else {
        errorMsg += 'Draft registry may be unavailable or full.'
      }
      console.error('[MultiImport] All drafts failed:', { failedEntries })
      setParseError(errorMsg)
      return
    }
    
    // Partial success - show warning but proceed
    if (failedEntries.length > 0) {
      const warnMsg = `${failedEntries.length} of ${result.entries.length} entries could not be added: ${failedEntries.map(e => e.title).join(', ')}`
      console.warn('[MultiImport] Partial success:', warnMsg)
      setParseWarnings(prev => [...prev, warnMsg])
    }
    
    console.log(`[MultiImport] Successfully created ${newDraftIds.length} drafts`)
    setImportedDraftIds(newDraftIds)
    setSelectedDraftIds(new Set(newDraftIds))
    setActiveDraftId(newDraftIds[0])
    setView('review')
    setShouldAutoParse(false)
  }, [importInput, importMode, draftRegistry, availableJournals, availableCollections])
  
  // Auto-parse effect (runs after handleParse is defined)
  useEffect(() => {
    if (shouldAutoParse && importInput.trim()) {
      handleParse()
    }
  }, [shouldAutoParse, importInput, handleParse])
  
  // Match journal names to IDs
  const matchJournals = (names: string[], journals: typeof availableJournals): string[] => {
    return names
      .map(name => {
        const normalized = name.toLowerCase().trim()
        const match = journals.find(j => 
          j.journal_name.toLowerCase().trim() === normalized ||
          j.journal_slug?.toLowerCase() === normalized
        )
        return match?.journal_id
      })
      .filter((id): id is string => !!id)
  }
  
  // Match collection names to IDs
  const matchCollections = (names: string[], collections: typeof availableCollections): string[] => {
    return names
      .map(name => {
        const normalized = name.toLowerCase().trim()
        const match = collections.find(c => 
          c.collection_name.toLowerCase().trim() === normalized ||
          c.collection_slug?.toLowerCase() === normalized
        )
        return match?.collection_id
      })
      .filter((id): id is string => !!id)
  }
  
  // ============================================================
  // REGISTRY MANAGEMENT
  // ============================================================
  
  // Clear entire registry (with confirmation)
  const handleClearRegistry = useCallback(() => {
    const count = draftRegistry.draftCount
    console.log(`[MultiImport] Clearing all ${count} drafts from registry`)
    draftRegistry.discardAllDrafts()
    setShowClearConfirm(false)
    setShowRegistryModal(false)
    setClearMessage(`Cleared ${count} draft(s) from registry`)
    setTimeout(() => setClearMessage(null), 3000)
    // Also clear our session tracking since those drafts are gone
    setSessionDraftIds(new Set())
    setImportedDraftIds([])
  }, [draftRegistry])
  
  // Remove a single draft from registry
  const handleRemoveDraft = useCallback((draftId: string) => {
    const draft = draftRegistry.getDraft(draftId)
    const title = draft?.title || 'Untitled'
    draftRegistry.removeDraft(draftId)
    // Update session tracking
    setSessionDraftIds(prev => {
      const next = new Set(prev)
      next.delete(draftId)
      return next
    })
    // Update imported drafts list
    setImportedDraftIds(prev => prev.filter(id => id !== draftId))
    setClearMessage(`Removed "${title}" from registry`)
    setTimeout(() => setClearMessage(null), 2000)
  }, [draftRegistry])
  
  // Get registry drafts for display
  const allRegistryDrafts = draftRegistry.drafts
  
  // Format time ago
  const formatTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ago`
  }
  
  // Toggle draft selection
  const toggleSelection = (draftId: string) => {
    setSelectedDraftIds(prev => {
      const next = new Set(prev)
      if (next.has(draftId)) {
        next.delete(draftId)
      } else {
        next.add(draftId)
      }
      return next
    })
  }
  
  // Select all / none
  const selectAll = () => setSelectedDraftIds(new Set(importedDraftIds))
  const selectNone = () => setSelectedDraftIds(new Set())
  
  // Validate a single draft
  const validateDraft = (draft: RegistryDraftState): string[] => {
    const errors: string[] = []
    if (!draft.title?.trim()) {
      errors.push('Title required')
    }
    if (draft.coverImageUrl?.trim() && !draft.coverImageAlt?.trim()) {
      errors.push('Cover alt required')
    }
    // Phase 3.1: Validate rich content exists
    const contentValidation = isContentValidForSave(draft.content)
    if (!contentValidation.valid) {
      errors.push(contentValidation.error || 'Rich content required')
    }
    return errors
  }
  
  // Save a single draft
  const saveSingleDraft = async (draftId: string): Promise<SaveResult> => {
    const draft = draftRegistry.getDraft(draftId)
    if (!draft) {
      return { draftId, success: false, error: 'Draft not found' }
    }
    
    // Validate
    const errors = validateDraft(draft)
    if (errors.length > 0) {
      return { draftId, success: false, error: errors.join(', ') }
    }
    
    try {
      const postData = {
        title: draft.title?.trim() || '',
        content_rich: draft.content?.json || null,
        content_html: draft.content?.html || null,
        content_text: draft.content?.html?.replace(/<[^>]*>/g, '').trim() || '',
        excerpt: draft.excerpt?.trim() || null,
        cover_image_url: draft.coverImageUrl?.trim() || null,
        cover_image_alt: draft.coverImageAlt?.trim() || null,
        status: draft.status || 'draft',
        label_ids: [],
        author_id: profile?.id || user?.id
      }
      
      let savedPost: any
      const supabase = getSupabaseClient()
      
      if (draft.postId) {
        // Update existing
        savedPost = await supabaseAdminPatch(`/api/posts/${draft.postId}`, postData)
        draftRegistry.markSaved(draftId, draft.postId)
      } else {
        // Create new
        savedPost = await supabaseAdminPost('/api/posts', postData)
        
        if (savedPost?.id) {
          // Add to journals
          for (const journalId of draft.selectedJournals || []) {
            try {
              await supabase.rpc('add_post_to_journal', {
                p_journal_id: journalId,
                p_post_id: savedPost.id
              })
            } catch (e) {
              console.error('Error adding to journal:', e)
            }
          }
          
          // Add to collections
          for (const collectionId of draft.selectedCollections || []) {
            try {
              await supabase.rpc('add_post_to_collection', {
                p_collection_id: collectionId,
                p_post_id: savedPost.id
              })
            } catch (e) {
              console.error('Error adding to collection:', e)
            }
          }
          
          draftRegistry.markSaved(draftId, savedPost.id)
        }
      }
      
      const postId = savedPost?.id || draft.postId
      if (postId) {
        onSaveSuccess?.(postId)
      }
      
      return { draftId, success: true, postId }
    } catch (error) {
      console.error('Error saving draft:', error)
      return {
        draftId,
        success: false,
        error: error instanceof Error ? error.message : 'Save failed'
      }
    }
  }
  
  // Save selected drafts (batch)
  const handleSaveSelected = async () => {
    const idsToSave = Array.from(selectedDraftIds)
    if (idsToSave.length === 0) return
    
    setSaving(true)
    setSaveProgress({ current: 0, total: idsToSave.length })
    setSaveResults([])
    
    const results: SaveResult[] = []
    
    for (let i = 0; i < idsToSave.length; i++) {
      setSaveProgress({ current: i + 1, total: idsToSave.length })
      const result = await saveSingleDraft(idsToSave[i])
      results.push(result)
    }
    
    setSaveResults(results)
    setSaving(false)
    setSaveProgress(null)
  }
  
  // Save all drafts
  const handleSaveAll = async () => {
    selectAll()
    // Wait for state update then save
    setTimeout(() => {
      handleSaveSelected()
    }, 50)
  }
  
  // Discard selected drafts
  const handleDiscardSelected = () => {
    for (const draftId of selectedDraftIds) {
      draftRegistry.removeDraft(draftId)
    }
    setImportedDraftIds(prev => prev.filter(id => !selectedDraftIds.has(id)))
    setSelectedDraftIds(new Set())
    setActiveDraftId(null)
    
    // If no drafts left, go back to input
    if (importedDraftIds.filter(id => !selectedDraftIds.has(id)).length === 0) {
      setView('input')
    }
  }
  
  // Discard single draft
  const handleDiscardDraft = (draftId: string) => {
    draftRegistry.removeDraft(draftId)
    setImportedDraftIds(prev => prev.filter(id => id !== draftId))
    setSelectedDraftIds(prev => {
      const next = new Set(prev)
      next.delete(draftId)
      return next
    })
    if (activeDraftId === draftId) {
      const remaining = importedDraftIds.filter(id => id !== draftId)
      setActiveDraftId(remaining[0] || null)
    }
    if (editingDraftId === draftId) {
      setEditingDraftId(null)
      setView('review')
    }
  }
  
  // Open draft in editor
  const handleEditDraft = (draftId: string) => {
    setEditingDraftId(draftId)
    setView('edit')
  }
  
  // Navigate to Curator for a saved draft
  const handleOpenInCurator = (draftId: string) => {
    const draft = draftRegistry.getDraft(draftId)
    if (!draft?.postId) return
    
    navigate('/dashboard/posts', {
      state: {
        fromEditor: true,
        returnToPostId: draft.postId,
        entryIsSaved: true,
        entryTitle: draft.title || 'Untitled',
        entryStatus: draft.status
      }
    })
    onClose()
  }
  
  if (!isOpen) return null
  
  // ============================================================
  // RENDER: EDIT VIEW (Embedded PostEditor)
  // ============================================================
  if (view === 'edit' && editingDraftId) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setEditingDraftId(null)
                  setView('review')
                }}
                className="text-gray-600 hover:text-gray-900 flex items-center gap-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Queue
              </button>
              <span className="text-gray-300">|</span>
              <h2 className="text-lg font-semibold text-gray-900">
                Editing: {draftRegistry.getDraft(editingDraftId)?.title || 'Untitled'}
              </h2>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Embedded PostEditor in Registry Mode */}
          <div className="flex-1 overflow-y-auto">
            <PostEditor
              useDraftId={editingDraftId}
              onSave={(savedPost) => {
                if (savedPost?.id) {
                  draftRegistry.markSaved(editingDraftId, savedPost.id)
                  onSaveSuccess?.(savedPost.id)
                }
                setEditingDraftId(null)
                setView('review')
              }}
              onCancel={() => {
                setEditingDraftId(null)
                setView('review')
              }}
            />
          </div>
        </div>
      </div>
    )
  }
  
  // ============================================================
  // RENDER: REVIEW VIEW (Queue)
  // ============================================================
  if (view === 'review') {
    const selectedCount = selectedDraftIds.size
    const savedCount = importedDrafts.filter(d => d.postId).length
    const unsavedCount = importedDrafts.length - savedCount
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Import Review Queue</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {importedDrafts.length} {importedDrafts.length === 1 ? 'entry' : 'entries'} imported
                {savedCount > 0 && ` · ${savedCount} saved`}
                {unsavedCount > 0 && ` · ${unsavedCount} unsaved`}
              </p>
            </div>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Save Results */}
          {saveResults.length > 0 && (
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-gray-700">Save Results:</span>
                <span className="text-sm text-green-600">
                  {saveResults.filter(r => r.success).length} saved
                </span>
                {saveResults.filter(r => !r.success).length > 0 && (
                  <span className="text-sm text-red-600">
                    · {saveResults.filter(r => !r.success).length} failed
                  </span>
                )}
              </div>
              {saveResults.filter(r => !r.success).map(r => (
                <p key={r.draftId} className="text-xs text-red-600">
                  {draftRegistry.getDraft(r.draftId)?.title || 'Untitled'}: {r.error}
                </p>
              ))}
            </div>
          )}
          
          {/* Progress */}
          {saving && saveProgress && (
            <div className="px-6 py-3 bg-blue-50 border-b border-blue-200">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm text-blue-700">
                  Saving {saveProgress.current} of {saveProgress.total}...
                </span>
              </div>
            </div>
          )}
          
          {/* Body: Split view */}
          <div className="flex-1 overflow-hidden flex">
            {/* Left: Draft List */}
            <div className="w-1/2 border-r border-gray-200 overflow-y-auto">
              {/* Selection controls */}
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
                <button
                  onClick={selectAll}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Select All
                </button>
                <button
                  onClick={selectNone}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Select None
                </button>
                <span className="text-xs text-gray-500">
                  {selectedCount} selected
                </span>
              </div>
              
              {/* Draft items */}
              <div className="divide-y divide-gray-100">
                {importedDrafts.map(draft => {
                  const isSelected = selectedDraftIds.has(draft.draftId)
                  const isActive = activeDraftId === draft.draftId
                  const isSaved = !!draft.postId
                  const validationErrors = validateDraft(draft)
                  
                  return (
                    <div
                      key={draft.draftId}
                      onClick={() => setActiveDraftId(draft.draftId)}
                      className={`px-4 py-3 cursor-pointer transition-colors ${
                        isActive ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation()
                            toggleSelection(draft.draftId)
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`font-medium truncate ${draft.title ? 'text-gray-900' : 'text-gray-400 italic'}`}>
                              {draft.title || 'Untitled'}
                            </span>
                            
                            {/* Status badges */}
                            {isSaved && (
                              <span className="flex-shrink-0 px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                                Saved
                              </span>
                            )}
                            {validationErrors.length > 0 && (
                              <span className="flex-shrink-0 px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded" title={validationErrors.join(', ')}>
                                ⚠️
                              </span>
                            )}
                          </div>
                          
                          <p className="text-xs text-gray-500 mt-0.5">
                            Status: {draft.status || 'draft'}
                            {draft.excerpt && ` · ${draft.excerpt.substring(0, 50)}${draft.excerpt.length > 50 ? '...' : ''}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            
            {/* Right: Selected Draft Details */}
            <div className="w-1/2 overflow-y-auto p-4">
              {activeDraftId ? (
                (() => {
                  const draft = draftRegistry.getDraft(activeDraftId)
                  if (!draft) return null
                  
                  const isSaved = !!draft.postId
                  const validationErrors = validateDraft(draft)
                  
                  return (
                    <div className="space-y-4">
                      {/* Title */}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {draft.title || <span className="text-gray-400 italic">Untitled</span>}
                        </h3>
                        <p className="text-sm text-gray-500">Status: {draft.status || 'draft'}</p>
                      </div>
                      
                      {/* Validation Warnings */}
                      {validationErrors.length > 0 && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <p className="text-sm font-medium text-amber-800 mb-1">Validation Issues:</p>
                          <ul className="text-sm text-amber-700 list-disc list-inside">
                            {validationErrors.map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {/* Preview */}
                      <div className="space-y-2">
                        {draft.coverImageUrl && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">Cover Image:</p>
                            <img
                              src={draft.coverImageUrl}
                              alt={draft.coverImageAlt || ''}
                              className="w-full h-32 object-cover rounded-lg border border-gray-200"
                            />
                          </div>
                        )}
                        
                        {draft.excerpt && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">Excerpt:</p>
                            <p className="text-sm text-gray-700">{draft.excerpt}</p>
                          </div>
                        )}
                        
                        {draft.content?.html && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">Content Preview:</p>
                            <div
                              className="prose prose-sm max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50"
                              dangerouslySetInnerHTML={{ __html: draft.content.html.substring(0, 1000) }}
                            />
                          </div>
                        )}
                        
                        {(draft.selectedJournals?.length || 0) > 0 && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">Journals:</p>
                            <p className="text-sm text-gray-700">{draft.selectedJournals?.length} assigned</p>
                          </div>
                        )}
                        
                        {(draft.selectedCollections?.length || 0) > 0 && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">Collections:</p>
                            <p className="text-sm text-gray-700">{draft.selectedCollections?.length} assigned</p>
                          </div>
                        )}
                      </div>
                      
                      {/* Actions */}
                      <div className="pt-4 border-t border-gray-200 space-y-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditDraft(activeDraftId)}
                            className="flex-1 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={async () => {
                              setSaving(true)
                              const result = await saveSingleDraft(activeDraftId)
                              setSaveResults([result])
                              setSaving(false)
                            }}
                            disabled={saving || validationErrors.length > 0}
                            className="flex-1 px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSaved ? 'Update' : 'Save'}
                          </button>
                        </div>
                        
                        <div className="flex gap-2">
                          {isSaved ? (
                            <button
                              onClick={() => handleOpenInCurator(activeDraftId)}
                              className="flex-1 px-3 py-2 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                            >
                              Open in Curator
                            </button>
                          ) : (
                            <button
                              disabled
                              className="flex-1 px-3 py-2 text-sm font-medium text-gray-400 bg-gray-100 border border-gray-200 rounded-lg cursor-not-allowed"
                              title="Save first to curate"
                            >
                              Open in Curator
                            </button>
                          )}
                          <button
                            onClick={() => handleDiscardDraft(activeDraftId)}
                            className="flex-1 px-3 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                          >
                            Discard
                          </button>
                        </div>
                        
                        {!isSaved && (
                          <p className="text-xs text-gray-500 text-center">
                            Save first to open in Curator
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })()
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400">
                  Select an entry to view details
                </div>
              )}
            </div>
          </div>
          
          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
            <div className="flex gap-2">
              <button
                onClick={handleDiscardSelected}
                disabled={selectedCount === 0 || saving}
                className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Discard Selected ({selectedCount})
              </button>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleSaveSelected}
                disabled={selectedCount === 0 || saving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : `Save Selected (${selectedCount})`}
              </button>
              <button
                onClick={handleSaveAll}
                disabled={importedDrafts.length === 0 || saving}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save All'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  // ============================================================
  // RENDER: INPUT VIEW (Paste)
  // ============================================================
  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Import Entries</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Paste JSON or HTML content · Supports multiple entries
              </p>
            </div>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Body */}
          <div className="px-6 py-4 flex-1 overflow-y-auto">
            {/* Clear message toast */}
            {clearMessage && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-sm text-green-700">{clearMessage}</p>
              </div>
            )}
            
            {/* Registry Status Banner */}
            {!isRegistryEmpty && (
              <div className={`mb-4 p-3 rounded-lg border ${
                isFull 
                  ? 'bg-red-50 border-red-200' 
                  : isNearCapacity 
                    ? 'bg-amber-50 border-amber-200' 
                    : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className={`w-4 h-4 ${
                      isFull ? 'text-red-600' : isNearCapacity ? 'text-amber-600' : 'text-gray-500'
                    }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <span className={`text-sm font-medium ${
                      isFull ? 'text-red-700' : isNearCapacity ? 'text-amber-700' : 'text-gray-700'
                    }`}>
                      Draft Registry: {registryCount}/{MAX_DRAFTS}
                      {isFull && ' (Full)'}
                      {isNearCapacity && !isFull && ' (Near capacity)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowRegistryModal(true)}
                      className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded hover:bg-blue-200 transition-colors"
                    >
                      View
                    </button>
                    <button
                      onClick={() => setShowClearConfirm(true)}
                      className="px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded hover:bg-red-200 transition-colors"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
                {isFull && (
                  <p className="text-xs text-red-600 mt-2">
                    Cannot import new entries. Clear the registry or save existing drafts first.
                  </p>
                )}
                {isNearCapacity && !isFull && (
                  <p className="text-xs text-amber-600 mt-2">
                    Only {availableSlots} slot{availableSlots !== 1 ? 's' : ''} available. Consider clearing old drafts.
                  </p>
                )}
              </div>
            )}
            
            {/* Textarea */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Paste content
              </label>
              <textarea
                value={importInput}
                onChange={(e) => {
                  setImportInput(e.target.value)
                  setParseError(null)
                }}
                className="w-full h-48 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm resize-none"
                placeholder='Paste JSON (single object, array, or { entries: [...] }) or HTML with delimiters'
              />
            </div>
            
            {/* Mode selector */}
            <div className="flex items-center gap-4 mb-4">
              <label className="text-sm font-medium text-gray-700">Format:</label>
              <select
                value={importMode}
                onChange={(e) => setImportMode(e.target.value as ImportMode)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="auto">Auto-detect</option>
                <option value="json">JSON</option>
                <option value="html">HTML</option>
              </select>
            </div>
            
            {/* Error */}
            {parseError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{parseError}</p>
              </div>
            )}
            
            {/* Warnings */}
            {parseWarnings.length > 0 && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                {parseWarnings.map((w, i) => (
                  <p key={i} className="text-sm text-amber-700">{w}</p>
                ))}
              </div>
            )}
            
            {/* Help text */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-1">
              <p className="text-xs text-blue-700 font-medium">Multi-entry formats supported:</p>
              <p className="text-xs text-blue-700">
                <strong>JSON:</strong> Array of objects [&#123;...&#125;, &#123;...&#125;] or wrapper &#123;"entries": [...]&#125;
              </p>
              <p className="text-xs text-blue-700">
                <strong>HTML:</strong> Multiple &lt;article data-entry&gt;...&lt;/article&gt; blocks or &lt;!-- ENTRY_START --&gt; delimiters
              </p>
            </div>
          </div>
          
          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            {/* Auto-clear checkbox */}
            <div className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                id="clearOnCancel"
                checked={clearOnCancel}
                onChange={(e) => setClearOnCancel(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="clearOnCancel" className="text-xs text-gray-600">
                Clear drafts from this session when I cancel
                {sessionDraftIds.size > 0 && (
                  <span className="text-gray-400 ml-1">({sessionDraftIds.size} draft{sessionDraftIds.size !== 1 ? 's' : ''})</span>
                )}
              </label>
            </div>
            
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleParse}
                disabled={!importInput.trim() || isFull}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Parse & Review
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* View Registry Modal */}
      {showRegistryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Draft Registry</h3>
                <p className="text-sm text-gray-500">{registryCount} of {MAX_DRAFTS} drafts</p>
              </div>
              <button onClick={() => setShowRegistryModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {allRegistryDrafts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p>Registry is empty</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {allRegistryDrafts.map(draft => (
                    <div
                      key={draft.draftId}
                      className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-start justify-between gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium truncate ${draft.title ? 'text-gray-900' : 'text-gray-400 italic'}`}>
                            {draft.title || 'Untitled'}
                          </span>
                          {/* Status badges */}
                          {draft.postId && (
                            <span className="flex-shrink-0 px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                              Saved
                            </span>
                          )}
                          {draft.isDirty && (
                            <span className="flex-shrink-0 px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded">
                              Unsaved
                            </span>
                          )}
                          {sessionDraftIds.has(draft.draftId) && (
                            <span className="flex-shrink-0 px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                              This session
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Source: {draft.source} · Updated {formatTimeAgo(draft.updatedAt)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveDraft(draft.draftId)}
                        className="flex-shrink-0 p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors"
                        title="Remove draft"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
              <button
                onClick={() => setShowClearConfirm(true)}
                disabled={allRegistryDrafts.length === 0}
                className="px-3 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear All
              </button>
              <button
                onClick={() => setShowRegistryModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Clear Confirmation Dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Clear Draft Registry?</h3>
                <p className="text-sm text-gray-500">This action cannot be undone.</p>
              </div>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              This will permanently remove <strong>{registryCount} draft{registryCount !== 1 ? 's' : ''}</strong> from the registry.
              Unsaved changes will be lost.
            </p>
            
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Keep Drafts
              </button>
              <button
                onClick={handleClearRegistry}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
