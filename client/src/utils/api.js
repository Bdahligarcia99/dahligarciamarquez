import axios from 'axios'

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
      const response = await api.get('/api/posts')
      return response.data
    } catch (error) {
      console.error('Error fetching posts:', error)
      throw error
    }
  },

  // Get single post by slug
  getPostBySlug: async (slug) => {
    try {
      const response = await api.get(`/api/posts/${slug}`)
      return response.data
    } catch (error) {
      console.error('Error fetching post:', error)
      throw error
    }
  },
}

export default api

