// Posts API routes with Supabase integration
import { Router } from 'express'
import { supabaseAdmin } from '../auth/supabaseAdmin.js'
import { requireUser } from '../middleware/requireUser.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { AuthenticatedRequest } from '../middleware/requireUser.js'

const router = Router()

// GET /api/posts - Public: published posts only
router.get('/', async (req, res) => {
  try {
    const { 
      page = '1', 
      limit = '20', 
      label, 
      search 
    } = req.query
    
    const pageNum = Math.max(1, parseInt(page as string))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)))
    const offset = (pageNum - 1) * limitNum
    
    let query = supabaseAdmin
      .from('posts')
      .select(`
        id,
        title,
        slug,
        excerpt,
        cover_image_url,
        created_at,
        updated_at,
        profiles!posts_author_id_fkey (
          display_name
        ),
        post_labels (
          labels (
            name,
            slug
          )
        )
      `)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1)
    
    // Filter by label if provided
    if (label && typeof label === 'string') {
      query = query.eq('post_labels.labels.slug', label)
    }
    
    // Text search if provided
    if (search && typeof search === 'string') {
      query = query.textSearch('title,content_text', search)
    }
    
    const { data, error, count } = await query
    
    if (error) {
      throw error
    }
    
    res.json({
      data: data || [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0
      }
    })
  } catch (error) {
    console.error('Error fetching posts:', error)
    res.status(500).json({ error: 'Failed to fetch posts' })
  }
})

// GET /api/posts/admin - Admin only: all posts with filtering
router.get('/admin', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { 
      page = '1', 
      limit = '20', 
      status,
      search 
    } = req.query
    
    const pageNum = Math.max(1, parseInt(page as string))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)))
    const offset = (pageNum - 1) * limitNum
    
    let query = supabaseAdmin
      .from('posts')
      .select(`
        id,
        title,
        slug,
        excerpt,
        status,
        created_at,
        updated_at,
        profiles!posts_author_id_fkey (
          display_name
        ),
        post_labels (
          labels (
            name,
            slug
          )
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1)
    
    // Filter by status if provided
    if (status && typeof status === 'string' && ['draft', 'published', 'archived'].includes(status)) {
      query = query.eq('status', status)
    }
    
    // Text search if provided
    if (search && typeof search === 'string') {
      query = query.textSearch('title,content_text', search)
    }
    
    const { data, error, count } = await query
    
    if (error) {
      throw error
    }
    
    res.json({
      data: data || [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0
      }
    })
  } catch (error) {
    console.error('Error fetching admin posts:', error)
    res.status(500).json({ error: 'Failed to fetch posts' })
  }
})

// GET /api/posts/:id - Get single post (published or own draft)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    const { data, error } = await supabaseAdmin
      .from('posts')
      .select(`
        id,
        title,
        slug,
        content_rich,
        content_text,
        excerpt,
        cover_image_url,
        status,
        created_at,
        updated_at,
        profiles!posts_author_id_fkey (
          id,
          display_name
        ),
        post_labels (
          labels (
            id,
            name,
            slug
          )
        )
      `)
      .eq('id', id)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Post not found' })
      }
      throw error
    }
    
    res.json(data)
  } catch (error) {
    console.error('Error fetching post:', error)
    res.status(500).json({ error: 'Failed to fetch post' })
  }
})

// POST /api/posts - Create new post (authenticated users)
router.post('/', requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { title, content_rich, excerpt, cover_image_url, status = 'draft', label_ids = [] } = req.body
    
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'Title is required and must be a string' })
    }
    
    if (!content_rich) {
      return res.status(400).json({ error: 'Content is required' })
    }
    
    const trimmedTitle = title.trim()
    if (trimmedTitle.length === 0) {
      return res.status(400).json({ error: 'Title cannot be empty' })
    }
    
    if (!['draft', 'published', 'archived'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }
    
    // Create the post
    const { data: post, error: postError } = await supabaseAdmin
      .from('posts')
      .insert({
        title: trimmedTitle,
        content_rich,
        excerpt: excerpt?.trim() || null,
        cover_image_url: cover_image_url || null,
        status,
        author_id: req.user!.id
      })
      .select('id, title, slug, status, created_at')
      .single()
    
    if (postError) {
      if (postError.code === '23505') { // Unique constraint violation
        return res.status(409).json({ error: 'A post with this title already exists' })
      }
      throw postError
    }
    
    // Add labels if provided
    if (Array.isArray(label_ids) && label_ids.length > 0) {
      const labelInserts = label_ids.map(labelId => ({
        post_id: post.id,
        label_id: labelId
      }))
      
      await supabaseAdmin
        .from('post_labels')
        .insert(labelInserts)
    }
    
    res.status(201).json(post)
  } catch (error) {
    console.error('Error creating post:', error)
    res.status(500).json({ error: 'Failed to create post' })
  }
})

// PUT /api/posts/:id - Update post (author or admin)
router.put('/:id', requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params
    const { title, content_rich, excerpt, cover_image_url, status, label_ids } = req.body
    
    // Check if user owns the post or is admin
    const { data: existingPost, error: fetchError } = await supabaseAdmin
      .from('posts')
      .select('author_id')
      .eq('id', id)
      .single()
    
    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Post not found' })
      }
      throw fetchError
    }
    
    if (existingPost.author_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to update this post' })
    }
    
    // Build update object
    const updates: any = {}
    if (title !== undefined) updates.title = title.trim()
    if (content_rich !== undefined) updates.content_rich = content_rich
    if (excerpt !== undefined) updates.excerpt = excerpt?.trim() || null
    if (cover_image_url !== undefined) updates.cover_image_url = cover_image_url || null
    if (status !== undefined) {
      if (!['draft', 'published', 'archived'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' })
      }
      updates.status = status
    }
    
    // Update the post
    const { data: updatedPost, error: updateError } = await supabaseAdmin
      .from('posts')
      .update(updates)
      .eq('id', id)
      .select('id, title, slug, status, updated_at')
      .single()
    
    if (updateError) {
      throw updateError
    }
    
    // Update labels if provided
    if (Array.isArray(label_ids)) {
      // Remove existing labels
      await supabaseAdmin
        .from('post_labels')
        .delete()
        .eq('post_id', id)
      
      // Add new labels
      if (label_ids.length > 0) {
        const labelInserts = label_ids.map(labelId => ({
          post_id: id,
          label_id: labelId
        }))
        
        await supabaseAdmin
          .from('post_labels')
          .insert(labelInserts)
      }
    }
    
    res.json(updatedPost)
  } catch (error) {
    console.error('Error updating post:', error)
    res.status(500).json({ error: 'Failed to update post' })
  }
})

// DELETE /api/posts/:id - Delete post (author or admin)
router.delete('/:id', requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params
    
    // Check if user owns the post or is admin
    const { data: existingPost, error: fetchError } = await supabaseAdmin
      .from('posts')
      .select('author_id')
      .eq('id', id)
      .single()
    
    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Post not found' })
      }
      throw fetchError
    }
    
    if (existingPost.author_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete this post' })
    }
    
    const { error } = await supabaseAdmin
      .from('posts')
      .delete()
      .eq('id', id)
    
    if (error) {
      throw error
    }
    
    res.json({ deleted: true })
  } catch (error) {
    console.error('Error deleting post:', error)
    res.status(500).json({ error: 'Failed to delete post' })
  }
})

export default router
