// Supabase JWT Authentication Middleware
// Verifies Supabase JWT tokens and attaches user info to request

import { Request, Response, NextFunction } from 'express'
import { getSupabaseAdmin } from '../auth/supabaseAdmin.ts'

// Initialize Supabase admin client
const supabaseAdmin = getSupabaseAdmin()

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email?: string
    role?: string
  }
}

export async function requireUser(
  req: AuthenticatedRequest, 
  res: Response, 
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Missing or invalid authorization header. Expected: Bearer <token>' 
      })
    }
    
    const token = authHeader.slice(7) // Remove 'Bearer ' prefix
    
    // Verify JWT token with Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    
    if (error || !user) {
      console.warn('JWT verification failed:', error?.message || 'No user found')
      return res.status(401).json({ 
        error: 'Invalid or expired token' 
      })
    }
    
    // Get user profile from database
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    // Attach user info to request
    req.user = {
      id: user.id,
      email: user.email,
      role: profile?.role || 'user'
    }
    
    next()
  } catch (error) {
    console.error('Auth middleware error:', error)
    res.status(500).json({ 
      error: 'Authentication service error' 
    })
  }
}
