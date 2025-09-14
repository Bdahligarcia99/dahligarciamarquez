// Image upload utility for admin users
import { adminHeaders } from '../lib/adminAuth'
import { getApiBase, API_MISCONFIGURED } from '../lib/apiBase'
import { isSupabaseConfigured } from '../lib/supabase'

export interface UploadImageResult {
  url: string
  width: number
  height: number
}

export interface UploadError {
  kind: 'uploads-disabled' | 'auth-error' | 'file-error' | 'network-error' | 'server-error'
  message: string
}

/**
 * Upload an image file to the server
 * Requires admin authentication
 */
export async function uploadImage(file: File): Promise<UploadImageResult> {
  if (API_MISCONFIGURED) {
    const error: UploadError = {
      kind: 'uploads-disabled',
      message: 'API configuration is missing. Image uploads are not available.'
    }
    throw error
  }

  // Create FormData for multipart upload
  const formData = new FormData()
  formData.append('image', file)

  try {
    const response = await fetch(`${getApiBase()}/api/images/uploads/image`, {
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

      // Handle specific error cases with typed errors
      if (response.status === 401 || response.status === 403) {
        const error: UploadError = {
          kind: 'auth-error',
          message: 'Admin authentication required. Please check your admin token.'
        }
        throw error
      } else if (response.status === 413) {
        const error: UploadError = {
          kind: 'file-error',
          message: 'File too large. Maximum size is 5MB.'
        }
        throw error
      } else if (response.status === 415) {
        const error: UploadError = {
          kind: 'file-error',
          message: 'Invalid file type. Only PNG, JPEG, and WebP images are supported.'
        }
        throw error
      } else if (response.status === 503) {
        const error: UploadError = {
          kind: 'uploads-disabled',
          message: 'Image uploads are not configured on the server. Please contact the administrator.'
        }
        throw error
      } else {
        const error: UploadError = {
          kind: 'server-error',
          message: errorMessage
        }
        throw error
      }
    }

    const result = await response.json()
    
    // Validate response shape
    if (!result.url || typeof result.width !== 'number' || typeof result.height !== 'number') {
      throw new Error('Invalid response from server')
    }

    // Ensure the URL is absolute by using the same API base
    try {
      const apiBase = getApiBase();
      console.log('API base for image URL:', apiBase);
      console.log('Original image URL from server:', result.url);
      
      // Smart URL construction based on API base
      let absoluteUrl;
      if (result.url.startsWith('http')) {
        // Already absolute
        absoluteUrl = result.url;
      } else if (apiBase && apiBase !== '') {
        // Use API base for absolute URL
        absoluteUrl = `${apiBase}${result.url}`;
      } else {
        // No API base - use relative URL (same-origin)
        absoluteUrl = result.url;
      }
      
      // Debug: Test if the constructed URL is accessible
      console.log('Testing URL accessibility...');
      const testImg = new Image();
      testImg.onload = () => console.log('✅ URL construction test passed:', absoluteUrl);
      testImg.onerror = () => console.log('❌ URL construction test failed:', absoluteUrl);
      testImg.src = absoluteUrl;
      
      console.log('Final image URL:', absoluteUrl);
      
      return {
        url: absoluteUrl,
        width: result.width,
        height: result.height
      }
    } catch (error) {
      console.error('Error constructing absolute URL:', error);
      // Fallback to original URL if there's an error
      return {
        url: result.url,
        width: result.width,
        height: result.height
      }
    }

  } catch (error) {
    // Re-throw our typed errors, wrap others
    if (error && typeof error === 'object' && 'kind' in error) {
      throw error // Already a typed UploadError
    } else if (error instanceof Error) {
      const typedError: UploadError = {
        kind: 'network-error',
        message: error.message
      }
      throw typedError
    } else {
      const typedError: UploadError = {
        kind: 'network-error',
        message: 'Network error occurred during upload'
      }
      throw typedError
    }
  }
}
