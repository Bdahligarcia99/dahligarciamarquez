# Storage Routes Wiring - Implementation Diff

## Changes Made to `server/server.js`

### 1. Added Route Imports
```diff
 // Import admin router
 import adminRoutes from './routes/admin.js'
+import imagesRoutes from './routes/images.js'
+import storageRoutes from './routes/storage.js'
+
+// Import storage info for boot logging
+import { storageInfo } from './src/storage/index.js'
```

### 2. Mounted API Routes
```diff
-// Mount admin router
-app.use('/api/admin', adminRoutes)
-console.log('Mounted admin: /api/admin/health')
+// Mount API routes
+app.use('/api/storage', storageRoutes)
+app.use('/api/images', imagesRoutes)
+app.use('/api/admin', adminRoutes)
+console.log('Mounted storage: /api/storage/health')
+console.log('Mounted images: /api/images/uploads/image')
+console.log('Mounted admin: /api/admin/health')
```

### 3. Added Storage Driver Boot Logging
```diff
     app.listen(PORT, () => {
       console.log(`🚀 Server running on port ${PORT}`)
       console.log(`🏥 Health check: http://localhost:${PORT}/healthz`)
       console.log(`📡 Test endpoint: http://localhost:${PORT}/api/hello`)
       console.log(`🗄️ Database test: http://localhost:${PORT}/api/db/now`)
       console.log(`📝 Posts API: http://localhost:${PORT}/api/posts`)
       
+      // Log storage driver
+      if (storageInfo.driver === 'supabase') {
+        const bucketName = process.env.SUPABASE_BUCKET || 'public-images'
+        console.log(`🗄️ Storage driver: supabase (${bucketName})`)
+      } else {
+        console.log(`🗄️ Storage driver: local`)
+      }
+      
       if (process.env.NODE_ENV !== 'production') {
         const printable = ALLOWED_ORIGINS.map(o => o instanceof RegExp ? o.toString() : o).join(', ') || '(none)';
         console.log(`🌐 CORS allowed origins: ${printable}`);
       }
     })
```

### 4. Updated Debug Routes Endpoint
```diff
-    // Add known admin routes manually since router inspection is complex
+    // Add known routes manually since router inspection is complex
+    routes.push('GET /api/storage/health')
+    routes.push('POST /api/images/uploads/image')
     routes.push('GET /api/admin/health')
     routes.push('GET /api/admin/coming-soon')
     routes.push('PUT /api/admin/coming-soon')
```

## Route Order & Placement

The routes are mounted in the correct order:
1. **CORS setup** (already existing)
2. **Body parsing middleware** (already existing) 
3. **API routes mounting**:
   - `/api/storage` → `storageRoutes`
   - `/api/images` → `imagesRoutes` 
   - `/api/admin` → `adminRoutes`
4. **Debug endpoints** (`/__debug/routes`)
5. **Static file serving** (`/uploads`)
6. **SPA fallback** (catch-all handler)

This ensures API routes are processed before any catch-all handlers.

## Existing Route Files

### `server/routes/storage.ts` ✅
- **GET /api/storage/health** - Returns `{ ok, driver, details? }`
- Uses `storage.health()` and `storageInfo.driver`
- Proper error handling with 503 status on failure

### `server/routes/images.ts` ✅  
- **POST /api/images/uploads/image** - Admin-protected upload endpoint
- Uses new storage driver abstraction (`storage.putImage()`)
- Returns proper error codes: 503, 413, 415
- Maintains existing admin authentication

## Boot Logging Output

When server starts, it will now show:

**Local Storage:**
```
🗄️ Storage driver: local
```

**Supabase Storage:**
```
🗄️ Storage driver: supabase (public-images)
```

No secrets are logged - bucket name is safe to display.

## Debug Routes Output

GET `/__debug/routes` now includes:
```json
[
  "GET /api/storage/health",
  "POST /api/images/uploads/image", 
  "GET /api/admin/health",
  "..."
]
```

## Route Accessibility

- ✅ **GET /api/storage/health** - Public endpoint, returns storage status
- ✅ **POST /api/images/uploads/image** - Admin-protected, requires `X-Admin-Token`
- ✅ Both routes appear in `/__debug/routes` for development verification
- ✅ No catch-all or static handlers shadow these routes (mounted before them)

The storage routes are now fully wired and accessible via the main server entry point.
