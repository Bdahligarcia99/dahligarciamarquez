# Commit Plan for Posts & Images API Enhancement

## Commit 1: feat(server): enforce admin token on write ops; unify errors

**Files to commit:**
- `server/src/middleware/requireAdminOrUser.ts` (NEW)
- `server/src/utils/responses.ts` (NEW)
- `server/routes/posts.ts` (MODIFIED - middleware + error responses)
- `server/routes/images.ts` (MODIFIED - middleware + error responses)

**Changes:**
- Added hybrid admin token/user JWT middleware
- Centralized error response format `{ error: string, details?: any }`
- Applied admin token requirement to all write operations
- Standardized HTTP status codes across all endpoints

## Commit 2: feat(posts): slug + content_text generation with validation

**Files to commit:**
- `server/src/utils/slugify.ts` (NEW)
- `server/src/utils/contentExtractor.ts` (NEW)
- `server/src/utils/validation.ts` (NEW)
- `server/routes/posts.ts` (MODIFIED - slug/validation logic)

**Changes:**
- Auto-slug generation with collision avoidance and reserved word protection
- Content text extraction from rich JSON for search indexing
- Comprehensive validation (title ≤120 chars, excerpt ≤500 chars)
- 422 validation responses with field-specific error maps

## Commit 3: feat(images): add alt_text/title; complete GET/PUT/:id; upload size warning

**Files to commit:**
- `server/migrations/0002_add_image_metadata.sql` (NEW)
- `server/src/utils/imageValidation.ts` (NEW)
- `server/src/utils/fileUpload.ts` (NEW)
- `server/src/middleware/multipart.ts` (NEW)
- `server/routes/images.ts` (MODIFIED - new endpoints + validation)

**Changes:**
- Added alt_text (required) and title (optional ≤120 chars) columns
- Implemented GET /api/images/:id and PUT /api/images/:id endpoints
- Added POST /api/images with file upload, MIME validation, size limits
- Warning responses for 2MB-8MB files, hard block >8MB
- 409 conflict protection on delete when referenced by posts

## Commit 4: test(server): add minimal tests for posts/images

**Files to commit:**
- `server/test-posts-images.js` (NEW)

**Changes:**
- Tests for POST /api/posts (slug generation, validation)
- Tests for PUT /api/posts/:id (regenerateSlug, content_text refresh)
- Tests for POST /api/images (type/size checks, alt_text validation)
- Tests for PUT /api/images/:id (alt_text updates)

---

## Summary of Implementation

### ✅ Admin Token Enforcement
- All write operations (POST/PUT/DELETE) now require admin token OR user JWT
- Hybrid middleware supports both authentication methods
- Maintains backward compatibility with existing Supabase JWT system

### ✅ Unified Response Format
- **Lists**: `{ items: [...], page, limit, total }`
- **Single**: `{ post: {...} }` or `{ image: {...} }`
- **Errors**: `{ error: string, details?: any }`
- **Validation**: `{ error: "Validation failed", fields: {...} }`

### ✅ Posts Enhancement
- Auto-slug generation with deduplication (my-post → my-post-2)
- Reserved word protection (admin, new, edit, etc.)
- Content text extraction for search indexing
- Length constraints with 422 validation responses

### ✅ Images Complete CRUD
- GET /api/images/:id - Single image with metadata
- PUT /api/images/:id - Update alt_text/title with validation  
- POST /api/images - Full file upload with size warnings
- DELETE with 409 conflict protection when referenced

### ✅ File Upload Features
- MIME validation (jpg/png/webp/gif only)
- Size limits: Warning at 2MB, hard block at 8MB
- Filename sanitization and collision avoidance
- Supabase Storage integration with cleanup on failures

### ✅ Test Coverage
- Slug generation and validation edge cases
- Content text extraction verification
- File upload validation (size, type, alt_text)
- Admin middleware protection verification
