// Posts API routes with Supabase integration
import { Router } from 'express'
import { getSupabaseAdmin } from '../auth/supabaseAdmin.ts'
import { requireUser } from '../middleware/requireUser.ts'
import { requireSupabaseAdmin } from '../src/middleware/requireSupabaseAdmin.ts'
import { AuthenticatedRequest } from '../middleware/requireUser.ts'
import { slugify, validateSlugAvailability } from '../src/utils/slugify.ts'
import { extractTextFromRichContent } from '../src/utils/contentExtractor.ts'
import { sanitizePostHtml, calculateReadingTime, extractTextFromHtml } from '../src/utils/sanitizeHtml.ts'
import { 
  validateTitle, 
  validateExcerpt, 
  validateSlugFormat, 
  validateStatus, 
  validateRichContent,
  createValidationErrorResponse,
  ValidationError 
} from '../src/utils/validation.ts'
import {
  createErrorResponse,
  createListResponse,
  createSingleResponse,
  HTTP_STATUS
} from '../src/utils/responses.ts'
import { imageTrackingService } from '../src/services/imageTrackingService.ts'

const router = Router()

// Initialize Supabase admin client
const supabaseAdmin = getSupabaseAdmin()

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
        reading_time,
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
    
    res.json(createListResponse(data || [], pageNum, limitNum, count || 0))
  } catch (error) {
    console.error('Error fetching posts:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(createErrorResponse('Failed to fetch posts'))
  }
})

// GET /api/posts/admin - Admin only: all posts with filtering
router.get('/admin', requireSupabaseAdmin, async (req: AuthenticatedRequest, res) => {
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
        reading_time,
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
    if (status && typeof status === 'string' && ['draft', 'published', 'private', 'system', 'archived'].includes(status)) {
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
    
    res.json(createListResponse(data || [], pageNum, limitNum, count || 0))
  } catch (error) {
    console.error('Error fetching admin posts:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(createErrorResponse('Failed to fetch posts'))
  }
})

// GET /api/posts/slug/:slug - Get single post by slug (public - published only, unless admin)
router.get('/slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params
    const fromDashboard = req.query.from === 'dashboard'
    
    console.log(`📖 GET /api/posts/slug/${slug} - fromDashboard: ${fromDashboard}`)
    
    // Check if user is authenticated as admin (for viewing non-published posts from dashboard)
    let isAdmin = false
    if (fromDashboard) {
      const authHeader = req.headers.authorization
      console.log(`🔑 Auth header present: ${!!authHeader}`)
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7)
        try {
          const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
          console.log(`👤 User from token: ${user?.email || 'none'}, error: ${authError?.message || 'none'}`)
          if (user && !authError) {
            // Check if user has admin role
            const { data: profile } = await supabaseAdmin
              .from('profiles')
              .select('role')
              .eq('id', user.id)
              .single()
            console.log(`📋 Profile role: ${profile?.role || 'none'}`)
            isAdmin = profile?.role === 'admin'
          }
        } catch (authErr) {
          console.log('Auth check failed, treating as public request:', authErr)
        }
      }
    }
    
    console.log(`🔓 isAdmin: ${isAdmin}`)
    
    // Build query
    let query = supabaseAdmin
      .from('posts')
      .select(`
        id,
        title,
        slug,
        content_rich,
        content_text,
        content_html,
        reading_time,
        excerpt,
        cover_image_url,
        cover_image_alt,
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
      .eq('slug', slug)
    
    // Only filter by status for public (non-admin) requests
    if (!isAdmin) {
      query = query.eq('status', 'published')
    }
    
    const { data, error } = await query.single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(HTTP_STATUS.NOT_FOUND).json(createErrorResponse('Post not found'))
      }
      throw error
    }
    
    res.json(createSingleResponse('post', data))
  } catch (error) {
    console.error('Error fetching post by slug:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(createErrorResponse('Failed to fetch post'))
  }
})

// GET /api/posts/:id - Get single post by ID (published or own draft)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    console.log(`📖 GET /api/posts/${id} - Fetching post`)
    
    const { data, error } = await supabaseAdmin
      .from('posts')
      .select(`
        id,
        title,
        slug,
        content_rich,
        content_text,
        content_html,
        reading_time,
        excerpt,
        cover_image_url,
        cover_image_alt,
        status,
        created_at,
        updated_at,
        author_id,
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
    
    console.log(`📊 GET /api/posts/${id} result:`, {
      success: !error,
      hasData: !!data,
      dataKeys: data ? Object.keys(data) : [],
      title: data?.title,
      error: error?.message
    })
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(HTTP_STATUS.NOT_FOUND).json(createErrorResponse('Post not found'))
      }
      throw error
    }
    
    res.json(createSingleResponse('post', data))
  } catch (error) {
    console.error('Error fetching post:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(createErrorResponse('Failed to fetch post'))
  }
})

