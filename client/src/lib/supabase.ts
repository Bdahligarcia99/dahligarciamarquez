// Supabase client configuration
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})

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

// Helper functions for common operations
export const getCurrentUser = () => {
  return supabase.auth.getUser()
}

export const signIn = (email: string, password: string) => {
  return supabase.auth.signInWithPassword({ email, password })
}

export const signUp = (email: string, password: string, displayName?: string) => {
  return supabase.auth.signUp({
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
  return supabase.auth.signOut()
}

export const resetPassword = (email: string) => {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`
  })
}

// Get current session token for API calls
export const getSessionToken = async (): Promise<string | null> => {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}
