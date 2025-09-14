// Admin-only routes for system management
import { Router } from 'express'
import { getSupabaseAdmin } from '../auth/supabaseAdmin.js'
import { requireAdmin } from '../src/middleware/requireAdmin.ts'
import { getComingSoon, setComingSoon } from '../src/state/runtimeConfig.js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const router = Router()

// Get package.json for version info
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
let packageVersion = 'unknown'

try {
  const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'))
  packageVersion = packageJson.version || 'unknown'
} catch (error) {
  console.warn('Could not read package.json for version info:', error)
}

// GET /api/admin/coming-soon - Get Coming Soon mode status
router.get('/coming-soon', requireAdmin, (req, res) => {
  try {
    res.json({
      enabled: getComingSoon()
    })
  } catch (error) {
    console.error('Error getting Coming Soon status:', error)
    res.status(500).json({ error: 'Failed to get Coming Soon status' })
  }
})

// PUT /api/admin/coming-soon - Set Coming Soon mode
router.put('/coming-soon', requireAdmin, (req, res) => {
  try {
    const { enabled } = req.body
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean value' })
    }
    
    setComingSoon(enabled)
    
    res.json({
      enabled: getComingSoon()
    })
  } catch (error) {
    console.error('Error setting Coming Soon status:', error)
    res.status(500).json({ error: 'Failed to set Coming Soon status' })
  }
})

// GET /api/admin/health - Admin health check endpoint
router.get('/health', requireAdmin, (req, res) => {
  res.json({
    ok: true,
    version: packageVersion,
    ts: new Date().toISOString()
  })
})

export default router
