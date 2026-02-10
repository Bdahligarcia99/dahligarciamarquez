# Entry Editor & Entry Curator Architecture Report

## 1. Entry Editor

### 1.1 Location in Codebase

| Item | Path |
|------|------|
| Component | `client/src/components/posts/PostEditor.tsx` |
| Route mount | `Dashboard.jsx` → `/dashboard/posts/new` and `/dashboard/posts/:id/edit` |
| Lazy-loaded | Yes, via `lazySafe()` wrapper |

### 1.2 How Entry Data is Loaded

**Routing:**
- `useParams()` extracts `id` from URL as `routePostId`
- If `postId` is present → edit mode; if absent → create mode

**Initial State Resolution (ordered priority):**
1. **Session Storage Draft** – `getInitialDraft(postId)` runs *before* `useState` hooks initialize, checking `sessionStorage` key `entry_editor_draft`
   - Only restores if `postId` matches stored draft's `postId`
   - Expires after 30 minutes
2. **Server Fetch** – `fetchPost()` called in `useEffect` if `postId` exists and no draft was restored
3. **Empty Defaults** – Used for new entries

### 1.3 Fields Managed

| Field | State Hook | Storage |
|-------|------------|---------|
| `title` | `useState` | Local |
| `content` | `useState<{ json, html }>` | Local (TipTap JSON + HTML) |
| `excerpt` | `useState` | Local |
| `coverImageUrl` | `useState` | Local |
| `coverImageAlt` | `useState` | Local |
| `status` | `useState<'draft'\|'published'\|'archived'>` | Local |
| `selectedLabels` | `useState<string[]>` | Local (legacy labels) |
| `selectedJournals` | `useState<string[]>` | Local (Curator journal IDs) |
| `selectedCollections` | `useState<string[]>` | Local (Curator collection IDs) |

**No external state store** (no Redux, Zustand, Context). All state is component-local via `useState`.

### 1.4 How Saving Works

**Create (no `postId`):**
1. Validate required fields (title, cover alt text if cover present)
2. Validate all image URLs
3. POST to `/api/posts` via `supabaseAdminPost()`
4. After success: call Supabase RPCs `add_post_to_journal` and `add_post_to_collection` for each selected assignment
5. Clear draft from sessionStorage
6. Navigate to `/dashboard/posts`

**Update (has `postId`):**
1. Same validation
2. PATCH to `/api/posts/${postId}` via `supabaseAdminPatch()`
3. Clear draft, clear "assignments changed" indicator
4. Show success toast; stay on page

**Key Observation:** Journal/Collection assignments for *new* posts are written client-side after the main POST succeeds. For *existing* posts, assignments are managed separately via the Curator or inline UI (not part of the PATCH payload).

### 1.5 Single Entry Assumption

The Editor **assumes one active entry at a time**:
- Route structure (`/posts/:id/edit`) enforces single entry context
- All state hooks are singular, not arrays of drafts
- `sessionStorage` draft key is global (only one draft preserved)

---

## 2. Entry Curator

### 2.1 Location in Codebase

| Item | Path |
|------|------|
| Component | `client/src/features/dashboard/PostsPage.jsx` (Curator is a tab within this component) |
| Route | `/dashboard/posts` |
| Tab toggle | `activeTab === 'curator'` |

### 2.2 Primary Purpose

The Curator provides:
1. **Hierarchical organization view** – Journals → Collections → Entries
2. **Batch assignment** – Assignment Queue for assigning multiple entries to journals/collections at once
3. **Entry status management** – Change status (draft, published, archived, private, system) from unassigned entries modal
4. **Reordering** – Drag entries within collections (positional)

### 2.3 Data Mutation vs Views

The Curator **mutates entry data**:
- Adds/removes entries from journals via `add_post_to_journal`, `remove_post_from_journal` RPCs
- Adds/removes entries from collections via `add_post_to_collection`, `remove_post_from_collection` RPCs
- Changes entry status via PATCH to `/api/posts/:id`
- Reorders entries via `reorder_collection_entries` RPC

### 2.4 Data Loading

**On mount:** `fetchPosts()` → fetches all posts via `/api/posts/admin`
**Curator data:** `fetchCuratorData()` → calls `fetchJournals()` which uses `get_user_journals` RPC
**On journal select:** `fetchCollections(journalId)` → `get_journal_collections` RPC
**On collection select:** `fetchCollectionEntries(collectionId)` → `get_collection_entries` RPC

All data is fetched independently; no shared store with Editor.

---

## 3. Navigation & Relationship

### 3.1 Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/dashboard/posts` | `PostsPage` | Entries list + Curator tabs |
| `/dashboard/posts/new` | `PostEditor` | Create new entry |
| `/dashboard/posts/:id/edit` | `PostEditor` | Edit existing entry |

### 3.2 Parent Layout

Both Editor and Curator share `Dashboard.jsx` as parent layout. They are **sibling routes**, not nested.

### 3.3 Editor → Curator Navigation

**Trigger:** "Curator" button in Editor calls `navigateToCurator()`

**Mechanism:**
1. `saveDraftState()` → stores current editor state to sessionStorage
2. `navigate('/dashboard/posts', { state: { fromEditor: true, returnToPostId, entryIsSaved, entryTitle, entryStatus, entryCoverUrl, currentJournals, currentCollections } })`

