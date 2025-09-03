// Coming Soon middleware - blocks non-admin traffic when enabled
import { Request, Response, NextFunction } from 'express'
import { getComingSoon } from '../state/runtimeConfig.js'
import { SERVER_ADMIN_TOKEN } from '../config.js'

/**
 * Coming Soon middleware
 * - If Coming Soon mode is disabled: allow all requests
 * - If enabled: allow admin requests, block others with 503 response
 */
export function comingSoonMiddleware(req: Request, res: Response, next: NextFunction): void {
  // If Coming Soon mode is disabled, allow all requests
  if (!getComingSoon()) {
    return next()
  }

  // Check if request has valid admin token (same logic as requireAdmin)
  const isAdminRequest = checkAdminToken(req)
  
  if (isAdminRequest) {
    // Admin requests are allowed even in Coming Soon mode
    return next()
  }

  // Block non-admin requests with 503 response
  const acceptsHtml = req.headers.accept && req.headers.accept.includes('text/html')
  
  if (acceptsHtml && !req.path.startsWith('/api/')) {
    // HTML/page requests - serve Coming Soon page
    const siteName = process.env.SITE_NAME || 'dahligarciamarquez'
    const comingSoonHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Coming Soon - ${siteName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-align: center;
    }
    .container {
      max-width: 600px;
      padding: 2rem;
    }
    h1 {
      font-size: 3rem;
      margin-bottom: 1rem;
      font-weight: 300;
    }
    p {
      font-size: 1.2rem;
      opacity: 0.9;
      line-height: 1.6;
    }
    .site-name {
      font-size: 1.5rem;
      margin-top: 2rem;
      opacity: 0.8;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Coming Soon!</h1>
    <p>We're working hard to bring you something amazing. Please check back soon.</p>
    <div class="site-name">${siteName}</div>
  </div>
</body>
</html>`.trim()

    res.status(503).type('html').send(comingSoonHtml)
  } else {
    // API requests - JSON response
    res.status(503).json({
      comingSoon: true,
      message: "Coming Soon!"
    })
  }
}

/**
 * Check if request has valid admin token
 * Reuses the same logic as requireAdmin middleware
 */
function checkAdminToken(req: Request): boolean {
  // Check if server admin token is configured
  if (!SERVER_ADMIN_TOKEN) {
    return false
  }

  // Extract token from headers (case-insensitive)
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

  // Validate token
  return token === SERVER_ADMIN_TOKEN
}
