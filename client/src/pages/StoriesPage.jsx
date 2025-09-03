import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { queryPosts } from '../data/postApi'
import { setDocumentTitle, setMetaDescription } from '../utils/metadata'

export default function StoriesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [posts, setPosts] = useState([])
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  const q = searchParams.get('q') || ''
  const tag = searchParams.get('tag') || ''
  const page = parseInt(searchParams.get('page') || '1')

  const availableTags = ['personal', 'insight', 'community', 'news']

  useEffect(() => {
    // Set page metadata
    const pageTitle = q ? `Search: "${q}"` : tag ? `Tag: ${tag}` : 'Stories'
    const pageDescription = q 
      ? `Search results for "${q}" on dahligarciamarquez`
      : tag 
      ? `Stories tagged with "${tag}" on dahligarciamarquez`
      : 'Browse all stories and experiences on dahligarciamarquez'
    
    setDocumentTitle(pageTitle)
    setMetaDescription(pageDescription)
    
    setLoading(true)
    const result = queryPosts({ q, tag, page, pageSize: 9 })
    setPosts(result.items)
    setTotalPages(result.totalPages)
    setLoading(false)
  }, [q, tag, page])

  const handleSearch = (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const searchQuery = formData.get('q')
    const newParams = new URLSearchParams(searchParams)
    if (searchQuery) {
      newParams.set('q', searchQuery)
    } else {
      newParams.delete('q')
    }
    newParams.delete('page') // Reset to page 1 on new search
    setSearchParams(newParams)
  }

  const handleTagFilter = (selectedTag) => {
    const newParams = new URLSearchParams(searchParams)
    if (selectedTag === tag) {
      newParams.delete('tag') // Remove filter if clicking same tag
    } else {
      newParams.set('tag', selectedTag)
    }
    newParams.delete('page') // Reset to page 1 on tag change
    setSearchParams(newParams)
  }

  const handlePageChange = (newPage) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.set('page', newPage.toString())
    setSearchParams(newParams)
  }

  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-serif font-bold text-secondary-900 mb-4">Stories</h1>
        <p className="text-lg text-secondary-600">Personal reflections, insights, and musings</p>
      </div>

      {/* Search and Filters */}
      <div className="mb-8 space-y-4">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search stories..."
            className="flex-1 px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <button
            type="submit"
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Search
          </button>
        </form>

        {/* Tag filters */}
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-secondary-600 py-2">Filter by tag:</span>
          {availableTags.map((tagOption) => (
            <button
              key={tagOption}
              onClick={() => handleTagFilter(tagOption)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                tag === tagOption
                  ? 'bg-primary-600 text-white'
                  : 'bg-secondary-200 text-secondary-700 hover:bg-secondary-300'
              }`}
            >
              {tagOption}
            </button>
          ))}
          {tag && (
            <button
              onClick={() => handleTagFilter('')}
              className="px-3 py-1 rounded-full text-sm bg-red-100 text-red-700 hover:bg-red-200"
            >
              Clear filter
            </button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="text-center py-8">
          <div className="text-secondary-600">Loading stories...</div>
        </div>
      )}

      {/* Posts grid */}
      {!loading && posts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {posts.map((post) => (
            <Link
              key={post.id}
              to={`/stories/${post.slug}`}
              className="group block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden"
            >
              {post.coverImageUrl && (
                <div className="aspect-video overflow-hidden">
                  <img
                    src={post.coverImageUrl}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              )}
              <div className="p-6">
                <div className="flex flex-wrap gap-1 mb-2">
                  {post.tags.map((postTag) => (
                    <span
                      key={postTag}
                      className="px-2 py-1 text-xs bg-secondary-100 text-secondary-600 rounded-full"
                    >
                      {postTag}
                    </span>
                  ))}
                </div>
                <h2 className="text-xl font-serif font-semibold text-secondary-900 mb-2 group-hover:text-primary-600 transition-colors">
                  {post.title}
                </h2>
                <p className="text-secondary-600 mb-3 line-clamp-2">{post.excerpt}</p>
                <div className="text-sm text-secondary-500">
                  {formatDate(post.publishedAt)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* No results */}
      {!loading && posts.length === 0 && (
        <div className="text-center py-12">
          <div className="text-secondary-600 mb-4">No stories found</div>
          {(q || tag) && (
            <button
              onClick={() => setSearchParams(new URLSearchParams())}
              className="text-primary-600 hover:text-primary-700"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex justify-center items-center gap-4">
          <button
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1}
            className={`px-4 py-2 rounded-lg ${
              page <= 1
                ? 'bg-secondary-100 text-secondary-400 cursor-not-allowed'
                : 'bg-secondary-200 text-secondary-700 hover:bg-secondary-300'
            }`}
          >
            Previous
          </button>
          <span className="text-secondary-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
            className={`px-4 py-2 rounded-lg ${
              page >= totalPages
                ? 'bg-secondary-100 text-secondary-400 cursor-not-allowed'
                : 'bg-secondary-200 text-secondary-700 hover:bg-secondary-300'
            }`}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
