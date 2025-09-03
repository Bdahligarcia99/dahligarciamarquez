// client/src/__tests__/RichTextEditor.insert-image.test.jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import RichTextEditor from '../components/editor/RichTextEditor'

// Mock TipTap editor
const mockEditor = {
  chain: () => ({
    focus: () => ({
      toggleBold: jest.fn().mockReturnValue({ run: jest.fn() }),
      toggleItalic: jest.fn().mockReturnValue({ run: jest.fn() }),
      toggleUnderline: jest.fn().mockReturnValue({ run: jest.fn() }),
      toggleStrike: jest.fn().mockReturnValue({ run: jest.fn() }),
      toggleHeading: jest.fn().mockReturnValue({ run: jest.fn() }),
      setParagraph: jest.fn().mockReturnValue({ run: jest.fn() }),
      setTextAlign: jest.fn().mockReturnValue({ run: jest.fn() }),
      toggleBulletList: jest.fn().mockReturnValue({ run: jest.fn() }),
      toggleOrderedList: jest.fn().mockReturnValue({ run: jest.fn() }),
      toggleBlockquote: jest.fn().mockReturnValue({ run: jest.fn() }),
      toggleCodeBlock: jest.fn().mockReturnValue({ run: jest.fn() }),
      setImage: jest.fn().mockReturnValue({ run: jest.fn() }),
      setLink: jest.fn().mockReturnValue({ run: jest.fn() }),
      unsetLink: jest.fn().mockReturnValue({ run: jest.fn() }),
      extendMarkRange: jest.fn().mockReturnValue({
        setLink: jest.fn().mockReturnValue({ run: jest.fn() }),
        unsetLink: jest.fn().mockReturnValue({ run: jest.fn() })
      })
    })
  }),
  isActive: jest.fn().mockReturnValue(false),
  getJSON: jest.fn().mockReturnValue({ type: 'doc', content: [] }),
  getHTML: jest.fn().mockReturnValue('<p></p>'),
  getAttributes: jest.fn().mockReturnValue({})
}

// Mock useEditor hook
jest.mock('@tiptap/react', () => ({
  useEditor: jest.fn(() => mockEditor),
  EditorContent: ({ editor }) => <div data-testid="editor-content">Editor Content</div>
}))

// Mock Supabase
jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } }
      })
    },
    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({
          data: { path: 'test-path' },
          error: null
        }),
        getPublicUrl: jest.fn().mockReturnValue({
          data: { publicUrl: 'https://example.com/image.jpg' }
        })
      })
    }
  },
  getSessionToken: jest.fn().mockResolvedValue('test-token')
}))

// Mock fetch for image metadata
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: jest.fn().mockResolvedValue({})
})

// Mock URL.createObjectURL and revokeObjectURL for ImagePicker
global.URL.createObjectURL = jest.fn(() => 'mock-object-url')
global.URL.revokeObjectURL = jest.fn()

