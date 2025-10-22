import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import LoadingSpinner from '../components/LoadingSpinner'
import { postsAPI } from '../utils/api'
import { formatDate } from '../utils/formatDate'
import { setDocumentTitle, setMetaDescription } from '../utils/metadata'

const BlogPost = () => {
  const { slug } = useParams()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchPost = async () => {
      try {
        setLoading(true)
        const data = await postsAPI.getPostBySlug(slug)
        // Handle API response format: { post: {...} }
        const postData = data?.post || data
        setPost(postData)
        setError(null)
        
        // Set page metadata when post is loaded
        if (postData) {
          setDocumentTitle(postData.title)
          setMetaDescription(postData.excerpt || `Read "${postData.title}" and more stories on dahligarciamarquez`)
        }
      } catch (err) {
        console.error('Failed to fetch post:', err)
        if (err.response?.status === 404) {
          setError('Story not found')
          setDocumentTitle('Story Not Found')
        } else {
          setError('Failed to load story. Please try again later.')
          setDocumentTitle('Error Loading Story')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchPost()
  }, [slug])

  if (loading) {
    return <LoadingSpinner text="Loading story..." />
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
          <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h3 className="text-lg font-semibold text-red-900 mb-2">Story Not Found</h3>
          <p className="text-red-700 mb-4">{error}</p>
          <Link to="/blog" className="btn-primary">
            ← Back to Stories
          </Link>
        </div>
      </div>
    )
  }

  if (!post) {
    return null
  }

  return (
    <article className="max-w-4xl mx-auto">
      {/* Back Link */}
      <div className="mb-8">
        <Link 
          to="/blog" 
          className="inline-flex items-center text-primary-600 hover:text-primary-700 font-medium transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Stories
        </Link>
      </div>

      {/* Featured Image */}
      {post.cover_image_url && (
        <div className="mb-8 rounded-lg overflow-hidden">
          <img 
            src={post.cover_image_url} 
            alt={post.cover_image_alt || post.title}
            className="w-full h-64 md:h-80 object-cover"
          />
        </div>
      )}

      {/* Header */}
      <header className="mb-8 text-center">
        <h1 className="text-4xl md:text-5xl font-serif font-bold text-secondary-900 mb-4 leading-tight">
          {post.title}
        </h1>
        
        {/* Meta Information */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-secondary-600 mb-6">
          <time dateTime={post.created_at}>
            {formatDate(post.created_at)}
          </time>
          
          {post.post_labels && post.post_labels.length > 0 && (
            <>
              <span className="text-secondary-300">•</span>
              <div className="flex flex-wrap gap-2">
                {post.post_labels.map((labelObj, index) => (
                  <span 
                    key={index}
                    className="inline-block px-2 py-1 text-xs font-medium bg-primary-50 text-primary-700 rounded-full"
                  >
                    {labelObj.labels?.name || 'Label'}
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
      <div className="prose prose-lg max-w-none">
        <div 
          dangerouslySetInnerHTML={{ __html: post.content_html || post.content_text || '' }} 
          className="leading-relaxed"
        />
      </div>

      {/* Footer */}
      <footer className="mt-12 pt-8 border-t border-secondary-200">
        <div className="text-center">
          <p className="text-secondary-600 mb-4">
            Thank you for reading this story.
          </p>
          <Link 
            to="/blog" 
            className="btn-secondary"
          >
            Read More Stories
          </Link>
        </div>
      </footer>
    </article>
  )
}

export default BlogPost

