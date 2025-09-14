import { config } from './src/config.ts'
import express from 'express'
import cors from 'cors'
import { initDb, q, closeDb } from './db.js'
import { requireAdmin } from './src/middleware/requireAdmin.ts'
import { query } from './src/db.ts'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Import admin router
import adminRoutes from './routes/admin.ts'
import imagesRoutes from './routes/images.ts'
import storageRoutes from './routes/storage.ts'
import compressionRoutes from './routes/compression.ts'

// Import storage info for boot logging
import { storageInfo } from './src/storage/index.ts'
import { isSupabaseAdminConfigured } from './auth/supabaseAdmin.ts'

// Get package.json for version endpoint
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const packageJson = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'))

const app = express()
const PORT = config.server.port

// Top-level CORS origins configuration
const DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const PROD_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const ALLOWED_ORIGINS = process.env.NODE_ENV === 'production' ? PROD_ORIGINS : DEV_ORIGINS;

// Request logging middleware (before CORS/body-parsing)
app.use((req, res, next) => {
  // Skip logging for common routes that would clutter logs
  if (['/healthz', '/favicon.ico'].includes(req.path)) return next();
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Dev-only debug header middleware
if (config.server.nodeEnv === 'development') {
  app.use((req, res, next) => {
    const debugUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    res.set('X-Debug-Server-Url', debugUrl);
    next();
  });
}

// CORS configuration
const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // allow curl / same-origin tools
    const ok = ALLOWED_ORIGINS.some(o => o instanceof RegExp ? o.test(origin) : o === origin);
    return cb(ok ? null : new Error('Not allowed by CORS'), ok);
  },
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Authorization','X-Admin-Token','Content-Type','Accept','X-Requested-With'],
  exposedHeaders: ['X-Debug-Server-Url'],
  optionsSuccessStatus: 204,
  credentials: false,
};

// Middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Dev-only OPTIONS logger
if (config.server.nodeEnv === 'development') {
  app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
      console.log(`[PREFLIGHT] ${req.method} ${req.path} from ${req.get('origin') || 'unknown'}`);
    }
    next();
  });
}

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Static file serving for uploads (development)
app.use('/uploads', express.static(join(__dirname, 'uploads')))

// Root route
app.get('/', (req, res) => {
  res.json({
    ok: true,
    service: "api",
    endpoints: ["/healthz", "/api/db/health", "/api/version", "/api/hello", "/api/db/now", "/api/posts"]
  })
})

// Health check endpoint
app.get('/healthz', (req, res) => {
  res.json({ 
    ok: true, 
    uptime: process.uptime() 
  })
})

// Database health check endpoint
app.get('/api/db/health', async (req, res) => {
  try {
    await query('SELECT 1 AS ok')
    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      error: error.message 
    })
  }
})

// Version endpoint
app.get('/api/version', (req, res) => {
  res.json({ version: packageJson.version })
})

// Test route
app.get('/api/hello', (req, res) => {
  res.json({ 
    message: "Hello from Render Express API!" 
  })
})

// Database smoke test
app.get('/api/db/now', async (req, res, next) => {
  try {
    const result = await q('SELECT NOW()')
    res.json({ now: result.rows[0].now })
  } catch (error) {
    next(error)
  }
})

