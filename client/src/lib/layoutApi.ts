// Page Layout API
// Handles saving and loading card layouts from Supabase
// Supports multiple layout slots per page

import { getSupabaseClient } from './supabase'

// Types
export interface CardPoint {
  x: number
  y: number
}

export interface Card {
  id: string
  points: CardPoint[]
}

export interface LayoutSettings {
  scrollRatio: number
  scrollSpeed: number
  wallpaperPosition: number
  alignmentMargin: number
}

export interface LayoutSlot {
  id: string
  page_id: string
  slot_number: number
  name: string
  cards: Card[]
  settings: LayoutSettings
  is_published: boolean
  created_at: string
  updated_at: string
}

// Default settings
export const DEFAULT_LAYOUT_SETTINGS: LayoutSettings = {
  scrollRatio: 2,
  scrollSpeed: 1,
  wallpaperPosition: 0,
  alignmentMargin: 1
}

// Max slots per page
export const MAX_SLOTS = 10

/**
 * Save a layout to a specific slot
 */
export async function saveLayoutSlot(
  pageId: string,
  slotNumber: number,
  name: string,
  cards: Card[],
  settings: LayoutSettings
): Promise<{ data: LayoutSlot | null; error: Error | null }> {
  const client = getSupabaseClient()
  
  if (!client) {
    return { data: null, error: new Error('Supabase not configured') }
  }
  
  try {
    const { data, error } = await client.rpc('save_layout_slot', {
      p_page_id: pageId,
      p_slot_number: slotNumber,
      p_name: name,
      p_cards: cards,
      p_settings: settings
    })
    
    if (error) {
      console.error('Error saving layout slot:', error)
      return { data: null, error }
    }
    
    console.log('✅ Layout slot saved:', data)
    return { data, error: null }
  } catch (err) {
    console.error('Error saving layout slot:', err)
    return { data: null, error: err as Error }
  }
}

/**
 * Get all layout slots for a page
 */
export async function getLayoutSlots(
  pageId: string
): Promise<{ data: LayoutSlot[] | null; error: Error | null }> {
  const client = getSupabaseClient()
  
  if (!client) {
    return { data: null, error: new Error('Supabase not configured') }
  }
  
  try {
    const { data, error } = await client
      .from('page_layouts')
      .select('*')
      .eq('page_id', pageId)
      .order('slot_number')
    
    if (error) {
      console.error('Error loading layout slots:', error)
      return { data: null, error }
    }
    
    console.log('✅ Layout slots loaded:', data)
    return { data: data || [], error: null }
  } catch (err) {
    console.error('Error loading layout slots:', err)
    return { data: null, error: err as Error }
  }
}

/**
 * Get a specific layout slot
 */
export async function getLayoutSlot(
  pageId: string,
  slotNumber: number
): Promise<{ data: LayoutSlot | null; error: Error | null }> {
  const client = getSupabaseClient()
  
  if (!client) {
    return { data: null, error: new Error('Supabase not configured') }
  }
  
  try {
    const { data, error } = await client
      .from('page_layouts')
      .select('*')
      .eq('page_id', pageId)
      .eq('slot_number', slotNumber)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return { data: null, error: null } // Not found is ok
      }
      console.error('Error loading layout slot:', error)
      return { data: null, error }
    }
    
    return { data, error: null }
  } catch (err) {
    console.error('Error loading layout slot:', err)
    return { data: null, error: err as Error }
  }
}

/**
 * Publish a specific slot (unpublishes others)
 */
export async function publishLayoutSlot(
  pageId: string,
  slotNumber: number
): Promise<{ data: LayoutSlot | null; error: Error | null }> {
  const client = getSupabaseClient()
  
  if (!client) {
    return { data: null, error: new Error('Supabase not configured') }
  }
  
  try {
    const { data, error } = await client.rpc('publish_layout_slot', {
      p_page_id: pageId,
      p_slot_number: slotNumber
    })
    
    if (error) {
      console.error('Error publishing layout slot:', error)
      return { data: null, error }
    }
    
    console.log('✅ Layout slot published:', data)
    return { data, error: null }
  } catch (err) {
    console.error('Error publishing layout slot:', err)
    return { data: null, error: err as Error }
  }
}

