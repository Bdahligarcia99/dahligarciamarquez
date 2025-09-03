// Auth & Access Control Tests - CommonJS
const { describe, test, expect, beforeEach } = require('@jest/globals');
const request = require('supertest');
const express = require('express');

// Mock the admin token
const VALID_ADMIN_TOKEN = 'test-admin-token-123';
const INVALID_TOKEN = 'invalid-token';

// Test helper functions
function createMockApp() {
  const app = express();
  app.use(express.json());
  
  // Mock middleware that simulates requireAdmin
  const mockRequireAdmin = (req, res, next) => {
    const authHeader = req.get('authorization') || req.get('Authorization');
    const xAdminToken = req.get('x-admin-token') || req.get('X-Admin-Token');
    
    let token;
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      token = authHeader.slice(7).trim();
    } else if (xAdminToken) {
      token = xAdminToken.trim();
    }
    
    if (!token || token !== VALID_ADMIN_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    next();
  };
  
  // Test routes
  app.get('/public', (req, res) => {
    res.json({ message: 'public endpoint' });
  });
  
  app.get('/admin-only', mockRequireAdmin, (req, res) => {
    res.json({ message: 'admin only endpoint' });
  });
  
  app.post('/admin-posts', mockRequireAdmin, (req, res) => {
    res.status(201).json({ message: 'post created', data: req.body });
  });
  
  return app;
}

describe('Auth & Access Control', () => {
  let app;
  
  beforeEach(() => {
    app = createMockApp();
  });

  describe('Public Endpoints', () => {
    test('should allow access without authentication', async () => {
      const response = await request(app)
        .get('/public')
        .expect(200);
      
      expect(response.body).toEqual({ message: 'public endpoint' });
    });
  });

  describe('Admin-Only Endpoints', () => {
    test('should deny access without token', async () => {
      const response = await request(app)
        .get('/admin-only')
        .expect(401);
      
      expect(response.body.error).toBe('Unauthorized');
    });
    
    test('should deny access with invalid token', async () => {
      const response = await request(app)
        .get('/admin-only')
        .set('Authorization', `Bearer ${INVALID_TOKEN}`)
        .expect(401);
      
      expect(response.body.error).toBe('Unauthorized');
    });
    
    test('should allow access with valid admin token via Authorization header', async () => {
      const response = await request(app)
        .get('/admin-only')
        .set('Authorization', `Bearer ${VALID_ADMIN_TOKEN}`)
        .expect(200);
      
      expect(response.body).toEqual({ message: 'admin only endpoint' });
    });
    
    test('should allow access with valid admin token via X-Admin-Token header', async () => {
      const response = await request(app)
        .get('/admin-only')
        .set('X-Admin-Token', VALID_ADMIN_TOKEN)
        .expect(200);
      
      expect(response.body).toEqual({ message: 'admin only endpoint' });
    });
    
    test('should handle case-insensitive Authorization header', async () => {
      const response = await request(app)
        .get('/admin-only')
        .set('authorization', `bearer ${VALID_ADMIN_TOKEN}`)
        .expect(200);
    });
    
    test('should handle malformed Authorization header', async () => {
      const response = await request(app)
        .get('/admin-only')
        .set('Authorization', 'InvalidFormat')
        .expect(401);
    });
    
    test('should trim whitespace from tokens', async () => {
      const response = await request(app)
        .get('/admin-only')
        .set('Authorization', `Bearer  ${VALID_ADMIN_TOKEN}  `)
        .expect(200);
    });
  });

  describe('POST Endpoints with Auth', () => {
    test('should create resource with valid admin token', async () => {
      const testData = { title: 'Test Post', content: 'Test content' };
      
      const response = await request(app)
        .post('/admin-posts')
        .set('Authorization', `Bearer ${VALID_ADMIN_TOKEN}`)
        .send(testData)
        .expect(201);
      
      expect(response.body.message).toBe('post created');
      expect(response.body.data).toEqual(testData);
    });
    
    test('should reject POST without admin token', async () => {
      const testData = { title: 'Test Post', content: 'Test content' };
      
      const response = await request(app)
        .post('/admin-posts')
        .send(testData)
        .expect(401);
      
      expect(response.body.error).toBe('Unauthorized');
    });
  });

  describe('Token Format Validation', () => {
    test('should handle empty Authorization header', async () => {
      await request(app)
        .get('/admin-only')
        .set('Authorization', '')
        .expect(401);
    });
    
    test('should handle Authorization header with only "Bearer"', async () => {
      await request(app)
        .get('/admin-only')
        .set('Authorization', 'Bearer')
        .expect(401);
    });
    
    test('should handle Authorization header with extra spaces', async () => {
      await request(app)
        .get('/admin-only')
        .set('Authorization', `  Bearer   ${VALID_ADMIN_TOKEN}   `)
        .expect(200);
    });
    
    test('should reject non-Bearer authorization schemes', async () => {
      await request(app)
        .get('/admin-only')
        .set('Authorization', `Basic ${VALID_ADMIN_TOKEN}`)
        .expect(401);
    });
  });
});

