// client/src/__tests__/ImagePicker.test.jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ImagePicker from '../components/editor/ImagePicker'

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-object-url')
global.URL.revokeObjectURL = jest.fn()

describe('ImagePicker', () => {
  const mockOnClose = jest.fn()
  const mockOnConfirm = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  const createMockFile = (name = 'test.jpg', type = 'image/jpeg', size = 1024) => {
    const file = new File(['test'], name, { type })
    Object.defineProperty(file, 'size', { value: size })
    return file
  }

  test('renders modal when open is true', () => {
    render(<ImagePicker open={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />)
    
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Insert Image')).toBeInTheDocument()
  })

  test('does not render when open is false', () => {
    render(<ImagePicker open={false} onClose={mockOnClose} onConfirm={mockOnConfirm} />)
    
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('has proper accessibility attributes', () => {
    render(<ImagePicker open={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />)
    
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-labelledby', 'image-picker-title')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    
    expect(screen.getByLabelText('Close dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Alt Text *')).toBeInTheDocument()
  })

  test('closes modal when close button is clicked', () => {
    render(<ImagePicker open={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />)
    
    const closeButton = screen.getByLabelText('Close dialog')
    fireEvent.click(closeButton)
    
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  test('closes modal when cancel button is clicked', () => {
    render(<ImagePicker open={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />)
    
    const cancelButton = screen.getByText('Cancel')
    fireEvent.click(cancelButton)
    
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  test('Insert button is disabled initially', () => {
    render(<ImagePicker open={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />)
    
    const insertButton = screen.getByText('Insert')
    expect(insertButton).toBeDisabled()
  })

  test('validates file type - accepts valid image types', async () => {
    render(<ImagePicker open={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />)
    
    const fileInput = document.querySelector('input[type="file"]')
    const validFile = createMockFile('test.png', 'image/png', 1024)
    
    fireEvent.change(fileInput, { target: { files: [validFile] } })
    
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
    
    expect(global.URL.createObjectURL).toHaveBeenCalledWith(validFile)
  })

  test('validates file type - rejects invalid file types', async () => {
    render(<ImagePicker open={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />)
    
    const fileInput = document.querySelector('input[type="file"]')
    const invalidFile = createMockFile('test.pdf', 'application/pdf', 1024)
    
    fireEvent.change(fileInput, { target: { files: [invalidFile] } })
    
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Please select a PNG, JPG, or WebP image file.')
    })
  })

  test('validates file size - accepts files under 5MB', async () => {
    render(<ImagePicker open={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />)
    
    const fileInput = document.querySelector('input[type="file"]')
    const validFile = createMockFile('test.jpg', 'image/jpeg', 3 * 1024 * 1024) // 3MB
    
    fireEvent.change(fileInput, { target: { files: [validFile] } })
    
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  test('validates file size - rejects files over 5MB', async () => {
    render(<ImagePicker open={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />)
    
    const fileInput = document.querySelector('input[type="file"]')
    const largeFile = createMockFile('large.jpg', 'image/jpeg', 6 * 1024 * 1024) // 6MB
    
    fireEvent.change(fileInput, { target: { files: [largeFile] } })
    
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/File size must be less than 5MB/)
    })
  })

  test('shows preview when valid file is selected', async () => {
    render(<ImagePicker open={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />)
    
    const fileInput = document.querySelector('input[type="file"]')
    const validFile = createMockFile('test.jpg', 'image/jpeg', 1024)
    
    fireEvent.change(fileInput, { target: { files: [validFile] } })
    
    await waitFor(() => {
      expect(screen.getByText('Preview')).toBeInTheDocument()
      expect(screen.getByAltText('Preview')).toBeInTheDocument()
      expect(screen.getByText(/test.jpg/)).toBeInTheDocument()
    })
  })

  test('validates alt text is required', async () => {
    render(<ImagePicker open={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />)
    
    // Select a valid file
    const fileInput = document.querySelector('input[type="file"]')
    const validFile = createMockFile('test.jpg', 'image/jpeg', 1024)
    fireEvent.change(fileInput, { target: { files: [validFile] } })
    
    // Try to insert without alt text
    await waitFor(() => {
      const insertButton = screen.getByText('Insert')
      expect(insertButton).toBeDisabled()
    })
    
    // Click insert to trigger validation
    const insertButton = screen.getByText('Insert')
    fireEvent.click(insertButton)
    
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Alt text is required for accessibility.')
    })
  })

  test('enables Insert button when file and alt text are provided', async () => {
    render(<ImagePicker open={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />)
    
    // Select a valid file
    const fileInput = document.querySelector('input[type="file"]')
    const validFile = createMockFile('test.jpg', 'image/jpeg', 1024)
    fireEvent.change(fileInput, { target: { files: [validFile] } })
    
    // Enter alt text
    const altTextInput = screen.getByLabelText('Alt Text *')
    fireEvent.change(altTextInput, { target: { value: 'Test image description' } })
    
    await waitFor(() => {
      const insertButton = screen.getByText('Insert')
      expect(insertButton).not.toBeDisabled()
    })
  })

  test('calls onConfirm with correct payload when Insert is clicked', async () => {
    render(<ImagePicker open={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />)
    
    // Select a valid file
    const fileInput = document.querySelector('input[type="file"]')
    const validFile = createMockFile('test.jpg', 'image/jpeg', 1024)
    fireEvent.change(fileInput, { target: { files: [validFile] } })
    
    // Enter alt text
    const altTextInput = screen.getByLabelText('Alt Text *')
    const altText = 'Test image description'
    fireEvent.change(altTextInput, { target: { value: altText } })
    
    // Click insert
    await waitFor(() => {
      const insertButton = screen.getByText('Insert')
      fireEvent.click(insertButton)
    })
    
    expect(mockOnConfirm).toHaveBeenCalledWith({
      file: validFile,
      alt: altText
    })
  })

  test('handles drag and drop', async () => {
    render(<ImagePicker open={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />)
    
    const dropZone = screen.getByText(/Drop an image here/).closest('div')
    const validFile = createMockFile('dropped.jpg', 'image/jpeg', 1024)
    
    // Mock drag events
    const dragOverEvent = new Event('dragover', { bubbles: true })
    Object.defineProperty(dragOverEvent, 'dataTransfer', {
      value: { files: [] }
    })
    
    const dropEvent = new Event('drop', { bubbles: true })
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: { files: [validFile] }
    })
    
    fireEvent(dropZone, dragOverEvent)
    fireEvent(dropZone, dropEvent)
    
    await waitFor(() => {
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(validFile)
    })
  })

  test('clears errors when valid file is selected after invalid one', async () => {
    render(<ImagePicker open={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />)
    
    const fileInput = document.querySelector('input[type="file"]')
    
    // First select invalid file
    const invalidFile = createMockFile('test.pdf', 'application/pdf', 1024)
    fireEvent.change(fileInput, { target: { files: [invalidFile] } })
    
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    
    // Then select valid file
    const validFile = createMockFile('test.jpg', 'image/jpeg', 1024)
    fireEvent.change(fileInput, { target: { files: [validFile] } })
    
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  test('clears alt text error when text is entered', async () => {
    render(<ImagePicker open={true} onClose={mockOnClose} onConfirm={mockOnConfirm} />)
    
    // Select a valid file
    const fileInput = document.querySelector('input[type="file"]')
    const validFile = createMockFile('test.jpg', 'image/jpeg', 1024)
    fireEvent.change(fileInput, { target: { files: [validFile] } })
    
    // Try to insert without alt text to trigger error
    await waitFor(() => {
      const insertButton = screen.getByText('Insert')
      fireEvent.click(insertButton)
    })
    
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Alt text is required')
    })
    
    // Enter alt text to clear error
    const altTextInput = screen.getByLabelText('Alt Text *')
    fireEvent.change(altTextInput, { target: { value: 'Test description' } })
    
    await waitFor(() => {
      const alerts = screen.queryAllByRole('alert')
      const altTextAlert = alerts.find(alert => alert.textContent.includes('Alt text is required'))
      expect(altTextAlert).not.toBeInTheDocument()
    })
  })
})
