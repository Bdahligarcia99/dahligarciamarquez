import axios from 'axios'
import { getSessionToken } from '../lib/supabase'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Posts API
export const postsAPI = {
  // Get all posts
  getAllPosts: async () => {
    try {
      const response = await api.get('/posts')
      return response.data
    } catch (error) {
      console.error('Error fetching posts:', error)
      throw error
    }
  },

  // Get single post by slug
  // fromDashboard: if true, includes auth token to allow viewing non-published posts
  getPostBySlug: async (slug, fromDashboard = false) => {
    try {
      const config = {}
      let url = `/posts/slug/${slug}`
      
      if (fromDashboard) {
        url += '?from=dashboard'
        // Include auth token for admin access
        // Wait a moment for Supabase to initialize session from localStorage (new tab scenario)
        let token = await getSessionToken()
        if (!token) {
          // Retry after a short delay if session not ready
          await new Promise(resolve => setTimeout(resolve, 500))
          token = await getSessionToken()
        }
        if (token) {
          config.headers = {
            Authorization: `Bearer ${token}`
          }
          console.log('[API] Viewing post with admin auth')
        } else {
          console.warn('[API] No auth token available for dashboard view')
        }
      }
      
      const response = await api.get(url, config)
      return response.data
    } catch (error) {
      console.error('Error fetching post:', error)
      throw error
    }
  },
}

export default api

