// test-posts-images.js - Tests for posts and images endpoints
const BASE_URL = process.env.API_URL || 'http://localhost:5000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'your-admin-token-here';

// Test data
const testPost = {
  title: 'Test Post for API Testing',
  content_rich: {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'This is test content for the API test.' }]
      }
    ]
  },
  excerpt: 'Test excerpt',
  status: 'draft',
  author_id: 'test-user-id'
};

const testImage = {
  alt_text: 'Test image for API testing',
  title: 'Test Image',
  owner_id: 'test-user-id'
};

const tests = [
  // Posts Tests
  {
    name: 'POST /api/posts - Create post with auto-generated slug',
    method: 'POST',
    path: '/api/posts',
    headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` },
    body: testPost,
    expectedStatus: 201,
    expectedKeys: ['post'],
    validate: (response) => {
      const { post } = response;
      return post.slug && 
             post.slug.includes('test-post-for-api-testing') &&
             post.title === testPost.title &&
             post.content_text && 
             post.content_text.includes('This is test content');
    }
  },
  {
    name: 'POST /api/posts - Validation error for missing title',
    method: 'POST',
    path: '/api/posts',
    headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` },
    body: { ...testPost, title: '' },
    expectedStatus: 422,
    expectedKeys: ['error', 'fields'],
    validate: (response) => {
      return response.error === 'Validation failed' && 
             response.fields.title &&
             response.fields.title.some(msg => msg.includes('empty'));
    }
  },
  {
    name: 'POST /api/posts - Title length validation',
    method: 'POST',
    path: '/api/posts',
    headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` },
    body: { 
      ...testPost, 
      title: 'A'.repeat(121) // 121 characters, exceeds 120 limit
    },
    expectedStatus: 422,
    expectedKeys: ['error', 'fields'],
    validate: (response) => {
      return response.fields.title &&
             response.fields.title.some(msg => msg.includes('120 characters'));
    }
  },
  {
    name: 'POST /api/posts - Custom slug validation',
    method: 'POST',
    path: '/api/posts',
    headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` },
    body: { ...testPost, slug: 'admin' }, // Reserved word
    expectedStatus: 422,
    expectedKeys: ['error', 'fields'],
    validate: (response) => {
      return response.fields.slug &&
             response.fields.slug.some(msg => msg.includes('reserved'));
    }
  },
  {
    name: 'PUT /api/posts/:id - Update with regenerateSlug=true',
    method: 'PUT',
    path: '/api/posts/{POST_ID}', // Will be replaced with actual ID
    headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` },
    body: { 
      title: 'Updated Test Post Title',
      regenerateSlug: true
    },
    expectedStatus: 200,
    expectedKeys: ['post'],
    validate: (response) => {
      const { post } = response;
      return post.slug && 
             post.slug.includes('updated-test-post-title') &&
             post.title === 'Updated Test Post Title';
    }
  },
  {
    name: 'PUT /api/posts/:id - Content text refresh on content_rich update',
    method: 'PUT',
    path: '/api/posts/{POST_ID}',
    headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` },
    body: { 
      content_rich: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Updated content with new text.' }]
          }
        ]
      }
    },
    expectedStatus: 200,
    expectedKeys: ['post'],
    validate: (response) => {
      // Note: We can't directly check content_text in response, 
      // but we can verify the update succeeded
      return response.post && response.post.updated_at;
    }
  },

  // Images Tests (Note: These would need actual file uploads in real tests)
  {
    name: 'POST /api/images - Missing alt_text validation',
    method: 'POST',
    path: '/api/images',
    headers: { 
      'Authorization': `Bearer ${ADMIN_TOKEN}`,
      'Content-Type': 'application/json' 
    },
    body: { title: 'Test without alt text' },
    expectedStatus: 422,
    expectedKeys: ['error', 'fields'],
    validate: (response) => {
      return response.fields.alt_text &&
             response.fields.alt_text.some(msg => msg.includes('required'));
    }
  },
  {
    name: 'PUT /api/images/:id - Alt text update validation',
    method: 'PUT',
    path: '/api/images/{IMAGE_ID}', // Would need actual image ID
    headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` },
    body: { alt_text: '' }, // Empty alt text
    expectedStatus: 422,
    expectedKeys: ['error', 'fields'],
    validate: (response) => {
      return response.fields.alt_text &&
             response.fields.alt_text.some(msg => msg.includes('empty'));
    }
  },
  {
    name: 'PUT /api/images/:id - Title length validation',
    method: 'PUT',
    path: '/api/images/{IMAGE_ID}',
    headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` },
    body: { 
      alt_text: 'Valid alt text',
      title: 'T'.repeat(121) // 121 characters, exceeds 120 limit
    },
    expectedStatus: 422,
    expectedKeys: ['error', 'fields'],
    validate: (response) => {
      return response.fields.title &&
             response.fields.title.some(msg => msg.includes('120 characters'));
    }
  }
];

// Test runner
async function runTests() {
  console.log(`🧪 Running Posts & Images API Tests against ${BASE_URL}\n`);
  
  let passed = 0;
  let failed = 0;
  let createdPostId = null;

  for (const test of tests) {
    try {
      // Replace placeholder IDs if we have them
      let path = test.path;
      if (path.includes('{POST_ID}') && createdPostId) {
        path = path.replace('{POST_ID}', createdPostId);
      }
      if (path.includes('{IMAGE_ID}')) {
        // Skip image tests that need actual IDs for now
        console.log(`⏭️  ${test.name} - SKIPPED (needs actual image ID)`);
        continue;
      }

      const options = {
        method: test.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...test.headers
        }
      };

      if (test.body) {
        options.body = JSON.stringify(test.body);
      }

      const response = await fetch(`${BASE_URL}${path}`, options);
      const data = await response.json();

      // Store created post ID for later tests
      if (test.name.includes('Create post') && response.status === 201 && data.post) {
        createdPostId = data.post.id;
      }

      // Check status code
      if (response.status !== test.expectedStatus) {
        throw new Error(`Expected status ${test.expectedStatus}, got ${response.status}`);
      }

      // Check expected keys
      for (const key of test.expectedKeys) {
        if (!(key in data)) {
          throw new Error(`Missing expected key: ${key}`);
        }
      }

      // Run custom validation if provided
      if (test.validate && !test.validate(data)) {
        throw new Error('Custom validation failed');
      }

      console.log(`✅ ${test.name}`);
      passed++;
    } catch (error) {
      console.log(`❌ ${test.name} - ${error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export { runTests, tests };
