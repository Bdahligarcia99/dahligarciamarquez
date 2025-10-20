/**
 * Image Tracking Service
 * 
 * This service handles the pre-computation of image relationships for the optimized
 * image library. It extracts images from post content and maintains the post_images table.
 */

import { getSupabaseAdmin } from '../../auth/supabaseAdmin.ts'

export interface ImageReference {
  url: string
  type: 'cover' | 'inline'
  alt_text?: string
  width?: number
  height?: number
  usage_context?: any
}

export interface PostImageSync {
  post_id: string
  images_found: ImageReference[]
  images_added: number
  images_updated: number
  images_removed: number
}

export class ImageTrackingService {
  private supabase = getSupabaseAdmin()

  /**
   * Sync all images for a specific post
   * This is called when posts are created/updated
   */
  async syncPostImages(postId: string, content_rich?: any, cover_image_url?: string): Promise<PostImageSync> {
    const images_found: ImageReference[] = []
    
    // Extract cover image
    if (cover_image_url) {
      images_found.push({
        url: cover_image_url,
        type: 'cover',
        alt_text: null,
        usage_context: { source: 'cover_image_url' }
      })
    }
    
    // Extract inline images from rich content
    if (content_rich) {
      const inlineImages = this.extractImagesFromContent(content_rich)
      images_found.push(...inlineImages)
    }
    
    // Get existing images for this post
    const { data: existingImages, error: fetchError } = await this.supabase
      .from('post_images')
      .select('*')
      .eq('post_id', postId)
    
    if (fetchError) {
      console.error('Error fetching existing images:', fetchError)
      throw fetchError
    }
    
    const existing = existingImages || []
    
    // Determine what needs to be added, updated, or removed
    const toAdd: ImageReference[] = []
    const toUpdate: Array<{ id: string; image: ImageReference }> = []
    const toRemoveIds: string[] = []
    
    // Find images to add or update
    for (const foundImage of images_found) {
      const existingImage = existing.find(img => 
        img.image_url === foundImage.url && img.image_type === foundImage.type
      )
      
      if (existingImage) {
        // Check if update needed
        if (this.needsUpdate(existingImage, foundImage)) {
          toUpdate.push({ id: existingImage.id, image: foundImage })
        }
      } else {
        toAdd.push(foundImage)
      }
    }
    
    // Find images to remove (exist in DB but not in content)
    for (const existingImage of existing) {
      const stillExists = images_found.some(img => 
        img.url === existingImage.image_url && img.type === existingImage.image_type
      )
      
      if (!stillExists) {
        toRemoveIds.push(existingImage.id)
      }
    }
    
    // Execute changes
    let images_added = 0
    let images_updated = 0
    let images_removed = 0
    
    // Add new images
    if (toAdd.length > 0) {
      const insertData = toAdd.map(img => ({
        post_id: postId,
        image_url: img.url,
        image_type: img.type,
        alt_text: img.alt_text,
        width: img.width,
        height: img.height,
        usage_context: img.usage_context
      }))
      
      const { error: insertError } = await this.supabase
        .from('post_images')
        .insert(insertData)
      
      if (insertError) {
        console.error('Error inserting images:', insertError)
        throw insertError
      }
      
      images_added = toAdd.length
    }
    
    // Update existing images
    for (const update of toUpdate) {
      const { error: updateError } = await this.supabase
        .from('post_images')
        .update({
          alt_text: update.image.alt_text,
          width: update.image.width,
          height: update.image.height,
          usage_context: update.image.usage_context,
          updated_at: new Date().toISOString()
        })
        .eq('id', update.id)
      
      if (updateError) {
        console.error('Error updating image:', updateError)
        throw updateError
      }
      
      images_updated++
    }
    
    // Remove deleted images
    if (toRemoveIds.length > 0) {
      const { error: deleteError } = await this.supabase
        .from('post_images')
        .delete()
        .in('id', toRemoveIds)
      
      if (deleteError) {
        console.error('Error removing images:', deleteError)
        throw deleteError
      }
      
      images_removed = toRemoveIds.length
    }
    
    return {
      post_id: postId,
      images_found,
      images_added,
      images_updated,
      images_removed
    }
  }

  /**
   * Remove all image references for a post (when post is deleted)
   */
  async removePostImages(postId: string): Promise<void> {
    const { error } = await this.supabase
      .from('post_images')
      .delete()
      .eq('post_id', postId)
    
    if (error) {
      console.error('Error removing post images:', error)
      throw error
    }
  }

