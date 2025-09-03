// client/src/__tests__/image-utils.test.js
import { loadImageDimensions, compressImage, isLargeImage, formatFileSize, formatDimensions } from '../utils/image'

// Mock HTMLImageElement
class MockImage {
  constructor() {
    this.naturalWidth = 0
    this.naturalHeight = 0
    this.onload = null
    this.onerror = null
  }

  set src(value) {
    // Simulate async image loading
    setTimeout(() => {
      if (value.includes('error')) {
        this.onerror?.()
      } else {
        // Set default dimensions or extract from URL
        if (value.includes('large')) {
          this.naturalWidth = 3000
          this.naturalHeight = 2500
        } else if (value.includes('small')) {
          this.naturalWidth = 800
          this.naturalHeight = 600
        } else {
          this.naturalWidth = 1920
          this.naturalHeight = 1080
        }
        this.onload?.()
      }
    }, 0)
  }
}

// Mock canvas and context
const mockCanvas = {
  width: 0,
  height: 0,
  getContext: jest.fn(() => ({
    drawImage: jest.fn()
  })),
  toBlob: jest.fn()
}

// Mock URL methods
global.URL.createObjectURL = jest.fn(() => 'mock-object-url')
global.URL.revokeObjectURL = jest.fn()

// Mock document.createElement
const originalCreateElement = document.createElement
document.createElement = jest.fn((tagName) => {
  if (tagName === 'canvas') {
    return mockCanvas
  }
  return originalCreateElement.call(document, tagName)
})

// Mock Image constructor
global.Image = MockImage

