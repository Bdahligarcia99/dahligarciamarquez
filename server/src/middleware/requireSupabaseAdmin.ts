import { Request, Response, NextFunction } from 'express'
import { getSupabaseAdmin } from '../../auth/supabaseAdmin.ts'

export interface SupabaseAdminRequest extends Request {
  user?: {
    id: string
    email?: string
    role: string
  }
}

/**
 * Middleware that requires Supabase authentication with admin role
 * Replaces the old token-based requireAdmin middleware
 */
export async function requireSupabaseAdmin(
  req: SupabaseAdminRequest, 
  res: Response, 
  next: NextFunction
): Promise<void> {
  const DEBUG = process.env.DEBUG_SUPABASE === 'true'
  
  try {
    if (DEBUG) {
      console.log('🔒 [requireSupabaseAdmin] Processing request:', req.method, req.path)
    }
    
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (DEBUG) {
        console.log('❌ [requireSupabaseAdmin] No valid auth header:', authHeader?.substring(0, 20))
      }
      res.status(401).json({ 
        error: 'Missing or invalid authorization header. Expected: Bearer <jwt_token>' 
      })
      return
    }
    
    const token = authHeader.slice(7) // Remove 'Bearer ' prefix
    
    if (DEBUG) {
      console.log('🔑 [requireSupabaseAdmin] Token received:', token.substring(0, 30) + '...')
    }
    
    const supabaseAdmin = getSupabaseAdmin()
    
    if (!supabaseAdmin) {
      console.error('❌ [requireSupabaseAdmin] Supabase admin client is NULL!')
      console.error('   This means SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set')
      console.error('   Check your .env file in the server directory')
      res.status(500).json({ 
        error: 'Supabase admin not configured',
        hint: 'Server configuration error - check server logs'
      })
      return
    }
    
    if (DEBUG) {
      console.log('✅ [requireSupabaseAdmin] Supabase admin client available')
    }
    
    // Verify JWT token with Supabase
    if (DEBUG) {
      console.log('🔍 [requireSupabaseAdmin] Verifying JWT with Supabase...')
    }
    
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    
    if (error || !user) {
      if (DEBUG) {
        console.log('❌ [requireSupabaseAdmin] JWT verification failed')
        console.log('   Error:', error?.message)
        console.log('   User:', user)
      } else {
        console.warn('JWT verification failed:', error?.message || 'No user found')
      }
      res.status(401).json({ 
        error: 'Invalid or expired token' 
      })
      return
    }
    
    if (DEBUG) {
      console.log('✅ [requireSupabaseAdmin] JWT verified, user:', user.email)
    }
    
    // Get user profile from database to check role
    if (DEBUG) {
      console.log('🔍 [requireSupabaseAdmin] Fetching user profile...')
    }
    
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    if (profileError || !profile) {
      if (DEBUG) {
        console.log('❌ [requireSupabaseAdmin] Profile fetch failed')
        console.log('   Error:', profileError?.message)
        console.log('   User ID:', user.id)
      } else {
        console.warn('Profile fetch failed:', profileError?.message || 'No profile found')
      }
      res.status(401).json({ 
        error: 'User profile not found' 
      })
      return
    }
    
    if (DEBUG) {
      console.log('✅ [requireSupabaseAdmin] Profile found, role:', profile.role)
    }
    
    // Check if user has admin role
    if (profile.role !== 'admin') {
      if (DEBUG) {
        console.log('❌ [requireSupabaseAdmin] User is not admin')
        console.log('   Email:', user.email)
        console.log('   Role:', profile.role)
      }
      res.status(403).json({ 
        error: 'Admin access required',
        hint: `Your role is '${profile.role}', but 'admin' is required`
      })
      return
    }
    
    if (DEBUG) {
      console.log('✅ [requireSupabaseAdmin] Authorization successful for:', user.email)
    }
    
    // Attach user info to request
    req.user = {
      id: user.id,
      email: user.email,
      role: profile.role
    }
    
    next()
  } catch (error) {
    console.error('❌ [requireSupabaseAdmin] Unexpected error:', error)
    if (DEBUG && error instanceof Error) {
      console.error('   Stack:', error.stack)
    }
    res.status(500).json({ 
      error: 'Authentication service error',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
