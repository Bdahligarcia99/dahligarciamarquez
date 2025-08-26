import pool from '../db/connection.js'

// Get all posts
export const getAllPosts = async (req, res) => {
  try {
    const query = `
      SELECT id, title, slug, excerpt, tags, image_url, created_at, updated_at
      FROM posts
      ORDER BY created_at DESC
    `
    
    const result = await pool.query(query)
    
    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching posts:', error)
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to fetch posts'
    })
  }
}

// Get single post by slug
export const getPostBySlug = async (req, res) => {
  try {
    const { slug } = req.params
    
    const query = `
      SELECT id, title, slug, content, excerpt, tags, image_url, created_at, updated_at
      FROM posts
      WHERE slug = $1
    `
    
    const result = await pool.query(query, [slug])
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Post not found',
        message: `No post found with slug: ${slug}`
      })
    }
    
    res.json(result.rows[0])
  } catch (error) {
    console.error('Error fetching post:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch post'
    })
  }
}

// Get posts by tag (bonus feature)
export const getPostsByTag = async (req, res) => {
  try {
    const { tag } = req.params
    
    const query = `
      SELECT id, title, slug, excerpt, tags, image_url, created_at, updated_at
      FROM posts
      WHERE $1 = ANY(tags)
      ORDER BY created_at DESC
    `
    
    const result = await pool.query(query, [tag])
    
    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching posts by tag:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch posts by tag'
    })
  }
}

