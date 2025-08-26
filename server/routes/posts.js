import express from 'express'
import { getAllPosts, getPostBySlug, getPostsByTag } from '../controllers/postController.js'

const router = express.Router()

// GET /api/posts - Get all posts
router.get('/', getAllPosts)

// GET /api/posts/tag/:tag - Get posts by tag
router.get('/tag/:tag', getPostsByTag)

// GET /api/posts/:slug - Get single post by slug (must be last)
router.get('/:slug', getPostBySlug)

export default router

