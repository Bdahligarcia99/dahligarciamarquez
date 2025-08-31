import { Request, Response, NextFunction } from 'express'
import { SERVER_ADMIN_TOKEN } from '../config'

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  // Check if server admin token is configured
  if (!SERVER_ADMIN_TOKEN) {
    res.status(500).json({ error: "Server admin token not configured." })
    return
  }

  // Extract token from headers (case-insensitive)
  let token: string | undefined

  // Check Authorization header (Bearer token) - robust parsing
  const authHeader = req.get('authorization') || req.get('Authorization')
  if (authHeader) {
    const trimmedAuth = authHeader.trim()
    if (trimmedAuth.toLowerCase().startsWith('bearer ')) {
      // Extract token after 'Bearer ' and trim any extra spaces
      token = trimmedAuth.slice(7).trim()
    }
  }

  // Check X-Admin-Token header if no Bearer token found - exact match
  if (!token) {
    const xAdminToken = req.get('x-admin-token') || req.get('X-Admin-Token')
    if (xAdminToken) {
      token = xAdminToken.trim()
    }
  }

  // Validate token
  if (!token || token !== SERVER_ADMIN_TOKEN) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }

  // Token is valid, proceed
  next()
}
