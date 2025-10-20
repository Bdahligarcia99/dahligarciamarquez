// Supabase Admin Client for Server-Side Operations
// Uses service role key for privileged database operations

import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

// Enhanced debugging for configuration issues
const DEBUG_SUPABASE_CONFIG = process.env.DEBUG_SUPABASE === 'true'

if (DEBUG_SUPABASE_CONFIG) {
  console.log('🔍 [SUPABASE ADMIN DEBUG]')
  console.log('  URL:', url ? `✅ Set (${url.substring(0, 30)}...)` : '❌ NOT SET')
  console.log('  Service Key:', key ? `✅ Set (${key.substring(0, 20)}...)` : '❌ NOT SET')
  console.log('  Key length:', key?.length || 0, 'characters')
  console.log('  Key format:', key?.startsWith('eyJ') ? '✅ JWT format' : '❌ Not JWT')
}

export const isSupabaseAdminConfigured = Boolean(url && key)

if (!isSupabaseAdminConfigured) {
  console.warn('⚠️  Supabase Admin NOT configured!')
  console.warn('   Missing:', [
    !url && 'SUPABASE_URL',
    !key && 'SUPABASE_SERVICE_ROLE_KEY'
  ].filter(Boolean).join(', '))
  console.warn('   Run: node server/debug-supabase-config.js for detailed diagnostics')
} else if (DEBUG_SUPABASE_CONFIG) {
  console.log('✅ Supabase Admin is configured')
}

let cached: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!isSupabaseAdminConfigured) {
    if (DEBUG_SUPABASE_CONFIG) {
      console.warn('❌ getSupabaseAdmin() called but not configured')
      console.warn('   Returning null - this will cause middleware to fail')
    }
    return null
  }
  
  if (!cached) {
    if (DEBUG_SUPABASE_CONFIG) {
      console.log('🔧 Creating new Supabase admin client...')
    }
    
    try {
      cached = createClient(url!, key!, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        db: {
          schema: 'public'
        }
      })
      
      if (DEBUG_SUPABASE_CONFIG) {
        console.log('✅ Supabase admin client created successfully')
      }
    } catch (error) {
      console.error('❌ Failed to create Supabase admin client:', error)
      return null
    }
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