**Curator response:**
- Detects `location.state?.fromEditor`
- Sets `cameFromEditor = true`
- Stores `returnToPostId` and `editorEntryInfo`
- If entry is saved → adds to Assignment Queue automatically
- If unsaved → shows warning banner

### 3.4 Curator → Editor Navigation

**Trigger:** "Back to Editor" button

**Mechanism:**
```js
navigate(`/dashboard/posts/${returnToPostId}/edit`, {
  state: { fromCurator: true, assignmentsChanged: editorEntryAssignmentsChanged }
})
```

**Editor response:**
- Detects `location.state?.fromCurator`
- If `assignmentsChanged` → refreshes assignments from DB, shows indicator
- Restores draft from sessionStorage (title, content, etc.)

### 3.5 State Sharing Summary

| What | Shared? | Mechanism |
|------|---------|-----------|
| Draft content | Temp | sessionStorage (expires 30min) |
| Post ID | Yes | Route params + location state |
| Entry metadata | One-way | location state on navigation |
| Assignment changes | Flag only | location state boolean |
| Actual data | No | Each fetches independently from DB |

---

## 4. State & Coupling Analysis

### 4.1 Isolated State

| Component | State Scope |
|-----------|-------------|
| PostEditor | Component-local useState + sessionStorage draft |
| PostsPage (Curator) | Component-local useState |

No shared React Context, store, or global state exists between them.

### 4.2 Feasibility: Sibling Views Over Same Draft

**Current barriers:**
1. **No shared state container** – Each component manages its own state
2. **sessionStorage is single-key** – Only one draft can be preserved
3. **Route-based rendering** – React Router unmounts components on navigation
4. **No in-memory draft registry** – No mechanism to hold multiple unsaved entries

**Feasibility verdict:** Rendering Editor and Curator as sibling views over the *same in-memory draft* would require:
- Lifting state to shared context/store
- Or keeping both components mounted (portal/modal approach)

### 4.3 "One Entry at a Time" Enforcement

| Constraint | Location |
|------------|----------|
| Route structure | `/posts/:id/edit` – single ID param |
| sessionStorage key | Single global key `entry_editor_draft` |
| PostEditor state | All singular, no draft array |
| Curator Assignment Queue | Can hold multiple entries, but doesn't create/edit them |

---

## 5. Extension Readiness

### 5.1 Safe Extension Points

| Feature | Approach | Risk Level |
|---------|----------|------------|
| **Editor ↔ Curator toggle without navigation** | Render both in same parent, toggle visibility; lift shared state to parent or context | Medium – requires state lift |
| **In-modal rendering of Editor** | PostEditor already accepts props (`onSave`, `onCancel`); can be rendered in modal | Low – designed for this |
| **In-modal rendering of Curator** | Curator is embedded in PostsPage; would need extraction to standalone component | Medium – extraction needed |
| **Multiple in-memory drafts** | Replace sessionStorage with Map/object keyed by temp ID; requires draft registry context | Medium – architectural change |
| **Per-entry save actions** | Already supported – save is per-entry via `handleSave` | Low – exists |
| **Batch save** | Would require iterating over draft registry; no current support | Medium – new feature |

### 5.2 Risky Areas / Constraints

| Constraint | Why It Matters |
|------------|----------------|
| **sessionStorage single-key draft** | Adding multi-draft support requires replacing this mechanism |
| **Route-based component mounting** | Navigating unmounts Editor; state must be externalized to survive |
| **Curator embedded in PostsPage** | Extracting Curator to reusable component requires refactoring ~1500 lines |
| **Assignment writes are immediate** | Curator RPCs write to DB instantly; no "stage and save together" pattern |
| **No optimistic draft tracking** | If browser crashes, only sessionStorage draft survives (if recent) |

---

## 6. Summary & Recommendations

### 6.1 Architecture Summary

- **Entry Editor** (`PostEditor.tsx`): Standalone component with fully local state. Loads from route param or sessionStorage draft. Saves via REST API. Supports create and edit modes.

- **Entry Curator** (tab in `PostsPage.jsx`): List + organization view. Fetches all posts on mount. Mutates assignments directly via Supabase RPCs. No direct content editing.

- **Relationship**: Sibling routes under `/dashboard/posts/*`. State handoff via sessionStorage + React Router location state. No shared runtime store.

### 6.2 Recommendations for Future Features

| Feature | Recommended Approach |
|---------|---------------------|
| **Multi-entry import** | Create draft registry context (`Map<tempId, DraftState>`). Import populates registry. Render list of draft cards. Each card can open Editor in modal. |
| **Batch save** | Iterate draft registry, call existing save logic per entry. Show progress indicator. |
| **Modal review queue** | Extract Curator's Assignment Queue UI to standalone component. Render in modal with draft registry entries. |
| **Editor/Curator side-by-side** | Lift shared entry state to parent context. Render both components; toggle visibility or use split pane. |
| **Unsaved changes warning** | Add `isDirty` flag to draft state. Check before navigation/close. |

### 6.3 Minimal Refactor Path

For features requiring multiple drafts:
1. Create `DraftRegistryContext` with `Map<string, DraftState>`
2. Modify `PostEditor` to read/write from context instead of local state (behind feature flag)
3. Keep sessionStorage as fallback for single-entry flows
4. Curator can read from registry to populate Assignment Queue with unsaved entries

This preserves backward compatibility while enabling multi-draft workflows.

---

*Report generated from static code analysis. No runtime testing performed.*
*Generated: January 2026*
