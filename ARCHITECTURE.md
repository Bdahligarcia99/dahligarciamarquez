# Architecture Report: dahligarciamarquez

A personal storytelling/blogging web application with admin dashboard and UI builder.

---

## Frontend

**Stack:** React 18 + Vite + Tailwind CSS + TypeScript (partial)

### Entry Point
- `client/src/main.jsx` → `App.jsx`
- React Router v6 for client-side routing

### Provider Hierarchy
```
Router
└── ConditionalAuthProvider (Supabase auth wrapper)
    └── NavbarProvider (navbar state/settings)
        └── ComingSoonGuard (feature flag gate)
            └── CompressionProvider (image compression settings)
                └── AppShell (layout + routes)
```

### Route Structure
| Route | Component | Access |
|-------|-----------|--------|
| `/` | `Home` | Public |
| `/blog` | `BlogList` | Public |
| `/blog/:slug` | `BlogPost` | Public |
| `/stories` | `StoriesPage` | Public |
| `/about`, `/contact` | Static pages | Public |
| `/auth/*` | SignIn, SignUp, ForgotPassword | Public |
| `/profile/settings` | ProfileSettings | Authenticated |
| `/dashboard/*` | Dashboard (nested routes) | Admin only |
| `/dashboard/card-builder/:pageId` | CardBuilderPage | Admin only |

### Key Directories
```
client/src/
├── components/       # Reusable UI (Navbar, Footer, editor/*)
├── features/         # Feature modules (dashboard/*, posts/*, admin/*)
├── pages/            # Route-level page components
├── hooks/            # useAuth, useCompressionSettings
├── context/          # NavbarContext
├── lib/              # API clients, Supabase config, utilities
└── utils/            # Image handling, formatting helpers
```

### State Management
- **Auth:** React Context (`useAuth`) wrapping Supabase client
- **Navbar:** React Context for dynamic nav items, persisted to Supabase `system_settings`
- **Compression:** React Context with localStorage + Supabase sync
- **Local state:** `useState` per component; no Redux/Zustand

### API Communication
- `lib/apiBase.ts` - URL builder, defaults to same-origin
- `lib/api.js` / `lib/adminAuth.js` - Fetch wrappers with JWT auth
- All admin API calls include `Authorization: Bearer <supabase_jwt>`
- Vite proxy in dev: `/api` → `http://localhost:8080`

---

## Backend/API

**Stack:** Node.js + Express + TypeScript (ESM)

### Entry Point
`server/server.js` - Express app initialization

### Middleware Chain
1. Request logging
2. CORS (dev origins hardcoded, prod from `ALLOWED_ORIGINS`)
3. `express.json()` / `express.urlencoded()`
4. Static file serving (`/uploads`)

### Route Mounting
```javascript
app.use('/api/storage', storageRoutes)     // File uploads, storage health
app.use('/api/images', imagesRoutes)       // Image management, deduplication
app.use('/api/admin', adminRoutes)         // Coming-soon toggle, admin health
app.use('/api/admin', userManagementRoutes)// User role management
app.use('/api/compression', compressionRoutes) // Compression settings
```

### Inline Routes (server.js)
- `GET /api/posts` - List posts (paginated, searchable)
- `GET /api/posts/:id` - Single post
- `POST /api/posts` - Create post
- `PATCH /api/posts/:id` - Update post
- `DELETE /api/posts/:id` - Delete post

All post routes require `requireSupabaseAdmin` middleware.

### Authentication Middleware
`src/middleware/requireSupabaseAdmin.ts`:
1. Extract Bearer token from `Authorization` header
2. Verify JWT with Supabase Admin client (`auth.getUser(token)`)
3. Fetch `profiles` table to check `role = 'admin'`
4. Attach `req.user = { id, email, role }` and call `next()`

### Key Server Directories
```
server/
├── routes/           # Express routers (admin, images, storage, etc.)
├── src/
│   ├── middleware/   # Auth, multipart, coming-soon
│   ├── services/     # compressionService, imageTrackingService
│   ├── storage/      # Pluggable driver (local vs Supabase)
│   └── utils/        # Validation, slugify, sanitizeHtml
├── auth/             # supabaseAdmin.ts (service role client)
├── migrations/       # SQL migration files
└── db.js             # Legacy pg Pool wrapper
```

