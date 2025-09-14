// Images metadata API routes
import { Router } from 'express'
import { requireAdmin } from '../src/middleware/requireAdmin.ts'
import { parseMultipartForm, MulterRequest } from '../src/middleware/multipart.js'
import { storage } from '../src/storage/index.js'

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
router.post('/uploads/image', parseMultipartForm, requireAdmin, async (req: MulterRequest, res) => {
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

// GET /api/images - Admin only: get all images (uploaded files + URLs from posts)
router.get('/', requireAdmin, async (req, res) => {
  try {
    console.log('Images endpoint called successfully')
    
    // Initialize empty arrays for images
    let uploadedImages: any[] = []
    let posts: any[] = []
    
    try {
      const { getSupabaseAdmin } = await import('../auth/supabaseAdmin.js')
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

export default router
