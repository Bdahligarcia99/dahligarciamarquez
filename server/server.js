import 'dotenv/config'
import express from 'express'
import cors from 'cors'

const app = express()
const PORT = process.env.PORT || 8080

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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`🏥 Health check: http://localhost:${PORT}/healthz`)
  console.log(`📡 Test endpoint: http://localhost:${PORT}/api/hello`)
  console.log(`🌐 CORS allowed origins: ${allowedOrigins.map(o => o instanceof RegExp ? o.source : o).join(', ')}`)
})