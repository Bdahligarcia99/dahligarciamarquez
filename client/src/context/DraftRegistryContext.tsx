/**
 * Draft Registry Context
 * 
 * Provides a centralized registry for holding multiple Entry Editor drafts
 * simultaneously. Enables future features like multi-entry import review
 * queues and batch save operations.
 * 
 * PHASE 1: Foundation only
 * - Context and hook are available but NOT yet integrated into editor UI
 * - PostEditor.tsx continues to use its own local state
 * - This is groundwork for future phases
 * 
 * Storage Keys:
 * - `entry_draft_registry` - Multi-draft registry (this system)
 * - `entry_editor_draft` - Legacy single-draft key (untouched)
 * 
 * Usage (future phases):
 * ```tsx
 * const { createDraft, getDraft, updateDraft } = useDraftRegistry()
 * const draftId = createDraft({ title: 'New Entry' }, 'new')
 * ```
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import {
  loadRegistry,
  saveRegistry,
  saveRegistryImmediate,
  canAddDraft,
  generateDraftId,
  REGISTRY_LIMITS,
} from '../lib/draftPersistence'

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/** How a draft was created */
export type DraftSource = 'new' | 'edit' | 'import' | 'duplicate'

/** Entry status values */
export type EntryStatus = 'draft' | 'published' | 'archived' | 'private' | 'system'

/** Validation error for a draft field */
export interface ValidationError {
  field: keyof DraftEntryFields | 'general'
  message: string
  code: string
}

/** Core entry fields (matches PostEditor state) */
export interface DraftEntryFields {
  title: string
  excerpt: string
  coverImageUrl: string
  coverImageAlt: string
  content: { json: any; html: string } | null
  status: EntryStatus
  selectedJournals: string[]
  selectedCollections: string[]
}

/** Registry metadata for each draft */
export interface DraftMetadata {
  draftId: string
  postId: string | null
  createdAt: number
  updatedAt: number
  isDirty: boolean
  source: DraftSource
  validationErrors: ValidationError[] | null
}

/** Full draft state (fields + metadata) */
export interface RegistryDraftState extends DraftEntryFields, DraftMetadata {}

/** Validation result from validateDraft */
export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
}

// ============================================================
// DEFAULT VALUES
// ============================================================

const DEFAULT_DRAFT_FIELDS: DraftEntryFields = {
  title: '',
  excerpt: '',
  coverImageUrl: '',
  coverImageAlt: '',
  content: null,
  status: 'draft',
  selectedJournals: [],
  selectedCollections: [],
}

// ============================================================
// VALIDATION
// ============================================================

/**
 * Validate a draft's fields
 * Rules:
 * - Title is required
 * - Cover alt text required if cover image is present
 */
function validateDraftFields(draft: DraftEntryFields): ValidationError[] {
  const errors: ValidationError[] = []

  // Title required
  if (!draft.title?.trim()) {
    errors.push({
      field: 'title',
      message: 'Title is required',
      code: 'REQUIRED',
    })
  }

  // Cover alt required if cover image present
  if (draft.coverImageUrl?.trim() && !draft.coverImageAlt?.trim()) {
    errors.push({
      field: 'coverImageAlt',
      message: 'Alt text is required when cover image is provided',
      code: 'REQUIRED',
    })
  }

  return errors
}

// ============================================================
// CONTEXT TYPE
// ============================================================

interface DraftRegistryContextValue {
  // Read
  drafts: RegistryDraftState[]
  getDraft: (draftId: string) => RegistryDraftState | null
  activeDraft: RegistryDraftState | null
  activeDraftId: string | null

  // Write
  createDraft: (initial?: Partial<DraftEntryFields>, source?: DraftSource) => string | null
  updateDraft: (draftId: string, partial: Partial<DraftEntryFields>) => void
  removeDraft: (draftId: string) => void

  // Focus
  selectDraft: (draftId: string | null) => void

  // Lifecycle
  markSaved: (draftId: string, postId: string) => void
  markDirty: (draftId: string) => void
  clearDirty: (draftId: string) => void

  // Validation
  validateDraft: (draftId: string) => ValidationResult

  // Batch operations
  discardAllDrafts: () => void

  // Utility
  draftCount: number
  canCreateDraft: boolean
}

