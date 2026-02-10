/**
 * Draft Registry Persistence Layer
 * 
 * Handles sessionStorage read/write for the Draft Registry.
 * 
 * Storage Keys:
 * - `entry_draft_registry` - Multi-draft registry (this module)
 * - `entry_editor_draft` - Legacy single-draft key (untouched, for backward compat)
 * 
 * Features:
 * - Debounced writes (500ms) to avoid thrashing
 * - TTL enforcement (30 minutes)
 * - Max drafts limit (10)
 * - Graceful degradation if sessionStorage unavailable
 * 
 * Phase 1: Foundation only - not yet integrated into editor UI.
 */

import type { RegistryDraftState } from '../context/DraftRegistryContext'

// ============================================================
// CONSTANTS
// ============================================================

export const REGISTRY_STORAGE_KEY = 'entry_draft_registry'
export const LEGACY_STORAGE_KEY = 'entry_editor_draft' // Keep for backward compat

export const REGISTRY_LIMITS = {
  MAX_DRAFTS: 10,
  MAX_SINGLE_DRAFT_KB: 100,
  WARN_TOTAL_SIZE_KB: 500,
  MAX_TOTAL_SIZE_KB: 2000,
  TTL_MS: 30 * 60 * 1000,         // 30 minutes
  TTL_WARNING_MS: 25 * 60 * 1000, // Warn at 25 minutes
  PERSIST_DEBOUNCE_MS: 500,
}

// ============================================================
// TYPES
// ============================================================

interface PersistedRegistry {
  version: 1
  drafts: Record<string, RegistryDraftState>
  activeDraftId: string | null
  persistedAt: number
}

// ============================================================
// STORAGE AVAILABILITY CHECK
// ============================================================

function isSessionStorageAvailable(): boolean {
  try {
    const testKey = '__draft_registry_test__'
    sessionStorage.setItem(testKey, 'test')
    sessionStorage.removeItem(testKey)
    return true
  } catch {
    return false
  }
}

// ============================================================
// LOAD FROM STORAGE
// ============================================================

/**
 * Load the draft registry from sessionStorage.
 * Automatically cleans expired drafts (TTL enforcement).
 * Returns empty registry if nothing persisted or on error.
 */
export function loadRegistry(): {
  registry: Map<string, RegistryDraftState>
  activeDraftId: string | null
} {
  if (!isSessionStorageAvailable()) {
    console.warn('[DraftPersistence] sessionStorage not available, using in-memory only')
    return { registry: new Map(), activeDraftId: null }
  }

  try {
    const stored = sessionStorage.getItem(REGISTRY_STORAGE_KEY)
    if (!stored) {
      return { registry: new Map(), activeDraftId: null }
    }

    const parsed: PersistedRegistry = JSON.parse(stored)
    
    // Version check
    if (parsed.version !== 1) {
      console.warn('[DraftPersistence] Unknown registry version, starting fresh')
      return { registry: new Map(), activeDraftId: null }
    }

    // Reconstruct Map and clean expired drafts
    const now = Date.now()
    const registry = new Map<string, RegistryDraftState>()
    
    for (const [draftId, draft] of Object.entries(parsed.drafts)) {
      // TTL check
      if (now - draft.updatedAt < REGISTRY_LIMITS.TTL_MS) {
        registry.set(draftId, draft)
      } else {
        console.log(`[DraftPersistence] Expired draft removed: ${draftId}`)
      }
    }

    // Validate activeDraftId still exists
    const activeDraftId = registry.has(parsed.activeDraftId || '') 
      ? parsed.activeDraftId 
      : null

    return { registry, activeDraftId }
  } catch (error) {
    console.error('[DraftPersistence] Failed to load registry:', error)
    return { registry: new Map(), activeDraftId: null }
  }
}

// ============================================================
// SAVE TO STORAGE
// ============================================================

let saveTimeout: ReturnType<typeof setTimeout> | null = null

/**
 * Save the draft registry to sessionStorage (debounced).
 * Call this after any registry mutation.
 */
export function saveRegistry(
  registry: Map<string, RegistryDraftState>,
  activeDraftId: string | null
): void {
  // Debounce
  if (saveTimeout) {
    clearTimeout(saveTimeout)
  }

  saveTimeout = setTimeout(() => {
    saveRegistryImmediate(registry, activeDraftId)
  }, REGISTRY_LIMITS.PERSIST_DEBOUNCE_MS)
}

/**
 * Save immediately without debounce (for critical moments like before navigation)
 */
export function saveRegistryImmediate(
  registry: Map<string, RegistryDraftState>,
  activeDraftId: string | null
): boolean {
  if (!isSessionStorageAvailable()) {
    console.warn('[DraftPersistence] sessionStorage not available, skipping save')
    return false
  }

  try {
    // Convert Map to plain object
    const drafts: Record<string, RegistryDraftState> = {}
    for (const [draftId, draft] of registry) {
      drafts[draftId] = draft
    }

    const persisted: PersistedRegistry = {
      version: 1,
      drafts,
      activeDraftId,
      persistedAt: Date.now(),
    }

    const serialized = JSON.stringify(persisted)
    
    // Size check
    const sizeKB = serialized.length / 1024
    if (sizeKB > REGISTRY_LIMITS.WARN_TOTAL_SIZE_KB) {
      console.warn(`[DraftPersistence] Registry size warning: ${sizeKB.toFixed(1)}KB`)
    }
    if (sizeKB > REGISTRY_LIMITS.MAX_TOTAL_SIZE_KB) {
      console.error(`[DraftPersistence] Registry too large (${sizeKB.toFixed(1)}KB), not saving`)
      return false
    }

    sessionStorage.setItem(REGISTRY_STORAGE_KEY, serialized)
    return true
  } catch (error) {
    console.error('[DraftPersistence] Failed to save registry:', error)
    return false
  }
}

/**
 * Clear any pending debounced save
 */
export function cancelPendingSave(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
    saveTimeout = null
  }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Check if adding a new draft would exceed the limit
 */
export function canAddDraft(currentCount: number): { allowed: boolean; reason?: string } {
  if (currentCount >= REGISTRY_LIMITS.MAX_DRAFTS) {
    return { 
      allowed: false, 
      reason: `Maximum ${REGISTRY_LIMITS.MAX_DRAFTS} drafts reached. Please save or discard existing drafts.`
    }
  }
  return { allowed: true }
}

/**
 * Check if a draft is approaching TTL expiration
 */
export function getDraftTTLStatus(updatedAt: number): {
  isExpired: boolean
  isWarning: boolean
  remainingMs: number
} {
  const now = Date.now()
  const age = now - updatedAt
  const remainingMs = REGISTRY_LIMITS.TTL_MS - age

  return {
    isExpired: remainingMs <= 0,
    isWarning: remainingMs > 0 && remainingMs <= (REGISTRY_LIMITS.TTL_MS - REGISTRY_LIMITS.TTL_WARNING_MS),
    remainingMs: Math.max(0, remainingMs),
  }
}

/**
 * Estimate draft size in KB
 */
export function estimateDraftSize(draft: RegistryDraftState): number {
  try {
    return JSON.stringify(draft).length / 1024
  } catch {
    return 0
  }
}

/**
 * Generate a unique draft ID
 */
export function generateDraftId(): string {
  // Simple UUID v4 implementation
  return 'draft-' + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * Clear the entire registry from storage
 */
export function clearRegistry(): void {
  cancelPendingSave()
  if (isSessionStorageAvailable()) {
    sessionStorage.removeItem(REGISTRY_STORAGE_KEY)
  }
}
