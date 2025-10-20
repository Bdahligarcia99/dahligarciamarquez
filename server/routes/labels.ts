// Labels API routes
import { Router } from 'express'
import { getSupabaseAdmin } from '../auth/supabaseAdmin.ts'
import { requireSupabaseAdmin } from '../src/middleware/requireSupabaseAdmin.ts'
import { AuthenticatedRequest } from '../middleware/requireUser.js'

const router = Router()

// GET /api/labels - Public access to all labels
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('labels')
      .select('id, name, slug, created_at')
      .order('name')
    
    if (error) {
      throw error
    }
    
    res.json(data)
  } catch (error) {
    console.error('Error fetching labels:', error)
    res.status(500).json({ error: 'Failed to fetch labels' })
  }
})

// POST /api/labels - Admin only: create new label
router.post('/', requireSupabaseAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { name } = req.body
    
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Label name is required and must be a string' })
    }
    
    const trimmedName = name.trim()
    if (trimmedName.length === 0) {
      return res.status(400).json({ error: 'Label name cannot be empty' })
    }
    
    const { data, error } = await supabaseAdmin
      .from('labels')
      .insert({ name: trimmedName })
      .select('id, name, slug, created_at')
      .single()
    
    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return res.status(409).json({ error: 'Label with this name already exists' })
      }
      throw error
    }
    
    res.status(201).json(data)
  } catch (error) {
    console.error('Error creating label:', error)
    res.status(500).json({ error: 'Failed to create label' })
  }
})

// PUT /api/labels/:id - Admin only: update label
router.put('/:id', requireSupabaseAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params
    const { name } = req.body
    
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Label name is required and must be a string' })
    }
    
    const trimmedName = name.trim()
    if (trimmedName.length === 0) {
      return res.status(400).json({ error: 'Label name cannot be empty' })
    }
    
    const { data, error } = await supabaseAdmin
      .from('labels')
      .update({ name: trimmedName })
      .eq('id', id)
      .select('id, name, slug, created_at, updated_at')
      .single()
    
    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return res.status(409).json({ error: 'Label with this name already exists' })
      }
      throw error
    }
    
    if (!data) {
      return res.status(404).json({ error: 'Label not found' })
    }
    
    res.json(data)
  } catch (error) {
    console.error('Error updating label:', error)
    res.status(500).json({ error: 'Failed to update label' })
  }
})

// DELETE /api/labels/:id - Admin only: delete label
router.delete('/:id', requireSupabaseAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params
    
    const { error } = await supabaseAdmin
      .from('labels')
      .delete()
      .eq('id', id)
    
    if (error) {
      throw error
    }
    
    res.json({ deleted: true })
  } catch (error) {
    console.error('Error deleting label:', error)
    res.status(500).json({ error: 'Failed to delete label' })
  }
})

export default router
