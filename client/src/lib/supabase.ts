// Supabase client configuration
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Feature flag for Supabase availability
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

// Lazy client creation - only when configured
let _supabaseClient: any = null

export function getSupabaseClient() {
  if (!isSupabaseConfigured) {
    return null // Do not throw
  }
  
  if (!_supabaseClient) {
    _supabaseClient = createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  }
  
  return _supabaseClient
}

// Legacy export for backward compatibility - will be null if not configured
export const supabase = getSupabaseClient()

// Types for our database tables
export interface Profile {
  id: string
  display_name?: string
  avatar_url?: string
  role: 'user' | 'admin'
  created_at: string
  updated_at: string
}

export interface Label {
  id: string
  name: string
  slug: string
  created_at: string
  updated_at: string
}

export interface Post {
  id: string
  author_id: string
  title: string
  slug: string
  content_rich?: any // JSON content from rich editor
  content_text?: string // Plain text for search
  content_html?: string // Sanitized HTML content
  reading_time?: number // Estimated reading time in minutes
  excerpt?: string
  cover_image_url?: string
  status: 'draft' | 'published' | 'archived'
  created_at: string
  updated_at: string
  profiles?: Profile
  post_labels?: { labels: Label }[]
}

export interface Image {
  id: string
  owner_id: string
  path: string
  mime_type: string
  file_size_bytes: number
  width?: number
  height?: number
  is_public: boolean
  created_at: string
  public_url?: string
}

// Helper functions for common operations - safe when Supabase not configured
export const getCurrentUser = () => {
  const client = getSupabaseClient()
  if (!client) return Promise.resolve({ data: { user: null }, error: new Error('Supabase not configured') })
  return client.auth.getUser()
}

export const signIn = (email: string, password: string) => {
  const client = getSupabaseClient()
  if (!client) return Promise.resolve({ data: null, error: new Error('Supabase not configured') })
  return client.auth.signInWithPassword({ email, password })
}

export const signUp = (email: string, password: string, displayName?: string) => {
  const client = getSupabaseClient()
  if (!client) return Promise.resolve({ data: null, error: new Error('Supabase not configured') })
  return client.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName
      }
    }
  })
}

export const signOut = () => {
  const client = getSupabaseClient()
  if (!client) return Promise.resolve({ error: new Error('Supabase not configured') })
  return client.auth.signOut()
}

export const resetPassword = (email: string) => {
  const client = getSupabaseClient()
  if (!client) return Promise.resolve({ data: null, error: new Error('Supabase not configured') })
  return client.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`
  })
}

// Get current session token for API calls - safe when Supabase not configured
export const getSessionToken = async (): Promise<string | null> => {
  const client = getSupabaseClient()
  if (!client) return null
  
  try {
    const { data: { session } } = await client.auth.getSession()
    return session?.access_token || null
  } catch (error) {
    console.warn('Failed to get session token:', error)
    return null
  }
}
