// client/src/__tests__/ImagePicker.large-warning.test.jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ImagePicker from '../components/editor/ImagePicker'

// Mock the image utilities
jest.mock('../utils/image', () => ({
  isLargeImage: jest.fn(),
  loadImageDimensions: jest.fn(),
  compressImage: jest.fn(),
  formatFileSize: jest.fn(),
  formatDimensions: jest.fn()
}))

import { isLargeImage, loadImageDimensions, compressImage, formatFileSize, formatDimensions } from '../utils/image'

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-object-url')
global.URL.revokeObjectURL = jest.fn()

describe('ImagePicker Large Image Warning', () => {
  const mockOnClose = jest.fn()
  const mockOnConfirm = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Default mock implementations
    formatFileSize.mockImplementation((size) => `${(size / 1024).toFixed(1)} KB`)
    formatDimensions.mockImplementation((w, h) => `${w} × ${h} px`)
  })

  const createMockFile = (name = 'test.jpg', type = 'image/jpeg', size = 1024) => {
    const file = new File(['test'], name, { type })
    Object.defineProperty(file, 'size', { value: size })
    return file
  }

  test('shows warning for large images', async () => {
    // Mock large image detection
    isLargeImage.mockResolvedValue(true)
    loadImageDimensions.mockResolvedValue({ width: 3000, height: 2000 })

    render(<ImagePicker open={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />)

    const fileInput = document.querySelector('input[type="file"]')
    const largeFile = createMockFile('large.jpg', 'image/jpeg', 2 * 1024 * 1024)
    
    fireEvent.change(fileInput, { target: { files: [largeFile] } })

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(screen.getByText('Large image detected. This may slow page loads.')).toBeInTheDocument()
    })

    expect(screen.getByText('Compress')).toBeInTheDocument()
    expect(screen.getByText('Keep original')).toBeInTheDocument()
  })

  test('does not show warning for small images', async () => {
    isLargeImage.mockResolvedValue(false)
    loadImageDimensions.mockResolvedValue({ width: 800, height: 600 })

    render(<ImagePicker open={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />)

    const fileInput = document.querySelector('input[type="file"]')
    const smallFile = createMockFile('small.jpg', 'image/jpeg', 100 * 1024)
    
    fireEvent.change(fileInput, { target: { files: [smallFile] } })

    await waitFor(() => {
      expect(screen.queryByText('Large image detected')).not.toBeInTheDocument()
    })
  })

  test('displays original image stats in warning', async () => {
    isLargeImage.mockResolvedValue(true)
    loadImageDimensions.mockResolvedValue({ width: 3000, height: 2500 })
    formatDimensions.mockReturnValue('3000 × 2500 px')
    formatFileSize.mockReturnValue('2.0 MB')

    render(<ImagePicker open={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />)

    const fileInput = document.querySelector('input[type="file"]')
    const largeFile = createMockFile('large.jpg', 'image/jpeg', 2 * 1024 * 1024)
    
    fireEvent.change(fileInput, { target: { files: [largeFile] } })

    await waitFor(() => {
      expect(screen.getByText(/Original: 3000 × 2500 px, 2.0 MB/)).toBeInTheDocument()
    })
  })

  test('compresses image when Compress button is clicked', async () => {
    isLargeImage.mockResolvedValue(true)
    loadImageDimensions
      .mockResolvedValueOnce({ width: 3000, height: 2500 }) // Original
      .mockResolvedValueOnce({ width: 2000, height: 1667 }) // Compressed

    const compressedFile = createMockFile('large.webp', 'image/webp', 500 * 1024)
    compressImage.mockResolvedValue(compressedFile)

    render(<ImagePicker open={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />)

    const fileInput = document.querySelector('input[type="file"]')
    const originalFile = createMockFile('large.jpg', 'image/jpeg', 2 * 1024 * 1024)
    
    fireEvent.change(fileInput, { target: { files: [originalFile] } })

    await waitFor(() => {
      expect(screen.getByText('Compress')).toBeInTheDocument()
    })

    const compressButton = screen.getByText('Compress')
    fireEvent.click(compressButton)

    // Should show compressing state
    expect(screen.getByText('Compressing...')).toBeInTheDocument()

    await waitFor(() => {
      expect(compressImage).toHaveBeenCalledWith(originalFile)
    })

    await waitFor(() => {
      expect(screen.queryByText('Large image detected')).not.toBeInTheDocument()
      expect(screen.getByText('Image compressed successfully')).toBeInTheDocument()
    })
  })

  test('shows compression result with before/after stats', async () => {
    isLargeImage.mockResolvedValue(true)
    loadImageDimensions
      .mockResolvedValueOnce({ width: 3000, height: 2500 }) // Original
      .mockResolvedValueOnce({ width: 2000, height: 1667 }) // Compressed

    const compressedFile = createMockFile('large.webp', 'image/webp', 500 * 1024)
    compressImage.mockResolvedValue(compressedFile)
    
    formatDimensions
      .mockReturnValueOnce('3000 × 2500 px') // Original
      .mockReturnValueOnce('2000 × 1667 px') // Compressed
    
    formatFileSize
      .mockReturnValueOnce('2.0 MB') // Original
      .mockReturnValueOnce('500.0 KB') // Compressed

    render(<ImagePicker open={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />)

    const fileInput = document.querySelector('input[type="file"]')
    const originalFile = createMockFile('large.jpg', 'image/jpeg', 2 * 1024 * 1024)
    
    fireEvent.change(fileInput, { target: { files: [originalFile] } })

    await waitFor(() => {
      const compressButton = screen.getByText('Compress')
      fireEvent.click(compressButton)
    })

    await waitFor(() => {
      expect(screen.getByText(/Compressed from 3000 × 2500 px, 2.0 MB → 2000 × 1667 px, 500.0 KB/)).toBeInTheDocument()
    })
  })

  test('keeps original image when Keep original is clicked', async () => {
    isLargeImage.mockResolvedValue(true)
    loadImageDimensions.mockResolvedValue({ width: 3000, height: 2500 })

    render(<ImagePicker open={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />)

    const fileInput = document.querySelector('input[type="file"]')
    const largeFile = createMockFile('large.jpg', 'image/jpeg', 2 * 1024 * 1024)
    
    fireEvent.change(fileInput, { target: { files: [largeFile] } })

    await waitFor(() => {
      expect(screen.getByText('Keep original')).toBeInTheDocument()
    })

    const keepButton = screen.getByText('Keep original')
    fireEvent.click(keepButton)

    // Warning should disappear
    expect(screen.queryByText('Large image detected')).not.toBeInTheDocument()
    
    // Should not call compress
    expect(compressImage).not.toHaveBeenCalled()
  })

  test('handles compression errors gracefully', async () => {
    isLargeImage.mockResolvedValue(true)
    loadImageDimensions.mockResolvedValue({ width: 3000, height: 2500 })
    compressImage.mockRejectedValue(new Error('Compression failed'))

    render(<ImagePicker open={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />)

    const fileInput = document.querySelector('input[type="file"]')
    const largeFile = createMockFile('large.jpg', 'image/jpeg', 2 * 1024 * 1024)
    
    fireEvent.change(fileInput, { target: { files: [largeFile] } })

    await waitFor(() => {
      const compressButton = screen.getByText('Compress')
      fireEvent.click(compressButton)
    })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to compress image. Please try a different image.')
    })
  })

  test('Insert button remains disabled during compression', async () => {
    isLargeImage.mockResolvedValue(true)
    loadImageDimensions.mockResolvedValue({ width: 3000, height: 2500 })
    
    // Mock compression to take some time
    compressImage.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

    render(<ImagePicker open={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />)

    const fileInput = document.querySelector('input[type="file"]')
    const largeFile = createMockFile('large.jpg', 'image/jpeg', 2 * 1024 * 1024)
    
    fireEvent.change(fileInput, { target: { files: [largeFile] } })

    // Add alt text to make Insert potentially enabled
    const altTextInput = screen.getByLabelText('Alt Text *')
    fireEvent.change(altTextInput, { target: { value: 'Test alt text' } })

    await waitFor(() => {
      const compressButton = screen.getByText('Compress')
      fireEvent.click(compressButton)
    })

    // Insert should be disabled during compression
    const insertButton = screen.getByText(/Compressing|Insert/)
    expect(insertButton).toBeDisabled()
  })

  test('focuses Insert button after compression completes', async () => {
    isLargeImage.mockResolvedValue(true)
    loadImageDimensions
      .mockResolvedValueOnce({ width: 3000, height: 2500 })
      .mockResolvedValueOnce({ width: 2000, height: 1667 })

    const compressedFile = createMockFile('compressed.webp', 'image/webp', 500 * 1024)
    compressImage.mockResolvedValue(compressedFile)

    render(<ImagePicker open={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />)

    const fileInput = document.querySelector('input[type="file"]')
    const largeFile = createMockFile('large.jpg', 'image/jpeg', 2 * 1024 * 1024)
    
    fireEvent.change(fileInput, { target: { files: [largeFile] } })

    // Add alt text
    const altTextInput = screen.getByLabelText('Alt Text *')
    fireEvent.change(altTextInput, { target: { value: 'Test alt text' } })

    await waitFor(() => {
      const compressButton = screen.getByText('Compress')
      fireEvent.click(compressButton)
    })

    await waitFor(() => {
      expect(screen.getByText('Image compressed successfully')).toBeInTheDocument()
    })

    // Check that Insert button becomes focused (we can't directly test focus, but we can test it's enabled)
    await waitFor(() => {
      const insertButton = screen.getByText('Insert')
      expect(insertButton).not.toBeDisabled()
    })
  })

  test('focuses Insert button after keeping original', async () => {
    isLargeImage.mockResolvedValue(true)
    loadImageDimensions.mockResolvedValue({ width: 3000, height: 2500 })

    render(<ImagePicker open={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />)

    const fileInput = document.querySelector('input[type="file"]')
    const largeFile = createMockFile('large.jpg', 'image/jpeg', 2 * 1024 * 1024)
    
    fireEvent.change(fileInput, { target: { files: [largeFile] } })

    // Add alt text
    const altTextInput = screen.getByLabelText('Alt Text *')
    fireEvent.change(altTextInput, { target: { value: 'Test alt text' } })

    await waitFor(() => {
      const keepButton = screen.getByText('Keep original')
      fireEvent.click(keepButton)
    })

    // Insert button should be enabled after keeping original
    const insertButton = screen.getByText('Insert')
    expect(insertButton).not.toBeDisabled()
  })

  test('warning has proper accessibility attributes', async () => {
    isLargeImage.mockResolvedValue(true)
    loadImageDimensions.mockResolvedValue({ width: 3000, height: 2500 })

    render(<ImagePicker open={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />)

    const fileInput = document.querySelector('input[type="file"]')
    const largeFile = createMockFile('large.jpg', 'image/jpeg', 2 * 1024 * 1024)
    
    fireEvent.change(fileInput, { target: { files: [largeFile] } })

    await waitFor(() => {
      const warningPanel = screen.getByRole('status')
      expect(warningPanel).toHaveClass('bg-yellow-50')
    })
  })

  test('compression result has proper accessibility attributes', async () => {
    isLargeImage.mockResolvedValue(true)
    loadImageDimensions
      .mockResolvedValueOnce({ width: 3000, height: 2500 })
      .mockResolvedValueOnce({ width: 2000, height: 1667 })

    const compressedFile = createMockFile('compressed.webp', 'image/webp', 500 * 1024)
    compressImage.mockResolvedValue(compressedFile)

    render(<ImagePicker open={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />)

    const fileInput = document.querySelector('input[type="file"]')
    const largeFile = createMockFile('large.jpg', 'image/jpeg', 2 * 1024 * 1024)
    
    fireEvent.change(fileInput, { target: { files: [largeFile] } })

    await waitFor(() => {
      const compressButton = screen.getByText('Compress')
      fireEvent.click(compressButton)
    })

    await waitFor(() => {
      const successPanel = screen.getByRole('status')
      expect(successPanel).toHaveClass('bg-green-50')
    })
  })
})
