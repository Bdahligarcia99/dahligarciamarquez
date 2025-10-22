// Runtime configuration state for the server
// This allows dynamic configuration changes that persist across restarts

import { getSupabaseAdmin } from '../../auth/supabaseAdmin.ts'

// In-memory cache for performance (refreshed on each get)
let comingSoonCache: boolean | null = null
let cacheTimestamp: number = 0
const CACHE_TTL = 5000 // 5 seconds

/**
 * Get the current Coming Soon mode state from database
 */
export async function getComingSoon(): Promise<boolean> {
  // Return cached value if fresh
  const now = Date.now()
  if (comingSoonCache !== null && (now - cacheTimestamp) < CACHE_TTL) {
    return comingSoonCache
  }

  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'coming_soon_mode')
      .single()

    if (error) {
      console.error('Failed to fetch coming_soon_mode from database:', error)
      // Fallback to environment variable
      return process.env.MAINTENANCE_MODE === 'true'
    }

    // Parse the boolean value from JSONB
    const enabled = data.value === true || data.value === 'true'
    
    // Update cache
    comingSoonCache = enabled
    cacheTimestamp = now
    
    return enabled
  } catch (error) {
    console.error('Error getting Coming Soon mode:', error)
    return process.env.MAINTENANCE_MODE === 'true'
  }
}

/**
 * Set the Coming Soon mode state in database
 * @param value New Coming Soon state
 * @param userId Optional user ID for audit trail
 */
export async function setComingSoon(value: boolean, userId?: string): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin()
    
    const updateData: any = {
      value: value,
      updated_at: new Date().toISOString()
    }
    
    if (userId) {
      updateData.updated_by = userId
    }

    const { error } = await supabase
      .from('system_settings')
      .update(updateData)
      .eq('key', 'coming_soon_mode')

    if (error) {
      console.error('Failed to update coming_soon_mode in database:', error)
      throw new Error('Failed to update Coming Soon mode')
    }

    // Update cache
    comingSoonCache = value
    cacheTimestamp = Date.now()
    
    console.log(`Coming Soon mode ${value ? 'ENABLED' : 'DISABLED'} (persisted to database)`)
    return value
  } catch (error) {
    console.error('Error setting Coming Soon mode:', error)
    throw error
  }
}

/**
 * Get all runtime configuration (for debugging/health checks)
 */
export async function getRuntimeConfig() {
  return {
    comingSoon: await getComingSoon(),
    maintenanceMode: process.env.MAINTENANCE_MODE,
    timestamp: new Date().toISOString()
  }
}
