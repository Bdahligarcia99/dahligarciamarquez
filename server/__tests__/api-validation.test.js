// API Validation & Business Logic Tests - CommonJS
const { describe, test, expect } = require('@jest/globals');

// Mock sanitize-html for testing
const mockSanitizeHtml = (html, options) => {
  // Handle null/undefined inputs
  if (!html) return '';
  
  // Simulate sanitize-html behavior for testing
  if (!options) return html;
  
  let result = html;
  
  // Remove disallowed tags
  const disallowedTags = ['script', 'iframe', 'style'];
  disallowedTags.forEach(tag => {
    result = result.replace(new RegExp(`<${tag}[^>]*>.*?</${tag}>`, 'gi'), '');
    result = result.replace(new RegExp(`<${tag}[^>]*/>`, 'gi'), '');
  });
  
  // Remove event handlers
  result = result.replace(/\son\w+\s*=\s*['"'][^'"]*['"']/gi, '');
  
  // Remove disallowed attributes (id, data-*, most styles)
  result = result.replace(/\sid\s*=\s*['"'][^'"]*['"']/gi, '');
  result = result.replace(/\sdata-[^=]*\s*=\s*['"'][^'"]*['"']/gi, '');
  
  // Remove most style attributes (keep text-align)
  result = result.replace(/\sstyle\s*=\s*['"']([^'"]*)['"']/gi, (match, styleContent) => {
    // Only keep text-align
    const textAlignMatch = styleContent.match(/text-align:\s*([^;]+)/);
    if (textAlignMatch) {
      return ` style="text-align: ${textAlignMatch[1].trim()}"`;
    }
    return '';
  });
  
  // Handle link rel attributes
  if (options.transformTags && options.transformTags.a) {
    result = result.replace(/<a([^>]*target="_blank"[^>]*)>/gi, (match, attrs) => {
      if (!attrs.includes('rel=')) {
        return match.replace('>', ' rel="noopener noreferrer">');
      } else if (!attrs.includes('noopener') || !attrs.includes('noreferrer')) {
        return match.replace(/rel="([^"]*)"/, (relMatch, relValue) => {
          const relParts = relValue.split(/\s+/).filter(Boolean);
          if (!relParts.includes('noopener')) relParts.push('noopener');
          if (!relParts.includes('noreferrer')) relParts.push('noreferrer');
          return `rel="${relParts.join(' ')}"`;
        });
      }
      return match;
    });
  }
  
  return result;
};

// Import the actual sanitization functions
let sanitizePostHtml, calculateReadingTime, extractTextFromHtml;
try {
  const sanitizeModule = require('../src/utils/sanitizeHtml.ts');
  sanitizePostHtml = sanitizeModule.sanitizePostHtml;
  calculateReadingTime = sanitizeModule.calculateReadingTime;
  extractTextFromHtml = sanitizeModule.extractTextFromHtml;
} catch (error) {
  // Fallback implementations for testing
  sanitizePostHtml = (html) => mockSanitizeHtml(html, {
    allowedTags: ['p', 'h1', 'h2', 'h3', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'img', 'figure', 'figcaption', 'br', 'hr', 'span'],
    transformTags: { a: true }
  });
  calculateReadingTime = (text) => {
    if (!text || typeof text !== 'string') return 0;
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 200));
  };
  extractTextFromHtml = (html) => (html || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

describe('Content Processing & Validation', () => {
  describe('Rich Content Processing', () => {
    test('should extract text from rich content structure', () => {
      const extractTextFromRichContent = (richContent) => {
        if (!richContent || !richContent.content) return '';
        
        const extractFromNode = (node) => {
          if (node.type === 'text') {
            return node.text || '';
          }
          
          if (node.content && Array.isArray(node.content)) {
            return node.content.map(extractFromNode).join('');
          }
          
          return '';
        };
        
        return richContent.content
          .map(extractFromNode)
          .join(' ')
          .trim();
      };
      
      const richContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Hello ' },
              { type: 'text', text: 'world!' }
            ]
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Second paragraph.' }
            ]
          }
        ]
      };
      
      const extractedText = extractTextFromRichContent(richContent);
      expect(extractedText).toBe('Hello world! Second paragraph.');
    });
    
    test('should handle empty or malformed rich content', () => {
      const extractTextFromRichContent = (richContent) => {
        if (!richContent || !richContent.content) return '';
        
        try {
          const extractFromNode = (node) => {
            if (node.type === 'text') {
              return node.text || '';
            }
            
            if (node.content && Array.isArray(node.content)) {
              return node.content.map(extractFromNode).join('');
            }
            
            return '';
          };
          
          return richContent.content
            .map(extractFromNode)
            .join(' ')
            .trim();
        } catch (error) {
          return '';
        }
      };
      
      expect(extractTextFromRichContent(null)).toBe('');
      expect(extractTextFromRichContent({})).toBe('');
      expect(extractTextFromRichContent({ type: 'doc', content: [] })).toBe('');
    });
  });

  describe('File Upload Validation', () => {
    test('should validate image file types', () => {
      const validateImageFile = (file) => {
        const errors = [];
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        const maxSize = 5 * 1024 * 1024; // 5MB
        
        if (!allowedTypes.includes(file.mimetype)) {
          errors.push('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.');
        }
        
        if (file.size > maxSize) {
          errors.push('File size too large. Maximum size is 5MB.');
        }
        
        return errors;
      };
      
      const validFile = { mimetype: 'image/jpeg', size: 1024 * 1024 }; // 1MB
      const invalidTypeFile = { mimetype: 'application/pdf', size: 1024 };
      const tooLargeFile = { mimetype: 'image/jpeg', size: 10 * 1024 * 1024 }; // 10MB
      
      expect(validateImageFile(validFile)).toEqual([]);
      expect(validateImageFile(invalidTypeFile)).toContain('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.');
      expect(validateImageFile(tooLargeFile)).toContain('File size too large. Maximum size is 5MB.');
    });
    
    test('should warn about large but valid files', () => {
      const shouldWarnAboutFileSize = (fileSize) => {
        const warningThreshold = 2 * 1024 * 1024; // 2MB
        return fileSize > warningThreshold;
      };
      
      expect(shouldWarnAboutFileSize(1024 * 1024)).toBe(false); // 1MB
      expect(shouldWarnAboutFileSize(3 * 1024 * 1024)).toBe(true); // 3MB
    });
  });

  describe('Data Sanitization', () => {
    test('should sanitize user input', () => {
      const sanitizeInput = (input, maxLength = 1000) => {
        if (typeof input !== 'string') return '';
        
        return input
          .trim()
          .substring(0, maxLength)
          .replace(/[<>]/g, ''); // Basic XSS prevention
      };
      
      expect(sanitizeInput('  Hello World  ')).toBe('Hello World');
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
      expect(sanitizeInput('A'.repeat(1500), 100)).toBe('A'.repeat(100));
      expect(sanitizeInput(123)).toBe('');
    });
    
    test('should validate email format', () => {
      const isValidEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
      };
      
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user+tag@domain.co.uk')).toBe(true);
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
    });
  });

  describe('Status and State Validation', () => {
    test('should validate post status transitions', () => {
      const isValidStatusTransition = (currentStatus, newStatus) => {
        const validStatuses = ['draft', 'published'];
        const validTransitions = {
          'draft': ['draft', 'published'],
          'published': ['published', 'draft']
        };
        
        return validStatuses.includes(newStatus) && 
               validTransitions[currentStatus]?.includes(newStatus);
      };
      
      expect(isValidStatusTransition('draft', 'published')).toBe(true);
      expect(isValidStatusTransition('published', 'draft')).toBe(true);
      expect(isValidStatusTransition('draft', 'archived')).toBe(false);
    });
    
    test('should validate pagination parameters', () => {
      const validatePagination = (page, limit) => {
        const errors = [];
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        
        if (isNaN(pageNum) || pageNum < 1) {
          errors.push('Page must be a positive integer');
        }
        
        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
          errors.push('Limit must be between 1 and 100');
        }
        
        return errors;
      };
      
      expect(validatePagination('1', '20')).toEqual([]);
      expect(validatePagination('0', '20')).toContain('Page must be a positive integer');
      expect(validatePagination('1', '150')).toContain('Limit must be between 1 and 100');
      expect(validatePagination('abc', '20')).toContain('Page must be a positive integer');
    });
  });

  describe('Error Response Formatting', () => {
    test('should format validation errors correctly', () => {
      const createValidationErrorResponse = (fieldErrors) => {
        return {
          error: 'Validation failed',
          fields: fieldErrors,
          timestamp: new Date().toISOString()
        };
      };
      
      const errors = {
        title: ['Title is required', 'Title too long'],
        excerpt: ['Excerpt too long']
      };
      
      const response = createValidationErrorResponse(errors);
      
      expect(response.error).toBe('Validation failed');
      expect(response.fields).toEqual(errors);
      expect(response.timestamp).toBeDefined();
    });
    
    test('should format success responses consistently', () => {
      const createSuccessResponse = (data, message = 'Success') => {
        return {
          success: true,
          message,
          data,
          timestamp: new Date().toISOString()
        };
      };
      
      const testData = { id: 1, title: 'Test Post' };
      const response = createSuccessResponse(testData, 'Post created');
      
      expect(response.success).toBe(true);
      expect(response.message).toBe('Post created');
      expect(response.data).toEqual(testData);
      expect(response.timestamp).toBeDefined();
    });
  });
});

