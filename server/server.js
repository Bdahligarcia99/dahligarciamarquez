import { config } from './src/config.ts'
import express from 'express'
import cors from 'cors'
import { initDb, q, closeDb } from './db.js'
import { requireAdmin } from './src/middleware/requireAdmin.js'
import { query } from './src/db.js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Get package.json for version endpoint
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const packageJson = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'))

const app = express()
const PORT = config.server.port

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

// Environment-driven CORS configuration with wildcard support
const toMatcher = (s) => {
  const v = s.trim();
  if (!v) return null;
  if (v.startsWith('*.')) {
    // turn "*.foo.com" into /\.foo\.com$/ regex
    const tail = v.slice(1).replace(/\./g, '\\.');
    return new RegExp(`${tail}$`);
  }
  return v; // exact string match
};

const defaults = [
  'https://dahligarciamarquez.com',
  '*.vercel.app',
  'http://localhost:5173'
];

const raw = process.env.ALLOWED_ORIGINS || defaults.join(',');
const allowedOrigins = raw.split(',').map(toMatcher).filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow curl/Postman
    const ok = allowedOrigins.some(o =>
      o instanceof RegExp ? o.test(origin) : o === origin
    );
    callback(ok ? null : new Error('Not allowed by CORS'), ok);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'X-Admin-Token', 'Content-Type', 'Accept', 'X-Requested-With'],
  credentials: true
};

// Middleware
app.use(cors(corsOptions))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Static file serving for uploads (development)
app.use('/uploads', express.static(join(__dirname, '..', 'uploads')))

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

// Admin health check endpoint
app.get('/api/admin/health', requireAdmin, (req, res) => {
  res.json({ 
    ok: true, 
    version: packageJson.version,
    ts: new Date().toISOString()
  })
})

// Debug endpoint for auth troubleshooting (development only)
if (config.server.nodeEnv === 'development') {
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
    
    // Text search on title OR body (case-insensitive)
    if (searchQuery) {
      params.push(`%${searchQuery}%`)
      whereConditions.push(`(title ILIKE $${params.length} OR body ILIKE $${params.length})`)
    }
    
    // Status filter
    if (status) {
      params.push(status)
      whereConditions.push(`status = $${params.length}`)
    }
    
    const whereClause = whereConditions.length ? `WHERE ${whereConditions.join(' AND ')}` : ''
    
    // Get paginated items
    const itemsQuery = `SELECT * FROM posts ${whereClause} ORDER BY created_at DESC LIMIT ${l} OFFSET ${offset}`
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
    const result = await q('SELECT * FROM posts WHERE id = $1', [id])
    
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
    const { title, body, status = 'published' } = req.body
    
    // Validation
    if (!title || !body) {
      const err = new Error('Title and body are required')
      err.status = 400
      return next(err)
    }
    
    if (typeof title !== 'string' || typeof body !== 'string') {
      const err = new Error('Title and body must be strings')
      err.status = 400
      return next(err)
    }
    
    if (status && !['draft', 'published'].includes(status)) {
      const err = new Error('Status must be "draft" or "published"')
      err.status = 400
      return next(err)
    }
    
    const result = await q(
      'INSERT INTO posts (title, body, status) VALUES ($1, $2, $3) RETURNING *',
      [title.trim(), body.trim(), status]
    )
    
    res.status(201).json(result.rows[0])
  } catch (error) {
    next(error)
  }
})

// Update post (partial) (admin only)
app.patch('/api/posts/:id', requireAdmin, async (req, res, next) => {
  try {
    const { title, body, status } = req.body || {}
    const updates = []
    const params = []
    
    // Build dynamic update query
    if (title !== undefined) {
      params.push(title)
      updates.push(`title = $${params.length}`)
    }
    if (body !== undefined) {
      params.push(body)
      updates.push(`body = $${params.length}`)
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
      const err = new Error('At least one field (title, body, or status) must be provided')
      err.status = 400
      return next(err)
    }
    
    // Add the ID parameter
    params.push(req.params.id)
    
    const { rows } = await q(
      `UPDATE posts SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
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
      console.log(`🌐 CORS allowed origins: ${allowedOrigins.map(o => o instanceof RegExp ? o.source : o).join(', ')}`)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()