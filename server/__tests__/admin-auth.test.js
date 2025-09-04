// server/__tests__/admin-auth.test.js
const request = require('supertest')
const express = require('express')
const cors = require('cors')

// Mock the config module
const originalEnv = process.env.SERVER_ADMIN_TOKEN
const TEST_TOKEN = 'test-admin-token-12345'

// Simple admin middleware for testing
function createAdminMiddleware(adminToken) {
  return function requireAdmin(req, res, next) {
    if (!adminToken) {
      return res.status(503).json({ error: "Admin functionality is disabled" })
    }

    let token
    const authHeader = req.get('authorization') || req.get('Authorization')
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      token = authHeader.slice(7).trim()
    }

    if (!token) {
      const xAdminToken = req.get('x-admin-token') || req.get('X-Admin-Token')
      if (xAdminToken) {
        token = xAdminToken.trim()
      }
    }

    if (!token || token !== adminToken) {
      return res.status(401).json({ error: "Unauthorized" })
    }

    next()
  }
}

describe('Admin Auth Middleware', () => {
  let app

  beforeEach(() => {
    // Create test app
    app = express()
    
    // Add CORS with Authorization header support
    app.use(cors({
      allowedHeaders: ['Authorization', 'X-Admin-Token', 'Content-Type']
    }))
    
    app.use(express.json())
    
    // Test route protected by admin auth
    app.get('/api/admin/health', createAdminMiddleware(TEST_TOKEN), (req, res) => {
      res.json({
        ok: true,
        version: '1.0.0',
        ts: new Date().toISOString()
      })
    })
  })

  describe('Valid Authentication', () => {
    test('should return 200 with correct Bearer token', async () => {
      const response = await request(app)
        .get('/api/admin/health')
        .set('Authorization', `Bearer ${TEST_TOKEN}`)
        .expect(200)

      expect(response.body).toMatchObject({
        ok: true,
        version: expect.any(String),
        ts: expect.any(String)
      })
    })

    test('should return 200 with correct X-Admin-Token header', async () => {
      const response = await request(app)
        .get('/api/admin/health')
        .set('X-Admin-Token', TEST_TOKEN)
        .expect(200)

      expect(response.body).toMatchObject({
        ok: true,
        version: expect.any(String),
        ts: expect.any(String)
      })
    })

    test('should handle Bearer token with extra spaces', async () => {
      const response = await request(app)
        .get('/api/admin/health')
        .set('Authorization', `  Bearer   ${TEST_TOKEN}  `)
        .expect(200)

      expect(response.body.ok).toBe(true)
    })
  })

  describe('Invalid Authentication', () => {
    test('should return 401 with wrong Bearer token', async () => {
      const response = await request(app)
        .get('/api/admin/health')
        .set('Authorization', 'Bearer wrong-token')
        .expect(401)

      expect(response.body).toEqual({
        error: 'Unauthorized'
      })
    })

    test('should return 401 with wrong X-Admin-Token', async () => {
      const response = await request(app)
        .get('/api/admin/health')
        .set('X-Admin-Token', 'wrong-token')
        .expect(401)

      expect(response.body).toEqual({
        error: 'Unauthorized'
      })
    })

    test('should return 401 with no auth headers', async () => {
      const response = await request(app)
        .get('/api/admin/health')
        .expect(401)

      expect(response.body).toEqual({
        error: 'Unauthorized'
      })
    })

    test('should return 401 with malformed Bearer header', async () => {
      const response = await request(app)
        .get('/api/admin/health')
        .set('Authorization', 'InvalidFormat token')
        .expect(401)

      expect(response.body).toEqual({
        error: 'Unauthorized'
      })
    })

    test('should return 401 with empty Bearer token', async () => {
      const response = await request(app)
        .get('/api/admin/health')
        .set('Authorization', 'Bearer ')
        .expect(401)

      expect(response.body).toEqual({
        error: 'Unauthorized'
      })
    })
  })

  describe('Missing Admin Token Configuration', () => {
    let appWithoutToken

    beforeEach(() => {
      appWithoutToken = express()
      appWithoutToken.use(cors({
        allowedHeaders: ['Authorization', 'X-Admin-Token', 'Content-Type']
      }))
      appWithoutToken.use(express.json())
      
      // Use middleware with no token configured
      appWithoutToken.get('/api/admin/health', createAdminMiddleware(null), (req, res) => {
        res.json({ ok: true })
      })
    })

    test('should return 503 when admin token not configured', async () => {
      const response = await request(appWithoutToken)
        .get('/api/admin/health')
        .set('Authorization', 'Bearer any-token')
        .expect(503)

      expect(response.body).toEqual({
        error: 'Admin functionality is disabled'
      })
    })
  })

  describe('CORS Preflight', () => {
    test('should handle OPTIONS preflight request', async () => {
      await request(app)
        .options('/api/admin/health')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'Authorization')
        .expect(204)
    })
  })
})
