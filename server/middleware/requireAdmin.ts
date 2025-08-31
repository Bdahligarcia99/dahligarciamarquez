// Admin Authorization Middleware
// Ensures user has admin role in profiles table

import { Response, NextFunction } from 'express'
import { AuthenticatedRequest, requireUser } from './requireUser.js'

export async function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  // First ensure user is authenticated
  requireUser(req, res, (error) => {
    if (error) return next(error)
    
    // Check if user has admin role
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Admin access required'
      })
    }
    
    next()
  })
}
