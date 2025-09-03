// Images metadata API routes
import { Router } from 'express'
import { supabaseAdmin } from '../auth/supabaseAdmin.js'
import { requireUser } from '../middleware/requireUser.js'
import { requireAdminOrUser, AdminOrUserRequest } from '../src/middleware/requireAdminOrUser.js'
import { AuthenticatedRequest } from '../middleware/requireUser.js'
import { parseMultipartForm, MulterRequest } from '../src/middleware/multipart.js'
import { 
  validateAltText, 
  validateImageTitle, 
  createImageValidationErrorResponse,
  ImageValidationError 
} from '../src/utils/imageValidation.js'
import {
  validateUploadedFile,
  shouldWarnAboutFileSize,
  generateUniqueFilename,
  generateStoragePath,
  uploadToSupabaseStorage,
  createFileValidationErrorResponse
} from '../src/utils/fileUpload.js'
import {
  createErrorResponse,
  createListResponse,
  createSingleResponse,
  createWarningResponse,
  HTTP_STATUS
} from '../src/utils/responses.js'

const router = Router()

// POST /api/images - Upload image file with metadata
router.post('/', parseMultipartForm, requireAdminOrUser, async (req: MulterRequest & AdminOrUserRequest, res) => {
  try {
    const { alt_text, title } = req.body
    const file = req.file

    // Validate file upload
    const fileErrors = validateUploadedFile(file!)
    if (fileErrors.length > 0) {
      return res.status(422).json(createFileValidationErrorResponse(fileErrors))
    }

    // Validate metadata fields
    const metadataErrors: ImageValidationError[] = [
      ...validateAltText(alt_text),
      ...validateImageTitle(title)
    ]

    if (metadataErrors.length > 0) {
      return res.status(422).json(createImageValidationErrorResponse(metadataErrors))
    }

    // Determine owner_id based on auth type
    let ownerId: string
    if (req.isAdmin) {
      // For admin token, require owner_id in request
      const { owner_id } = req.body
      if (!owner_id || typeof owner_id !== 'string') {
        return res.status(422).json(createImageValidationErrorResponse([{
          field: 'owner_id',
          message: 'owner_id is required when using admin token',
          code: 'REQUIRED'
        }]))
      }
      ownerId = owner_id
    } else {
      // For user token, use authenticated user's ID
      ownerId = req.user!.id
    }

    // Generate unique filename and storage path
    const uniqueFilename = generateUniqueFilename(file!.originalname, ownerId)
    const storagePath = generateStoragePath(uniqueFilename, ownerId)

    // Upload to Supabase Storage
    const uploadResult = await uploadToSupabaseStorage(file!, storagePath)
    
    if (!uploadResult.success) {
      return res.status(500).json({ 
        error: 'Failed to upload file',
        details: uploadResult.error 
      })
    }

    // Store metadata in database
    const { data: imageRecord, error: dbError } = await supabaseAdmin
      .from('images')
      .insert({
        owner_id: ownerId,
        path: storagePath,
        mime_type: file!.mimetype,
        file_size_bytes: file!.size,
        alt_text: alt_text.trim(),
        title: title?.trim() || null,
        is_public: true // Default to public for uploaded images
      })
      .select('id, path, mime_type, file_size_bytes, width, height, is_public, alt_text, title, created_at, updated_at')
      .single()

    if (dbError) {
      // If DB insert fails, try to clean up uploaded file
      try {
        await supabaseAdmin.storage
          .from('post-images')
          .remove([storagePath])
      } catch (cleanupError) {
        console.warn('Failed to cleanup uploaded file after DB error:', cleanupError)
      }
      
      throw dbError
    }

    // Check if we should warn about file size
    const warning = shouldWarnAboutFileSize(file!.size) ? {
      message: `File size (${(file!.size / 1024 / 1024).toFixed(1)}MB) is large. Consider optimizing for better performance.`
    } : undefined

    // Prepare response
    const response: any = {
      image: {
        ...imageRecord,
        public_url: uploadResult.publicUrl
      }
    }

    if (warning) {
      res.status(HTTP_STATUS.CREATED).json(createWarningResponse('image', {
        ...imageRecord,
        public_url: uploadResult.publicUrl
      }, warning.message))
    } else {
      res.status(HTTP_STATUS.CREATED).json(createSingleResponse('image', {
        ...imageRecord,
        public_url: uploadResult.publicUrl
      }))
    }
  } catch (error) {
    console.error('Error uploading image:', error)
    res.status(500).json({ error: 'Failed to upload image' })
  }
})

