// Images metadata API routes
import { Router } from 'express'
import { requireSupabaseAdmin } from '../src/middleware/requireSupabaseAdmin.ts'
import { parseMultipartForm, MulterRequest } from '../src/middleware/multipart.ts'
import { storage } from '../src/storage/index.ts'

// Image processing dependencies
let sharp: any
let imageSize: any

try {
  sharp = (await import('sharp')).default
} catch {
  console.warn('Sharp not available, falling back to image-size')
  try {
    imageSize = (await import('image-size')).default
  } catch {
    console.error('Neither sharp nor image-size available for image processing')
  }
}

const router = Router()

/**
 * Validate uploaded image file
 */
function validateImageUpload(file: Express.Multer.File | undefined): string | null {
  if (!file) {
    return 'No image file provided'
  }

  const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/webp']
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return `Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`
  }

  const maxSize = 5 * 1024 * 1024 // 5MB
  if (file.size > maxSize) {
    return `File too large. Maximum size: ${maxSize / 1024 / 1024}MB`
  }

  return null
}

/**
 * Get image dimensions from buffer
 */
async function getImageDimensions(buffer: Buffer): Promise<{ width: number; height: number }> {
  if (sharp) {
    try {
      const metadata = await sharp(buffer).metadata()
      return {
        width: metadata.width || 0,
        height: metadata.height || 0
      }
    } catch (error) {
      console.warn('Sharp failed to get dimensions:', error)
    }
  }

  if (imageSize) {
    try {
      const dimensions = imageSize(buffer)
      return {
        width: dimensions.width || 0,
        height: dimensions.height || 0
      }
    } catch (error) {
      console.warn('image-size failed to get dimensions:', error)
    }
  }

  // Fallback if both fail
  return { width: 0, height: 0 }
}

/**
 * Get file extension from mime type
 */
function getExtensionFromMimeType(mimeType: string): string {
  switch (mimeType) {
    case 'image/png':
      return 'png'
    case 'image/jpeg':
      return 'jpg'
    case 'image/webp':
      return 'webp'
    default:
      return 'jpg'
  }
}

