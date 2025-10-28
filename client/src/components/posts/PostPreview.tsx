// Post Preview Component - Shows posts as readers would see them
import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabaseAdminGet } from '../../lib/api'
import LoadingSpinner from '../LoadingSpinner'
import { formatDate } from '../../utils/formatDate'
import { setDocumentTitle, setMetaDescription } from '../../utils/metadata'

interface Label {
  id: string
  name: string
}

interface Post {
  id: string
  title: string
  content?: string // Fallback for old posts
  content_html?: string // Primary content field
  content_text?: string
  excerpt?: string
  cover_image_url?: string
  cover_image_alt?: string
  status: 'draft' | 'published' | 'archived'
  created_at: string
  labels?: Label[]
}

export default function PostPreview() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPost = async () => {
      if (!id) return

      try {
        setLoading(true)
        const response = await supabaseAdminGet(`/api/posts/${id}`)
        const data = response.post || response // Extract post from wrapped response
        setPost(data)
        setError(null)
        
        // Set page metadata when post is loaded
        if (data) {
          setDocumentTitle(`Preview: ${data.title}`)
          setMetaDescription(data.excerpt || `Preview of "${data.title}"`)
        }
      } catch (err) {
        console.error('Failed to fetch post:', err)
        setError('Failed to load post preview. Please try again later.')
        setDocumentTitle('Error Loading Preview')
      } finally {
        setLoading(false)
      }
    }

    fetchPost()
  }, [id])

  const handleBackToEdit = () => {
    navigate(`/dashboard/posts/${id}/edit`)
  }

  if (loading) {
    return <LoadingSpinner text="Loading preview..." />
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
          <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h3 className="text-lg font-semibold text-red-900 mb-2">Preview Not Available</h3>
          <p className="text-red-700 mb-4">{error}</p>
          <button onClick={handleBackToEdit} className="btn-primary">
            ← Back to Editor
          </button>
        </div>
      </div>
    )
  }

  if (!post) {
    return null
  }

  return (
    <>
      {/* Preview Controls - Fixed at top */}
      <div className="fixed top-0 left-0 right-0 bg-blue-600 text-white px-4 py-3 shadow-lg z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span className="font-medium">Preview Mode</span>
            <span className="text-blue-200">•</span>
            <span className="text-blue-200 capitalize">{post.status}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleBackToEdit}
              className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              ← Back to Editor
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - with top padding to account for fixed header */}
      <div className="pt-16">
        <article className="max-w-4xl mx-auto">
          {/* Back Link - styled like public blog */}
          <div className="mb-8">
            <button 
              onClick={handleBackToEdit}
              className="inline-flex items-center text-primary-600 hover:text-primary-700 font-medium transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Editor
            </button>
          </div>

          {/* Featured Image */}
          {post.cover_image_url && (
            <div className="mb-8 rounded-lg overflow-hidden">
              <img 
                src={post.cover_image_url} 
                alt={post.cover_image_alt || post.title || 'Cover image'}
                className="w-full h-64 md:h-80 object-cover"
                onError={(e) => {
                  // Hide broken image gracefully
                  const img = e.target as HTMLImageElement
                  const container = img.parentElement
                  if (container) {
                    container.style.display = 'none'
                  }
                }}
              />
            </div>
          )}

          {/* Header */}
          <header className="mb-8 text-center">
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-secondary-900 mb-4 leading-tight">
              {post.title || 'Untitled Post'}
            </h1>
            
            {/* Meta Information */}
            <div className="flex flex-wrap items-center justify-center gap-4 text-secondary-600 mb-6">
              <time dateTime={post.created_at}>
                {formatDate(post.created_at)}
              </time>
              
              {post.labels && post.labels.length > 0 && (
                <>
                  <span className="text-secondary-300">•</span>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {post.labels.map((label) => (
                      <span 
                        key={label.id}
                        className="inline-block px-2 py-1 text-xs font-medium bg-primary-50 text-primary-700 rounded-full"
                      >
                        {label.name}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Excerpt */}
            {post.excerpt && (
              <p className="text-xl text-secondary-600 italic max-w-3xl mx-auto leading-relaxed">
                {post.excerpt}
              </p>
            )}
          </header>

          {/* Content */}
          <div className="prose-custom">
            <div 
              dangerouslySetInnerHTML={{ __html: post.content_html || post.content }} 
              className="leading-relaxed"
            />
          </div>

          {/* Footer */}
          <footer className="mt-12 pt-8 border-t border-secondary-200">
            <div className="text-center">
              <p className="text-secondary-600 mb-4">
                This is how your story will appear to readers.
              </p>
              <button 
                onClick={handleBackToEdit}
                className="btn-secondary"
              >
                Continue Editing
              </button>
            </div>
          </footer>
        </article>
      </div>
    </>
  )
}
