# Draft Registry Design Specification

## Overview

This document specifies a Draft Registry system for holding multiple Entry Editor drafts simultaneously. It enables future features like multi-entry import review queues and batch save operations while preserving backward compatibility with the existing single-draft workflow.

---

## 1. Draft Registry Structure

### 1.1 DraftState Type Definition

Based on the existing `DraftState` interface in `PostEditor.tsx`, extended with registry metadata:

```typescript
// Core entry fields (matches current PostEditor state)
interface DraftEntryFields {
  title: string
  excerpt: string
  coverImageUrl: string
  coverImageAlt: string
  content: { json: any; html: string } | null
  status: 'draft' | 'published' | 'archived' | 'private' | 'system'
  selectedJournals: string[]      // Journal IDs for saved entries, names for pending
  selectedCollections: string[]   // Collection IDs for saved entries, names for pending
}

// Registry metadata
interface DraftMetadata {
  draftId: string                 // Unique temp ID (uuid or nanoid)
  postId: string | null           // Database post ID (null until saved)
  createdAt: number               // Unix timestamp
  updatedAt: number               // Unix timestamp (updates on any field change)
  isDirty: boolean                // True if unsaved changes exist
  source: DraftSource             // How this draft was created
  validationErrors: ValidationError[] | null  // Populated on validate()
}

type DraftSource = 
  | 'new'           // Created via "New Entry" button
  | 'edit'          // Opened from existing post
  | 'import'        // Created via Import feature
  | 'duplicate'     // Future: duplicated from another entry

// Full draft state
interface RegistryDraftState extends DraftEntryFields, DraftMetadata {}

// Validation error structure
interface ValidationError {
  field: keyof DraftEntryFields | 'general'
  message: string
  code: string  // e.g., 'REQUIRED', 'TOO_LONG', 'INVALID_URL'
}
```

### 1.2 Registry Structure

```typescript
// The registry is a Map keyed by draftId
type DraftRegistry = Map<string, RegistryDraftState>

// Active draft selection (for UI focus)
interface DraftRegistryContext {
  registry: DraftRegistry
  activeDraftId: string | null  // Currently focused draft
}
```

### 1.3 Field Mapping Notes

| Editor State Field | Registry Field | Notes |
|--------------------|----------------|-------|
| `title` | `title` | Required for save |
| `content` | `content` | `{ json, html }` from TipTap |
| `excerpt` | `excerpt` | Optional |
| `coverImageUrl` | `coverImageUrl` | Validated URL |
| `coverImageAlt` | `coverImageAlt` | Required if coverImageUrl present |
| `status` | `status` | Extended to include 'private', 'system' |
| `selectedLabels` | *not included* | Legacy field, not used in registry |
| `selectedJournals` | `selectedJournals` | Journal IDs (or names for import) |
| `selectedCollections` | `selectedCollections` | Collection IDs (or names for import) |

---

## 2. Draft Lifecycle

### 2.1 Draft Creation

| Trigger | Source | Initial State | Notes |
|---------|--------|---------------|-------|
| "New Entry" button | `'new'` | Empty defaults | `postId: null`, empty fields |
| Edit existing post | `'edit'` | Fetched from API | `postId: <id>`, fields from server |
| Import single | `'import'` | Parsed fields | `postId: null`, partial fields |
| Import batch | `'import'` | Array of parsed | Creates multiple drafts |

**Creation Flow:**
```
User action → createDraft(initialState, source) → generates draftId → adds to registry → returns draftId
```

### 2.2 Draft Updates

**Write-through Pattern:**
- Each field change calls `updateDraft(draftId, { field: value })`
- Sets `isDirty: true` and `updatedAt: Date.now()`
- Does NOT auto-persist to sessionStorage (see persistence strategy)

**Debouncing:**
- Individual field updates are synchronous (in-memory)
- sessionStorage persistence is debounced (500ms) to avoid thrashing

### 2.3 Draft Removal

| Trigger | Action |
|---------|--------|
| User clicks "Discard" | `removeDraft(draftId)` |
| Save succeeds (new entry) | `markSaved(draftId, newPostId)` then optionally `removeDraft(draftId)` |
| Save succeeds (edit) | `markSaved(draftId, postId)`, clear `isDirty` |
| TTL expires | Background cleanup removes draft |
| User navigates away | Prompt if `isDirty`, then remove or persist |