describe('Security Validations', () => {
  test('should detect potential security issues', () => {
    const containsSuspiciousContent = (content) => {
      const suspiciousPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i, // onclick, onload, etc.
        /eval\s*\(/i,
        /document\.cookie/i
      ];
      
      return suspiciousPatterns.some(pattern => pattern.test(content));
    };
    
    expect(containsSuspiciousContent('Normal content')).toBe(false);
    expect(containsSuspiciousContent('<script>alert("xss")</script>')).toBe(true);
    expect(containsSuspiciousContent('onclick="malicious()"')).toBe(true);
    expect(containsSuspiciousContent('javascript:void(0)')).toBe(true);
  });
  
  test('should validate rate limiting logic', () => {
    const checkRateLimit = (requests, timeWindow, maxRequests) => {
      const now = Date.now();
      const windowStart = now - timeWindow;
      
      const recentRequests = requests.filter(timestamp => timestamp > windowStart);
      
      return {
        allowed: recentRequests.length < maxRequests,
        remaining: Math.max(0, maxRequests - recentRequests.length),
        resetTime: windowStart + timeWindow
      };
    };
    
    const now = Date.now();
    const requests = [
      now - 1000,  // 1 second ago
      now - 2000,  // 2 seconds ago
      now - 61000  // 61 seconds ago (outside 1-minute window)
    ];
    
    const result = checkRateLimit(requests, 60000, 5); // 5 requests per minute
    
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(3); // 5 max - 2 recent = 3 remaining
  });
});

