import { Request, Response, NextFunction } from 'express'
import { SERVER_ADMIN_TOKEN } from '../config'
import { timingSafeEqual } from 'crypto'

// Log warning at boot if admin token is missing
if (!SERVER_ADMIN_TOKEN) {
  console.warn('⚠️  SERVER_ADMIN_TOKEN is not configured. Admin endpoints will be disabled (503).')
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }
  
  try {
    const bufferA = Buffer.from(a, 'utf8')
    const bufferB = Buffer.from(b, 'utf8')
    return timingSafeEqual(bufferA, bufferB)
  } catch {
    return false
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  // Check if server admin token is configured
  if (!SERVER_ADMIN_TOKEN) {
    res.status(503).json({ error: "Admin functionality is disabled" })
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

  // Check X-Admin-Token header if no Bearer token found (for curl convenience)
  if (!token) {
    const xAdminToken = req.get('x-admin-token') || req.get('X-Admin-Token')
    if (xAdminToken) {
      token = xAdminToken.trim()
    }
  }

  // Validate token using constant-time comparison
  if (!token || !constantTimeCompare(token, SERVER_ADMIN_TOKEN)) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }

  // Token is valid, proceed
  next()
}