describe('Image Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCanvas.toBlob.mockReset()
  })

  const createMockFile = (name = 'test.jpg', type = 'image/jpeg', size = 1024) => {
    const file = new File(['test'], name, { type })
    Object.defineProperty(file, 'size', { value: size })
    return file
  }

  describe('loadImageDimensions', () => {
    test('loads dimensions for valid image', async () => {
      const file = createMockFile('test.jpg')
      
      const dimensions = await loadImageDimensions(file)
      
      expect(dimensions).toEqual({ width: 1920, height: 1080 })
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(file)
    })

    test('loads large dimensions', async () => {
      const file = createMockFile('large.jpg')
      
      const dimensions = await loadImageDimensions(file)
      
      expect(dimensions).toEqual({ width: 3000, height: 2500 })
    })

    test('loads small dimensions', async () => {
      const file = createMockFile('small.jpg')
      
      const dimensions = await loadImageDimensions(file)
      
      expect(dimensions).toEqual({ width: 800, height: 600 })
    })

    test('rejects on image load error', async () => {
      const file = createMockFile('error.jpg')
      
      await expect(loadImageDimensions(file)).rejects.toThrow('Failed to load image')
    })
  })

  describe('compressImage', () => {
    test('compresses image with default settings', async () => {
      const file = createMockFile('large.jpg', 'image/jpeg', 2 * 1024 * 1024)
      
      // Mock successful WebP compression
      const mockWebPBlob = new Blob(['compressed-webp'], { type: 'image/webp' })
      mockCanvas.toBlob.mockImplementation((callback, mimeType, quality) => {
        if (mimeType === 'image/webp') {
          callback(mockWebPBlob)
        }
      })

      const compressedFile = await compressImage(file)
      
      expect(compressedFile).toBeInstanceOf(File)
      expect(compressedFile.name).toBe('large.webp')
      expect(compressedFile.type).toBe('image/webp')
      expect(mockCanvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/webp', 0.82)
    })

    test('falls back to JPEG when WebP fails', async () => {
      const file = createMockFile('test.jpg', 'image/jpeg', 1024 * 1024)
      
      // Mock WebP failure, JPEG success
      const mockJPEGBlob = new Blob(['compressed-jpeg'], { type: 'image/jpeg' })
      mockCanvas.toBlob.mockImplementation((callback, mimeType, quality) => {
        if (mimeType === 'image/webp') {
          callback(null) // WebP fails
        } else if (mimeType === 'image/jpeg') {
          callback(mockJPEGBlob) // JPEG succeeds
        }
      })

      const compressedFile = await compressImage(file)
      
      expect(compressedFile.name).toBe('test.jpg')
      expect(compressedFile.type).toBe('image/jpeg')
      expect(mockCanvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/webp', 0.82)
      expect(mockCanvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.82)
    })

    test('uses custom compression options', async () => {
      const file = createMockFile('custom.png', 'image/png', 500 * 1024)
      
      const mockWebPBlob = new Blob(['compressed'], { type: 'image/webp' })
      mockCanvas.toBlob.mockImplementation((callback, mimeType, quality) => {
        if (mimeType === 'image/webp') {
          callback(mockWebPBlob)
        }
      })

      await compressImage(file, { maxDim: 1500, quality: 0.9 })
      
      expect(mockCanvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/webp', 0.9)
    })

    test('scales down large images', async () => {
      const file = createMockFile('large.jpg', 'image/jpeg', 1024)
      
      const mockWebPBlob = new Blob(['compressed'], { type: 'image/webp' })
      mockCanvas.toBlob.mockImplementation((callback) => callback(mockWebPBlob))

      await compressImage(file, { maxDim: 2000 })
      
      // Should scale down from 3000x2500 to fit within 2000px max dimension
      // Expected: 2000x1667 (maintaining aspect ratio)
      expect(mockCanvas.width).toBe(2000)
      expect(mockCanvas.height).toBe(1667)
    })

    test('preserves smaller images dimensions', async () => {
      const file = createMockFile('small.jpg', 'image/jpeg', 1024)
      
      const mockWebPBlob = new Blob(['compressed'], { type: 'image/webp' })
      mockCanvas.toBlob.mockImplementation((callback) => callback(mockWebPBlob))

      await compressImage(file, { maxDim: 2000 })
      
      // Should keep original dimensions (800x600 < 2000px)
      expect(mockCanvas.width).toBe(800)
      expect(mockCanvas.height).toBe(600)
    })

    test('rejects when both WebP and JPEG fail', async () => {
      const file = createMockFile('fail.jpg')
      
      // Mock both compressions failing
      mockCanvas.toBlob.mockImplementation((callback) => callback(null))

      await expect(compressImage(file)).rejects.toThrow('Image compression failed')
    })

    test('rejects on image load error', async () => {
      const file = createMockFile('error.jpg')
      
      await expect(compressImage(file)).rejects.toThrow('Failed to load image for compression')
    })
  })

  describe('isLargeImage', () => {
    test('returns true for large file size', async () => {
      const file = createMockFile('big.jpg', 'image/jpeg', 900 * 1024) // > 800KB
      
      const result = await isLargeImage(file)
      
      expect(result).toBe(true)
    })

    test('returns true for large dimensions', async () => {
      const file = createMockFile('large.jpg', 'image/jpeg', 100 * 1024) // Small file size but large dimensions
      
      const result = await isLargeImage(file)
      
      expect(result).toBe(true) // 3000x2500 > 2000px threshold
    })

    test('returns false for small images', async () => {
      const file = createMockFile('small.jpg', 'image/jpeg', 100 * 1024) // Small file and dimensions
      
      const result = await isLargeImage(file)
      
      expect(result).toBe(false) // 800x600 <= 2000px and 100KB <= 800KB
    })

    test('returns false on dimension load error', async () => {
      const file = createMockFile('error.jpg', 'image/jpeg', 100 * 1024) // Small file size
      
      const result = await isLargeImage(file)
      
      expect(result).toBe(false) // Falls back to file size check only
    })
  })

  describe('formatFileSize', () => {
    test('formats bytes', () => {
      expect(formatFileSize(512)).toBe('512 B')
    })

    test('formats kilobytes', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB') // 1.5 * 1024
    })

    test('formats megabytes', () => {
      expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB')
    })
  })

  describe('formatDimensions', () => {
    test('formats dimensions correctly', () => {
      expect(formatDimensions(1920, 1080)).toBe('1920 × 1080 px')
      expect(formatDimensions(800, 600)).toBe('800 × 600 px')
    })
  })
})
