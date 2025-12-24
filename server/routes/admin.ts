// Admin-only routes for system management
import { Router } from 'express'
import { getSupabaseAdmin } from '../auth/supabaseAdmin.ts'
import { requireSupabaseAdmin } from '../src/middleware/requireSupabaseAdmin.ts'
import { getComingSoon, setComingSoon } from '../src/state/runtimeConfig.ts'
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
router.get('/coming-soon', requireSupabaseAdmin, async (req, res) => {
  try {
    const enabled = await getComingSoon()
    res.json({ enabled })
  } catch (error) {
    console.error('Error getting Coming Soon status:', error)
    res.status(500).json({ error: 'Failed to get Coming Soon status' })
  }
})

// PUT/POST /api/admin/coming-soon - Set Coming Soon mode
router.put('/coming-soon', requireSupabaseAdmin, async (req, res) => {
  try {
    const { enabled } = req.body
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean value' })
    }
    
    // Extract user ID from request if available
    const userId = (req as any).user?.id
    
    await setComingSoon(enabled, userId)
    
    res.json({
      enabled: await getComingSoon()
    })
  } catch (error) {
    console.error('Error setting Coming Soon status:', error)
    res.status(500).json({ error: 'Failed to set Coming Soon status' })
  }
})

// POST /api/admin/coming-soon - Set Coming Soon mode (alias for PUT)
router.post('/coming-soon', requireSupabaseAdmin, async (req, res) => {
  try {
    const { enabled } = req.body
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean value' })
    }
    
    // Extract user ID from request if available
    const userId = (req as any).user?.id
    
    await setComingSoon(enabled, userId)
    
    res.json({
      enabled: await getComingSoon()
    })
  } catch (error) {
    console.error('Error setting Coming Soon status:', error)
    res.status(500).json({ error: 'Failed to set Coming Soon status' })
  }
})

// GET /api/admin/health - Admin health check endpoint
router.get('/health', requireSupabaseAdmin, (req, res) => {
  res.json({
    ok: true,
    version: packageVersion,
    ts: new Date().toISOString()
  })
})

// GET /api/admin/storage-stats - Get database and storage usage stats
router.get('/storage-stats', requireSupabaseAdmin, async (req, res) => {
  const supabase = getSupabaseAdmin()
  const stats: {
    database?: { size_bytes: number; size_formatted: string };
    storage?: { size_bytes: number; size_formatted: string; file_count: number };
    error?: string;
  } = {}

  try {
    // Get database size using pg_database_size
    const { data: dbData, error: dbError } = await supabase.rpc('get_database_size')
    
    if (!dbError && dbData) {
      stats.database = {
        size_bytes: dbData.size_bytes || 0,
        size_formatted: formatBytes(dbData.size_bytes || 0)
      }
    } else {
      // Fallback: try direct query (may not work due to permissions)
      console.warn('Could not get database size via RPC:', dbError?.message)
    }

    // Get storage bucket size
    const bucketName = process.env.SUPABASE_BUCKET || 'public-images'
    const { data: files, error: storageError } = await supabase.storage
      .from(bucketName)
      .list('', { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } })

    if (!storageError && files) {
      // Recursively get all files to calculate total size
      let totalSize = 0
      let fileCount = 0
      
      const processFolder = async (path: string) => {
        const { data: items } = await supabase.storage
          .from(bucketName)
          .list(path, { limit: 1000 })
        
        if (items) {
          for (const item of items) {
            if (item.id) {
              // It's a file
              totalSize += item.metadata?.size || 0
              fileCount++
            } else {
              // It's a folder, recurse
              const folderPath = path ? `${path}/${item.name}` : item.name
              await processFolder(folderPath)
            }
          }
        }
      }
      
      await processFolder('')
      
      stats.storage = {
        size_bytes: totalSize,
        size_formatted: formatBytes(totalSize),
        file_count: fileCount
      }
    } else {
      console.warn('Could not list storage files:', storageError?.message)
    }

    res.json({ ok: true, stats })
  } catch (error: any) {
    console.error('Error getting storage stats:', error)
    res.json({ ok: false, error: error.message, stats })
  }
})

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export default router
