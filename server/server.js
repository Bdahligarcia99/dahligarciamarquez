import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { initDb, q, closeDb } from './db.js'

const app = express()
const PORT = process.env.PORT || 8080

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
  credentials: true
};

// Middleware
app.use(cors(corsOptions))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Root route
app.get('/', (req, res) => {
  res.json({
    ok: true,
    service: "api",
    endpoints: ["/healthz", "/api/hello", "/api/db/now", "/api/posts"]
  })
})

// Health check endpoint
app.get('/healthz', (req, res) => {
  res.json({ 
    ok: true, 
    uptime: process.uptime() 
  })
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

// Get all posts
app.get('/api/posts', async (req, res, next) => {
  try {
    const result = await q('SELECT * FROM posts ORDER BY created_at DESC LIMIT 50')
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
})

// Get single post by ID
app.get('/api/posts/:id', async (req, res, next) => {
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

// Create new post
app.post('/api/posts', async (req, res, next) => {
  try {
    const { title, body } = req.body
    
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
    
    const result = await q(
      'INSERT INTO posts (title, body) VALUES ($1, $2) RETURNING *',
      [title.trim(), body.trim()]
    )
    
    res.status(201).json(result.rows[0])
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