### 2.4 Save Transition (Temp → Persisted)

```
Before save:  { draftId: 'temp-abc', postId: null, ... }
POST /api/posts → returns { id: 'real-uuid-123' }
After save:   { draftId: 'temp-abc', postId: 'real-uuid-123', isDirty: false, ... }
```

**Options after successful save:**
1. **Keep in registry** (for review queue flows) – mark as saved, clear dirty
2. **Remove from registry** (for single-entry flows) – cleanup after navigation

---

## 3. Persistence Strategy

### 3.1 Recommendation: Option B – Multi-Draft SessionStorage

Extend sessionStorage to support multiple drafts:

```typescript
const REGISTRY_STORAGE_KEY = 'entry_draft_registry'
const LEGACY_STORAGE_KEY = 'entry_editor_draft'  // Keep for backward compat

interface PersistedRegistry {
  version: 1
  drafts: Record<string, RegistryDraftState>  // keyed by draftId
  activeDraftId: string | null
  persistedAt: number
}
```

### 3.2 Persistence Rules

| Rule | Implementation |
|------|----------------|
| **Debounced writes** | Persist to sessionStorage at most every 500ms |
| **TTL enforcement** | On load, filter out drafts where `updatedAt < now - 30min` |
| **Size guard** | Max 10 drafts in registry; warn/reject if exceeded |
| **Size limit** | Estimate ~50KB per draft; warn if registry > 400KB |
| **Graceful degradation** | If sessionStorage fails, continue with in-memory only |

### 3.3 Backward Compatibility

**Phase 1-2:** Maintain dual persistence:
- New registry writes to `entry_draft_registry`
- Legacy single-draft restore checks `entry_editor_draft` first (for users mid-session during rollout)

**Phase 3+:** Deprecate legacy key after confidence period.

### 3.4 TTL Implementation

```typescript
function cleanExpiredDrafts(registry: DraftRegistry): DraftRegistry {
  const now = Date.now()
  const TTL_MS = 30 * 60 * 1000  // 30 minutes
  
  const cleaned = new Map<string, RegistryDraftState>()
  for (const [id, draft] of registry) {
    if (now - draft.updatedAt < TTL_MS) {
      cleaned.set(id, draft)
    }
  }
  return cleaned
}
```

---

## 4. Integration Plan (Phased)

### Phase 1: Introduce Context (Non-Invasive)

**Goal:** Add DraftRegistryContext without changing any existing behavior.

**Tasks:**
- [ ] Create `client/src/context/DraftRegistryContext.tsx`
- [ ] Implement context provider with in-memory Map
- [ ] Implement sessionStorage persistence layer (separate module)
- [ ] Add provider to App.jsx (wraps existing providers)
- [ ] No UI changes; no PostEditor changes

**Risk:** Minimal – context exists but isn't used yet.

### Phase 2: PostEditor Optional Integration

**Goal:** Allow PostEditor to optionally use registry (behind prop/flag).

**Tasks:**
- [ ] Add `useDraftId?: string` prop to PostEditor
- [ ] If `useDraftId` is provided, read/write from registry instead of local state
- [ ] Keep default behavior (no prop) exactly as today
- [ ] Update `saveDraftState()` to write to registry when in registry mode
- [ ] Test: single-entry flow unchanged; registry mode works

**Backward Compat:** Existing routes (`/dashboard/posts/new`, `/dashboard/posts/:id/edit`) continue using local state. Registry mode only activates with explicit prop.

### Phase 3: Multi-Draft Review UI

**Goal:** Import modal creates multiple drafts; new review UI lists them.

**Tasks:**
- [ ] Extend Import modal to support "Import All" for batch JSON/HTML
- [ ] Create `DraftReviewQueue` component showing list of drafts
- [ ] Each draft card shows title, status, validation state
- [ ] Click draft → opens PostEditor in modal with `useDraftId={draftId}`
- [ ] "Save All" iterates registry, saves each, shows progress

**New Route (optional):** `/dashboard/posts/import-review` or modal overlay.

