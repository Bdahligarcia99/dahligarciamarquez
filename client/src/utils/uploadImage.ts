// Image upload utility for admin users
import { adminHeaders } from '../lib/adminAuth'
import { API_URL, API_MISCONFIGURED } from '../lib/api'

export interface UploadImageResult {
  url: string
  width: number
  height: number
}

/**
 * Upload an image file to the server
 * Requires admin authentication
 */
export async function uploadImage(file: File): Promise<UploadImageResult> {
  if (API_MISCONFIGURED) {
    throw new Error('VITE_API_URL is not set. Check Vercel env vars.')
  }

  // Create FormData for multipart upload
  const formData = new FormData()
  formData.append('image', file)

  try {
    const response = await fetch(`${API_URL}/api/images/uploads/image`, {
      method: 'POST',
      headers: {
        ...adminHeaders() // Includes Authorization: Bearer <token>
      },
      body: formData
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = 'Upload failed'

      try {
        const errorData = JSON.parse(errorText)
        errorMessage = errorData.error || errorMessage
      } catch {
        errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`
      }

      // Handle specific error cases
      if (response.status === 401 || response.status === 403) {
        throw new Error('Admin authentication required. Please check your admin token.')
      } else if (response.status === 413) {
        throw new Error('File too large. Maximum size is 5MB.')
      } else if (response.status === 415) {
        throw new Error('Invalid file type. Only PNG, JPEG, and WebP images are supported.')
      } else {
        throw new Error(errorMessage)
      }
    }

    const result = await response.json()
    
    // Validate response shape
    if (!result.url || typeof result.width !== 'number' || typeof result.height !== 'number') {
      throw new Error('Invalid response from server')
    }

    return {
      url: result.url,
      width: result.width,
      height: result.height
    }

  } catch (error) {
    // Re-throw our custom errors, wrap others
    if (error instanceof Error) {
      throw error
    } else {
      throw new Error('Network error occurred during upload')
    }
  }
}