describe('RichTextEditor Image Insert Integration', () => {
  const mockOnChange = jest.fn()
  const mockOnInsertImage = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  const createMockFile = (name = 'test.jpg', type = 'image/jpeg', size = 1024) => {
    const file = new File(['test'], name, { type })
    Object.defineProperty(file, 'size', { value: size })
    return file
  }

  test('renders Insert Image button in toolbar', () => {
    render(
      <RichTextEditor 
        onChange={mockOnChange} 
        onInsertImage={mockOnInsertImage}
      />
    )

    expect(screen.getByLabelText('Insert image')).toBeInTheDocument()
  })

  test('clicking Insert Image button opens ImagePicker modal', async () => {
    render(
      <RichTextEditor 
        onChange={mockOnChange} 
        onInsertImage={mockOnInsertImage}
      />
    )

    const insertImageButton = screen.getByLabelText('Insert image')
    fireEvent.click(insertImageButton)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Insert Image')).toBeInTheDocument()
    })
  })

  test('ImagePicker modal can be closed', async () => {
    render(
      <RichTextEditor 
        onChange={mockOnChange} 
        onInsertImage={mockOnInsertImage}
      />
    )

    // Open modal
    const insertImageButton = screen.getByLabelText('Insert image')
    fireEvent.click(insertImageButton)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    // Close modal
    const closeButton = screen.getByLabelText('Close dialog')
    fireEvent.click(closeButton)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  test('completing ImagePicker flow calls onInsertImage with correct payload', async () => {
    render(
      <RichTextEditor 
        onChange={mockOnChange} 
        onInsertImage={mockOnInsertImage}
      />
    )

    // Open modal
    const insertImageButton = screen.getByLabelText('Insert image')
    fireEvent.click(insertImageButton)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    // Select a file
    const fileInput = document.querySelector('input[type="file"]')
    const testFile = createMockFile('test-image.png', 'image/png', 2048)
    fireEvent.change(fileInput, { target: { files: [testFile] } })

    // Enter alt text
    const altTextInput = screen.getByLabelText('Alt Text *')
    const altText = 'A test image for the editor'
    fireEvent.change(altTextInput, { target: { value: altText } })

    // Click Insert
    await waitFor(() => {
      const insertButton = screen.getByText('Insert')
      expect(insertButton).not.toBeDisabled()
      fireEvent.click(insertButton)
    })

    // Verify onInsertImage was called with correct payload
    expect(mockOnInsertImage).toHaveBeenCalledWith({
      file: testFile,
      alt: altText
    })

    // Verify modal is closed
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  test('falls back to legacy behavior when onInsertImage is not provided', async () => {
    // Mock document.createElement for file input
    const mockInput = {
      type: '',
      accept: '',
      onchange: null,
      click: jest.fn()
    }
    const originalCreateElement = document.createElement
    document.createElement = jest.fn().mockReturnValue(mockInput)

    render(<RichTextEditor onChange={mockOnChange} />)

    const insertImageButton = screen.getByLabelText('Insert image')
    fireEvent.click(insertImageButton)

    // Should not open ImagePicker modal
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // Should create file input and click it (legacy behavior)
    expect(document.createElement).toHaveBeenCalledWith('input')
    expect(mockInput.type).toBe('file')
    expect(mockInput.accept).toBe('image/*')
    expect(mockInput.click).toHaveBeenCalled()

    // Restore original createElement
    document.createElement = originalCreateElement
  })

  test('ImagePicker validates file types correctly', async () => {
    render(
      <RichTextEditor 
        onChange={mockOnChange} 
        onInsertImage={mockOnInsertImage}
      />
    )

    // Open modal
    const insertImageButton = screen.getByLabelText('Insert image')
    fireEvent.click(insertImageButton)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    // Try to select invalid file type
    const fileInput = document.querySelector('input[type="file"]')
    const invalidFile = createMockFile('document.pdf', 'application/pdf', 1024)
    fireEvent.change(fileInput, { target: { files: [invalidFile] } })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Please select a PNG, JPG, or WebP image file.')
    })

    // Insert button should remain disabled
    const insertButton = screen.getByText('Insert')
    expect(insertButton).toBeDisabled()
  })

  test('ImagePicker validates file size correctly', async () => {
    render(
      <RichTextEditor 
        onChange={mockOnChange} 
        onInsertImage={mockOnInsertImage}
      />
    )

    // Open modal
    const insertImageButton = screen.getByLabelText('Insert image')
    fireEvent.click(insertImageButton)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    // Try to select oversized file
    const fileInput = document.querySelector('input[type="file"]')
    const largeFile = createMockFile('large.jpg', 'image/jpeg', 6 * 1024 * 1024) // 6MB
    fireEvent.change(fileInput, { target: { files: [largeFile] } })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/File size must be less than 5MB/)
    })

    // Insert button should remain disabled
    const insertButton = screen.getByText('Insert')
    expect(insertButton).toBeDisabled()
  })

  test('ImagePicker requires alt text', async () => {
    render(
      <RichTextEditor 
        onChange={mockOnChange} 
        onInsertImage={mockOnInsertImage}
      />
    )

    // Open modal
    const insertImageButton = screen.getByLabelText('Insert image')
    fireEvent.click(insertImageButton)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    // Select valid file but no alt text
    const fileInput = document.querySelector('input[type="file"]')
    const validFile = createMockFile('valid.jpg', 'image/jpeg', 1024)
    fireEvent.change(fileInput, { target: { files: [validFile] } })

    await waitFor(() => {
      // Insert button should be disabled without alt text
      const insertButton = screen.getByText('Insert')
      expect(insertButton).toBeDisabled()
    })

    // Try clicking Insert to trigger validation
    const insertButton = screen.getByText('Insert')
    fireEvent.click(insertButton)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Alt text is required for accessibility.')
    })

    // onInsertImage should not be called
    expect(mockOnInsertImage).not.toHaveBeenCalled()
  })

  test('shows preview when valid image is selected', async () => {
    render(
      <RichTextEditor 
        onChange={mockOnChange} 
        onInsertImage={mockOnInsertImage}
      />
    )

    // Open modal
    const insertImageButton = screen.getByLabelText('Insert image')
    fireEvent.click(insertImageButton)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    // Select valid file
    const fileInput = document.querySelector('input[type="file"]')
    const validFile = createMockFile('preview-test.png', 'image/png', 2048)
    fireEvent.change(fileInput, { target: { files: [validFile] } })

    await waitFor(() => {
      expect(screen.getByText('Preview')).toBeInTheDocument()
      expect(screen.getByAltText('Preview')).toBeInTheDocument()
      expect(screen.getByText(/preview-test.png/)).toBeInTheDocument()
      expect(screen.getByText(/2.0 KB/)).toBeInTheDocument()
    })

    expect(global.URL.createObjectURL).toHaveBeenCalledWith(validFile)
  })
})