// POST /api/uploads/image - Upload image file (admin only)
router.post('/uploads/image', parseMultipartForm, requireSupabaseAdmin, async (req: MulterRequest, res) => {
  try {
    const file = req.file

    if (!file) {
      return res.status(400).json({ error: 'No image file provided' })
    }

    // Get compression settings
    let compressionSettings
    try {
      const { query } = await import('../src/db.ts')
      const settingsResult = await query(`
        SELECT * FROM compression_settings 
        WHERE user_id IS NULL 
        ORDER BY created_at DESC 
        LIMIT 1
      `)
      compressionSettings = settingsResult.rows[0]
    } catch (error) {
      console.warn('Could not fetch compression settings, using defaults:', error)
      compressionSettings = {
        compression_enabled: true,
        auto_compress: true,
        size_threshold_kb: 500,
        dimension_threshold_px: 2000,
        quality_preset: 'balanced',
        custom_quality: 75,
        convert_photos_to_webp: true,
        preserve_png_for_graphics: true
      }
    }

    // Get original image dimensions
    const { width: originalWidth, height: originalHeight } = await getImageDimensions(file.buffer)
    
    let finalBuffer = file.buffer
    let finalMimeType = file.mimetype
    let compressionResult = null
    
    // Check if compression should be applied
    if (compressionSettings?.compression_enabled && compressionSettings?.auto_compress) {
      try {
        const { CompressionService } = await import('../src/services/compressionService.js')
        
        // Check if image meets compression thresholds
        const shouldCompress = CompressionService.shouldCompress(
          file.buffer,
          { width: originalWidth, height: originalHeight },
          {
            sizeThreshold: compressionSettings.size_threshold_kb || 500,
            dimensionThreshold: compressionSettings.dimension_threshold_px || 2000
          }
        )
        
        if (shouldCompress) {
          // Apply compression
          const quality = compressionSettings.quality_preset === 'custom' 
            ? compressionSettings.custom_quality 
            : compressionSettings.quality_preset
            
          compressionResult = await CompressionService.compressImage(file.buffer, {
            quality,
            convertPhotosToWebP: compressionSettings.convert_photos_to_webp,
            preservePngForGraphics: compressionSettings.preserve_png_for_graphics
          })
          
          finalBuffer = compressionResult.buffer
          finalMimeType = compressionResult.mimeType
        }
      } catch (compressionError) {
        console.warn('Compression failed, using original image:', compressionError)
        // Continue with original image if compression fails
      }
    }

    // Use storage driver to save image
    const { url, path } = await storage.putImage({
      buffer: finalBuffer,
      mime: finalMimeType,
      filenameHint: file.originalname
    })

    // Store metadata if possible
    try {
      const { query } = await import('../src/db.ts')
      await query(`
        INSERT INTO image_metadata (
          path, mime_type, file_size_bytes, is_public,
          is_compressed, original_size_bytes, compressed_size_bytes,
          compression_ratio, compression_quality
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        path,
        finalMimeType,
        finalBuffer.length,
        true,
        compressionResult !== null,
        file.buffer.length,
        finalBuffer.length,
        compressionResult?.compressionRatio || 0,
        compressionSettings?.quality_preset || 'none'
      ])
    } catch (error) {
      console.warn('Could not store image metadata:', error)
    }

    // Get final dimensions (may have changed due to compression)
    const { width: finalWidth, height: finalHeight } = compressionResult 
      ? { width: compressionResult.width, height: compressionResult.height }
      : await getImageDimensions(finalBuffer)

    // Return success response
    const response: any = {
      url,
      path,
      width: finalWidth,
      height: finalHeight
    }

    // Add compression info if compression was applied
    if (compressionResult) {
      response.compression = {
        originalSize: compressionResult.originalSize,
        compressedSize: compressionResult.compressedSize,
        compressionRatio: compressionResult.compressionRatio,
        format: compressionResult.format,
        stats: `Compressed from ${(compressionResult.originalSize / (1024 * 1024)).toFixed(2)}MB to ${(compressionResult.compressedSize / (1024 * 1024)).toFixed(2)}MB (${compressionResult.compressionRatio}% reduction)`
      }
    }

    res.status(200).json(response)

  } catch (error: any) {
    console.error('Image upload error:', error)
    
    // Handle specific error status codes
    if (error.statusCode === 503) {
      return res.status(503).json({ 
        error: 'Uploads not configured' 
      })
    } else if (error.statusCode === 415) {
      return res.status(415).json({ 
        error: error.message 
      })
    } else if (error.statusCode === 413) {
      return res.status(413).json({ 
        error: error.message 
      })
    }
    
    // Handle other errors (500)
    res.status(500).json({ error: 'Failed to upload image' })
  }
})

// GET /api/images - Admin only: get all images (optimized with pre-computed data)
router.get('/', requireSupabaseAdmin, async (req, res) => {
  try {
    console.log('🔍 Images endpoint called - starting optimized processing...')
    
    const { 
      page = '1', 
      limit = '50', 
      source,
      search 
    } = req.query
    
    const pageNum = Math.max(1, parseInt(page as string))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)))
    const offset = (pageNum - 1) * limitNum
    
    console.log('📊 Query params:', { page: pageNum, limit: limitNum, source, search })
    
    // Try Supabase first, fall back to direct PostgreSQL
    let supabaseAdmin = null
    let useDirectPostgres = false
    
    try {
      const { getSupabaseAdmin } = await import('../auth/supabaseAdmin.ts')
      supabaseAdmin = getSupabaseAdmin()
      
      if (!supabaseAdmin) {
        console.log('⚠️ Supabase admin client is null - using direct PostgreSQL')
        useDirectPostgres = true
      }
    } catch (error) {
      console.log('⚠️ Supabase not available - using direct PostgreSQL')
      useDirectPostgres = true
    }
    
    if (useDirectPostgres) {
      return await directPostgresImageProcessing(req, res)
    }
    
    console.log('🔌 Supabase admin client initialized')
    
    // Get uploaded images from images table
    let uploadedImages: any[] = []
    
    try {
      console.log('📁 Fetching uploaded images...')
      const { data: uploadedImagesData, error: uploadedError } = await supabaseAdmin
        .from('images')
        .select(`
          id,
          path,
          mime_type,
          file_size_bytes,
          width,
          height,
          is_public,
          created_at,
          profiles!images_owner_id_fkey (
            display_name
          )
        `)
        .order('created_at', { ascending: false })
      
      if (uploadedError) {
        console.error('❌ Error fetching uploaded images:', uploadedError)
        // Don't throw here, just log and continue with empty array
        uploadedImages = []
      } else {
        uploadedImages = uploadedImagesData || []
        console.log(`✅ Found ${uploadedImages.length} uploaded images`)
      }
    } catch (error) {
      console.error('❌ Exception fetching uploaded images:', error)
      uploadedImages = []
    }
    
    // Get post images from pre-computed table (with fallback)
    let postImages: any[] = []
    
    try {
      console.log('🗂️ Attempting to fetch from post_images table...')
      const { data: postImagesData, error: postImagesError } = await supabaseAdmin
        .from('post_images')
        .select(`
          id,
          image_url,
          image_type,
          alt_text,
          width,
          height,
          created_at,
          posts!post_images_post_id_fkey (
            id,
            title,
            profiles!posts_author_id_fkey (
              display_name
            )
          )
        `)
        .order('created_at', { ascending: false })
      
      if (postImagesError) {
        console.log('❌ Error from post_images query:', postImagesError)
        // If post_images table doesn't exist, fall back to legacy processing
        if (postImagesError.code === '42P01' || postImagesError.message?.includes('does not exist') || postImagesError.message?.includes('relation') && postImagesError.message?.includes('not exist')) {
          console.log('⚠️ post_images table not found, falling back to legacy processing')
          return legacyImageProcessing(req, res)
        }
        throw postImagesError
      }
      
      postImages = postImagesData || []
      console.log(`✅ Found ${postImages.length} post images from optimized table`)
    } catch (error: any) {
      console.log('⚠️ Exception accessing post_images table, falling back to legacy processing:', error.message)
      console.log('🔍 Error details:', error)
      return legacyImageProcessing(req, res)
    }
    
    // Format uploaded images
    const formattedUploadedImages = (uploadedImages || []).map(img => ({
      id: img.id,
      url: img.path.startsWith('http') ? img.path : `/uploads/${img.path}`,
      source: 'upload',
      mime_type: img.mime_type,
      file_size_bytes: img.file_size_bytes,
      width: img.width,
      height: img.height,
      is_public: img.is_public,
      created_at: img.created_at,
      owner: img.profiles,
      post_title: null,
      post_id: null
    }))
    
    // Format post images
    const formattedPostImages = (postImages || []).map(img => ({
      id: `post-${img.id}`,
      url: img.image_url,
      source: img.image_type === 'cover' ? 'post_cover' : 'post_inline',
      mime_type: null,
      file_size_bytes: null,
      width: img.width,
      height: img.height,
      is_public: true,
      created_at: img.created_at,
      owner: img.posts?.profiles,
      post_title: img.posts?.title,
      post_id: img.posts?.id,
      alt_text: img.alt_text
    }))
    
    // Combine all images
    let allImages = [...formattedUploadedImages, ...formattedPostImages]
    
    // Apply filters
    if (source) {
      allImages = allImages.filter(img => img.source === source)
    }
    
    if (search && typeof search === 'string') {
      const searchLower = search.toLowerCase()
      allImages = allImages.filter(img => 
        img.post_title?.toLowerCase().includes(searchLower) ||
        img.alt_text?.toLowerCase().includes(searchLower) ||
        img.owner?.display_name?.toLowerCase().includes(searchLower) ||
        img.url.toLowerCase().includes(searchLower)
      )
    }
    
    // Sort by created_at descending
    allImages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    
    // Apply pagination
    const paginatedImages = allImages.slice(offset, offset + limitNum)
    
    console.log(`✅ Optimized endpoint: returning ${paginatedImages.length} of ${allImages.length} images`)
    
    res.json({
      images: paginatedImages,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: allImages.length,
        pages: Math.ceil(allImages.length / limitNum),
        hasMore: offset + limitNum < allImages.length
      },
      stats: {
        total: allImages.length,
        uploaded_count: formattedUploadedImages.length,
        post_images_count: formattedPostImages.length,
        cover_images: formattedPostImages.filter(img => img.source === 'post_cover').length,
        inline_images: formattedPostImages.filter(img => img.source === 'post_inline').length
      }
    })
  } catch (error: any) {
    console.error('❌ Error in optimized images endpoint:', error)
    console.error('🔍 Error stack:', error.stack)
    
    // Last resort fallback to legacy processing
    console.log('🆘 Attempting final fallback to legacy processing...')
    try {
      return await legacyImageProcessing(req, res)
    } catch (legacyError) {
      console.error('❌ Legacy fallback also failed:', legacyError)
      res.status(500).json({ 
        error: 'Failed to fetch images',
        details: error.message,
        fallback_error: legacyError.message
      })
    }
  }
})

// GET /api/images/legacy - Admin only: fallback to old runtime processing
router.get('/legacy', requireSupabaseAdmin, async (req, res) => {
  try {
    console.log('Images endpoint called successfully')
    
    // Initialize empty arrays for images
    let uploadedImages: any[] = []
    let posts: any[] = []
    
    try {
      const { getSupabaseAdmin } = await import('../auth/supabaseAdmin.ts')
      const supabaseAdmin = getSupabaseAdmin()
      
      console.log('Supabase admin client initialized')
      
      // Get uploaded images from images table
      const { data: uploadedImagesData, error: uploadedError } = await supabaseAdmin
        .from('images')
        .select(`
          id,
          path,
          mime_type,
          file_size_bytes,
          width,
          height,
          is_public,
          created_at,
          profiles!images_owner_id_fkey (
            display_name
          )
        `)
        .order('created_at', { ascending: false })

      if (uploadedError) {
        console.error('Error fetching uploaded images:', uploadedError)
      } else {
        uploadedImages = uploadedImagesData || []
        console.log(`Found ${uploadedImages.length} uploaded images`)
      }

      // Get images from post content (cover images and inline images)
      const { data: postsData, error: postsError } = await supabaseAdmin
        .from('posts')
        .select(`
          id,
          title,
          cover_image_url,
          content_rich,
          created_at,
          profiles!posts_author_id_fkey (
            display_name,
            email
          )
        `)
        .not('cover_image_url', 'is', null)

      if (postsError) {
        console.error('Error fetching posts with images:', postsError)
      } else {
        posts = postsData || []
        console.log(`Found ${posts.length} posts with cover images`)
      }

    } catch (supabaseError) {
      console.error('Supabase initialization or query error:', supabaseError)
      // Continue with empty arrays - the endpoint will still work
    }

    // Extract images from post content
    const postImages: any[] = []
    
    // Add cover images
    posts.forEach(post => {
      if (post.cover_image_url) {
        postImages.push({
          id: `cover-${post.id}`,
          url: post.cover_image_url,
          source: 'post_cover',
          post_id: post.id,
          post_title: post.title,
          created_at: post.created_at,
          owner: post.profiles
        })
      }
    })

    // Extract inline images from rich content
    posts.forEach(post => {
      if (post.content_rich) {
        try {
          const content = JSON.parse(post.content_rich)
          extractImagesFromContent(content, post, postImages)
        } catch (e) {
          // Skip invalid JSON content
          console.warn(`Failed to parse content_rich for post ${post.id}:`, e)
        }
      }
    })

    // Format uploaded images
    const formattedUploadedImages = uploadedImages.map(img => ({
      id: img.id,
      url: img.path.startsWith('http') ? img.path : `/uploads/${img.path}`,
      source: 'upload',
      mime_type: img.mime_type,
      file_size_bytes: img.file_size_bytes,
      width: img.width,
      height: img.height,
      is_public: img.is_public,
      created_at: img.created_at,
      owner: img.profiles
    }))

    // Combine and sort all images
    const allImages = [...formattedUploadedImages, ...postImages]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    console.log(`Returning ${allImages.length} total images (${formattedUploadedImages.length} uploaded, ${postImages.length} from posts)`)

    res.json({
      images: allImages,
      total: allImages.length,
      uploaded_count: formattedUploadedImages.length,
      post_images_count: postImages.length
    })

  } catch (error: any) {
    console.error('Error in images endpoint:', error)
    console.error('Error stack:', error.stack)
    res.status(500).json({ 
      error: 'Failed to fetch images',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Helper function to extract images from rich content
function extractImagesFromContent(content: any, post: any, images: any[]) {
  if (!content || typeof content !== 'object') return
  
  if (Array.isArray(content)) {
    content.forEach(item => extractImagesFromContent(item, post, images))
    return
  }
  
  if (content.type === 'image' && content.attrs?.src) {
    images.push({
      id: `inline-${post.id}-${images.length}`,
      url: content.attrs.src,
      source: 'post_inline',
      post_id: post.id,
      post_title: post.title,
      alt_text: content.attrs.alt || null,
      width: content.attrs.width || null,
      height: content.attrs.height || null,
      created_at: post.created_at,
      owner: post.profiles
    })
  }
  
  // Recursively check nested content
  if (content.content) {
    extractImagesFromContent(content.content, post, images)
  }
  
  // Check other properties that might contain nested content
  Object.values(content).forEach(value => {
    if (typeof value === 'object') {
      extractImagesFromContent(value, post, images)
    }
  })
}

// POST /api/images/reconcile - Admin only: full reconciliation (monthly maintenance)
router.post('/reconcile', requireSupabaseAdmin, async (req, res) => {
  try {
    console.log('🔄 Starting full image reconciliation...')
    
    // Use direct PostgreSQL
    const { query } = await import('../src/db.js')
    
    // Create reconciliation log entry
    let reconciliationId: number
    try {
      const logResult = await query(`
        INSERT INTO image_reconciliation_log (status, triggered_by)
        VALUES ('running', 'manual')
        RETURNING id
      `)
      reconciliationId = logResult.rows[0].id
      console.log(`✅ Started reconciliation ${reconciliationId}`)
    } catch (error: any) {
      if (error.message?.includes('does not exist')) {
        console.log('⚠️ image_reconciliation_log table does not exist, proceeding without logging')
        reconciliationId = Date.now() // Use timestamp as fallback ID
      } else {
        console.error('Failed to log reconciliation start:', error)
        return res.status(500).json({ error: 'Failed to start reconciliation' })
      }
    }
    
    let stats = {
      posts_processed: 0,
      images_found: 0,
      images_added: 0,
      images_updated: 0,
      images_removed: 0
    }
    
    try {
      // Get all posts with content using direct PostgreSQL
      const postsResult = await query(`
        SELECT id, title, cover_image_url, content_rich 
        FROM posts
      `)
      
      const posts = postsResult.rows || []
      console.log(`Processing ${posts.length} posts...`)
      
      // Import the image tracking service
      const { imageTrackingService } = await import('../src/services/imageTrackingService.js')
      
      // Process each post
      for (const post of posts) {
        try {
          const result = await imageTrackingService.syncPostImages(
            post.id, 
            post.content_rich, 
            post.cover_image_url
          )
          
          stats.posts_processed++
          stats.images_found += result.images_found.length
          stats.images_added += result.images_added
          stats.images_updated += result.images_updated
          stats.images_removed += result.images_removed
          
          if (stats.posts_processed % 10 === 0) {
            console.log(`Processed ${stats.posts_processed}/${posts.length} posts...`)
          }
        } catch (postError) {
          console.error(`Failed to process post ${post.id}:`, postError)
          // Continue with other posts
        }
      }
      
      // Update reconciliation log with success (if table exists)
      try {
        await query(`
          UPDATE image_reconciliation_log 
          SET status = 'completed',
              completed_at = NOW(),
              posts_processed = $1,
              images_found = $2,
              images_added = $3,
              images_updated = $4,
              images_removed = $5
          WHERE id = $6
        `, [
          stats.posts_processed,
          stats.images_found,
          stats.images_added,
          stats.images_updated,
          stats.images_removed,
          reconciliationId
        ])
      } catch (updateError: any) {
        if (!updateError.message?.includes('does not exist')) {
          console.error('Failed to update reconciliation log:', updateError)
        }
      }
      
      console.log('✅ Reconciliation completed:', stats)
      
      res.json({
        success: true,
        message: 'Image reconciliation completed successfully',
        stats,
        reconciliation_id: reconciliationId
      })
      
    } catch (error) {
      // Update reconciliation log with failure (if table exists)
      try {
        await query(`
          UPDATE image_reconciliation_log 
          SET status = 'failed',
              completed_at = NOW(),
              error_message = $1,
              posts_processed = $2,
              images_found = $3,
              images_added = $4,
              images_updated = $5,
              images_removed = $6
          WHERE id = $7
        `, [
          error instanceof Error ? error.message : 'Unknown error',
          stats.posts_processed,
          stats.images_found,
          stats.images_added,
          stats.images_updated,
          stats.images_removed,
          reconciliationId
        ])
      } catch (updateError: any) {
        if (!updateError.message?.includes('does not exist')) {
          console.error('Failed to update reconciliation log with error:', updateError)
        }
      }
      
      throw error
    }
    
  } catch (error: any) {
    console.error('❌ Reconciliation failed:', error)
    res.status(500).json({ 
      error: 'Reconciliation failed',
      details: error.message 
    })
  }
})

// GET /api/images/reconcile/status - Admin only: get reconciliation history
router.get('/reconcile/status', requireSupabaseAdmin, async (req, res) => {
  try {
    console.log('🔍 Reconciliation status endpoint called')
    
    // Try direct PostgreSQL approach
    const { query } = await import('../src/db.js')
    
    let logs: any[] = []
    let totalImages = 0
    let totalPosts = 0
    
    // Get reconciliation logs (if table exists)
    try {
      const logsResult = await query(`
        SELECT * FROM image_reconciliation_log 
        ORDER BY started_at DESC 
        LIMIT 10
      `)
      logs = logsResult.rows || []
      console.log(`✅ Found ${logs.length} reconciliation logs`)
    } catch (error: any) {
      if (error.message?.includes('does not exist')) {
        console.log('⚠️ image_reconciliation_log table does not exist')
      } else {
        console.error('❌ Error fetching reconciliation logs:', error)
      }
    }
    
    // Get current system stats
    try {
      const postsResult = await query('SELECT COUNT(*) as count FROM posts')
      totalPosts = parseInt(postsResult.rows[0]?.count || '0')
      
      const imagesResult = await query('SELECT COUNT(*) as count FROM post_images')
      totalImages = parseInt(imagesResult.rows[0]?.count || '0')
    } catch (error: any) {
      if (error.message?.includes('does not exist')) {
        console.log('⚠️ Some tables do not exist, using fallback stats')
        // Use fallback method to count posts
        try {
          const postsResult = await query('SELECT COUNT(*) as count FROM posts')
          totalPosts = parseInt(postsResult.rows[0]?.count || '0')
        } catch (e) {
          console.log('⚠️ Could not count posts')
        }
      } else {
        console.error('❌ Error fetching system stats:', error)
      }
    }
    
    const lastReconciliation = logs[0] || null
    const needsReconciliation = !lastReconciliation || 
      (lastReconciliation.status === 'failed') ||
      (new Date().getTime() - new Date(lastReconciliation.started_at).getTime() > 30 * 24 * 60 * 60 * 1000) // 30 days
    
    console.log(`✅ Reconciliation status: posts=${totalPosts}, images=${totalImages}, needs_reconciliation=${needsReconciliation}`)
    
    res.json({
      current_stats: {
        total_posts: totalPosts,
        tracked_images: totalImages
      },
      last_reconciliation: lastReconciliation,
      needs_reconciliation: needsReconciliation,
      reconciliation_history: logs
    })
    
  } catch (error: any) {
    console.error('❌ Error fetching reconciliation status:', error)
    res.status(500).json({ 
      error: 'Failed to fetch reconciliation status',
      details: error.message 
    })
  }
})

// Legacy image processing function (fallback when post_images table doesn't exist)
async function legacyImageProcessing(req: any, res: any) {
  try {
    console.log('🔄 Using legacy image processing...')
    
    const { getSupabaseAdmin } = await import('../auth/supabaseAdmin.ts')
    const supabaseAdmin = getSupabaseAdmin()
    
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client is null in legacy processing - returning empty result')
      return res.json({
        images: [],
        total: 0,
        uploaded_count: 0,
        post_images_count: 0,
        processing_mode: 'legacy-fallback',
        error: 'Supabase not configured'
      })
    }
    
    // Initialize empty arrays for images
    let uploadedImages: any[] = []
    let posts: any[] = []
    
    // Get uploaded images from images table
    const { data: uploadedImagesData, error: uploadedError } = await supabaseAdmin
      .from('images')
      .select(`
        id,
        path,
        mime_type,
        file_size_bytes,
        width,
        height,
        is_public,
        created_at,
        profiles!images_owner_id_fkey (
          display_name,
          email
        )
      `)
      .order('created_at', { ascending: false })

    if (uploadedError) {
      console.error('Error fetching uploaded images:', uploadedError)
    } else {
      uploadedImages = uploadedImagesData || []
      console.log(`Found ${uploadedImages.length} uploaded images`)
    }

    // Get images from post content (cover images and inline images)
    const { data: postsData, error: postsError } = await supabaseAdmin
      .from('posts')
      .select(`
        id,
        title,
        cover_image_url,
        content_rich,
        created_at,
        profiles!posts_author_id_fkey (
          display_name,
          email
        )
      `)
      .not('cover_image_url', 'is', null)

    if (postsError) {
      console.error('Error fetching posts with images:', postsError)
    } else {
      posts = postsData || []
      console.log(`Found ${posts.length} posts with cover images`)
    }

    // Extract images from post content
    const postImages: any[] = []
    
    // Add cover images
    posts.forEach(post => {
      if (post.cover_image_url) {
        postImages.push({
          id: `cover-${post.id}`,
          url: post.cover_image_url,
          source: 'post_cover',
          post_id: post.id,
          post_title: post.title,
          created_at: post.created_at,
          owner: post.profiles
        })
      }
    })

    // Extract inline images from rich content
    posts.forEach(post => {
      if (post.content_rich) {
        try {
          const content = JSON.parse(post.content_rich)
          extractImagesFromContent(content, post, postImages)
        } catch (e) {
          // Skip invalid JSON content
          console.warn(`Failed to parse content_rich for post ${post.id}:`, e)
        }
      }
    })

    // Format uploaded images
    const formattedUploadedImages = uploadedImages.map(img => ({
      id: img.id,
      url: img.path.startsWith('http') ? img.path : `/uploads/${img.path}`,
      source: 'upload',
      mime_type: img.mime_type,
      file_size_bytes: img.file_size_bytes,
      width: img.width,
      height: img.height,
      is_public: img.is_public,
      created_at: img.created_at,
      owner: img.profiles
    }))

    // Combine and sort all images
    const allImages = [...formattedUploadedImages, ...postImages]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    console.log(`✅ Legacy processing: returning ${allImages.length} total images (${formattedUploadedImages.length} uploaded, ${postImages.length} from posts)`)

    res.json({
      images: allImages,
      total: allImages.length,
      uploaded_count: formattedUploadedImages.length,
      post_images_count: postImages.length,
      processing_mode: 'legacy'
    })

  } catch (error: any) {
    console.error('Error in legacy images processing:', error)
    res.status(500).json({ error: 'Failed to fetch images' })
  }
}

// Direct PostgreSQL processing function (when Supabase isn't available)
async function directPostgresImageProcessing(req: any, res: any) {
  try {
    console.log('🐘 Using direct PostgreSQL processing...')
    
    const { query } = await import('../src/db.js')
    
    // Get uploaded images from images table (if it exists)
    let uploadedImages: any[] = []
    try {
      const uploadedResult = await query(`
        SELECT i.id, i.path, i.mime_type, i.file_size_bytes, 
               i.width, i.height, i.is_public, i.created_at
        FROM images i
        ORDER BY i.created_at DESC
      `)
      uploadedImages = uploadedResult.rows || []
      console.log(`✅ Found ${uploadedImages.length} uploaded images`)
    } catch (error: any) {
      if (error.message?.includes('does not exist')) {
        console.log('⚠️ Images table does not exist, skipping uploaded images')
      } else {
        console.error('❌ Error fetching uploaded images:', error)
      }
    }
    
    // Get post images from post_images table (if it exists)
    let postImages: any[] = []
    try {
      const postImagesResult = await query(`
        SELECT pi.id, pi.image_url, pi.image_type, pi.alt_text,
               pi.width, pi.height, pi.created_at,
               p.id as post_id, p.title as post_title
        FROM post_images pi
        LEFT JOIN posts p ON pi.post_id = p.id
        ORDER BY pi.created_at DESC
      `)
      postImages = postImagesResult.rows || []
      console.log(`✅ Found ${postImages.length} post images from optimized table`)
      
      // If post_images table exists but is empty, fall back to content parsing
      if (postImages.length === 0) {
        console.log('⚠️ post_images table is empty, falling back to content parsing')
        throw new Error('Empty post_images table - trigger fallback')
      }
    } catch (error: any) {
      if (error.message?.includes('does not exist') || error.message?.includes('Empty post_images table')) {
        console.log('⚠️ post_images table does not exist or is empty, falling back to content parsing')
        // Fall back to parsing post content
        try {
          const postsResult = await query(`
            SELECT id, title, cover_image_url, content_rich, created_at
            FROM posts 
            WHERE cover_image_url IS NOT NULL OR content_rich IS NOT NULL
          `)
          
          const posts = postsResult.rows || []
          console.log(`Found ${posts.length} posts to parse for images`)
          
          // Process each post
          posts.forEach(post => {
            // Add cover image
            if (post.cover_image_url) {
              postImages.push({
                id: `cover-${post.id}`,
                image_url: post.cover_image_url,
                image_type: 'cover',
                alt_text: null,
                width: null,
                height: null,
                created_at: post.created_at,
                post_id: post.id,
                post_title: post.title,
                display_name: null,
                email: null
              })
            }
            
            // Parse content for inline images
            if (post.content_rich) {
              try {
                // Check if content_rich is already an object or needs parsing
                let content = post.content_rich
                if (typeof content === 'string') {
                  content = JSON.parse(content)
                }
                const inlineImages = extractImagesFromContentDirect(content, post)
                postImages.push(...inlineImages)
              } catch (e) {
                console.warn(`Failed to parse content for post ${post.id}:`, e)
              }
            }
          })
          
          // Deduplicate images by URL and type
          const uniqueImages = []
          const seen = new Set()
          
          postImages.forEach(img => {
            const key = `${img.image_url}-${img.image_type}-${img.post_id}`
            if (!seen.has(key)) {
              seen.add(key)
              uniqueImages.push(img)
            }
          })
          
          postImages = uniqueImages
          console.log(`✅ Parsed ${postImages.length} unique images from post content (deduplicated)`)
        } catch (parseError) {
          console.error('❌ Error parsing post content:', parseError)
        }
      } else {
        console.error('❌ Error fetching post images:', error)
      }
    }
    
    // Format uploaded images
    const formattedUploadedImages = uploadedImages.map(img => {
      // Ensure uploaded images use absolute URLs to the API server
      const finalUrl = img.path?.startsWith('http') ? img.path : `http://localhost:8080/uploads/${img.path}`
      
      console.log('🖼️ Formatting uploaded image:', {
        id: img.id,
        originalPath: img.path,
        finalUrl: finalUrl
      })
      
      return {
        id: img.id,
        url: finalUrl,
        source: 'upload',
        mime_type: img.mime_type,
        file_size_bytes: img.file_size_bytes,
        width: img.width,
        height: img.height,
        is_public: img.is_public,
        created_at: img.created_at,
        owner: {
          display_name: null,
          email: null
        },
        post_title: null,
        post_id: null
      }
    })
    
    // Format post images
    const formattedPostImages = postImages.map(img => ({
      id: `post-${img.id || Math.random()}`,
      url: img.image_url,
      source: img.image_type === 'cover' ? 'post_cover' : 'post_inline',
      mime_type: null,
      file_size_bytes: null,
      width: img.width,
      height: img.height,
      is_public: true,
      created_at: img.created_at,
      owner: {
        display_name: null,
        email: null
      },
      post_title: img.post_title,
      post_id: img.post_id,
      alt_text: img.alt_text
    }))
    
    // Combine all images
    const allImages = [...formattedUploadedImages, ...formattedPostImages]
    
    // Sort by created_at descending
    allImages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    
    console.log(`✅ Direct PostgreSQL: returning ${allImages.length} total images (${formattedUploadedImages.length} uploaded, ${formattedPostImages.length} from posts)`)
    
    res.json({
      images: allImages,
      pagination: {
        page: 1,
        limit: 50,
        total: allImages.length,
        pages: 1,
        hasMore: false
      },
      stats: {
        total: allImages.length,
        uploaded_count: formattedUploadedImages.length,
        post_images_count: formattedPostImages.length,
        cover_images: formattedPostImages.filter(img => img.source === 'post_cover').length,
        inline_images: formattedPostImages.filter(img => img.source === 'post_inline').length
      },
      processing_mode: 'direct-postgres'
    })

  } catch (error: any) {
    console.error('❌ Error in direct PostgreSQL processing:', error)
    res.status(500).json({ 
      error: 'Failed to fetch images',
      details: error.message,
      processing_mode: 'direct-postgres-error'
    })
  }
}

// Helper function to extract images from content (direct version)
function extractImagesFromContentDirect(content: any, post: any): any[] {
  const images: any[] = []
  
  if (!content || typeof content !== 'object') {
    return images
  }
  
  if (Array.isArray(content)) {
    content.forEach(item => {
      images.push(...extractImagesFromContentDirect(item, post))
    })
    return images
  }
  
  // Handle image nodes
  if (content.type === 'image' && content.attrs?.src) {
    images.push({
      id: `inline-${post.id}-${images.length}`,
      image_url: content.attrs.src,
      image_type: 'inline',
      alt_text: content.attrs.alt || null,
      width: content.attrs.width || null,
      height: content.attrs.height || null,
      created_at: post.created_at,
      post_id: post.id,
      post_title: post.title,
      display_name: null,
      email: null
    })
  }
  
  // Recursively check nested content
  if (content.content) {
    images.push(...extractImagesFromContentDirect(content.content, post))
  }
  
  // Check other properties that might contain nested content
  Object.values(content).forEach(value => {
    if (typeof value === 'object') {
      images.push(...extractImagesFromContentDirect(value, post))
    }
  })
  
  return images
}

// POST /api/images/metadata - Store image metadata in images table (for library)
router.post('/metadata', requireSupabaseAdmin, async (req, res) => {
  try {
    const { path, mime_type, file_size_bytes, width, height, is_public } = req.body

    if (!path || !mime_type) {
      return res.status(400).json({ error: 'Missing required fields: path, mime_type' })
    }

    // Get admin user ID from the request (set by requireAdmin middleware)
    const adminUserId = (req as any).adminUserId || 'admin-system'
    console.log('🔍 Admin User ID from request:', adminUserId)

    // Try Supabase first, fall back to direct PostgreSQL
    let supabaseAdmin = null
    try {
      const { getSupabaseAdmin } = await import('../auth/supabaseAdmin.ts')
      supabaseAdmin = getSupabaseAdmin()
    } catch (error) {
      console.log('⚠️ Supabase not available for metadata storage')
    }

    if (supabaseAdmin) {
      // Use Supabase - find existing profile or create system admin
      let ownerId = adminUserId
      
      try {
        // Try to find any existing profile
        const { data: profiles, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .order('created_at', { ascending: true })
          .limit(1)

        if (profileError) throw profileError

        if (profiles && profiles.length > 0) {
          ownerId = profiles[0].id
          console.log('✅ Found existing profile (Supabase), using ID:', ownerId)
        } else {
          // Create system admin profile
          const systemAdminId = '00000000-0000-0000-0000-000000000001'
          const { error: createError } = await supabaseAdmin
            .from('profiles')
            .upsert({
              id: systemAdminId,
              display_name: 'System Admin'
            })

          if (createError) throw createError
          
          ownerId = systemAdminId
          console.log('✅ Created system admin profile (Supabase) with ID:', ownerId)
        }
      } catch (profileError) {
        console.warn('❌ Supabase profile lookup failed:', profileError)
        throw new Error(`Cannot determine valid owner_id: ${profileError.message}`)
      }

      const { data, error } = await supabaseAdmin
        .from('images')
        .insert({
          path,
          mime_type,
          file_size_bytes,
          width,
          height,
          is_public: is_public !== false, // Default to true
          owner_id: ownerId
        })
        .select()
        .single()

      if (error) {
        console.error('Supabase metadata storage error:', error)
        throw error
      }

      res.json({ success: true, id: data.id })
    } else {
      // Use direct PostgreSQL - try to find or create a system admin user
      const { query } = await import('../src/db.js')
      
      // First, try to get a system admin user ID
      let ownerId = adminUserId
      console.log('🔍 Initial owner ID:', ownerId)
      
      try {
        // First, try to find ANY existing profile to use as owner
        const anyProfileQuery = await query(`
          SELECT id FROM profiles 
          ORDER BY created_at ASC
          LIMIT 1
        `)
        
        console.log('🔍 Any profile query result:', anyProfileQuery.rows)
        
        if (anyProfileQuery.rows.length > 0) {
          ownerId = anyProfileQuery.rows[0].id
          console.log('✅ Found existing profile, using ID:', ownerId)
        } else {
          // If no profiles exist, create a system admin profile
          console.log('⚠️ No profiles found, creating system admin profile...')
          const systemAdminId = '00000000-0000-0000-0000-000000000001' // Different from before
          
          try {
            await query(`
              INSERT INTO profiles (id, display_name, created_at, updated_at)
              VALUES ($1, $2, NOW(), NOW())
              ON CONFLICT (id) DO NOTHING
            `, [systemAdminId, 'System Admin'])
            
            ownerId = systemAdminId
            console.log('✅ Created system admin profile with ID:', ownerId)
          } catch (createError) {
            console.error('❌ Failed to create system admin profile:', createError)
            // Last resort: try to find the first profile again or fail gracefully
            throw new Error('Cannot create system admin profile and no existing profiles found')
          }
        }
      } catch (profileError) {
        console.warn('❌ Profile lookup/creation failed:', profileError)
        throw new Error(`Cannot determine valid owner_id: ${profileError.message}`)
      }
      
      console.log('🎯 Final owner ID to use:', ownerId)

      const result = await query(`
        INSERT INTO images (path, mime_type, file_size_bytes, width, height, is_public, owner_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [path, mime_type, file_size_bytes, width, height, is_public !== false, ownerId])

      res.json({ success: true, id: result.rows[0].id })
    }

  } catch (error: any) {
    console.error('Error storing image metadata:', error)
    res.status(500).json({ 
      error: 'Failed to store image metadata',
      details: error.message 
    })
  }
})

export default router