### Phase 4: Curator Integration for Drafts

**Goal:** Allow assignment management for unsaved drafts.

**Tasks:**
- [ ] In Curator, detect if entry is from registry (unsaved)
- [ ] For unsaved drafts: stage assignment changes in registry (no RPC)
- [ ] For saved entries: use existing RPCs
- [ ] When draft saves, apply staged assignments via RPCs

---

## 5. API Surface

### 5.1 Hook: `useDraftRegistry()`

```typescript
interface UseDraftRegistryReturn {
  // Read
  drafts: RegistryDraftState[]
  getDraft: (draftId: string) => RegistryDraftState | null
  activeDraft: RegistryDraftState | null
  
  // Write
  createDraft: (initial?: Partial<DraftEntryFields>, source?: DraftSource) => string
  updateDraft: (draftId: string, partial: Partial<DraftEntryFields>) => void
  removeDraft: (draftId: string) => void
  
  // Lifecycle
  markSaved: (draftId: string, postId: string) => void
  markDirty: (draftId: string) => void
  clearDirty: (draftId: string) => void
  
  // Focus
  selectDraft: (draftId: string | null) => void
  
  // Validation
  validateDraft: (draftId: string) => ValidationError[]
  
  // Batch
  saveAllDrafts: () => Promise<SaveAllResult>
  discardAllDrafts: () => void
}
```

### 5.2 Function Signatures

```typescript
// Create a new draft, returns the generated draftId
function createDraft(
  initial?: Partial<DraftEntryFields>,
  source?: DraftSource
): string

// Update specific fields of a draft
function updateDraft(
  draftId: string,
  partial: Partial<DraftEntryFields>
): void

// Get a single draft by ID
function getDraft(draftId: string): RegistryDraftState | null

// Get all drafts as array (for rendering lists)
function listDrafts(): RegistryDraftState[]

// Remove a draft from registry
function removeDraft(draftId: string): void

// Mark draft as saved with its new postId
function markSaved(
  draftId: string,
  postId: string,
  persistedSnapshot?: DraftEntryFields  // Optional: store what was saved
): void

// Validate draft, returns array of errors (empty = valid)
function validateDraft(draftId: string): ValidationError[]

// Set the active draft (for UI focus)
function selectDraft(draftId: string | null): void
```

### 5.3 Validation Rules

```typescript
function validateDraft(draft: RegistryDraftState): ValidationError[] {
  const errors: ValidationError[] = []
  
  // Title required
  if (!draft.title?.trim()) {
    errors.push({ field: 'title', message: 'Title is required', code: 'REQUIRED' })
  }
  
  // Cover alt required if cover image present
  if (draft.coverImageUrl?.trim() && !draft.coverImageAlt?.trim()) {
    errors.push({ 
      field: 'coverImageAlt', 
      message: 'Alt text required for cover image', 
      code: 'REQUIRED' 
    })
  }
  
  // Content should exist (TipTap always has at least empty doc)
  // No hard requirement – empty posts allowed as drafts
  
  return errors
}
```

---

## 6. Curator Interaction

### 6.1 Assignment Handling by Draft State

| Draft State | Curator Behavior |
|-------------|------------------|
| `postId: null` (unsaved) | Stage assignments in `selectedJournals`/`selectedCollections` – NO RPC calls |
| `postId: <id>` (saved) | Use existing RPCs (`add_post_to_journal`, etc.) – immediate DB write |

### 6.2 Staged Assignments Model

For unsaved drafts, assignments are stored as IDs (if journal/collection exists) or names (if to-be-created):

```typescript
interface StagedAssignment {
  type: 'journal' | 'collection'
  id?: string        // Existing journal/collection ID
  name?: string      // Name for auto-creation (from import)
  action: 'add' | 'remove'
}

// Alternative: just store final state in draft
// selectedJournals: string[]  // Mix of IDs and names
// On save, resolve names → IDs (create if needed), then call RPCs
```

**Recommendation:** Keep it simple – store final selection arrays in draft. On save:
1. For each `selectedJournals` entry:
   - If UUID format → assume existing ID, call `add_post_to_journal`
   - If not UUID → lookup by name or create, then add
