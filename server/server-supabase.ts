import { config } from './src/config.js'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import path from 'path'
import { fileURLToPath } from 'url'

// Import routes
import authRoutes from './routes/auth.js'
import labelsRoutes from './routes/labels.js'
import postsRoutes from './routes/posts.js'
import imagesRoutes from './routes/images.js'
import adminRoutes from './routes/admin.js'

// Import middleware
import { comingSoonMiddleware } from './src/middleware/comingSoon.js'

const app = express()
const PORT = config.server.port

// Security middleware
app.use(helmet())

// Request logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'))
}

// Environment-driven CORS configuration with wildcard support
const toMatcher = (s: string) => {
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
  origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    if (!origin) return callback(null, true); // allow curl/Postman
    const ok = allowedOrigins.some(o =>
      o instanceof RegExp ? o.test(origin) : o === origin
    );
    callback(ok ? null : new Error('Not allowed by CORS'), ok);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'X-Admin-Token', 'Content-Type', 'Accept', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'ETag'],
  credentials: true,
  optionsSuccessStatus: 204
};

// Middleware
app.options('*', cors(corsOptions))
app.use(cors(corsOptions))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Static file serving for uploads (development)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')))

// Root route
app.get('/', (req, res) => {
  res.json({
    ok: true,
    service: "storytelling-api",
    version: "2.0.0",
    auth: "supabase",
    endpoints: [
      "/healthz",
      "/api/auth/db-ping",
      "/api/labels",
      "/api/posts",
      "/api/posts/admin",
      "/api/images",
      "/api/admin"
    ]
  })
})

// Health check endpoint (before Coming Soon middleware)
app.get('/healthz', (req, res) => {
  res.json({ 
    ok: true, 
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  })
})

// Coming Soon middleware - blocks non-admin traffic when enabled
app.use(comingSoonMiddleware)

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/labels', labelsRoutes)
app.use('/api/posts', postsRoutes)
app.use('/api/images', imagesRoutes)
app.use('/api/admin', adminRoutes)

// Legacy compatibility - redirect old admin ping
app.get('/api/admin/ping', (req, res) => {
  res.redirect(301, '/api/auth/db-ping')
})

// 404 handler - convert unmatched routes to a 404 error
app.use((req, res, next) => {
  const err = new Error('Not Found');
  (err as any).status = 404;
  next(err);
});

// Central JSON error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
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
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...')
  process.exit(0)
})

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Storytelling API v2.0 running on port ${PORT}`)
  console.log(`🏥 Health check: http://localhost:${PORT}/healthz`)
  console.log(`🔐 Auth: Supabase JWT`)
  console.log(`🗄️ Database: Supabase Postgres`)
  console.log(`📦 Storage: Supabase Storage`)
  console.log(`🌐 CORS allowed origins: ${allowedOrigins.map(o => o instanceof RegExp ? o.source : o).join(', ')}`)
  console.log('[boot] CORS configured with allowedHeaders: Authorization, X-Admin-Token')
})

export default app
