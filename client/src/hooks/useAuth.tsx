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
  refreshProfile: () => Promise<void>
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
  const [initialCheckDone, setInitialCheckDone] = useState(false)

  // Fetch user profile from database
  const fetchProfile = async (userId: string) => {
    const client = getSupabaseClient()
    if (!client) {
      console.log('❌ No Supabase client available for profile fetch')
      return null
    }
    
    console.log('🔍 Fetching profile for user:', userId)
    
    try {
      // Add timeout to prevent hanging
      const fetchPromise = client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Profile fetch timed out after 10 seconds')), 10000)
      )
      
      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any

      if (error) {
        console.error('❌ Error fetching profile:', error.message, 'Code:', error.code)
        return null
      }

      if (data) {
        console.log('✅ Profile fetched successfully:', data.role)
        return data
      } else {
        console.log('⚠️ No profile data returned')
        return null
      }
    } catch (error: any) {
      console.error('❌ Profile fetch exception:', error?.message || error)
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
    console.log('🔄 AuthProvider useEffect triggered')
    // If Supabase is not configured, set loading to false and return
    if (!isSupabaseConfigured) {
      console.log('❌ Supabase not configured')
      setLoading(false)
      setInitialCheckDone(true)
      return
    }

    const client = getSupabaseClient()
    if (!client) {
      console.log('❌ Supabase client not available')
      setLoading(false)
      return
    }

    // Skip initial session check - rely on auth state change listener
    // This avoids the hanging getSession() issue
    console.log('🔄 Skipping initial session check, relying on auth state listener')

    // Listen for auth changes - this is our primary source of auth state
    let subscription
    try {
      console.log('🔄 Setting up auth state change listener...')
      const result = client.auth.onAuthStateChange(
        async (event, session) => {
          console.log('🔄 Auth state changed:', event, session?.user?.email)
          
          if (session?.user) {
            console.log('✅ Setting user from auth change:', session.user.email)
            setUser(session.user)
            setSession(session)
            
            // Fetch or create profile
            console.log('🔍 Attempting to fetch profile for:', session.user.email)
            
            try {
              let userProfile = await fetchProfile(session.user.id)
              if (!userProfile) {
                console.log('📝 No profile found, creating profile for:', session.user.email)
                // Create profile for any user who doesn't have one (new signups or existing users)
                userProfile = await createProfile(session.user)
                if (userProfile) {
                  console.log('✅ Profile created successfully:', userProfile.role)
                } else {
                  console.log('❌ Failed to create profile')
                }
              }
              console.log('🔄 Setting profile state:', userProfile?.role || 'null')
              setProfile(userProfile)
            } catch (profileError) {
              console.error('❌ Error in profile fetch/create flow:', profileError)
              setProfile(null)
            }
          } else {
            console.log('❌ Clearing user from auth change')
            setUser(null)
            setSession(null)
            setProfile(null)
          }
          
          // Mark that we've received at least one auth state event
          if (!initialCheckDone) {
            setInitialCheckDone(true)
          }
          
          console.log('✅ Auth change complete, loading = false')
          setLoading(false)
        }
      )
      subscription = result.data.subscription
      console.log('✅ Auth state listener setup complete')
      
      // Set a backup timer to ensure loading doesn't hang forever
      // If no auth state change occurs within 3 seconds, assume no session
      setTimeout(() => {
        if (!initialCheckDone) {
          console.log('⏰ No auth state change received, assuming no session')
          setLoading(false)
          setInitialCheckDone(true)
        }
      }, 3000)
      
    } catch (error) {
      console.error('❌ Failed to set up auth state listener:', error)
      setLoading(false)
    }

    return () => {
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    const client = getSupabaseClient()
    if (!client) {
      return { error: new Error('Supabase not configured') }
    }
    
    console.log('🔐 Attempting sign in with Supabase...')
    try {
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password
      })
      
      console.log('🔍 Sign in response:', { 
        hasUser: !!data?.user, 
        hasSession: !!data?.session,
        error: error?.message 
      })
      
      return { error }
    } catch (err) {
      console.error('❌ Sign in exception:', err)
      return { error: err }
    }
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
    if (!client) {
      console.error('Supabase client not available')
      return
    }
    
    try {
      // Add timeout to prevent hanging  
      const signOutPromise = client.auth.signOut()
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Sign out timeout')), 2000)
      )
      
      const result = await Promise.race([signOutPromise, timeoutPromise])
      const { error } = result || {}
      
      if (error) {
        throw error
      }
      
    } catch (error) {
      // Continue with cleanup even if API call fails
      console.warn('Supabase sign out failed, clearing local state:', error.message)
    }
    
    // Always clear local state and storage
    setUser(null)
    setSession(null)
    setProfile(null)
    
    // Clear localStorage
    try {
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
          localStorage.removeItem(key)
        }
      })
    } catch (e) {
      console.warn('Could not clear localStorage:', e)
    }
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

  const refreshProfile = async () => {
    if (!user?.id) return
    
    console.log('🔄 Refreshing profile data...')
    const updatedProfile = await fetchProfile(user.id)
    if (updatedProfile) {
      console.log('✅ Profile refreshed:', updatedProfile)
      setProfile(updatedProfile)
    }
  }

  const value = {
    user,
    profile,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    refreshProfile
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