2. Same for `selectedCollections`

### 6.3 UI Bridge Pattern

When showing Curator-style controls for a draft:

```tsx
// In draft review card or modal
<AssignmentPicker
  selectedJournals={draft.selectedJournals}
  selectedCollections={draft.selectedCollections}
  onChange={(journals, collections) => {
    updateDraft(draft.draftId, { 
      selectedJournals: journals,
      selectedCollections: collections 
    })
  }}
  immediateWrite={draft.postId !== null}  // Only call RPCs if saved
/>
```

---

## 7. Risks & Guardrails

### 7.1 Identified Risks

| Risk | Impact | Likelihood |
|------|--------|------------|
| **Memory bloat** | Large content in many drafts | Medium |
| **SessionStorage overflow** | Browser rejects writes (~5MB limit) | Low-Medium |
| **Inconsistent drafts** | User edits in multiple tabs | Medium |
| **Race conditions on batch save** | Parallel saves conflict | Low |
| **Orphaned drafts** | TTL too long, storage fills up | Low |
| **Lost drafts** | TTL too short, user loses work | Medium |

### 7.2 Guardrails

| Guardrail | Implementation |
|-----------|----------------|
| **Max drafts** | Reject `createDraft()` if registry has ≥10 drafts |
| **Max draft size** | Warn if single draft > 100KB; reject if > 500KB |
| **Debounced persistence** | 500ms debounce on sessionStorage writes |
| **TTL with warning** | 30min TTL; show "draft expiring soon" at 25min |
| **Tab sync (future)** | Use BroadcastChannel API to sync registry across tabs |
| **Dirty navigation guard** | Prompt "You have unsaved drafts" on window close |
| **Size monitoring** | Log warning if total registry > 1MB |

### 7.3 Recommended Limits

```typescript
const REGISTRY_LIMITS = {
  MAX_DRAFTS: 10,
  MAX_SINGLE_DRAFT_KB: 100,
  WARN_TOTAL_SIZE_KB: 500,
  MAX_TOTAL_SIZE_KB: 2000,
  TTL_MS: 30 * 60 * 1000,  // 30 minutes
  TTL_WARNING_MS: 25 * 60 * 1000,  // Warn at 25 minutes
  PERSIST_DEBOUNCE_MS: 500,
}
```

---

## 8. File Structure (Proposed)

```
client/src/
├── context/
│   └── DraftRegistryContext.tsx    # Context provider + hook
├── lib/
│   └── draftPersistence.ts         # sessionStorage read/write
├── utils/
│   └── draftValidation.ts          # Validation logic
├── components/
│   └── drafts/
│       ├── DraftReviewQueue.tsx    # List of draft cards
│       ├── DraftCard.tsx           # Single draft summary
│       └── DraftAssignmentPicker.tsx # Curator-style picker for drafts
```

---

## 9. Migration & Rollback

### 9.1 Feature Flag

```typescript
const FEATURE_FLAGS = {
  USE_DRAFT_REGISTRY: false,  // Toggle in development
}

// In PostEditor:
if (FEATURE_FLAGS.USE_DRAFT_REGISTRY && props.useDraftId) {
  // Use registry
} else {
  // Use existing local state + sessionStorage
}
```

### 9.2 Rollback Plan

If issues arise:
1. Set `USE_DRAFT_REGISTRY: false`
2. Users fall back to existing single-draft behavior
3. Existing `entry_editor_draft` key still works
4. Registry data in `entry_draft_registry` ignored but preserved

---

## 10. Summary

| Aspect | Decision |
|--------|----------|
| **Storage** | sessionStorage with multi-draft key |
| **State shape** | Extends current DraftState with metadata |
| **Integration** | Phased, opt-in via prop |
| **Curator** | Staged assignments for unsaved; RPCs for saved |
| **Limits** | 10 drafts, 30min TTL, size guards |
| **Backward compat** | Full – existing flows unchanged until Phase 3+ |

This design enables multi-entry import review queues while preserving the simplicity of the current single-entry editing experience.

---

*Design Spec v1.0 – January 2026*
*Based on PostEditor.tsx, PostsPage.jsx, and existing sessionStorage draft pattern.*
