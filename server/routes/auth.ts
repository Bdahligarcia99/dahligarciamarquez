// Authentication and database connectivity routes
import { Router } from 'express'
import { getSupabaseAdmin } from '../auth/supabaseAdmin.ts'

const router = Router()

// Database connectivity check
router.post('/db-ping', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('count')
      .limit(1)
    
    if (error) {
      throw error
    }
    
    res.json({ 
      ok: true, 
      message: 'Database connection successful',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Database ping failed:', error)
    res.status(500).json({ 
      ok: false, 
      error: 'Database connection failed' 
    })
  }
})

export default router
