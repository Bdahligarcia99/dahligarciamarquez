// Supabase Admin Client for Server-Side Operations
// Uses service role key for privileged database operations

import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

export const isSupabaseAdminConfigured = Boolean(url && key)

let cached: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!isSupabaseAdminConfigured) return null
  if (!cached) {
    cached = createClient(url!, key!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema: 'public'
      }
    })
  }
  return cached
}

// Helper to get user profile with role
export async function getUserProfile(userId: string) {
  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    console.error('Supabase admin client not configured')
    return null
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, display_name, role, created_at, updated_at')
    .eq('id', userId)
    .single()
  
  if (error) {
    console.error('Error fetching user profile:', error)
    return null
  }
  
  return data
}

// Helper to check if user is admin
export async function isUserAdmin(userId: string): Promise<boolean> {
  const profile = await getUserProfile(userId)
  return profile?.role === 'admin'
}
