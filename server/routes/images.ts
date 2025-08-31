// Images metadata API routes
import { Router } from 'express'
import { supabaseAdmin } from '../auth/supabaseAdmin.js'
import { requireUser } from '../middleware/requireUser.js'
import { AuthenticatedRequest } from '../middleware/requireUser.js'

const router = Router()

// POST /api/images/metadata - Store image metadata after client upload
router.post('/metadata', requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { 
      path, 
      mime_type, 
      file_size_bytes, 
      width, 
      height, 
      is_public = true 
    } = req.body
    
    // Validation
    if (!path || typeof path !== 'string') {
      return res.status(400).json({ error: 'Image path is required' })
    }
    
    if (!mime_type || typeof mime_type !== 'string') {
      return res.status(400).json({ error: 'MIME type is required' })
    }
    
    if (!file_size_bytes || typeof file_size_bytes !== 'number') {
      return res.status(400).json({ error: 'File size is required' })
    }
    
    // Validate MIME type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(mime_type)) {
      return res.status(400).json({ 
        error: `Invalid MIME type. Allowed: ${allowedTypes.join(', ')}` 
      })
    }
    
    // Store metadata
    const { data, error } = await supabaseAdmin
      .from('images')
      .insert({
        owner_id: req.user!.id,
        path,
        mime_type,
        file_size_bytes,
        width: width || null,
        height: height || null,
        is_public: Boolean(is_public)
      })
      .select('id, path, mime_type, file_size_bytes, width, height, is_public, created_at')
      .single()
    
    if (error) {
      throw error
    }
    
    // Generate public URL for the image
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('post-images')
      .getPublicUrl(path)
    
    res.status(201).json({
      ...data,
      public_url: publicUrl
    })
  } catch (error) {
    console.error('Error storing image metadata:', error)
    res.status(500).json({ error: 'Failed to store image metadata' })
  }
})

// GET /api/images - List user's images
router.get('/', requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { page = '1', limit = '50' } = req.query
    
    const pageNum = Math.max(1, parseInt(page as string))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)))
    const offset = (pageNum - 1) * limitNum
    
    const { data, error, count } = await supabaseAdmin
      .from('images')
      .select('id, path, mime_type, file_size_bytes, width, height, is_public, created_at', { count: 'exact' })
      .eq('owner_id', req.user!.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1)
    
    if (error) {
      throw error
    }
    
    // Add public URLs
    const imagesWithUrls = data?.map(image => {
      const { data: { publicUrl } } = supabaseAdmin.storage
        .from('post-images')
        .getPublicUrl(image.path)
      
      return {
        ...image,
        public_url: publicUrl
      }
    }) || []
    
    res.json({
      data: imagesWithUrls,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0
      }
    })
  } catch (error) {
    console.error('Error fetching images:', error)
    res.status(500).json({ error: 'Failed to fetch images' })
  }
})

// DELETE /api/images/:id - Delete image and its storage file
router.delete('/:id', requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params
    
    // Get image details first
    const { data: image, error: fetchError } = await supabaseAdmin
      .from('images')
      .select('owner_id, path')
      .eq('id', id)
      .single()
    
    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Image not found' })
      }
      throw fetchError
    }
    
    // Check ownership or admin
    if (image.owner_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete this image' })
    }
    
    // Delete from storage
    const { error: storageError } = await supabaseAdmin.storage
      .from('post-images')
      .remove([image.path])
    
    if (storageError) {
      console.warn('Storage deletion failed:', storageError)
      // Continue with database deletion even if storage fails
    }
    
    // Delete from database
    const { error: dbError } = await supabaseAdmin
      .from('images')
      .delete()
      .eq('id', id)
    
    if (dbError) {
      throw dbError
    }
    
    res.json({ deleted: true })
  } catch (error) {
    console.error('Error deleting image:', error)
    res.status(500).json({ error: 'Failed to delete image' })
  }
})

export default router
