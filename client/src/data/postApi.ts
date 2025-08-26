// src/data/postApi.ts
import { posts } from './posts'

export function queryPosts({ q = '', tag = '', page = 1, pageSize = 9 } = {}) {
  const qn = q.trim().toLowerCase()
  const filtered = posts.filter(p => {
    const qHit = !qn || p.title.toLowerCase().includes(qn) || p.excerpt.toLowerCase().includes(qn) || p.content.toLowerCase().includes(qn)
    const tagHit = !tag || p.tags.includes(tag)
    return qHit && tagHit
  })
  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = (page - 1) * pageSize
  const items = filtered.slice(start, start + pageSize)
  return { items, total, totalPages, page }
}

export function getPostBySlug(slug: string) {
  return posts.find(p => p.slug === slug) || null
}
