import { useState, useEffect } from 'react'
import PostCard from '../components/PostCard'
import LoadingSpinner from '../components/LoadingSpinner'
import { postsAPI } from '../utils/api'
import { SITE_NAME } from '../config/branding'
import { setDocumentTitle, setMetaDescription } from '../utils/metadata'

const BlogList = () => {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Set page metadata
    setDocumentTitle('Stories')
    setMetaDescription(`A collection of personal experiences, thoughts, and reflections from ${SITE_NAME}. Each story is a piece of my journey worth sharing.`)
    
    const fetchPosts = async () => {
      try {
        setLoading(true)
        const data = await postsAPI.getAllPosts()
        // Handle API response format: { items: [...], page, limit, total }
        const postsArray = data?.items || data || []
        setPosts(postsArray)
        setError(null)
      } catch (err) {
        console.error('Failed to fetch posts:', err)
        setError('Failed to load stories. Please try again later.')
      } finally {
        setLoading(false)
      }
    }

    fetchPosts()
  }, [])

  if (loading) {
    return <LoadingSpinner text="Loading stories..." />
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
          <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h3 className="text-lg font-semibold text-red-900 mb-2">Something went wrong</h3>
          <p className="text-red-700">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 btn-primary bg-red-600 hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-serif font-bold text-secondary-900 mb-4">
          Stories
        </h1>
        <p className="text-lg text-secondary-600 max-w-2xl mx-auto">
          A collection of personal experiences, thoughts, and reflections. 
          Each story is a piece of my journey worth sharing.
        </p>
      </div>

      {/* Posts Grid */}
      {posts.length === 0 ? (
        <div className="text-center py-12">
          <svg className="w-16 h-16 text-secondary-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <h3 className="text-xl font-serif font-semibold text-secondary-900 mb-2">
            No stories yet
          </h3>
          <p className="text-secondary-600">
            Check back soon for new stories and experiences to explore.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}

export default BlogList