// POST /api/images/metadata - Store image metadata after client upload
router.post('/metadata', requireAdminOrUser, async (req: AdminOrUserRequest, res) => {
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
    
    // Determine owner_id based on auth type
    let ownerId: string
    if (req.isAdmin) {
      // For admin token, require owner_id in request
      const { owner_id } = req.body
      if (!owner_id || typeof owner_id !== 'string') {
        return res.status(400).json({ 
          error: 'owner_id is required when using admin token' 
        })
      }
      ownerId = owner_id
    } else {
      // For user token, use authenticated user's ID
      ownerId = req.user!.id
    }

    // Store metadata
    const { data, error } = await supabaseAdmin
      .from('images')
      .insert({
        owner_id: ownerId,
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
    
    res.json(createListResponse(imagesWithUrls, pageNum, limitNum, count || 0))
  } catch (error) {
    console.error('Error fetching images:', error)
    res.status(500).json({ error: 'Failed to fetch images' })
  }
})

// GET /api/images/:id - Get single image metadata
router.get('/:id', requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params
    
    const { data: image, error } = await supabaseAdmin
      .from('images')
      .select('id, owner_id, path, mime_type, file_size_bytes, width, height, is_public, alt_text, title, created_at, updated_at')
      .eq('id', id)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Image not found' })
      }
      throw error
    }
    
    // Check access permissions
    if (!image.is_public && image.owner_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(404).json({ error: 'Image not found' })
    }
    
    // Remove owner_id from response for security
    const { owner_id, ...imageResponse } = image
    
    // Generate public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('post-images')
      .getPublicUrl(image.path)
    
    res.json({
      image: {
        ...imageResponse,
        public_url: publicUrl
      }
    })
  } catch (error) {
    console.error('Error fetching image:', error)
    res.status(500).json({ error: 'Failed to fetch image' })
  }
})

// PUT /api/images/:id - Update image metadata
router.put('/:id', requireAdminOrUser, async (req: AdminOrUserRequest, res) => {
  try {
    const { id } = req.params
    const { alt_text, title } = req.body
    
    // Get existing image first
    const { data: existingImage, error: fetchError } = await supabaseAdmin
      .from('images')
      .select('owner_id')
      .eq('id', id)
      .single()
    
    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Image not found' })
      }
      throw fetchError
    }
    
    // Check authorization based on auth type
    if (!req.isAdmin) {
      // For user tokens, check ownership
      if (existingImage.owner_id !== req.user!.id && req.user!.role !== 'admin') {
        return res.status(403).json({ error: 'Not authorized to update this image' })
      }
    }
    // Admin token users can update any image
    
    // Validate fields
    const errors: ImageValidationError[] = [
      ...validateAltText(alt_text),
      ...validateImageTitle(title)
    ]
    
    // Return validation errors if any
    if (errors.length > 0) {
      return res.status(422).json(createImageValidationErrorResponse(errors))
    }
    
    // Build update object
    const updates: any = {
      alt_text: alt_text.trim(),
      updated_at: new Date().toISOString()
    }
    
    if (title !== undefined) {
      updates.title = title?.trim() || null
    }
    
    // Update the image metadata
    const { data: updatedImage, error: updateError } = await supabaseAdmin
      .from('images')
      .update(updates)
      .eq('id', id)
      .select('id, path, mime_type, file_size_bytes, width, height, is_public, alt_text, title, created_at, updated_at')
      .single()
    
    if (updateError) {
      throw updateError
    }
    
    // Generate public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('post-images')
      .getPublicUrl(updatedImage.path)
    
    res.json({
      image: {
        ...updatedImage,
        public_url: publicUrl
      }
    })
  } catch (error) {
    console.error('Error updating image:', error)
    res.status(500).json({ error: 'Failed to update image' })
  }
})

// DELETE /api/images/:id - Delete image and its storage file
router.delete('/:id', requireAdminOrUser, async (req: AdminOrUserRequest, res) => {
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
    
    // Check authorization based on auth type
    if (!req.isAdmin) {
      // For user tokens, check ownership
      if (image.owner_id !== req.user!.id && req.user!.role !== 'admin') {
        return res.status(403).json({ error: 'Not authorized to delete this image' })
      }
    }
    // Admin token users can delete any image
    
    // Check if image is referenced by any posts (cover images or in content)
    // Generate the public URL to check against
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('post-images')
      .getPublicUrl(image.path)
    
    const { data: referencingPosts, error: refError } = await supabaseAdmin
      .from('posts')
      .select('id, title')
      .or(`cover_image_url.eq.${publicUrl},content_rich.cs."${image.path}"`)
      .limit(5)
    
    if (refError) {
      console.warn('Error checking post references:', refError)
    }
    
    if (referencingPosts && referencingPosts.length > 0) {
      return res.status(409).json({ 
        error: 'Cannot delete image: it is being used by one or more posts',
        references: referencingPosts.map(post => ({ id: post.id, title: post.title }))
      })
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