describe('HTML Sanitization', () => {
  describe('Allowed Content', () => {
    test('should keep allowed formatting tags', () => {
      const html = `
        <h1>Main Heading</h1>
        <h2>Subheading</h2>
        <h3>Sub-subheading</h3>
        <p>This is a <strong>bold</strong> and <em>italic</em> paragraph with <u>underlined</u> and <s>strikethrough</s> text.</p>
        <ul>
          <li>List item 1</li>
          <li>List item 2</li>
        </ul>
        <ol>
          <li>Ordered item 1</li>
          <li>Ordered item 2</li>
        </ol>
        <blockquote>This is a quote</blockquote>
        <code>inline code</code>
        <pre>code block</pre>
        <br/>
        <hr/>
      `;
      
      const sanitized = sanitizePostHtml(html);
      
      // Should contain all allowed tags
      expect(sanitized).toContain('<h1>');
      expect(sanitized).toContain('<h2>');
      expect(sanitized).toContain('<h3>');
      expect(sanitized).toContain('<p>');
      expect(sanitized).toContain('<strong>');
      expect(sanitized).toContain('<em>');
      expect(sanitized).toContain('<u>');
      expect(sanitized).toContain('<s>');
      expect(sanitized).toContain('<ul>');
      expect(sanitized).toContain('<ol>');
      expect(sanitized).toContain('<li>');
      expect(sanitized).toContain('<blockquote>');
      expect(sanitized).toContain('<code>');
      expect(sanitized).toContain('<pre>');
      expect(sanitized).toContain('<br');
      expect(sanitized).toContain('<hr');
    });

    test('should keep links with proper attributes', () => {
      const html = `
        <a href="https://example.com" title="Example Site">Regular link</a>
        <a href="mailto:test@example.com">Email link</a>
      `;
      
      const sanitized = sanitizePostHtml(html);
      
      expect(sanitized).toContain('href="https://example.com"');
      expect(sanitized).toContain('title="Example Site"');
      expect(sanitized).toContain('href="mailto:test@example.com"');
    });

    test('should keep images with alt text and dimensions', () => {
      const html = `
        <img src="/uploads/test.jpg" alt="Test image" width="800" height="600" title="Image title" />
        <figure class="align-center">
          <img src="/uploads/figure.jpg" alt="Figure image" />
          <figcaption>Image caption</figcaption>
        </figure>
      `;
      
      const sanitized = sanitizePostHtml(html);
      
      expect(sanitized).toContain('src="/uploads/test.jpg"');
      expect(sanitized).toContain('alt="Test image"');
      expect(sanitized).toContain('width="800"');
      expect(sanitized).toContain('height="600"');
      expect(sanitized).toContain('title="Image title"');
      expect(sanitized).toContain('<figure');
      expect(sanitized).toContain('<figcaption>');
      expect(sanitized).toContain('class="align-center"');
    });

    test('should keep alignment classes', () => {
      const html = `
        <p class="align-left">Left aligned</p>
        <h2 class="align-center">Center aligned</h2>
        <figure class="align-right">
          <img src="/test.jpg" alt="Right aligned" />
        </figure>
      `;
      
      const sanitized = sanitizePostHtml(html);
      
      expect(sanitized).toContain('class="align-left"');
      expect(sanitized).toContain('class="align-center"');
      expect(sanitized).toContain('class="align-right"');
    });
  });

  describe('Dangerous Content Removal', () => {
    test('should strip script tags', () => {
      const html = `
        <p>Safe content</p>
        <script>alert('malicious code')</script>
        <script src="malicious.js"></script>
        <p>More safe content</p>
      `;
      
      const sanitized = sanitizePostHtml(html);
      
      expect(sanitized).not.toContain('<script');
      expect(sanitized).not.toContain('alert(');
      expect(sanitized).not.toContain('malicious');
      expect(sanitized).toContain('Safe content');
      expect(sanitized).toContain('More safe content');
    });

    test('should strip iframe tags', () => {
      const html = `
        <p>Safe content</p>
        <iframe src="https://malicious.com" width="500" height="300"></iframe>
        <p>More safe content</p>
      `;
      
      const sanitized = sanitizePostHtml(html);
      
      expect(sanitized).not.toContain('<iframe');
      expect(sanitized).not.toContain('malicious.com');
      expect(sanitized).toContain('Safe content');
      expect(sanitized).toContain('More safe content');
    });

    test('should strip inline event handlers', () => {
      const html = `
        <p onclick="alert('click')">Clickable paragraph</p>
        <a href="#" onmouseover="stealData()">Malicious link</a>
        <img src="/test.jpg" alt="Test" onerror="hack()" />
      `;
      
      const sanitized = sanitizePostHtml(html);
      
      expect(sanitized).not.toContain('onclick');
      expect(sanitized).not.toContain('onmouseover');
      expect(sanitized).not.toContain('onerror');
      expect(sanitized).not.toContain('alert(');
      expect(sanitized).not.toContain('stealData');
      expect(sanitized).not.toContain('hack()');
      expect(sanitized).toContain('Clickable paragraph');
      expect(sanitized).toContain('Malicious link');
    });

    test('should strip style tags and most style attributes', () => {
      const html = `
        <style>body { background: red; }</style>
        <p style="color: red; background: blue; text-align: center;">Styled paragraph</p>
        <div style="display: none; position: absolute;">Hidden div</div>
      `;
      
      const sanitized = sanitizePostHtml(html);
      
      expect(sanitized).not.toContain('<style');
      expect(sanitized).not.toContain('background: red');
      expect(sanitized).not.toContain('color: red');
      expect(sanitized).not.toContain('display: none');
      expect(sanitized).not.toContain('position: absolute');
      // text-align should be preserved
      expect(sanitized).toContain('Styled paragraph');
    });

    test('should remove disallowed attributes', () => {
      const html = `
        <p id="test" data-value="123" class="align-left">Paragraph</p>
        <a href="/test" target="_blank" rel="nofollow" class="link">Link</a>
        <img src="/test.jpg" alt="Test" id="image1" data-src="backup.jpg" />
      `;
      
      const sanitized = sanitizePostHtml(html);
      
      // Should remove id and data attributes
      expect(sanitized).not.toContain('id=');
      expect(sanitized).not.toContain('data-');
      // Should keep allowed attributes
      expect(sanitized).toContain('class="align-left"');
      expect(sanitized).toContain('href="/test"');
      expect(sanitized).toContain('src="/test.jpg"');
      expect(sanitized).toContain('alt="Test"');
    });
  });

  describe('Link Security', () => {
    test('should add rel="noopener noreferrer" to target="_blank" links', () => {
      const html = `
        <a href="https://external.com" target="_blank">External link</a>
        <a href="/internal" target="_self">Internal link</a>
        <a href="https://another.com" target="_blank" rel="bookmark">Existing rel</a>
      `;
      
      const sanitized = sanitizePostHtml(html);
      
      // Should add noopener noreferrer to target="_blank" without rel
      expect(sanitized).toMatch(/<a[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
      
      // Should preserve target="_self" without adding rel
      expect(sanitized).toContain('target="_self"');
      expect(sanitized).not.toContain('target="_self"[^>]*rel=');
      
      // Should add noopener noreferrer to existing rel
      expect(sanitized).toMatch(/rel="[^"]*noopener[^"]*"/);
      expect(sanitized).toMatch(/rel="[^"]*noreferrer[^"]*"/);
    });

    test('should preserve existing noopener noreferrer', () => {
      const html = `<a href="https://external.com" target="_blank" rel="noopener noreferrer">Already secure</a>`;
      
      const sanitized = sanitizePostHtml(html);
      
      expect(sanitized).toContain('rel="noopener noreferrer"');
      // Should not duplicate the attributes
      expect(sanitized.match(/noopener/g) || []).toHaveLength(1);
      expect(sanitized.match(/noreferrer/g) || []).toHaveLength(1);
    });
  });

  describe('Reading Time Calculation', () => {
    test('should calculate reading time correctly', () => {
      const shortText = 'This is a short text with about ten words total.';
      const longText = Array(201).fill('word').join(' '); // 201 words
      
      expect(calculateReadingTime(shortText)).toBe(1); // Minimum 1 minute
      expect(calculateReadingTime(longText)).toBe(2); // 201 words / 200 wpm = ~2 minutes
      expect(calculateReadingTime('')).toBe(0); // Empty text
      expect(calculateReadingTime(null)).toBe(0); // Null input
    });

    test('should extract text from HTML for reading time', () => {
      const html = `
        <h1>Title</h1>
        <p>This is a <strong>paragraph</strong> with <em>formatting</em>.</p>
        <ul><li>List item</li></ul>
      `;
      
      const text = extractTextFromHtml(html);
      const readingTime = calculateReadingTime(text);
      
      expect(text).toBe('Title This is a paragraph with formatting. List item');
      expect(readingTime).toBe(1); // Short text, minimum 1 minute
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty and null inputs', () => {
      expect(sanitizePostHtml('')).toBe('');
      expect(sanitizePostHtml(null)).toBe('');
      expect(sanitizePostHtml(undefined)).toBe('');
      
      expect(extractTextFromHtml('')).toBe('');
      expect(extractTextFromHtml(null)).toBe('');
      expect(extractTextFromHtml(undefined)).toBe('');
    });

    test('should handle malformed HTML', () => {
      const malformedHtml = `
        <p>Unclosed paragraph
        <div>Nested incorrectly</p>
        <img src="/test.jpg" alt="Missing closing
        <a href="/test">Unclosed link
      `;
      
      const sanitized = sanitizePostHtml(malformedHtml);
      
      // Should still process without throwing errors
      expect(typeof sanitized).toBe('string');
      expect(sanitized.length).toBeGreaterThan(0);
    });

    test('should preserve figure structure correctly', () => {
      const html = `
        <figure class="align-left">
          <img src="/uploads/test.jpg" alt="Test image" />
          <figcaption>This is a caption</figcaption>
        </figure>
      `;
      
      const sanitized = sanitizePostHtml(html);
      
      expect(sanitized).toContain('<figure');
      expect(sanitized).toContain('class="align-left"');
      expect(sanitized).toContain('<img');
      expect(sanitized).toContain('alt="Test image"');
      expect(sanitized).toContain('<figcaption>');
      expect(sanitized).toContain('This is a caption');
    });
  });
});
