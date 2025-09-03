// Rich Text Editor with TipTap
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import { useState, useImperativeHandle, forwardRef } from 'react'
import { supabase, getSessionToken } from '../../lib/supabase'
import ImagePicker from './ImagePicker'

interface RichTextEditorProps {
  content?: any
  onChange: (content: any) => void
  onInsertImage?: (payload: { file: File; alt: string }) => void
  className?: string
}

export interface RichTextEditorRef {
  insertFigure: (payload: { src: string; alt: string; caption?: string }) => void
}

const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(({ content, onChange, onInsertImage, className = '' }, ref) => {
  const [uploading, setUploading] = useState(false)
  const [imagePickerOpen, setImagePickerOpen] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline'
        }
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg'
        }
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph']
      }),
      Underline
    ],
    content,
    onUpdate: ({ editor }) => {
      // Provide both JSON and HTML for flexibility
      const jsonContent = editor.getJSON()
      const htmlContent = editor.getHTML()
      onChange({ json: jsonContent, html: htmlContent })
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-[200px] p-4'
      },
      handleKeyDown: (view, event) => {
        // Handle keyboard shortcuts
        if (event.ctrlKey || event.metaKey) {
          switch (event.key) {
            case 'b':
              event.preventDefault()
              editor?.chain().focus().toggleBold().run()
              return true
            case 'i':
              event.preventDefault()
              editor?.chain().focus().toggleItalic().run()
              return true
            case 'u':
              event.preventDefault()
              editor?.chain().focus().toggleUnderline().run()
              return true
            default:
              return false
          }
        }
        return false
      }
    }
  })

  const handleImageUpload = async (file: File) => {
    if (!file) return null

    setUploading(true)
    try {
      // Validate file
      const maxSize = (parseInt(import.meta.env.VITE_MAX_IMAGE_MB) || 3) * 1024 * 1024
      if (file.size > maxSize) {
        throw new Error(`File size must be less than ${maxSize / 1024 / 1024}MB`)
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Only JPEG, PNG, WebP, and GIF images are allowed')
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Must be logged in to upload images')

      // Generate file path
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      const filePath = `${user.id}/${new Date().toISOString().slice(0, 10)}/${fileName}`

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('post-images')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('post-images')
        .getPublicUrl(filePath)

      // Store metadata via API
      const token = await getSessionToken()
      if (token) {
        const response = await fetch('/api/images/metadata', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            path: filePath,
            mime_type: file.type,
            file_size_bytes: file.size,
            is_public: true
          })
        })

        if (!response.ok) {
          console.warn('Failed to store image metadata:', await response.text())
        }
      }

      return publicUrl
    } catch (error) {
      console.error('Image upload failed:', error)
      alert(error instanceof Error ? error.message : 'Image upload failed')
      return null
    } finally {
      setUploading(false)
    }
  }

  const addImage = () => {
    if (onInsertImage) {
      // Use the new ImagePicker modal
      setImagePickerOpen(true)
    } else {
      // Fallback to direct file upload (legacy behavior)
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (file) {
          const url = await handleImageUpload(file)
          if (url && editor) {
            editor.chain().focus().setImage({ src: url }).run()
          }
        }
      }
      input.click()
    }
  }

  const handleImagePickerConfirm = (payload: { file: File; alt: string }) => {
    setImagePickerOpen(false)
    onInsertImage?.(payload)
  }

  /**
   * Insert a semantic figure element at the current cursor position
   */
  const insertFigure = ({ src, alt, caption = '' }: { src: string; alt: string; caption?: string }) => {
    if (!editor) return

    // Create the figure HTML with semantic structure
    const figureHtml = `
      <figure class="align-left">
        <img src="${src}" alt="${alt}" />
        <figcaption>${caption}</figcaption>
      </figure>
    `.trim()

    // Insert the figure at the current selection
    editor
      .chain()
      .focus()
      .insertContent(figureHtml)
      .run()

    // Move cursor after the figure so typing continues naturally
    const { from } = editor.state.selection
    const figureNodeSize = editor.state.doc.nodeAt(from)?.nodeSize || 1
    editor
      .chain()
      .focus()
      .setTextSelection(from + figureNodeSize)
      .run()
  }

  // Expose insertFigure to parent component via ref
  useImperativeHandle(ref, () => ({
    insertFigure
  }), [editor])

  const setLink = () => {
    const previousUrl = editor?.getAttributes('link').href
    const url = window.prompt('URL', previousUrl)

    if (url === null) return

    if (url === '') {
      editor?.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  if (!editor) {
    return <div>Loading editor...</div>
  }

  return (
    <div className={`border border-gray-300 rounded-lg ${className}`}>
      {/* Toolbar */}
      <div className="border-b border-gray-200 p-2 flex flex-wrap gap-1">
        {/* Headings */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          aria-label="Heading 1"
          aria-pressed={editor.isActive('heading', { level: 1 })}
          className={`px-2 py-1 text-sm rounded ${
            editor.isActive('heading', { level: 1 }) ? 'bg-gray-200' : 'hover:bg-gray-100'
          }`}
        >
          H1
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          aria-label="Heading 2"
          aria-pressed={editor.isActive('heading', { level: 2 })}
          className={`px-2 py-1 text-sm rounded ${
            editor.isActive('heading', { level: 2 }) ? 'bg-gray-200' : 'hover:bg-gray-100'
          }`}
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          aria-label="Heading 3"
          aria-pressed={editor.isActive('heading', { level: 3 })}
          className={`px-2 py-1 text-sm rounded ${
            editor.isActive('heading', { level: 3 }) ? 'bg-gray-200' : 'hover:bg-gray-100'
          }`}
        >
          H3
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setParagraph().run()}
          aria-label="Paragraph"
          aria-pressed={editor.isActive('paragraph')}
          className={`px-2 py-1 text-sm rounded ${
            editor.isActive('paragraph') ? 'bg-gray-200' : 'hover:bg-gray-100'
          }`}
        >
          P
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        {/* Formatting */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          aria-label="Bold (Ctrl+B)"
          aria-pressed={editor.isActive('bold')}
          className={`px-2 py-1 text-sm rounded font-bold ${
            editor.isActive('bold') ? 'bg-gray-200' : 'hover:bg-gray-100'
          }`}
        >
          B
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          aria-label="Italic (Ctrl+I)"
          aria-pressed={editor.isActive('italic')}
          className={`px-2 py-1 text-sm rounded italic ${
            editor.isActive('italic') ? 'bg-gray-200' : 'hover:bg-gray-100'
          }`}
        >
          I
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          aria-label="Underline (Ctrl+U)"
          aria-pressed={editor.isActive('underline')}
          className={`px-2 py-1 text-sm rounded underline ${
            editor.isActive('underline') ? 'bg-gray-200' : 'hover:bg-gray-100'
          }`}
        >
          U
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          aria-label="Strikethrough"
          aria-pressed={editor.isActive('strike')}
          className={`px-2 py-1 text-sm rounded line-through ${
            editor.isActive('strike') ? 'bg-gray-200' : 'hover:bg-gray-100'
          }`}
        >
          S
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        {/* Alignment */}
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          aria-label="Align left"
          aria-pressed={editor.isActive({ textAlign: 'left' }) || (!editor.isActive({ textAlign: 'center' }) && !editor.isActive({ textAlign: 'right' }))}
          className={`px-2 py-1 text-sm rounded ${
            editor.isActive({ textAlign: 'left' }) || (!editor.isActive({ textAlign: 'center' }) && !editor.isActive({ textAlign: 'right' })) ? 'bg-gray-200' : 'hover:bg-gray-100'
          }`}
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          aria-label="Align center"
          aria-pressed={editor.isActive({ textAlign: 'center' })}
          className={`px-2 py-1 text-sm rounded ${
            editor.isActive({ textAlign: 'center' }) ? 'bg-gray-200' : 'hover:bg-gray-100'
          }`}
        >
          ↔
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          aria-label="Align right"
          aria-pressed={editor.isActive({ textAlign: 'right' })}
          className={`px-2 py-1 text-sm rounded ${
            editor.isActive({ textAlign: 'right' }) ? 'bg-gray-200' : 'hover:bg-gray-100'
          }`}
        >
          →
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        {/* Lists */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          aria-label="Bullet list"
          aria-pressed={editor.isActive('bulletList')}
          className={`px-2 py-1 text-sm rounded ${
            editor.isActive('bulletList') ? 'bg-gray-200' : 'hover:bg-gray-100'
          }`}
        >
          • List
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          aria-label="Numbered list"
          aria-pressed={editor.isActive('orderedList')}
          className={`px-2 py-1 text-sm rounded ${
            editor.isActive('orderedList') ? 'bg-gray-200' : 'hover:bg-gray-100'
          }`}
        >
          1. List
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        {/* Special blocks */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          aria-label="Block quote"
          aria-pressed={editor.isActive('blockquote')}
          className={`px-2 py-1 text-sm rounded ${
            editor.isActive('blockquote') ? 'bg-gray-200' : 'hover:bg-gray-100'
          }`}
        >
          Quote
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          aria-label="Code block"
          aria-pressed={editor.isActive('codeBlock')}
          className={`px-2 py-1 text-sm rounded ${
            editor.isActive('codeBlock') ? 'bg-gray-200' : 'hover:bg-gray-100'
          }`}
        >
          Code
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        {/* Media */}
        <button
          type="button"
          onClick={setLink}
          aria-label="Insert link"
          aria-pressed={editor.isActive('link')}
          className={`px-2 py-1 text-sm rounded ${
            editor.isActive('link') ? 'bg-gray-200' : 'hover:bg-gray-100'
          }`}
        >
          Link
        </button>
        <button
          type="button"
          onClick={addImage}
          disabled={uploading}
          aria-label="Insert image"
          className="px-2 py-1 text-sm rounded hover:bg-gray-100 disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : 'Image'}
        </button>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />

      {/* Image Picker Modal */}
      <ImagePicker
        open={imagePickerOpen}
        onClose={() => setImagePickerOpen(false)}
        onConfirm={handleImagePickerConfirm}
      />
    </div>
  )
})

RichTextEditor.displayName = 'RichTextEditor'

export default RichTextEditor