// ============================================================
// CONTEXT
// ============================================================

const DraftRegistryContext = createContext<DraftRegistryContextValue | null>(null)

// ============================================================
// PROVIDER
// ============================================================

export function DraftRegistryProvider({ children }: { children: React.ReactNode }) {
  // Registry state
  const [registry, setRegistry] = useState<Map<string, RegistryDraftState>>(() => new Map())
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  // Ref to track latest registry for persistence
  const registryRef = useRef(registry)
  const activeDraftIdRef = useRef(activeDraftId)

  // Keep refs in sync
  useEffect(() => {
    registryRef.current = registry
    activeDraftIdRef.current = activeDraftId
  }, [registry, activeDraftId])

  // Load from sessionStorage on mount
  useEffect(() => {
    const { registry: loadedRegistry, activeDraftId: loadedActiveId } = loadRegistry()
    setRegistry(loadedRegistry)
    setActiveDraftId(loadedActiveId)
    setInitialized(true)
    
    if (loadedRegistry.size > 0) {
      console.log(`[DraftRegistry] Loaded ${loadedRegistry.size} draft(s) from storage`)
    }
  }, [])

  // Persist to sessionStorage when registry changes (debounced)
  useEffect(() => {
    if (!initialized) return
    saveRegistry(registry, activeDraftId)
  }, [registry, activeDraftId, initialized])

  // Save immediately before page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveRegistryImmediate(registryRef.current, activeDraftIdRef.current)
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  // --------------------------------------------------------
  // READ METHODS
  // --------------------------------------------------------

  const getDraft = useCallback((draftId: string): RegistryDraftState | null => {
    return registry.get(draftId) || null
  }, [registry])

  const drafts = Array.from(registry.values())
  const activeDraft = activeDraftId ? registry.get(activeDraftId) || null : null
  const draftCount = registry.size
  const canCreateDraft = canAddDraft(draftCount).allowed

  // --------------------------------------------------------
  // WRITE METHODS
  // --------------------------------------------------------

  const createDraft = useCallback((
    initial?: Partial<DraftEntryFields>,
    source: DraftSource = 'new'
  ): string | null => {
    const check = canAddDraft(registry.size)
    if (!check.allowed) {
      console.warn(`[DraftRegistry] Cannot create draft: ${check.reason}`)
      return null
    }

    const draftId = generateDraftId()
    const now = Date.now()

    const newDraft: RegistryDraftState = {
      // Default fields
      ...DEFAULT_DRAFT_FIELDS,
      // Override with provided initial values
      ...initial,
      // Metadata
      draftId,
      postId: null,
      createdAt: now,
      updatedAt: now,
      isDirty: false,
      source,
      validationErrors: null,
    }

    setRegistry(prev => {
      const next = new Map(prev)
      next.set(draftId, newDraft)
      return next
    })

    console.log(`[DraftRegistry] Created draft: ${draftId} (source: ${source})`)
    return draftId
  }, [registry.size])

  const updateDraft = useCallback((
    draftId: string,
    partial: Partial<DraftEntryFields>
  ): void => {
    setRegistry(prev => {
      const existing = prev.get(draftId)
      if (!existing) {
        console.warn(`[DraftRegistry] Cannot update non-existent draft: ${draftId}`)
        return prev
      }

      const updated: RegistryDraftState = {
        ...existing,
        ...partial,
        updatedAt: Date.now(),
        isDirty: true,
        // Clear validation errors on update (will be re-validated on demand)
        validationErrors: null,
      }

      const next = new Map(prev)
      next.set(draftId, updated)
      return next
    })
  }, [])

  const removeDraft = useCallback((draftId: string): void => {
    setRegistry(prev => {
      if (!prev.has(draftId)) {
        return prev
      }
      const next = new Map(prev)
      next.delete(draftId)
      console.log(`[DraftRegistry] Removed draft: ${draftId}`)
      return next
    })

    // Clear active if it was the removed draft
    setActiveDraftId(prev => prev === draftId ? null : prev)
  }, [])

  // --------------------------------------------------------
  // FOCUS METHODS
  // --------------------------------------------------------

  const selectDraft = useCallback((draftId: string | null): void => {
    if (draftId && !registry.has(draftId)) {
      console.warn(`[DraftRegistry] Cannot select non-existent draft: ${draftId}`)
      return
    }
    setActiveDraftId(draftId)
  }, [registry])

  // --------------------------------------------------------
  // LIFECYCLE METHODS
  // --------------------------------------------------------

  const markSaved = useCallback((draftId: string, postId: string): void => {
    setRegistry(prev => {
      const existing = prev.get(draftId)
      if (!existing) {
        console.warn(`[DraftRegistry] Cannot mark saved non-existent draft: ${draftId}`)
        return prev
      }

      const updated: RegistryDraftState = {
        ...existing,
        postId,
        isDirty: false,
        updatedAt: Date.now(),
      }

      const next = new Map(prev)
      next.set(draftId, updated)
      console.log(`[DraftRegistry] Marked saved: ${draftId} -> postId: ${postId}`)
      return next
    })
  }, [])

  const markDirty = useCallback((draftId: string): void => {
    setRegistry(prev => {
      const existing = prev.get(draftId)
      if (!existing || existing.isDirty) {
        return prev
      }

      const updated: RegistryDraftState = {
        ...existing,
        isDirty: true,
        updatedAt: Date.now(),
      }

      const next = new Map(prev)
      next.set(draftId, updated)
      return next
    })
  }, [])

  const clearDirty = useCallback((draftId: string): void => {
    setRegistry(prev => {
      const existing = prev.get(draftId)
      if (!existing || !existing.isDirty) {
        return prev
      }

      const updated: RegistryDraftState = {
        ...existing,
        isDirty: false,
        updatedAt: Date.now(),
      }

      const next = new Map(prev)
      next.set(draftId, updated)
      return next
    })
  }, [])

  // --------------------------------------------------------
  // VALIDATION
  // --------------------------------------------------------

  const validateDraft = useCallback((draftId: string): ValidationResult => {
    const draft = registry.get(draftId)
    if (!draft) {
      return {
        isValid: false,
        errors: [{ field: 'general', message: 'Draft not found', code: 'NOT_FOUND' }],
      }
    }

    const errors = validateDraftFields(draft)
    
    // Store validation errors in draft
    setRegistry(prev => {
      const existing = prev.get(draftId)
      if (!existing) return prev

      const updated: RegistryDraftState = {
        ...existing,
        validationErrors: errors.length > 0 ? errors : null,
      }

      const next = new Map(prev)
      next.set(draftId, updated)
      return next
    })

    return {
      isValid: errors.length === 0,
      errors,
    }
  }, [registry])

  // --------------------------------------------------------
  // BATCH OPERATIONS
  // --------------------------------------------------------

  const discardAllDrafts = useCallback((): void => {
    setRegistry(new Map())
    setActiveDraftId(null)
    console.log('[DraftRegistry] Discarded all drafts')
  }, [])

  // --------------------------------------------------------
  // CONTEXT VALUE
  // --------------------------------------------------------

  const value: DraftRegistryContextValue = {
    // Read
    drafts,
    getDraft,
    activeDraft,
    activeDraftId,
    // Write
    createDraft,
    updateDraft,
    removeDraft,
    // Focus
    selectDraft,
    // Lifecycle
    markSaved,
    markDirty,
    clearDirty,
    // Validation
    validateDraft,
    // Batch
    discardAllDrafts,
    // Utility
    draftCount,
    canCreateDraft,
  }

  return (
    <DraftRegistryContext.Provider value={value}>
      {children}
    </DraftRegistryContext.Provider>
  )
}

// ============================================================
// HOOK
// ============================================================

/**
 * Hook to access the Draft Registry.
 * 
 * Phase 1: Available but not yet integrated into editor UI.
 * 
 * @throws Error if used outside DraftRegistryProvider
 */
export function useDraftRegistry(): DraftRegistryContextValue {
  const context = useContext(DraftRegistryContext)
  if (!context) {
    throw new Error('useDraftRegistry must be used within a DraftRegistryProvider')
  }
  return context
}

/**
 * Safe version that returns null if outside provider (for conditional usage)
 */
export function useDraftRegistrySafe(): DraftRegistryContextValue | null {
  return useContext(DraftRegistryContext)
}

// ============================================================
// EXPORTS
// ============================================================

export { REGISTRY_LIMITS } from '../lib/draftPersistence'