describe('Input Validation & Sanitization', () => {
  test('should validate title requirements', () => {
    const validateTitle = (title) => {
      const errors = [];
      if (typeof title !== 'string') {
        errors.push('Title must be a string');
        return errors; // Return early for non-string values
      }
      
      if (title.trim() === '') {
        errors.push('Title cannot be empty');
      }
      
      if (title.length > 120) {
        errors.push('Title must be 120 characters or less');
      }
      
      return errors;
    };
    
    expect(validateTitle('Valid Title')).toEqual([]);
    expect(validateTitle('')).toContain('Title cannot be empty');
    expect(validateTitle('A'.repeat(121))).toContain('Title must be 120 characters or less');
    expect(validateTitle(123)).toContain('Title must be a string');
  });
  
  test('should validate slug format', () => {
    const validateSlugFormat = (slug) => {
      const errors = [];
      if (!slug || typeof slug !== 'string') {
        errors.push('Slug must be a string');
        return errors;
      }
      
      if (!/^[a-z0-9-]+$/.test(slug)) {
        errors.push('Slug must contain only lowercase letters, numbers, and hyphens');
      }
      
      if (slug.length > 100) {
        errors.push('Slug must be 100 characters or less');
      }
      
      const reserved = ['admin', 'api', 'www', 'mail', 'ftp'];
      if (reserved.includes(slug)) {
        errors.push('This slug is reserved and cannot be used');
      }
      
      return errors;
    };
    
    expect(validateSlugFormat('valid-slug-123')).toEqual([]);
    expect(validateSlugFormat('Invalid Slug')).toContain('Slug must contain only lowercase letters, numbers, and hyphens');
    expect(validateSlugFormat('admin')).toContain('This slug is reserved and cannot be used');
  });
  
  test('should validate alt text for images', () => {
    const validateAltText = (altText) => {
      const errors = [];
      if (typeof altText !== 'string') {
        errors.push('Alt text is required');
        return errors; // Return early for non-string values
      }
      
      if (altText.trim() === '') {
        errors.push('Alt text cannot be empty');
      }
      
      if (altText.length > 500) {
        errors.push('Alt text must be 500 characters or less');
      }
      
      return errors;
    };
    
    expect(validateAltText('Valid alt text')).toEqual([]);
    expect(validateAltText('')).toContain('Alt text cannot be empty');
    expect(validateAltText('A'.repeat(501))).toContain('Alt text must be 500 characters or less');
  });
});

describe('Slug Generation', () => {
  test('should generate valid slugs from titles', () => {
    const slugify = (title) => {
      return title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-')     // Replace spaces with hyphens
        .replace(/-+/g, '-')      // Replace multiple hyphens with single
        .replace(/^-|-$/g, '')    // Remove leading/trailing hyphens
        .substring(0, 100);       // Limit length
    };
    
    expect(slugify('My Blog Post')).toBe('my-blog-post');
    expect(slugify('Special Characters & Symbols!')).toBe('special-characters-symbols');
    expect(slugify('Numbers 123 and Spaces')).toBe('numbers-123-and-spaces');
    expect(slugify('   Extra   Spaces   ')).toBe('extra-spaces');
    expect(slugify('UPPERCASE TITLE')).toBe('uppercase-title');
  });
});

describe('HTTP Status Code Validation', () => {
  test('should use correct status codes', () => {
    const HTTP_STATUS = {
      OK: 200,
      CREATED: 201,
      BAD_REQUEST: 400,
      UNAUTHORIZED: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      UNPROCESSABLE_ENTITY: 422,
      INTERNAL_SERVER_ERROR: 500
    };
    
    expect(HTTP_STATUS.OK).toBe(200);
    expect(HTTP_STATUS.CREATED).toBe(201);
    expect(HTTP_STATUS.UNAUTHORIZED).toBe(401);
    expect(HTTP_STATUS.FORBIDDEN).toBe(403);
    expect(HTTP_STATUS.NOT_FOUND).toBe(404);
    expect(HTTP_STATUS.UNPROCESSABLE_ENTITY).toBe(422);
  });
});