  /**
   * Extract images from TipTap rich content JSON
   */
  private extractImagesFromContent(content: any, context: any = {}): ImageReference[] {
    const images: ImageReference[] = []
    
    if (!content || typeof content !== 'object') {
      return images
    }
    
    if (Array.isArray(content)) {
      content.forEach((item, index) => {
        const childImages = this.extractImagesFromContent(item, { ...context, index })
        images.push(...childImages)
      })
      return images
    }
    
    // Handle image nodes
    if (content.type === 'image' && content.attrs?.src) {
      images.push({
        url: content.attrs.src,
        type: 'inline',
        alt_text: content.attrs.alt || null,
        width: content.attrs.width || null,
        height: content.attrs.height || null,
        usage_context: {
          node_type: 'image',
          position: context,
          title: content.attrs.title || null
        }
      })
    }
    
    // Handle figure nodes (images with captions)
    if (content.type === 'figure' && content.content) {
      const figureImages = this.extractImagesFromContent(content.content, {
        ...context,
        figure: true,
        caption: this.extractTextFromNode(content.content)
      })
      images.push(...figureImages.map(img => ({
        ...img,
        usage_context: {
          ...img.usage_context,
          is_figure: true,
          caption: context.caption
        }
      })))
    }
    
    // Recursively check nested content
    if (content.content) {
      const nestedImages = this.extractImagesFromContent(content.content, context)
      images.push(...nestedImages)
    }
    
    // Check other properties that might contain nested content
    Object.entries(content).forEach(([key, value]) => {
      if (key !== 'content' && typeof value === 'object') {
        const nestedImages = this.extractImagesFromContent(value, { ...context, [key]: true })
        images.push(...nestedImages)
      }
    })
    
    return images
  }

  /**
   * Extract text content from a node (for captions)
   */
  private extractTextFromNode(node: any): string {
    if (!node) return ''
    
    if (typeof node === 'string') return node
    
    if (Array.isArray(node)) {
      return node.map(item => this.extractTextFromNode(item)).join(' ')
    }
    
    if (node.type === 'text') {
      return node.text || ''
    }
    
    if (node.content) {
      return this.extractTextFromNode(node.content)
    }
    
    return ''
  }

  /**
   * Check if an existing image record needs updating
   */
  private needsUpdate(existing: any, found: ImageReference): boolean {
    return (
      existing.alt_text !== found.alt_text ||
      existing.width !== found.width ||
      existing.height !== found.height ||
      JSON.stringify(existing.usage_context) !== JSON.stringify(found.usage_context)
    )
  }

  /**
   * Get image statistics for a post
   */
  async getPostImageStats(postId: string): Promise<{
    total: number
    cover_images: number
    inline_images: number
  }> {
    const { data, error } = await this.supabase
      .from('post_images')
      .select('image_type')
      .eq('post_id', postId)
    
    if (error) {
      console.error('Error fetching post image stats:', error)
      throw error
    }
    
    const images = data || []
    const cover_images = images.filter(img => img.image_type === 'cover').length
    const inline_images = images.filter(img => img.image_type === 'inline').length
    
    return {
      total: images.length,
      cover_images,
      inline_images
    }
  }

  /**
   * Get all images with usage statistics
   */
  async getImageUsageStats(): Promise<Array<{
    image_url: string
    usage_count: number
    posts: Array<{ post_id: string; post_title?: string }>
    first_used: string
    last_used: string
  }>> {
    const { data, error } = await this.supabase
      .from('post_images')
      .select(`
        image_url,
        created_at,
        updated_at,
        posts!post_images_post_id_fkey (
          id,
          title
        )
      `)
      .order('image_url')
    
    if (error) {
      console.error('Error fetching image usage stats:', error)
      throw error
    }
    
    // Group by image URL
    const imageMap = new Map<string, any>()
    
    for (const item of data || []) {
      const url = item.image_url
      
      if (!imageMap.has(url)) {
        imageMap.set(url, {
          image_url: url,
          usage_count: 0,
          posts: [],
          first_used: item.created_at,
          last_used: item.updated_at
        })
      }
      
      const stats = imageMap.get(url)
      stats.usage_count++
      stats.posts.push({
        post_id: item.posts.id,
        post_title: item.posts.title
      })
      
      // Update first/last used dates
      if (item.created_at < stats.first_used) {
        stats.first_used = item.created_at
      }
      if (item.updated_at > stats.last_used) {
        stats.last_used = item.updated_at
      }
    }
    
    return Array.from(imageMap.values())
  }
}

// Export singleton instance
export const imageTrackingService = new ImageTrackingService()