// POST /api/posts - Create new post (admin token or authenticated user required)
router.post('/', requireSupabaseAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { 
      title, 
      content_rich, 
      content_html,
      excerpt, 
      cover_image_url,
      cover_image_alt, 
      status = 'draft', 
      label_ids = [],
      slug: providedSlug
    } = req.body
    
    // Validate all fields
    const errors: ValidationError[] = [
      ...validateTitle(title),
      ...validateRichContent(content_rich),
      ...validateExcerpt(excerpt),
      ...validateStatus(status)
    ]
    
    // Validate provided slug if any
    if (providedSlug !== undefined) {
      errors.push(...validateSlugFormat(providedSlug))
    }
    
    // Determine author_id based on auth type
    let authorId: string
    if (req.isAdmin) {
      // For admin token, require author_id in request
      const { author_id } = req.body
      if (!author_id || typeof author_id !== 'string') {
        errors.push({
          field: 'author_id',
          message: 'author_id is required when using admin token',
          code: 'REQUIRED'
        })
      } else {
        authorId = author_id
      }
    } else {
      // For user token, use authenticated user's ID
      authorId = req.user!.id
    }
    
    // Return validation errors if any
    if (errors.length > 0) {
      return res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json(createValidationErrorResponse(errors))
    }
    
    // Generate or validate slug
    let finalSlug: string
    try {
      if (providedSlug) {
        // Validate provided slug is available
        const isAvailable = await validateSlugAvailability(providedSlug.trim())
        if (!isAvailable) {
          return res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json(createValidationErrorResponse([{
            field: 'slug',
            message: 'This slug is already taken or reserved',
            code: 'UNAVAILABLE'
          }]))
        }
        finalSlug = providedSlug.trim()
      } else {
        // Generate slug from title
        finalSlug = await slugify(title.trim())
      }
    } catch (slugError: any) {
      return res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json(createValidationErrorResponse([{
        field: 'slug',
        message: slugError.message || 'Failed to generate slug',
        code: 'GENERATION_FAILED'
      }]))
    }
    
    // Extract plain text from rich content
    const contentText = extractTextFromRichContent(content_rich)
    
    // Sanitize HTML content if provided
    let sanitizedHtml: string | null = null
    let readingTime = 0
    
    if (content_html && typeof content_html === 'string') {
      sanitizedHtml = sanitizePostHtml(content_html)
      const plainText = extractTextFromHtml(sanitizedHtml)
      readingTime = calculateReadingTime(plainText)
    } else if (contentText) {
      // Fallback to content_text for reading time
      readingTime = calculateReadingTime(contentText)
    }
    
    // Prepare post data for insertion
    const postData: any = {
      title: title.trim(),
      slug: finalSlug,
      content_rich,
      content_text: contentText,
      content_html: sanitizedHtml,
      reading_time: Math.max(1, readingTime), // Ensure minimum 1 minute
      excerpt: excerpt?.trim() || null,
      cover_image_url: cover_image_url || null,
      cover_image_alt: cover_image_alt?.trim() || null,
      status,
      author_id: authorId
    }
    
    // Create the post
    const { data: post, error: postError } = await supabaseAdmin
      .from('posts')
      .insert(postData)
      .select('id, title, slug, status, created_at')
      .single()
    
    if (postError) {
      if (postError.code === '23505') { // Unique constraint violation
        return res.status(HTTP_STATUS.CONFLICT).json(createErrorResponse('A post with this slug already exists'))
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
    
    // Track images in background (non-blocking)
    setImmediate(async () => {
      try {
        await imageTrackingService.syncPostImages(post.id, content_rich, cover_image_url)
        console.log(`✅ Images tracked for post ${post.id}`)
      } catch (error) {
        console.error(`❌ Failed to track images for post ${post.id}:`, error)
        // Don't fail the request if image tracking fails
      }
    })
    
    res.status(HTTP_STATUS.CREATED).json(createSingleResponse('post', {
      ...post,
      reading_time: Math.max(1, readingTime),
      content_html: sanitizedHtml // Return sanitized HTML (now persisted)
    }))
  } catch (error) {
    console.error('Error creating post:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(createErrorResponse('Failed to create post'))
  }
})

// PUT /api/posts/:id - Update post (admin token or author)
// PATCH /api/posts/:id - Update post (admin token or author) - same as PUT
const updatePostHandler = async (req: AuthenticatedRequest, res: any) => {
  try {
    const { id } = req.params
    console.log(`🔄 PATCH/PUT /api/posts/${id} received`)
    console.log(`📦 Request body keys:`, Object.keys(req.body))
    const { 
      title, 
      content_rich, 
      content_html,
      excerpt, 
      cover_image_url,
      cover_image_alt, 
      status, 
      label_ids,
      regenerateSlug = false 
    } = req.body
    
    // Check authorization based on auth type
    if (!req.isAdmin) {
      // For user tokens, check ownership
      const { data: existingPost, error: fetchError } = await supabaseAdmin
        .from('posts')
        .select('author_id, title, slug')
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
    }
    // Admin token users can update any post
    
    // Validate fields that are being updated
    const errors: ValidationError[] = []
    
    if (title !== undefined) {
      errors.push(...validateTitle(title))
    }
    
    if (content_rich !== undefined) {
      errors.push(...validateRichContent(content_rich))
    }
    
    if (excerpt !== undefined) {
      errors.push(...validateExcerpt(excerpt))
    }
    
    if (status !== undefined) {
      errors.push(...validateStatus(status))
    }
    
    // Return validation errors if any
    if (errors.length > 0) {
      return res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json(createValidationErrorResponse(errors))
    }
    
    // Build update object
    const updates: any = {}
    
    if (title !== undefined) {
      updates.title = title.trim()
    }
    
    if (content_rich !== undefined) {
      updates.content_rich = content_rich
      // Always update content_text when content_rich changes
      updates.content_text = extractTextFromRichContent(content_rich)
    }
    
    // Handle HTML sanitization and reading time calculation
    let sanitizedHtml: string | null = null
    let readingTime = 0
    
    if (content_html !== undefined && typeof content_html === 'string') {
      sanitizedHtml = sanitizePostHtml(content_html)
      const plainText = extractTextFromHtml(sanitizedHtml)
      readingTime = calculateReadingTime(plainText)
      
      updates.content_html = sanitizedHtml
      updates.reading_time = Math.max(1, readingTime) // Ensure minimum 1 minute
    } else if (updates.content_text) {
      // Calculate reading time from updated content_text
      readingTime = calculateReadingTime(updates.content_text)
    }
    
    if (excerpt !== undefined) {
      updates.excerpt = excerpt?.trim() || null
    }
    
    if (cover_image_url !== undefined) {
      updates.cover_image_url = cover_image_url || null
    }
    
    if (cover_image_alt !== undefined) {
      updates.cover_image_alt = cover_image_alt?.trim() || null
    }
    
    if (status !== undefined) {
      updates.status = status
    }
    
    // Handle slug regeneration
    if (regenerateSlug && title !== undefined) {
      try {
        updates.slug = await slugify(title.trim(), id)
      } catch (slugError: any) {
        return res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json(createValidationErrorResponse([{
          field: 'slug',
          message: slugError.message || 'Failed to regenerate slug',
          code: 'GENERATION_FAILED'
        }]))
      }
    }
    
    // Update the post
    console.log(`📝 Updating post ${id} with:`, JSON.stringify(updates, null, 2))
    const { data: updatedPost, error: updateError } = await supabaseAdmin
      .from('posts')
      .update(updates)
      .eq('id', id)
      .select('id, title, slug, status, updated_at')
      .single()
    console.log(`✅ Update result:`, { updatedPost, error: updateError })
    
    if (updateError) {
      if (updateError.code === '23505') { // Unique constraint violation
        return res.status(HTTP_STATUS.CONFLICT).json(createErrorResponse('A post with this slug already exists'))
      }
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
    
    // Update image tracking if content or cover image changed
    if (content_rich !== undefined || cover_image_url !== undefined) {
      setImmediate(async () => {
        try {
          const finalCoverUrl = cover_image_url !== undefined ? cover_image_url : null
          await imageTrackingService.syncPostImages(id, content_rich, finalCoverUrl)
          console.log(`✅ Images updated for post ${id}`)
        } catch (error) {
          console.error(`❌ Failed to update images for post ${id}:`, error)
          // Don't fail the request if image tracking fails
        }
      })
    }
    
    res.json(createSingleResponse('post', {
      ...updatedPost,
      reading_time: Math.max(1, readingTime),
      content_html: sanitizedHtml // Return sanitized HTML (now persisted)
    }))
  } catch (error) {
    console.error('Error updating post:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(createErrorResponse('Failed to update post'))
  }
}

// Register both PUT and PATCH to the same handler
router.put('/:id', requireSupabaseAdmin, updatePostHandler)
router.patch('/:id', requireSupabaseAdmin, updatePostHandler)

// DELETE /api/posts/:id - Delete post (admin token or author)
router.delete('/:id', requireSupabaseAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params
    
    // Check authorization based on auth type
    if (!req.isAdmin) {
      // For user tokens, check ownership
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
    }
    // Admin token users can delete any post
    
    const { error } = await supabaseAdmin
      .from('posts')
      .delete()
      .eq('id', id)
    
    if (error) {
      throw error
    }
    
    // Clean up image tracking (post_images table has CASCADE DELETE, but let's be explicit)
    setImmediate(async () => {
      try {
        await imageTrackingService.removePostImages(id)
        console.log(`✅ Images cleaned up for deleted post ${id}`)
      } catch (error) {
        console.error(`❌ Failed to clean up images for deleted post ${id}:`, error)
        // This is non-critical since CASCADE DELETE should handle it
      }
    })
    
    res.json({ deleted: true })
  } catch (error) {
    console.error('Error deleting post:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(createErrorResponse('Failed to delete post'))
  }
})

export default router
