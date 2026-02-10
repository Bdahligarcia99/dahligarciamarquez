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
  
  // Get drafts from registry
  const importedDrafts = importedDraftIds
    .map(id => draftRegistry.getDraft(id))
    .filter((d): d is RegistryDraftState => d !== null)
  
  // Track if we should auto-parse on next render
  const [shouldAutoParse, setShouldAutoParse] = useState(false)
  
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
    
    const result = parseMultipleEntries(importInput, importMode)
    
    if (!result.success || result.entries.length === 0) {
      setParseError(result.error || 'No entries found')
      setParseWarnings(result.warnings)
      return
    }
    
    setParseWarnings(result.warnings)
    
    // Create a draft for each parsed entry
    const newDraftIds: string[] = []
    
    for (const fields of result.entries) {
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
      }
    }
    
    if (newDraftIds.length === 0) {
      setParseError('Failed to create drafts')
      return
    }
    
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
              onClick={onClose}
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
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
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
                onClick={onClose}
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
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Body */}
        <div className="px-6 py-4 flex-1 overflow-y-auto">
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
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleParse}
            disabled={!importInput.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Parse & Review
          </button>
        </div>
      </div>
    </div>
  )
}