### Database Connections
**Two connection patterns exist:**
1. `db.js` / `src/db.ts` - Direct PostgreSQL via `pg` Pool (`DATABASE_URL`)
2. `src/supabase.ts` / `auth/supabaseAdmin.ts` - Supabase JS client (`SUPABASE_URL` + keys)

Most new features use the Supabase client; legacy post queries use `db.js`.

---

## Data Layer

**Primary Database:** PostgreSQL via Supabase

### Core Tables
| Table | Purpose |
|-------|---------|
| `profiles` | Extends `auth.users` (id FK), stores `display_name`, `avatar_url`, `role` |
| `posts` | Blog entries with `content_rich` (JSONB), `content_text`, `status`, `slug` |
| `labels` | Post categories/tags |
| `post_labels` | M:N join table |
| `images` | Uploaded file metadata (path, size, dimensions) |
| `post_images` | Tracks which images are used in which posts |

### Extended Tables (UI/Settings)
| Table | Purpose |
|-------|---------|
| `system_settings` | Singleton row for `navbar_items` JSONB, global flags |
| `page_layouts` | Per-page card layouts (JSONB `cards`), wallpaper settings |
| `page_layout_slots` | Multiple saved layout variants per page |
| `compression_settings` | Default image compression parameters |
| `image_reconciliation_log` | Audit trail for image sync operations |

### Row-Level Security (RLS)
All tables have RLS enabled:
- Public tables (`posts` with `status='published'`) - `SELECT` for `anon`
- User tables - `SELECT/INSERT/UPDATE/DELETE` scoped by `auth.uid()`
- Admin tables - Full access for `profiles.role = 'admin'`

### Supabase Features Used
- **Auth:** Email/password, JWT sessions
- **Storage:** `public-images` bucket for uploads
- **RPC Functions:** `get_page_wallpaper`, `set_page_wallpaper`, `get_storage_usage`, etc.
- **Realtime:** Not currently used

### Data Flow Example (Create Post)
```
Client                    Server                      Supabase
──────                    ──────                      ────────
POST /api/posts     →     requireSupabaseAdmin()  →   auth.getUser(jwt)
  + JWT                   validate body               profiles.select(role)
  + body                  INSERT INTO posts     →     posts table
                          ← return row               ← row data
← 201 JSON
```

---

## Environment/Infrastructure

### Development
- **Client:** Vite dev server on `:5173`, proxies `/api` to `:8080`
- **Server:** Node on `:8080`, connects to Supabase cloud
- **Script:** `start-dev.sh` launches both + doctor terminal + browser

### Environment Variables
**Client (`.env`):**
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_BASE_URL=       # Empty for same-origin
```

**Server (`.env`):**
```
DATABASE_URL=postgresql://...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Admin operations
PORT=8080
NODE_ENV=development
```

### Production Deployment
**Render.com** (`render.yaml`):
- `storytelling-api` - Node web service
- `storytelling-frontend` - Static site (Vite build)
- `storytelling-db` - PostgreSQL (though Supabase is primary)

**Vercel** (`client/vercel.json`):
- Static hosting for client build
- API rewrites to Render backend

### Storage Driver
Configurable via environment:
- **Local:** Files in `server/uploads/`, served as `/uploads/*`
- **Supabase:** Files in `public-images` bucket, public URLs via Supabase CDN

Selected at boot in `src/storage/index.ts` based on env vars.

### Build Pipeline
```
Client:  npm run build → Vite → dist/
Server:  TypeScript compiled at runtime (tsx/ts-node)
```

No containerization; direct Node execution.

---

## Key Integration Points

### Frontend ↔ Backend
- All API calls use Supabase JWT in `Authorization` header
- Server validates JWT with Supabase Admin client
- Profile/role data fetched from `profiles` table

### Backend ↔ Supabase
- **supabaseAdmin** (service role) - Full DB access, user verification
- **supabase** (anon key) - Standard client operations
- Direct `pg` queries for legacy post operations

### Supabase Auth Flow
1. Client calls `supabase.auth.signInWithPassword()`
2. Supabase returns JWT + refresh token
3. Client stores in localStorage (`sb-xxx-auth-token`)
4. Client sends JWT on all `/api/*` requests
5. Server verifies via `supabase.auth.getUser(token)`

---

## File Size Notes
- `CardBuilderPage.jsx` - ~4600 lines (UI builder with tools, grid, cards)
- `server.js` - ~525 lines (main Express app)
- `useAuth.tsx` - ~350 lines (auth context + profile fetching)