/**
 * Delete a layout slot
 */
export async function deleteLayoutSlot(
  pageId: string,
  slotNumber: number
): Promise<{ success: boolean; error: Error | null }> {
  const client = getSupabaseClient()
  
  if (!client) {
    return { success: false, error: new Error('Supabase not configured') }
  }
  
  try {
    const { data, error } = await client.rpc('delete_layout_slot', {
      p_page_id: pageId,
      p_slot_number: slotNumber
    })
    
    if (error) {
      console.error('Error deleting layout slot:', error)
      return { success: false, error }
    }
    
    console.log('✅ Layout slot deleted')
    return { success: true, error: null }
  } catch (err) {
    console.error('Error deleting layout slot:', err)
    return { success: false, error: err as Error }
  }
}

/**
 * Rename a layout slot
 */
export async function renameLayoutSlot(
  pageId: string,
  slotNumber: number,
  newName: string
): Promise<{ data: LayoutSlot | null; error: Error | null }> {
  const client = getSupabaseClient()
  
  if (!client) {
    return { data: null, error: new Error('Supabase not configured') }
  }
  
  try {
    const { data, error } = await client.rpc('rename_layout_slot', {
      p_page_id: pageId,
      p_slot_number: slotNumber,
      p_new_name: newName
    })
    
    if (error) {
      console.error('Error renaming layout slot:', error)
      return { data: null, error }
    }
    
    console.log('✅ Layout slot renamed:', data)
    return { data, error: null }
  } catch (err) {
    console.error('Error renaming layout slot:', err)
    return { data: null, error: err as Error }
  }
}

/**
 * Get the next available slot number
 */
export async function getNextSlotNumber(
  pageId: string
): Promise<{ data: number | null; error: Error | null }> {
  const client = getSupabaseClient()
  
  if (!client) {
    return { data: null, error: new Error('Supabase not configured') }
  }
  
  try {
    const { data, error } = await client.rpc('get_next_slot_number', {
      p_page_id: pageId
    })
    
    if (error) {
      console.error('Error getting next slot number:', error)
      return { data: null, error }
    }
    
    return { data: data || 1, error: null }
  } catch (err) {
    console.error('Error getting next slot number:', err)
    return { data: null, error: err as Error }
  }
}

/**
 * Load the published layout for a page (for public viewing)
 */
export async function loadPublishedLayout(
  pageId: string
): Promise<{ data: LayoutSlot | null; error: Error | null }> {
  const client = getSupabaseClient()
  
  if (!client) {
    return { data: null, error: new Error('Supabase not configured') }
  }
  
  try {
    const { data, error } = await client
      .from('page_layouts')
      .select('*')
      .eq('page_id', pageId)
      .eq('is_published', true)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return { data: null, error: null } // Not found
      }
      console.error('Error loading published layout:', error)
      return { data: null, error }
    }
    
    return { data, error: null }
  } catch (err) {
    console.error('Error loading published layout:', err)
    return { data: null, error: err as Error }
  }
}

// ============================================
// Legacy functions for backward compatibility
// ============================================

/**
 * @deprecated Use saveLayoutSlot instead
 */
export async function savePageLayout(
  pageId: string,
  cards: Card[],
  settings: LayoutSettings
): Promise<{ data: LayoutSlot | null; error: Error | null }> {
  // Save to slot 1 by default
  return saveLayoutSlot(pageId, 1, 'Layout 1', cards, settings)
}

/**
 * @deprecated Use getLayoutSlots or getLayoutSlot instead
 */
export async function loadPageLayout(
  pageId: string
): Promise<{ data: LayoutSlot | null; error: Error | null }> {
  // Load slot 1 by default
  return getLayoutSlot(pageId, 1)
}

/**
 * @deprecated Use publishLayoutSlot instead
 */
export async function publishPageLayout(
  pageId: string
): Promise<{ data: LayoutSlot | null; error: Error | null }> {
  // Publish slot 1 by default
  return publishLayoutSlot(pageId, 1)
}
