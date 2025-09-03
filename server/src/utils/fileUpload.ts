import { Request } from 'express'
import { supabaseAdmin } from '../../auth/supabaseAdmin.js'

/**
 * File upload constraints
 */
export const FILE_CONSTRAINTS = {
  maxSize: {
    warning: 2 * 1024 * 1024, // 2MB - show warning
    hardLimit: 8 * 1024 * 1024 // 8MB - hard block
  },
  allowedMimeTypes: [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/webp',
    'image/gif'
  ],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif']
} as const

/**
 * File validation error structure
 */
export interface FileValidationError {
  field: string
  message: string
  code: string
}

/**
 * File upload result
 */
export interface FileUploadResult {
  success: boolean
  warning?: {
    message: string
  }
  file?: {
    path: string
    publicUrl: string
    size: number
    mimeType: string
    width?: number
    height?: number
  }
  errors?: FileValidationError[]
}

/**
 * Validates uploaded file
 */
export function validateUploadedFile(file: Express.Multer.File): FileValidationError[] {
  const errors: FileValidationError[] = []

  if (!file) {
    errors.push({
      field: 'file',
      message: 'File is required',
      code: 'REQUIRED'
    })
    return errors
  }

  // Check MIME type
  if (!FILE_CONSTRAINTS.allowedMimeTypes.includes(file.mimetype)) {
    errors.push({
      field: 'file',
      message: `Invalid file type. Allowed types: ${FILE_CONSTRAINTS.allowedMimeTypes.join(', ')}`,
      code: 'INVALID_MIME_TYPE'
    })
  }

  // Check file extension
  const fileExtension = getFileExtension(file.originalname).toLowerCase()
  if (!FILE_CONSTRAINTS.allowedExtensions.includes(fileExtension)) {
    errors.push({
      field: 'file',
      message: `Invalid file extension. Allowed extensions: ${FILE_CONSTRAINTS.allowedExtensions.join(', ')}`,
      code: 'INVALID_EXTENSION'
    })
  }

  // Check hard size limit
  if (file.size > FILE_CONSTRAINTS.maxSize.hardLimit) {
    errors.push({
      field: 'file',
      message: `File size must be less than ${FILE_CONSTRAINTS.maxSize.hardLimit / 1024 / 1024}MB`,
      code: 'FILE_TOO_LARGE'
    })
  }

  return errors
}

/**
 * Checks if file size should trigger a warning
 */
export function shouldWarnAboutFileSize(fileSize: number): boolean {
  return fileSize > FILE_CONSTRAINTS.maxSize.warning && fileSize <= FILE_CONSTRAINTS.maxSize.hardLimit
}

/**
 * Sanitizes filename for safe storage
 */
export function sanitizeFilename(filename: string): string {
  // Extract extension
  const extension = getFileExtension(filename)
  const nameWithoutExt = filename.slice(0, filename.lastIndexOf('.')) || filename

  // Sanitize the name part
  const sanitized = nameWithoutExt
    .toLowerCase()
    .replace(/[^a-z0-9\-_]/g, '-') // Replace non-alphanumeric with dashes
    .replace(/--+/g, '-') // Replace multiple dashes with single
    .replace(/^-+|-+$/g, '') // Trim dashes from start/end
    .slice(0, 50) // Limit length

  // If sanitization resulted in empty string, use default
  const finalName = sanitized || 'image'

  return `${finalName}${extension}`
}

/**
 * Generates unique filename to avoid collisions
 */
export function generateUniqueFilename(originalFilename: string, userId: string): string {
  const sanitizedName = sanitizeFilename(originalFilename)
  const timestamp = Date.now()
  const randomSuffix = Math.random().toString(36).substring(2, 8)
  const extension = getFileExtension(sanitizedName)
  const nameWithoutExt = sanitizedName.slice(0, sanitizedName.lastIndexOf('.')) || sanitizedName

  return `${nameWithoutExt}-${timestamp}-${randomSuffix}${extension}`
}

/**
 * Generates storage path for uploaded file
 */
export function generateStoragePath(filename: string, userId: string): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  
  return `${userId}/${year}/${month}/${filename}`
}

/**
 * Uploads file to Supabase Storage
 */
export async function uploadToSupabaseStorage(
  file: Express.Multer.File, 
  storagePath: string
): Promise<{ success: boolean; publicUrl?: string; error?: string }> {
  try {
    // Upload file to Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from('post-images')
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false // Don't overwrite existing files
      })

    if (error) {
      console.error('Supabase storage upload error:', error)
      return { success: false, error: error.message }
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('post-images')
      .getPublicUrl(storagePath)

    return { success: true, publicUrl }
  } catch (error: any) {
    console.error('Storage upload error:', error)
    return { success: false, error: error.message || 'Upload failed' }
  }
}

/**
 * Gets file extension from filename
 */
function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.')
  return lastDotIndex !== -1 ? filename.slice(lastDotIndex) : ''
}

/**
 * Creates validation error response for file uploads
 */
export function createFileValidationErrorResponse(errors: FileValidationError[]) {
  const errorMap: Record<string, string[]> = {}
  
  for (const error of errors) {
    if (!errorMap[error.field]) {
      errorMap[error.field] = []
    }
    errorMap[error.field].push(error.message)
  }

  return {
    error: 'Validation failed',
    fields: errorMap
  }
}
