// Authentication hook for Supabase
import { useState, useEffect, createContext, useContext, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase, getSupabaseClient, isSupabaseConfigured, Profile } from '../lib/supabase'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: any }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch user profile from database
  const fetchProfile = async (userId: string) => {
    const client = getSupabaseClient()
    if (!client) return null
    
    try {
      const { data, error } = await client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching profile:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Profile fetch error:', error)
      return null
    }
  }

  // Create profile for new users
  const createProfile = async (user: User) => {
    const client = getSupabaseClient()
    if (!client) return null
    
    try {
      const { data, error } = await client
        .from('profiles')
        .insert({
          id: user.id,
          display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User',
          role: 'user'
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating profile:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Profile creation error:', error)
      return null
    }
  }

  useEffect(() => {
    // If Supabase is not configured, set loading to false and return
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    const client = getSupabaseClient()
    if (!client) {
      setLoading(false)
      return
    }

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await client.auth.getSession()
        
        if (session?.user) {
          setUser(session.user)
          setSession(session)
          
          // Fetch or create profile
          let userProfile = await fetchProfile(session.user.id)
          if (!userProfile) {
            userProfile = await createProfile(session.user)
          }
          setProfile(userProfile)
        }
      } catch (error) {
        console.warn('Failed to get initial session:', error)
      }
      
      setLoading(false)
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = client.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email)
        
        if (session?.user) {
          setUser(session.user)
          setSession(session)
          
          // Fetch or create profile
          let userProfile = await fetchProfile(session.user.id)
          if (!userProfile && event === 'SIGNED_UP') {
            userProfile = await createProfile(session.user)
          }
          setProfile(userProfile)
        } else {
          setUser(null)
          setSession(null)
          setProfile(null)
        }
        
        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    const client = getSupabaseClient()
    if (!client) {
      return { error: new Error('Supabase not configured') }
    }
    
    const { error } = await client.auth.signInWithPassword({
      email,
      password
    })
    return { error }
  }

  const signUp = async (email: string, password: string, displayName?: string) => {
    const client = getSupabaseClient()
    if (!client) {
      return { error: new Error('Supabase not configured') }
    }
    
    const { error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName
        }
      }
    })
    return { error }
  }

  const signOut = async () => {
    const client = getSupabaseClient()
    if (!client) return
    await client.auth.signOut()
  }

  const resetPassword = async (email: string) => {
    const client = getSupabaseClient()
    if (!client) {
      return { error: new Error('Supabase not configured') }
    }
    
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`
    })
    return { error }
  }

  const value = {
    user,
    profile,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
