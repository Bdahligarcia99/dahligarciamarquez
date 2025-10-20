import { Request, Response, NextFunction } from 'express'
import { SERVER_ADMIN_TOKEN } from '../config.ts'
import { getSupabaseAdmin } from '../../auth/supabaseAdmin.ts'

export interface AdminOrUserRequest extends Request {
  user?: {
    id: string
    email?: string
    role?: string
  }
  isAdmin?: boolean
}

export function requireAdminOrUser(req: AdminOrUserRequest, res: Response, next: NextFunction): void {
  // First try admin token
  if (SERVER_ADMIN_TOKEN) {
    let token: string | undefined

    // Check Authorization header (Bearer token)
    const authHeader = req.get('authorization') || req.get('Authorization')
    if (authHeader) {
      const trimmedAuth = authHeader.trim()
      if (trimmedAuth.toLowerCase().startsWith('bearer ')) {
        token = trimmedAuth.slice(7).trim()
      }
    }

    // Check X-Admin-Token header if no Bearer token found
    if (!token) {
      const xAdminToken = req.get('x-admin-token') || req.get('X-Admin-Token')
      if (xAdminToken) {
        token = xAdminToken.trim()
      }
    }

    // If admin token matches, proceed as admin
    if (token && token === SERVER_ADMIN_TOKEN) {
      req.isAdmin = true
      return next()
    }
  }

  // If no admin token, try Supabase JWT
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Missing or invalid authorization header. Expected: Bearer <admin_token> or Bearer <user_jwt>' 
    })
  }

  const token = authHeader.slice(7) // Remove 'Bearer ' prefix

  // Verify JWT token with Supabase
  supabaseAdmin.auth.getUser(token)
    .then(({ data: { user }, error }) => {
      if (error || !user) {
        return res.status(401).json({ 
          error: 'Invalid or expired token' 
        })
      }

      // Get user profile from database
      return supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
        .then(({ data: profile }) => {
          // Attach user info to request
          req.user = {
            id: user.id,
            email: user.email,
            role: profile?.role || 'user'
          }
          req.isAdmin = false
          next()
        })
    })
    .catch(error => {
      console.error('Auth middleware error:', error)
      res.status(500).json({ 
        error: 'Authentication service error' 
      })
    })
}
