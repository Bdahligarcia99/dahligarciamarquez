import 'dotenv/config'
import express from 'express'
import cors from 'cors'

const app = express()
const PORT = process.env.PORT || 8080

// CORS configuration with allowlist
const corsOptions = {
  origin: [
    process.env.CORS_ORIGIN, // Custom domain (set later)
    'http://localhost:5173', // Vite dev server
    /.*\.vercel\.app$/ // Vercel preview deploys
  ].filter(Boolean), // Remove undefined values
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true
}

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
})