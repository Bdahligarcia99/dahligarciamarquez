import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getPostBySlug } from '../data/postApi'

export default function StoryDetail() {
  const { slug } = useParams()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const foundPost = getPostBySlug(slug)
    setPost(foundPost)
    setLoading(false)
  }, [slug])

  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const renderContent = (content) => {
    // Simple markdown-like rendering for headers
    if (content.startsWith('#')) {
      return (
        <div className="prose prose-lg max-w-none prose-headings:font-serif prose-headings:text-secondary-900 prose-p:text-secondary-700 prose-p:leading-relaxed">
          {content.split('\n').map((line, index) => {
            if (line.startsWith('# ')) {
              return <h1 key={index} className="text-4xl font-serif font-bold text-secondary-900 mb-6">{line.slice(2)}</h1>
            } else if (line.startsWith('## ')) {
              return <h2 key={index} className="text-3xl font-serif font-semibold text-secondary-900 mb-4 mt-8">{line.slice(3)}</h2>
            } else if (line.startsWith('### ')) {
              return <h3 key={index} className="text-2xl font-serif font-semibold text-secondary-900 mb-3 mt-6">{line.slice(4)}</h3>
            } else if (line.trim() === '') {
              return <br key={index} />
            } else {
              return <p key={index} className="text-secondary-700 leading-relaxed mb-4">{line}</p>
            }
          })}
        </div>
      )
    } else {
      return <pre className="whitespace-pre-wrap text-secondary-700 leading-relaxed">{content}</pre>
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-12">
          <div className="text-secondary-600">Loading story...</div>
        </div>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-12">
          <h1 className="text-2xl font-serif font-bold text-secondary-900 mb-4">Story Not Found</h1>
          <p className="text-secondary-600 mb-6">The story you're looking for doesn't exist.</p>
          <Link
            to="/stories"
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            ← Back to Stories
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back link */}
      <div className="mb-6">
        <Link
          to="/stories"
          className="inline-flex items-center text-primary-600 hover:text-primary-700 transition-colors"
        >
          ← Back to Stories
        </Link>
      </div>

      {/* Cover image */}
      {post.coverImageUrl && (
        <div className="aspect-video md:aspect-[2/1] overflow-hidden rounded-lg mb-8">
          <img
            src={post.coverImageUrl}
            alt={post.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Article header */}
      <header className="mb-8">
        <div className="flex flex-wrap gap-2 mb-4">
          {post.tags.map((tag) => (
            <Link
              key={tag}
              to={`/stories?tag=${tag}`}
              className="px-3 py-1 text-sm bg-secondary-100 text-secondary-600 rounded-full hover:bg-secondary-200 transition-colors"
            >
              {tag}
            </Link>
          ))}
        </div>
        
        <h1 className="text-4xl md:text-5xl font-serif font-bold text-secondary-900 mb-4 leading-tight">
          {post.title}
        </h1>
        
        <div className="flex items-center text-secondary-600 mb-6">
          <time dateTime={post.publishedAt}>
            {formatDate(post.publishedAt)}
          </time>
        </div>

        {post.excerpt && (
          <div className="text-xl text-secondary-600 leading-relaxed border-l-4 border-primary-200 pl-6 mb-8">
            {post.excerpt}
          </div>
        )}
      </header>

      {/* Article content */}
      <article className="mb-12">
        {renderContent(post.content)}
      </article>

      {/* Footer */}
      <footer className="border-t border-secondary-200 pt-8">
        <div className="flex justify-between items-center">
          <Link
            to="/stories"
            className="inline-flex items-center px-4 py-2 bg-secondary-100 text-secondary-700 rounded-lg hover:bg-secondary-200 transition-colors"
          >
            ← Back to Stories
          </Link>
          
          <div className="text-sm text-secondary-500">
            Published {formatDate(post.publishedAt)}
          </div>
        </div>
      </footer>
    </div>
  )
}
