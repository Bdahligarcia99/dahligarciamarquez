// client/src/__tests__/RichTextEditor.test.jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { Editor } from '@tiptap/react'
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

describe('RichTextEditor', () => {
  const mockOnChange = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('renders toolbar with all formatting buttons', () => {
    render(<RichTextEditor onChange={mockOnChange} />)

    // Check for heading buttons
    expect(screen.getByLabelText('Heading 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Heading 2')).toBeInTheDocument()
    expect(screen.getByLabelText('Heading 3')).toBeInTheDocument()
    expect(screen.getByLabelText('Paragraph')).toBeInTheDocument()

    // Check for formatting buttons
    expect(screen.getByLabelText('Bold (Ctrl+B)')).toBeInTheDocument()
    expect(screen.getByLabelText('Italic (Ctrl+I)')).toBeInTheDocument()
    expect(screen.getByLabelText('Underline (Ctrl+U)')).toBeInTheDocument()
    expect(screen.getByLabelText('Strikethrough')).toBeInTheDocument()

    // Check for alignment buttons
    expect(screen.getByLabelText('Align left')).toBeInTheDocument()
    expect(screen.getByLabelText('Align center')).toBeInTheDocument()
    expect(screen.getByLabelText('Align right')).toBeInTheDocument()

    // Check for list buttons
    expect(screen.getByLabelText('Bullet list')).toBeInTheDocument()
    expect(screen.getByLabelText('Numbered list')).toBeInTheDocument()

    // Check for special blocks
    expect(screen.getByLabelText('Block quote')).toBeInTheDocument()
    expect(screen.getByLabelText('Code block')).toBeInTheDocument()

    // Check for media buttons
    expect(screen.getByLabelText('Insert link')).toBeInTheDocument()
    expect(screen.getByLabelText('Insert image')).toBeInTheDocument()
  })

  test('toolbar buttons have proper accessibility attributes', () => {
    render(<RichTextEditor onChange={mockOnChange} />)

    const boldButton = screen.getByLabelText('Bold (Ctrl+B)')
    expect(boldButton).toHaveAttribute('type', 'button')
    expect(boldButton).toHaveAttribute('aria-pressed', 'false')

    const h1Button = screen.getByLabelText('Heading 1')
    expect(h1Button).toHaveAttribute('aria-pressed', 'false')
  })

  test('bold button triggers editor command', () => {
    render(<RichTextEditor onChange={mockOnChange} />)

    const boldButton = screen.getByLabelText('Bold (Ctrl+B)')
    fireEvent.click(boldButton)

    expect(mockEditor.chain().focus().toggleBold).toHaveBeenCalled()
  })

  test('italic button triggers editor command', () => {
    render(<RichTextEditor onChange={mockOnChange} />)

    const italicButton = screen.getByLabelText('Italic (Ctrl+I)')
    fireEvent.click(italicButton)

    expect(mockEditor.chain().focus().toggleItalic).toHaveBeenCalled()
  })

  test('underline button triggers editor command', () => {
    render(<RichTextEditor onChange={mockOnChange} />)

    const underlineButton = screen.getByLabelText('Underline (Ctrl+U)')
    fireEvent.click(underlineButton)

    expect(mockEditor.chain().focus().toggleUnderline).toHaveBeenCalled()
  })

  test('strikethrough button triggers editor command', () => {
    render(<RichTextEditor onChange={mockOnChange} />)

    const strikeButton = screen.getByLabelText('Strikethrough')
    fireEvent.click(strikeButton)

    expect(mockEditor.chain().focus().toggleStrike).toHaveBeenCalled()
  })

  test('heading buttons trigger correct commands', () => {
    render(<RichTextEditor onChange={mockOnChange} />)

    const h1Button = screen.getByLabelText('Heading 1')
    fireEvent.click(h1Button)
    expect(mockEditor.chain().focus().toggleHeading).toHaveBeenCalledWith({ level: 1 })

    const h2Button = screen.getByLabelText('Heading 2')
    fireEvent.click(h2Button)
    expect(mockEditor.chain().focus().toggleHeading).toHaveBeenCalledWith({ level: 2 })

    const h3Button = screen.getByLabelText('Heading 3')
    fireEvent.click(h3Button)
    expect(mockEditor.chain().focus().toggleHeading).toHaveBeenCalledWith({ level: 3 })

    const pButton = screen.getByLabelText('Paragraph')
    fireEvent.click(pButton)
    expect(mockEditor.chain().focus().setParagraph).toHaveBeenCalled()
  })

  test('alignment buttons trigger correct commands', () => {
    render(<RichTextEditor onChange={mockOnChange} />)

    const leftButton = screen.getByLabelText('Align left')
    fireEvent.click(leftButton)
    expect(mockEditor.chain().focus().setTextAlign).toHaveBeenCalledWith('left')

    const centerButton = screen.getByLabelText('Align center')
    fireEvent.click(centerButton)
    expect(mockEditor.chain().focus().setTextAlign).toHaveBeenCalledWith('center')

    const rightButton = screen.getByLabelText('Align right')
    fireEvent.click(rightButton)
    expect(mockEditor.chain().focus().setTextAlign).toHaveBeenCalledWith('right')
  })

  test('list buttons trigger correct commands', () => {
    render(<RichTextEditor onChange={mockOnChange} />)

    const bulletButton = screen.getByLabelText('Bullet list')
    fireEvent.click(bulletButton)
    expect(mockEditor.chain().focus().toggleBulletList).toHaveBeenCalled()

    const numberedButton = screen.getByLabelText('Numbered list')
    fireEvent.click(numberedButton)
    expect(mockEditor.chain().focus().toggleOrderedList).toHaveBeenCalled()
  })

  test('renders editor content', () => {
    render(<RichTextEditor onChange={mockOnChange} />)
    expect(screen.getByTestId('editor-content')).toBeInTheDocument()
  })

  test('calls onChange with both JSON and HTML when content updates', () => {
    const { useEditor } = require('@tiptap/react')
    
    // Mock the editor to simulate content update
    const mockEditorWithUpdate = {
      ...mockEditor,
      getJSON: jest.fn().mockReturnValue({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] }),
      getHTML: jest.fn().mockReturnValue('<p>Hello</p>')
    }

    useEditor.mockImplementation((config) => {
      // Simulate onUpdate callback
      if (config.onUpdate) {
        setTimeout(() => {
          config.onUpdate({ editor: mockEditorWithUpdate })
        }, 0)
      }
      return mockEditorWithUpdate
    })

    render(<RichTextEditor onChange={mockOnChange} />)

    // Wait for the onUpdate to be called
    setTimeout(() => {
      expect(mockOnChange).toHaveBeenCalledWith({
        json: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] },
        html: '<p>Hello</p>'
      })
    }, 10)
  })
})
