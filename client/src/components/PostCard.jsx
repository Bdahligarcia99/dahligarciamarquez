import { Link } from 'react-router-dom'

const PostCard = ({ post }) => {
  const { title, slug, cover_image_url } = post

  return (
    <Link to={`/blog/${slug}`} className="group block">
      <article className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
        {/* Cover Image or Placeholder */}
        <div className="aspect-video bg-gradient-to-br from-primary-100 to-primary-200 relative overflow-hidden">
          {cover_image_url ? (
            <img 
              src={cover_image_url} 
              alt={title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg 
                className="w-20 h-20 text-primary-400 opacity-50" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={1.5} 
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" 
                />
              </svg>
            </div>
          )}
        </div>

        {/* Title */}
        <div className="p-6">
          <h2 className="text-xl font-serif font-semibold text-secondary-900 group-hover:text-primary-600 transition-colors line-clamp-2">
            {title}
          </h2>
        </div>
      </article>
    </Link>
  )
}

export default PostCard