// Mount API routes
app.use('/api/storage', storageRoutes)
app.use('/api/images', imagesRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/compression', compressionRoutes)
console.log('Mounted storage: /api/storage/health')
console.log('Mounted images: /api/images/uploads/image')
console.log('Mounted admin: /api/admin/health')
console.log('Mounted compression: /api/compression/settings')

// Debug endpoints (development only)
if (config.server.nodeEnv === 'development') {
  // Route list endpoint for verification
  app.get('/__debug/routes', (req, res) => {
    const routes = []
    
    // Extract routes from Express app
    function extractRoutes(stack, basePath = '') {
      stack.forEach(layer => {
        if (layer.route) {
          // Regular route
          const methods = Object.keys(layer.route.methods)
          methods.forEach(method => {
            routes.push(`${method.toUpperCase()} ${basePath}${layer.route.path}`)
          })
        } else if (layer.name === 'router') {
          // Router middleware
          const routerPath = layer.regexp.source
            .replace(/\\\//g, '/')
            .replace(/\$.*/, '')
            .replace(/\^/, '')
            .replace(/\?\(\?\=/, '')
          
          if (layer.handle && layer.handle.stack) {
            extractRoutes(layer.handle.stack, routerPath)
          }
        }
      })
    }
    
    extractRoutes(app._router.stack)
    
    // Add known routes manually since router inspection is complex
    routes.push('GET /api/storage/health')
    routes.push('POST /api/images/uploads/image')
    routes.push('GET /api/admin/health')
    routes.push('GET /api/admin/coming-soon')
    routes.push('PUT /api/admin/coming-soon')
    
    res.json(routes.sort())
  })

  // Database diagnostics endpoint
  app.get('/__debug/db', async (req, res) => {
    try {
      let provider = 'unknown'
      let hostMasked = 'unknown'
      let dbName = 'unknown'
      let counts = {}

      // Determine provider and extract connection info
      const dbUrl = process.env.DATABASE_URL || ''
      if (dbUrl.includes('supabase')) {
        provider = 'supabase'
      } else if (dbUrl.includes('postgres') || dbUrl.includes('postgresql')) {
        provider = 'postgres'
      }

      // Extract and mask host
      try {
        const url = new URL(dbUrl)
        hostMasked = url.hostname.length > 8 
          ? url.hostname.substring(0, 8) + '****' + url.hostname.substring(url.hostname.length - 4)
          : url.hostname.substring(0, 6) + '****'
        dbName = url.pathname.substring(1) || 'unknown' // Remove leading slash
      } catch (e) {
        // Invalid URL, keep defaults
      }

      // Get counts if requested
      if (req.query.counts === '1') {
        try {
          const result = await query('SELECT COUNT(*) as count FROM posts')
          counts.posts = parseInt(result.rows[0].count, 10)
        } catch (e) {
          counts.posts = 'error'
        }
      }

      res.json({
        provider,
        hostMasked,
        dbName,
        counts
      })
    } catch (error) {
      res.status(500).json({ error: 'Failed to get DB diagnostics' })
    }
  })

  // Auth troubleshooting endpoint
  app.get('/api/debug/auth', (req, res) => {
    const hasTokenConfigured = Boolean(process.env.SERVER_ADMIN_TOKEN)
    
    let providedAuthHeader = null
    const authHeader = req.get('authorization') || req.get('Authorization')
    const xAdminToken = req.get('x-admin-token') || req.get('X-Admin-Token')
    
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      providedAuthHeader = 'authorization'
    } else if (xAdminToken) {
      providedAuthHeader = 'x-admin-token'
    }
    
    res.json({
      hasTokenConfigured,
      providedAuthHeader
    })
  })
}

// Get all posts with filtering and pagination (admin only)
app.get('/api/posts', requireAdmin, async (req, res, next) => {
  try {
    const { q: searchQuery = '', status, page = '1', limit = '20' } = req.query
    const p = Math.max(1, parseInt(page))
    const l = Math.min(100, Math.max(1, parseInt(limit)))
    const offset = (p - 1) * l
    
    const params = []
    const whereConditions = []
    
    // Text search on title OR content_text (case-insensitive)
    if (searchQuery) {
      params.push(`%${searchQuery}%`)
      whereConditions.push(`(title ILIKE $${params.length} OR content_text ILIKE $${params.length})`)
    }
    
    // Status filter
    if (status) {
      params.push(status)
      whereConditions.push(`status = $${params.length}`)
    }
    
    const whereClause = whereConditions.length ? `WHERE ${whereConditions.join(' AND ')}` : ''
    
    // Get paginated items
    const itemsQuery = `SELECT id, title, content_text, status, created_at, updated_at FROM posts ${whereClause} ORDER BY created_at DESC LIMIT ${l} OFFSET ${offset}`
    const { rows: items } = await q(itemsQuery, params)
    
    // Get total count for same filters
    const countQuery = `SELECT COUNT(*)::int as total FROM posts ${whereClause}`
    const { rows: [{ total }] } = await q(countQuery, params)
    
    res.json({ items, page: p, limit: l, total })
  } catch (error) {
    next(error)
  }
})

// Get single post by ID (admin only)
app.get('/api/posts/:id', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params
    const result = await q('SELECT id, title, content_text, content_rich, content_html, excerpt, cover_image_url, status, created_at, updated_at FROM posts WHERE id = $1', [id])
    
    if (result.rows.length === 0) {
      const err = new Error('Post not found')
      err.status = 404
      return next(err)
    }
    
    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
})

// Create new post (admin only)
app.post('/api/posts', requireAdmin, async (req, res, next) => {
  try {
    const { title, content_text, content_rich, content_html, excerpt, cover_image_url, status = 'published', author_id } = req.body
    
    // Use content_text for post content, but also accept rich content
    const contentText = content_text
    
    // TODO: Temporary fix - use default test author if author_id is missing
    // This should be removed once client-side author_id support is added
    const authorId = author_id || '14aefc2f-74df-4611-accf-8e36f1edbae7' // Supabase test user UUID
    
    // Validation
    if (!title || !contentText) {
      const err = new Error('Title and content are required')
      err.status = 400
      return next(err)
    }
    
    if (typeof title !== 'string' || typeof contentText !== 'string') {
      const err = new Error('Title and content must be strings')
      err.status = 400
      return next(err)
    }
    
    if (status && !['draft', 'published'].includes(status)) {
      const err = new Error('Status must be "draft" or "published"')
      err.status = 400
      return next(err)
    }
    
    const result = await q(
      'INSERT INTO posts (title, content_text, content_rich, content_html, excerpt, cover_image_url, status, author_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, title, content_text, content_rich, content_html, excerpt, cover_image_url, status, author_id, created_at, updated_at',
      [title.trim(), contentText?.trim() || null, content_rich || null, content_html || null, excerpt?.trim() || null, cover_image_url?.trim() || null, status, authorId]
    )
    
    res.status(201).json(result.rows[0])
  } catch (error) {
    next(error)
  }
})

// Update post (partial) (admin only)
app.patch('/api/posts/:id', requireAdmin, async (req, res, next) => {
  try {
    const { title, content_text, content_rich, content_html, excerpt, cover_image_url, status } = req.body || {}
    const updates = []
    const params = []
    
    // Build dynamic update query
    if (title !== undefined) {
      params.push(title)
      updates.push(`title = $${params.length}`)
    }
    if (content_text !== undefined) {
      params.push(content_text)
      updates.push(`content_text = $${params.length}`)
    }
    if (content_rich !== undefined) {
      params.push(content_rich)
      updates.push(`content_rich = $${params.length}`)
    }
    if (content_html !== undefined) {
      params.push(content_html)
      updates.push(`content_html = $${params.length}`)
    }
    if (excerpt !== undefined) {
      params.push(excerpt)
      updates.push(`excerpt = $${params.length}`)
    }
    if (cover_image_url !== undefined) {
      params.push(cover_image_url)
      updates.push(`cover_image_url = $${params.length}`)
    }
    if (status !== undefined) {
      if (!['draft', 'published'].includes(status)) {
        const err = new Error('Status must be "draft" or "published"')
        err.status = 400
        return next(err)
      }
      params.push(status)
      updates.push(`status = $${params.length}`)
    }
    
    // Validate at least one field is being updated
    if (!updates.length) {
      const err = new Error('At least one field (title, content_text, content_rich, content_html, excerpt, cover_image_url, or status) must be provided')
      err.status = 400
      return next(err)
    }
    
    // Add the ID parameter
    params.push(req.params.id)
    
    const { rows } = await q(
      `UPDATE posts SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING id, title, content_text, content_rich, content_html, excerpt, cover_image_url, status, created_at, updated_at`,
      params
    )
    
    if (!rows.length) {
      const err = new Error('Post not found')
      err.status = 404
      return next(err)
    }
    
    res.json(rows[0])
  } catch (error) {
    next(error)
  }
})

// Delete post (admin only)
app.delete('/api/posts/:id', requireAdmin, async (req, res, next) => {
  try {
    const { rowCount } = await q('DELETE FROM posts WHERE id = $1', [req.params.id])
    
    if (!rowCount) {
      const err = new Error('Post not found')
      err.status = 404
      return next(err)
    }
    
    res.json({ deleted: true })
  } catch (error) {
    next(error)
  }
})

// 404 handler - convert unmatched routes to a 404 error
app.use((req, res, next) => {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// Central JSON error handler
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const message = status === 500 ? 'Internal Server Error' : (err.message || 'Error');
  
  // Log server errors (5xx) with stack traces, client errors (4xx) as warnings
  if (status >= 500) {
    console.error(err.stack || err);
  } else {
    console.warn(`${req.method} ${req.originalUrl} -> ${status} ${message}`);
  }
  
  res.status(status).json({ error: message });
});

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...')
  await closeDb()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...')
  await closeDb()
  process.exit(0)
})

// Initialize database and start server
async function startServer() {
  try {
    await initDb()
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`)
      console.log(`🏥 Health check: http://localhost:${PORT}/healthz`)
      console.log(`📡 Test endpoint: http://localhost:${PORT}/api/hello`)
      console.log(`🗄️ Database test: http://localhost:${PORT}/api/db/now`)
      console.log(`📝 Posts API: http://localhost:${PORT}/api/posts`)
      
      // Log storage driver
      if (storageInfo.driver === 'supabase') {
        const bucketName = process.env.SUPABASE_BUCKET || 'public-images'
        console.log(`🗄️ Storage driver: supabase (${bucketName})`)
      } else {
        console.log(`🗄️ Storage driver: local`)
      }
      
      // Log Supabase admin configuration status
      console.log(`🔑 Supabase Admin: ${isSupabaseAdminConfigured ? 'configured' : 'not configured'}`)
      
      if (process.env.NODE_ENV !== 'production') {
        const printable = ALLOWED_ORIGINS.map(o => o instanceof RegExp ? o.toString() : o).join(', ') || '(none)';
        console.log(`🌐 CORS allowed origins: ${printable}`);
      }
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()