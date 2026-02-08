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

// GET /api/images/debug - Debug endpoint to check what's in the database
router.get('/debug', requireSupabaseAdmin, async (req, res) => {
  try {
    const { getSupabaseAdmin } = await import('../auth/supabaseAdmin.ts')
    const supabaseAdmin = getSupabaseAdmin()
    
    // Check posts with cover images
    const { data: posts, error: postsError } = await supabaseAdmin
      .from('posts')
      .select('id, title, cover_image_url, status')
      .limit(20)
    
    // Check images table
    const { data: images, error: imagesError } = await supabaseAdmin
      .from('images')
      .select('id, path, created_at')
      .limit(20)
    
    res.json({
      posts: {
        data: posts,
        error: postsError?.message,
        count: posts?.length || 0,
        withCoverImage: posts?.filter(p => p.cover_image_url)?.length || 0
      },
      images: {
        data: images,
        error: imagesError?.message,
        count: images?.length || 0
      }
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
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
            display_name
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

// GET /api/images/duplicates - Admin only: scan for duplicate image URLs
router.get('/duplicates', requireSupabaseAdmin, async (req, res) => {
  try {
    console.log('🔍 Scanning for duplicate image URLs...')
    
    // Use Supabase Admin client (same as posts API)
    const { getSupabaseAdmin } = await import('../auth/supabaseAdmin.ts')
    const supabaseAdmin = getSupabaseAdmin()
    
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Supabase admin client not configured' })
    }
    
    // Check if post_images table exists by trying to query it
    const { data: tableCheck, error: tableError } = await supabaseAdmin
      .from('post_images')
      .select('id')
      .limit(1)
    
    if (tableError && tableError.message?.includes('does not exist')) {
      console.log('⚠️ post_images table does not exist')
      return res.json({
        duplicates: [],
        stats: {
          totalDuplicateUrls: 0,
          trueDuplicates: 0,
          sharedImages: 0,
          potentialSavings: 0
        },
        message: 'Image tracking table not found. Run reconciliation first to build the image index.'
      })
    }
    
    // Get all post_images to analyze duplicates
    const { data: allImages, error: imagesError } = await supabaseAdmin
      .from('post_images')
      .select('id, post_id, image_url')
      .not('image_url', 'is', null)
    
    if (imagesError) {
      throw new Error(`Failed to fetch images: ${imagesError.message}`)
    }
    
    // Group by URL to find duplicates
    const urlGroups: Record<string, { ids: string[], postIds: Set<string> }> = {}
    
    for (const img of allImages || []) {
      if (!img.image_url) continue
      
      if (!urlGroups[img.image_url]) {
        urlGroups[img.image_url] = { ids: [], postIds: new Set() }
      }
      urlGroups[img.image_url].ids.push(img.id)
      urlGroups[img.image_url].postIds.add(img.post_id)
    }
    
    // Filter to only URLs with multiple occurrences
    const duplicates = Object.entries(urlGroups)
      .filter(([_, group]) => group.ids.length > 1)
      .map(([url, group]) => ({
        image_url: url,
        total_count: group.ids.length,
        unique_posts: group.postIds.size,
        post_ids: Array.from(group.postIds),
        image_ids: group.ids
      }))
      .sort((a, b) => b.total_count - a.total_count)
    
    // Get post titles for context
    const postIds = [...new Set(duplicates.flatMap(d => d.post_ids))]
    let postTitles: Record<string, string> = {}
    
    if (postIds.length > 0) {
      const { data: posts } = await supabaseAdmin
        .from('posts')
        .select('id, title')
        .in('id', postIds)
      
      for (const post of posts || []) {
        postTitles[post.id] = post.title
      }
    }
    
    // Calculate stats
    const trueDuplicates = duplicates.filter(d => d.total_count > d.unique_posts)
    const sharedImages = duplicates.filter(d => d.unique_posts > 1)
    
    // Format response with enriched data
    const formattedDuplicates = duplicates.map(d => ({
      url: d.image_url,
      totalCount: d.total_count,
      uniquePosts: d.unique_posts,
      isDuplicate: d.total_count > d.unique_posts, // Same URL appears multiple times in same post
      isShared: d.unique_posts > 1, // Same URL used across different posts
      posts: d.post_ids.map((id: string) => ({
        id,
        title: postTitles[id] || 'Unknown'
      })),
      imageIds: d.image_ids
    }))
    
    console.log(`✅ Found ${duplicates.length} URLs with multiple occurrences, ${trueDuplicates.length} true duplicates`)
    
    res.json({
      duplicates: formattedDuplicates,
      stats: {
        totalDuplicateUrls: duplicates.length,
        trueDuplicates: trueDuplicates.length, // Same URL repeated in same post
        sharedImages: sharedImages.length, // Same URL used in different posts (valid)
        potentialSavings: trueDuplicates.reduce((sum, d) => 
          sum + (d.total_count - d.unique_posts), 0
        )
      }
    })
    
  } catch (error: any) {
    console.error('❌ Error scanning for duplicates:', error)
    res.status(500).json({ error: error.message })
  }
})

// POST /api/images/deduplicate - Admin only: remove duplicate image records
router.post('/deduplicate', requireSupabaseAdmin, async (req, res) => {
  try {
    console.log('🧹 Starting image deduplication...')
    
    // Use Supabase Admin client
    const { getSupabaseAdmin } = await import('../auth/supabaseAdmin.ts')
    const supabaseAdmin = getSupabaseAdmin()
    
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Supabase admin client not configured' })
    }
    
    const { dryRun = true } = req.body
    
    // Check if post_images table exists
    const { error: tableError } = await supabaseAdmin
      .from('post_images')
      .select('id')
      .limit(1)
    
    if (tableError && tableError.message?.includes('does not exist')) {
      return res.json({
        success: true,
        dryRun,
        stats: {
          duplicateGroups: 0,
          recordsKept: 0,
          recordsRemoved: 0
        },
        message: 'Image tracking table not found. Run reconciliation first to build the image index.'
      })
    }
    
    // Get all images to find true duplicates (same URL + same post_id)
    const { data: allImages, error: imagesError } = await supabaseAdmin
      .from('post_images')
      .select('id, post_id, image_url, created_at')
      .not('image_url', 'is', null)
      .order('created_at', { ascending: true })
    
    if (imagesError) {
      throw new Error(`Failed to fetch images: ${imagesError.message}`)
    }
    
    // Group by URL + post_id to find true duplicates
    const groups: Record<string, { ids: string[], count: number }> = {}
    
    for (const img of allImages || []) {
      if (!img.image_url) continue
      const key = `${img.image_url}::${img.post_id}`
      
      if (!groups[key]) {
        groups[key] = { ids: [], count: 0 }
      }
      groups[key].ids.push(img.id)
      groups[key].count++
    }
    
    // Find groups with more than 1 (true duplicates)
    const duplicateGroups = Object.values(groups).filter(g => g.count > 1)
    let removedCount = 0
    let keptCount = 0
    const removedIds: string[] = []
    
    for (const group of duplicateGroups) {
      // Keep the first one (oldest), remove the rest
      const [keepId, ...removeIds] = group.ids
      keptCount++
      
      if (!dryRun && removeIds.length > 0) {
        for (const id of removeIds) {
          const { error: deleteError } = await supabaseAdmin
            .from('post_images')
            .delete()
            .eq('id', id)
          
          if (!deleteError) {
            removedCount++
            removedIds.push(id)
          }
        }
      } else {
        removedCount += removeIds.length
        removedIds.push(...removeIds)
      }
    }
    
    console.log(`✅ Deduplication ${dryRun ? '(dry run)' : ''}: ${removedCount} duplicates ${dryRun ? 'would be' : ''} removed, ${keptCount} kept`)
    
    res.json({
      success: true,
      dryRun,
      stats: {
        duplicateGroups: duplicateGroups.length,
        recordsKept: keptCount,
        recordsRemoved: removedCount,
        removedIds: dryRun ? removedIds : undefined
      },
      message: dryRun 
        ? `Found ${removedCount} duplicate records that would be removed. Run with dryRun=false to remove them.`
        : `Successfully removed ${removedCount} duplicate records.`
    })
    
  } catch (error: any) {
    console.error('❌ Deduplication failed:', error)
    res.status(500).json({ error: error.message })
  }
})

// POST /api/images/reconcile - Admin only: full reconciliation (monthly maintenance)
router.post('/reconcile', requireSupabaseAdmin, async (req, res) => {
  try {
    console.log('🔄 Starting full image reconciliation...')
    
    // Use Supabase Admin client (same as posts API)
    const { getSupabaseAdmin } = await import('../auth/supabaseAdmin.ts')
    const supabaseAdmin = getSupabaseAdmin()
    
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Supabase admin client not configured' })
    }
    
    let stats = {
      posts_processed: 0,
      images_found: 0,
      images_added: 0,
      images_updated: 0,
      images_removed: 0
    }
    
    try {
      // Get all posts with content using Supabase
      const { data: posts, error: postsError } = await supabaseAdmin
        .from('posts')
        .select('id, title, cover_image_url, content_rich')
      
      if (postsError) {
        console.error('❌ Failed to fetch posts:', postsError)
        throw new Error(`Failed to fetch posts: ${postsError.message}`)
      }
      
      console.log(`📊 Found ${posts?.length || 0} posts to process`)
      
      // Helper function to extract images from TipTap content
      const extractImagesFromContent = (content: any): Array<{url: string, alt?: string}> => {
        const images: Array<{url: string, alt?: string}> = []
        
        if (!content || typeof content !== 'object') return images
        
        if (Array.isArray(content)) {
          content.forEach(item => {
            images.push(...extractImagesFromContent(item))
          })
          return images
        }
        
        // Handle image nodes
        if (content.type === 'image' && content.attrs?.src) {
          images.push({
            url: content.attrs.src,
            alt: content.attrs.alt || null
          })
        }
        
        // Recursively check nested content
        if (content.content) {
          images.push(...extractImagesFromContent(content.content))
        }
        
        return images
      }
      
      // Check if post_images table exists, create if not
      const { error: tableCheckError } = await supabaseAdmin
        .from('post_images')
        .select('id')
        .limit(1)
      
      if (tableCheckError && tableCheckError.message?.includes('does not exist')) {
        console.log('⚠️ post_images table does not exist in Supabase.')
        console.log('   Please run the migration SQL to create it.')
        // Continue anyway - we'll just track what we find
      }
      
      // Process each post using Supabase
      for (const post of posts || []) {
        try {
          const imagesForPost: Array<{url: string, type: string, alt?: string}> = []
          
          // Add cover image
          if (post.cover_image_url) {
            imagesForPost.push({
              url: post.cover_image_url,
              type: 'cover',
              alt: null
            })
          }
          
          // Extract inline images from content
          if (post.content_rich) {
            const inlineImages = extractImagesFromContent(post.content_rich)
            inlineImages.forEach(img => {
              imagesForPost.push({
                url: img.url,
                type: 'inline',
                alt: img.alt
              })
            })
          }
          
          stats.images_found += imagesForPost.length
          
          // Get existing images for this post from Supabase
          const { data: existing, error: existingError } = await supabaseAdmin
            .from('post_images')
            .select('id, image_url, image_type')
            .eq('post_id', post.id)
          
          if (existingError && !existingError.message?.includes('does not exist')) {
            console.warn(`  ⚠️ Could not fetch existing images for post ${post.id}`)
          }
          
          const existingImages = existing || []
          
          // Find images to add
          for (const img of imagesForPost) {
            const exists = existingImages.some(e => e.image_url === img.url && e.image_type === img.type)
            if (!exists) {
              const { error: insertError } = await supabaseAdmin
                .from('post_images')
                .insert({
                  post_id: post.id,
                  image_url: img.url,
                  image_type: img.type,
                  alt_text: img.alt
                })
              
              if (insertError && !insertError.message?.includes('does not exist')) {
                console.warn(`  ⚠️ Could not insert image: ${insertError.message}`)
              } else if (!insertError) {
                stats.images_added++
              }
            }
          }
          
          // Find images to remove (in DB but not in content)
          for (const existingImg of existingImages) {
            const stillExists = imagesForPost.some(img => 
              img.url === existingImg.image_url && img.type === existingImg.image_type
            )
            if (!stillExists) {
              const { error: deleteError } = await supabaseAdmin
                .from('post_images')
                .delete()
                .eq('id', existingImg.id)
              
              if (!deleteError) {
                stats.images_removed++
              }
            }
          }
          
          stats.posts_processed++
          
          if (stats.posts_processed % 5 === 0) {
            console.log(`  📝 Processed ${stats.posts_processed}/${(posts || []).length} posts...`)
          }
        } catch (postError: any) {
          console.error(`❌ Failed to process post ${post.id}:`, postError.message)
          // Continue with other posts
        }
      }
      
      console.log('✅ Reconciliation completed:', stats)
      
      // Log the reconciliation run
      const logEntry = {
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        status: 'completed',
        posts_processed: stats.posts_processed,
        images_found: stats.images_found,
        images_added: stats.images_added,
        images_removed: stats.images_removed
      }
      
      const { error: logError } = await supabaseAdmin
        .from('image_reconciliation_log')
        .insert(logEntry)
      
      if (logError) {
        console.log('⚠️ Could not log reconciliation (table may not exist):', logError.message)
        // This is non-fatal, continue
      }
      
      res.json({
        success: true,
        message: 'Image reconciliation completed successfully',
        stats
      })
      
    } catch (error: any) {
      console.error('❌ Reconciliation inner error:', error)
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
    
    // Use Supabase Admin client
    const { getSupabaseAdmin } = await import('../auth/supabaseAdmin.ts')
    const supabaseAdmin = getSupabaseAdmin()
    
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Supabase admin client not configured' })
    }
    
    let logs: any[] = []
    let totalImages = 0
    let totalPosts = 0
    
    // Get reconciliation logs (if table exists)
    const { data: logsData, error: logsError } = await supabaseAdmin
      .from('image_reconciliation_log')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(10)
    
    if (!logsError) {
      logs = logsData || []
      console.log(`✅ Found ${logs.length} reconciliation logs`)
    } else if (logsError.message?.includes('does not exist')) {
      console.log('⚠️ image_reconciliation_log table does not exist')
    } else {
      console.error('❌ Error fetching reconciliation logs:', logsError)
    }
    
    // Get current system stats - count posts
    const { count: postsCount, error: postsError } = await supabaseAdmin
      .from('posts')
      .select('*', { count: 'exact', head: true })
    
    if (!postsError) {
      totalPosts = postsCount || 0
    }
    
    // Count post_images
    const { count: imagesCount, error: imagesError } = await supabaseAdmin
      .from('post_images')
      .select('*', { count: 'exact', head: true })
    
    if (!imagesError) {
      totalImages = imagesCount || 0
    } else if (imagesError.message?.includes('does not exist')) {
      console.log('⚠️ post_images table does not exist')
    }
    
    const lastReconciliation = logs[0] || null
    
    // Determine if reconciliation is needed:
    // - If we have logs and the last one succeeded recently (within 30 days), we're good
    // - If we have no logs but we DO have tracked images, we're probably okay (recon ran but table didn't exist)
    // - If we have no logs AND no tracked images, we need reconciliation
    let needsReconciliation = true
    
    if (lastReconciliation && lastReconciliation.status === 'completed') {
      const daysSinceLastRun = (new Date().getTime() - new Date(lastReconciliation.started_at).getTime()) / (24 * 60 * 60 * 1000)
      needsReconciliation = daysSinceLastRun > 30
    } else if (!lastReconciliation && totalImages > 0) {
      // No log but we have images tracked - reconciliation has been run
      needsReconciliation = false
    } else if (!lastReconciliation && totalPosts > 0 && totalImages === 0) {
      // We have posts but no tracked images - definitely need reconciliation
      needsReconciliation = true
    }
    
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
    
    console.log('✅ Supabase admin client available for legacy processing')
    
    // Initialize empty arrays for images
    let uploadedImages: any[] = []
    let posts: any[] = []
    
    // Get uploaded images from images table
    console.log('📁 Querying images table...')
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
    } else {
      uploadedImages = uploadedImagesData || []
      console.log(`✅ Found ${uploadedImages.length} uploaded images`)
    }

    // FIRST: Get ALL posts to see what's in the table
    console.log('📝 Querying ALL posts first (debug)...')
    const { data: allPostsData, error: allPostsError } = await supabaseAdmin
      .from('posts')
      .select('id, title, cover_image_url, status')
      .limit(50)
    
    if (allPostsError) {
      console.error('❌ Error fetching all posts:', allPostsError)
    } else {
      console.log(`📊 Total posts in database: ${allPostsData?.length || 0}`)
      const postsWithCover = allPostsData?.filter(p => p.cover_image_url) || []
      console.log(`📊 Posts with cover_image_url: ${postsWithCover.length}`)
      
      // Show status breakdown
      const statusCounts = allPostsData?.reduce((acc: any, p: any) => {
        acc[p.status] = (acc[p.status] || 0) + 1
        return acc
      }, {}) || {}
      console.log(`📊 Posts by status:`, statusCounts)
      
      if (postsWithCover.length > 0) {
        console.log('📊 Sample posts with cover:', postsWithCover.slice(0, 3).map(p => ({
          id: p.id,
          title: p.title,
          status: p.status,
          cover_image_url: p.cover_image_url?.substring(0, 50) + '...'
        })))
      }
    }

    // Get images from post content (cover images and inline images)
    console.log('📝 Querying posts with cover images...')
    const { data: postsData, error: postsError } = await supabaseAdmin
      .from('posts')
      .select(`
        id,
        title,
        cover_image_url,
        content_rich,
        created_at,
        profiles!posts_author_id_fkey (
          display_name
        )
      `)
      .not('cover_image_url', 'is', null)

    if (postsError) {
      console.error('❌ Error fetching posts with images:', postsError)
      console.error('❌ Error details:', JSON.stringify(postsError, null, 2))
    } else {
      posts = postsData || []
      console.log(`✅ Found ${posts.length} posts with cover images`)
      if (posts.length > 0) {
        console.log('📊 First post:', { id: posts[0].id, title: posts[0].title, has_cover: !!posts[0].cover_image_url })
      }
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
                display_name: null
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
          display_name: null
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
        display_name: null
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
      display_name: null
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
