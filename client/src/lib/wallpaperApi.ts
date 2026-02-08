// Page Wallpaper API
// Handles saving and loading page wallpapers from Supabase

import { getSupabaseClient } from './supabase'

// Types
export interface PageWallpaper {
  url: string
  alt: string
}

export interface PageWallpaperEntry {
  page_id: string
  wallpaper: PageWallpaper | null
  is_universal_wallpaper?: boolean
}

/**
 * Get wallpaper for a specific page
 */
export async function getPageWallpaper(
  pageId: string
): Promise<{ data: PageWallpaper | null; error: Error | null }> {
  const client = getSupabaseClient()
  
  if (!client) {
    return { data: null, error: new Error('Supabase not configured') }
  }
  
  try {
    const { data, error } = await client.rpc('get_page_wallpaper', {
      p_page_id: pageId
    })
    
    if (error) {
      console.error('Error loading page wallpaper:', error)
      return { data: null, error }
    }
    
    return { data: data as PageWallpaper | null, error: null }
  } catch (err) {
    console.error('Error loading page wallpaper:', err)
    return { data: null, error: err as Error }
  }
}

/**
 * Set wallpaper for a specific page
 */
export async function setPageWallpaper(
  pageId: string,
  wallpaper: PageWallpaper
): Promise<{ success: boolean; error: Error | null }> {
  const client = getSupabaseClient()
  
  if (!client) {
    return { success: false, error: new Error('Supabase not configured') }
  }
  
  try {
    const { data, error } = await client.rpc('set_page_wallpaper', {
      p_page_id: pageId,
      p_wallpaper: wallpaper
    })
    
    if (error) {
      console.error('Error saving page wallpaper:', error)
      return { success: false, error }
    }
    
    console.log('✅ Page wallpaper saved for:', pageId, data)
    return { success: true, error: null }
  } catch (err) {
    console.error('Error saving page wallpaper:', err)
    return { success: false, error: err as Error }
  }
}

/**
 * Remove wallpaper from a specific page
 */
export async function removePageWallpaper(
  pageId: string
): Promise<{ success: boolean; error: Error | null }> {
  const client = getSupabaseClient()
  
  if (!client) {
    return { success: false, error: new Error('Supabase not configured') }
  }
  
  try {
    const { error } = await client.rpc('remove_page_wallpaper', {
      p_page_id: pageId
    })
    
    if (error) {
      console.error('Error removing page wallpaper:', error)
      return { success: false, error }
    }
    
    console.log('✅ Page wallpaper removed for:', pageId)
    return { success: true, error: null }
  } catch (err) {
    console.error('Error removing page wallpaper:', err)
    return { success: false, error: err as Error }
  }
}

/**
 * Get all page wallpapers at once (for dashboard)
 */
export async function getAllPageWallpapers(): Promise<{ 
  data: { wallpapers: Record<string, PageWallpaper>; universalPageId: string | null } | null
  error: Error | null 
}> {
  const client = getSupabaseClient()
  
  if (!client) {
    return { data: null, error: new Error('Supabase not configured') }
  }
  
  try {
    const { data, error } = await client.rpc('get_all_page_wallpapers')
    
    if (error) {
      console.error('Error loading all page wallpapers:', error)
      return { data: null, error }
    }
    
    // Convert array to object keyed by page_id
    const wallpapers: Record<string, PageWallpaper> = {}
    let universalPageId: string | null = null
    
    if (data && Array.isArray(data)) {
      for (const entry of data as PageWallpaperEntry[]) {
        if (entry.wallpaper) {
          wallpapers[entry.page_id] = entry.wallpaper
        }
        if (entry.is_universal_wallpaper) {
          universalPageId = entry.page_id
        }
      }
    }
    
    console.log('✅ All page wallpapers loaded:', { wallpapers, universalPageId })
    return { data: { wallpapers, universalPageId }, error: null }
  } catch (err) {
    console.error('Error loading all page wallpapers:', err)
    return { data: null, error: err as Error }
  }
}

/**
 * Set a page as the universal wallpaper source
 */
export async function setUniversalWallpaper(
  pageId: string
): Promise<{ previousPageId: string | null; error: Error | null }> {
  const client = getSupabaseClient()
  
  if (!client) {
    return { previousPageId: null, error: new Error('Supabase not configured') }
  }
  
  try {
    const { data, error } = await client.rpc('set_universal_wallpaper', {
      p_page_id: pageId
    })
    
    if (error) {
      console.error('Error setting universal wallpaper:', error)
      return { previousPageId: null, error }
    }
    
    console.log('✅ Universal wallpaper set to:', pageId, 'Previous:', data)
    return { previousPageId: data as string | null, error: null }
  } catch (err) {
    console.error('Error setting universal wallpaper:', err)
    return { previousPageId: null, error: err as Error }
  }
}

/**
 * Clear universal wallpaper (no page is universal)
 */
export async function clearUniversalWallpaper(): Promise<{ success: boolean; error: Error | null }> {
  const client = getSupabaseClient()
  
  if (!client) {
    return { success: false, error: new Error('Supabase not configured') }
  }
  
  try {
    const { error } = await client.rpc('clear_universal_wallpaper')
    
    if (error) {
      console.error('Error clearing universal wallpaper:', error)
      return { success: false, error }
    }
    
    console.log('✅ Universal wallpaper cleared')
    return { success: true, error: null }
  } catch (err) {
    console.error('Error clearing universal wallpaper:', err)
    return { success: false, error: err as Error }
  }
}

/**
 * Get the universal wallpaper
 */
export async function getUniversalWallpaper(): Promise<{ 
  data: { pageId: string; wallpaper: PageWallpaper } | null
  error: Error | null 
}> {
  const client = getSupabaseClient()
  
  if (!client) {
    return { data: null, error: new Error('Supabase not configured') }
  }
  
  try {
    const { data, error } = await client.rpc('get_universal_wallpaper')
    
    if (error) {
      console.error('Error loading universal wallpaper:', error)
      return { data: null, error }
    }
    
    if (data && Array.isArray(data) && data.length > 0) {
      const entry = data[0] as { page_id: string; wallpaper: PageWallpaper }
      return { data: { pageId: entry.page_id, wallpaper: entry.wallpaper }, error: null }
    }
    
    return { data: null, error: null }
  } catch (err) {
    console.error('Error loading universal wallpaper:', err)
    return { data: null, error: err as Error }
  }
}
