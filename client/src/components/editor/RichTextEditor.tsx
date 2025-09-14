// Rich Text Editor with TipTap
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import { useState, useImperativeHandle, forwardRef } from 'react'
import { supabase, getSessionToken, isSupabaseConfigured } from '../../lib/supabase'
import { API_MISCONFIGURED } from '../../lib/api'
import ImagePicker from './ImagePicker'

interface RichTextEditorProps {
  content?: any
  onChange: (content: any) => void
  onInsertImage?: (payload: { file: File; alt: string }) => void
  onImageDoubleClick?: (imageUrl: string) => void
  className?: string
}

export interface RichTextEditorRef {
  insertFigure: (payload: { src: string; alt: string; caption?: string }) => void
  editor?: any
}

const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(({ content, onChange, onInsertImage, onImageDoubleClick, className = '' }, ref) => {
  const [uploading, setUploading] = useState(false)
  const [imagePickerOpen, setImagePickerOpen] = useState(false)
  const [editorHeight, setEditorHeight] = useState(() => {
    // Responsive default height based on screen size
    if (typeof window !== 'undefined') {
      const height = window.innerHeight
      if (height < 600) return '50vh' // Smaller screens
      if (height < 800) return '55vh' // Medium screens  
      return '60vh' // Large screens
    }
    return '60vh'
  })
  
  const [editorWidth, setEditorWidth] = useState(() => {
    // Responsive default width based on screen size
    if (typeof window !== 'undefined') {
      const width = window.innerWidth
      if (width < 768) return '100%' // Mobile: full width
      if (width < 1024) return '90%' // Tablet: 90% width
      if (width < 1440) return '80%' // Desktop: 80% width
      return '70%' // Large desktop: 70% width (but can expand much more)
    }
    return '100%'
  })
  
  // Check if image uploads are available
  const uploadsAvailable = !API_MISCONFIGURED && (isSupabaseConfigured || true) // Server endpoint is always available when API is configured

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg my-4',
          draggable: false // Prevent drag and drop deletion
        }
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline'
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
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none'
      },
      handleDOMEvents: {
        dblclick: (view, event) => {
          const target = event.target as HTMLElement
          if (target.tagName === 'IMG' && onImageDoubleClick) {
            const img = target as HTMLImageElement
            onImageDoubleClick(img.src)
            return true // Prevent default behavior
          }
          return false
        },
        // Prevent context menu on images to avoid delete options
        contextmenu: (view, event) => {
          const target = event.target as HTMLElement
          if (target.tagName === 'IMG') {
            event.preventDefault()
            return true
          }
          return false
        },
        // Prevent drag start on images
        dragstart: (view, event) => {
          const target = event.target as HTMLElement
          if (target.tagName === 'IMG') {
            event.preventDefault()
            return true
          }
          return false
        }
      },
      handleKeyDown: (view, event) => {
        // Prevent image deletion - all image manipulation should go through image management panel
        if (event.key === 'Delete' || event.key === 'Backspace' || (event.key === 'x' && (event.ctrlKey || event.metaKey))) {
          const { selection } = view.state
          const { from, to } = selection
          
          // Check if an image node is selected
          const nodeAtSelection = view.state.doc.nodeAt(from)
          if (nodeAtSelection && nodeAtSelection.type.name === 'image') {
            event.preventDefault()
            return true // Prevent deletion
          }
          
          // Check if we're about to delete into an image (backspace case)
          if (event.key === 'Backspace' && from > 0) {
            const nodeBefore = view.state.doc.nodeAt(from - 1)
            if (nodeBefore && nodeBefore.type.name === 'image') {
              event.preventDefault()
              return true // Prevent deletion
            }
          }
          
          // Check if we're about to delete into an image (delete case)
          if (event.key === 'Delete' && to < view.state.doc.content.size) {
            const nodeAfter = view.state.doc.nodeAt(to)
            if (nodeAfter && nodeAfter.type.name === 'image') {
              event.preventDefault()
              return true // Prevent deletion
            }
          }
        }

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
            // Use TipTap's native image insertion instead of raw HTML
            editor.chain().focus().setImage({ src: url, alt: file.name }).run()
          }
        }
      }
      input.click()
    }
  }

  const handleImagePickerConfirm = (payload: { file?: File; url?: string; alt: string }) => {
    setImagePickerOpen(false)
    
    if (payload.file) {
      // Handle file upload
      onInsertImage?.(payload as { file: File; alt: string })
    } else if (payload.url) {
      // Handle URL insertion - insert directly into editor
      insertFigure({ src: payload.url, alt: payload.alt })
    }
  }

  /**
   * Insert an image using TipTap's native Image extension with debugging
   */
  const insertFigure = ({ src, alt, caption = '' }: { src: string; alt: string; caption?: string }) => {
    if (!editor) {
      console.error('Editor not available for image insertion')
      return
    }

    console.log('Inserting image with TipTap setImage:', { src, alt, caption })

    // Debug: Check if Image extension is available
    const imageExtension = editor.extensionManager.extensions.find(ext => ext.name === 'image');
    console.log('Image extension found:', !!imageExtension);
    if (imageExtension) {
      console.log('Image extension config:', imageExtension.options);
    }

    // Use the working method (direct setImage command) - this worked in testing
    console.log('Using direct setImage command that worked in testing...');
    let result = false;
    try {
      result = editor.commands.setImage({
        src: src,
        alt: alt,
        title: caption || alt
      });
      console.log('setImage command result:', result);
    } catch (error) {
      console.error('setImage command error:', error);
    }
      
    console.log('insertContent command result:', result)

    // Immediate check - see if image exists right after insertion
    console.log('Immediate check after insertion:');
    console.log('HTML immediately:', editor.getHTML());
    console.log('JSON immediately:', JSON.stringify(editor.getJSON(), null, 2));

    // Don't add extra paragraph - it might be interfering with the image
    // Just check the final state after a brief delay
    setTimeout(() => {
      // Log the HTML content to see what was actually inserted
      console.log('HTML after brief delay:', editor.getHTML())
      
      // Check if the image is actually in the document
      const hasImg = editor.getHTML().includes('<img');
      console.log('Image found in HTML after delay:', hasImg);
      
      if (!hasImg) {
        console.log('⚠️ Image disappeared after insertion!');
        console.log('Editor JSON after delay:', JSON.stringify(editor.getJSON(), null, 2));
      } else {
        console.log('✅ Image persisted successfully!');
      }
    }, 50)
  }

  // Expose insertFigure and editor to parent component via ref
  useImperativeHandle(ref, () => ({
    insertFigure,
    editor
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

  // Handle height resize functionality
  const handleHeightMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startHeight = parseInt(editorHeight.replace('vh', '').replace('px', ''))
    const isVh = editorHeight.includes('vh')
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - startY
      if (isVh) {
        const viewportHeight = window.innerHeight
        const deltaVh = (deltaY / viewportHeight) * 100
        const newHeight = Math.max(20, Math.min(80, startHeight + deltaVh)) // Min 20vh, Max 80vh
        setEditorHeight(`${newHeight}vh`)
      } else {
        const newHeight = Math.max(200, startHeight + deltaY) // Min 200px
        setEditorHeight(`${newHeight}px`)
      }
    }
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }

  // Handle width resize functionality
  const handleWidthMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = parseInt(editorWidth.replace('%', '').replace('px', '').replace('vw', ''))
    const isPercent = editorWidth.includes('%')
    const isVw = editorWidth.includes('vw')
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX
      if (isPercent) {
        const containerWidth = (e.target as HTMLElement).closest('.max-w-4xl')?.clientWidth || window.innerWidth
        const deltaPercent = (deltaX / containerWidth) * 100
        const newWidth = Math.max(30, Math.min(200, startWidth + deltaPercent)) // Min 30%, Max 200%
        setEditorWidth(`${newWidth}%`)
      } else if (isVw) {
        const viewportWidth = window.innerWidth
        const deltaVw = (deltaX / viewportWidth) * 100
        const newWidth = Math.max(20, Math.min(95, startWidth + deltaVw)) // Min 20vw, Max 95vw
        setEditorWidth(`${newWidth}vw`)
      } else {
        const newWidth = Math.max(300, startWidth + deltaX) // Min 300px
        setEditorWidth(`${newWidth}px`)
      }
    }
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  return (
    <div 
      className={`border border-gray-300 rounded-lg mx-auto relative ${className}`}
      style={{ width: editorWidth }}
    >
      {/* Fixed Toolbar */}
      <div className="border-b border-gray-200 p-2 flex flex-wrap gap-1 bg-white rounded-t-lg sticky top-0 z-10">
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
          disabled={uploading || !uploadsAvailable}
          aria-label={uploadsAvailable ? "Insert image" : "Image uploads not configured in this environment"}
          title={uploadsAvailable ? "Insert image" : "Image uploads not configured in this environment"}
          className="px-2 py-1 text-sm rounded hover:bg-gray-100 disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : 'Image'}
        </button>
      </div>

      {/* Scrollable Content Area */}
      <div 
        className="relative"
        style={{ height: editorHeight }}
      >
        <div className="h-full overflow-y-auto p-4">
          <EditorContent editor={editor} />
        </div>
        
        {/* Height Resize Handle (Bottom) */}
        <div
          onMouseDown={handleHeightMouseDown}
          className="absolute bottom-0 left-0 right-0 h-2 bg-gray-100 hover:bg-gray-200 cursor-row-resize flex items-center justify-center group transition-colors"
          title="Drag to resize editor height"
        >
          <div className="w-8 h-1 bg-gray-400 rounded-full group-hover:bg-gray-600 transition-colors"></div>
        </div>
        
        {/* Width Resize Handle (Right) */}
        <div
          onMouseDown={handleWidthMouseDown}
          className="absolute top-0 right-0 bottom-0 w-2 bg-gray-100 hover:bg-gray-200 cursor-col-resize flex items-center justify-center group transition-colors"
          title="Drag to resize editor width"
        >
          <div className="h-8 w-1 bg-gray-400 rounded-full group-hover:bg-gray-600 transition-colors"></div>
        </div>
        
        {/* Corner Resize Handle (Bottom-Right) */}
        <div
          className="absolute bottom-0 right-0 w-4 h-4 bg-gray-100 hover:bg-gray-200 cursor-nw-resize group transition-colors"
          title="Drag to resize both width and height"
          onMouseDown={(e) => {
            e.preventDefault()
            const startX = e.clientX
            const startY = e.clientY
            const startHeight = parseInt(editorHeight.replace('vh', '').replace('px', ''))
            const startWidth = parseInt(editorWidth.replace('%', '').replace('px', '').replace('vw', ''))
            const isHeightVh = editorHeight.includes('vh')
            const isWidthPercent = editorWidth.includes('%')
            const isWidthVw = editorWidth.includes('vw')
            
            const handleMouseMove = (e: MouseEvent) => {
              // Handle height
              const deltaY = e.clientY - startY
              if (isHeightVh) {
                const viewportHeight = window.innerHeight
                const deltaVh = (deltaY / viewportHeight) * 100
                const newHeight = Math.max(20, Math.min(80, startHeight + deltaVh))
                setEditorHeight(`${newHeight}vh`)
              } else {
                const newHeight = Math.max(200, startHeight + deltaY)
                setEditorHeight(`${newHeight}px`)
              }
              
              // Handle width
              const deltaX = e.clientX - startX
              if (isWidthPercent) {
                const containerWidth = (e.target as HTMLElement).closest('.max-w-4xl')?.clientWidth || window.innerWidth
                const deltaPercent = (deltaX / containerWidth) * 100
                const newWidth = Math.max(30, Math.min(200, startWidth + deltaPercent))
                setEditorWidth(`${newWidth}%`)
              } else if (isWidthVw) {
                const viewportWidth = window.innerWidth
                const deltaVw = (deltaX / viewportWidth) * 100
                const newWidth = Math.max(20, Math.min(95, startWidth + deltaVw))
                setEditorWidth(`${newWidth}vw`)
              } else {
                const newWidth = Math.max(300, startWidth + deltaX)
                setEditorWidth(`${newWidth}px`)
              }
            }
            
            const handleMouseUp = () => {
              document.removeEventListener('mousemove', handleMouseMove)
              document.removeEventListener('mouseup', handleMouseUp)
              document.body.style.cursor = ''
              document.body.style.userSelect = ''
            }
            
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
            document.body.style.cursor = 'nw-resize'
            document.body.style.userSelect = 'none'
          }}
        >
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-2 h-2 bg-gray-400 rounded-full group-hover:bg-gray-600 transition-colors"></div>
          </div>
        </div>
      </div>

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
