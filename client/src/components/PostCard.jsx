import { Link } from 'react-router-dom'
import { formatDate } from '../utils/formatDate'

const PostCard = ({ post }) => {
  const { title, slug, excerpt, created_at, tags, image_url } = post

  return (
    <article className="card hover:shadow-lg transition-shadow duration-300">
      {/* Featured Image */}
      {image_url && (
        <div className="mb-4 -mt-6 -mx-6">
          <img 
            src={image_url} 
            alt={title}
            className="w-full h-48 object-cover rounded-t-lg"
          />
        </div>
      )}

      {/* Tags */}
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {tags.map((tag, index) => (
            <span 
              key={index}
              className="inline-block px-2 py-1 text-xs font-medium bg-primary-50 text-primary-700 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Title */}
      <h2 className="text-xl font-serif font-semibold text-secondary-900 mb-2 hover:text-primary-600 transition-colors">
        <Link to={`/blog/${slug}`}>
          {title}
        </Link>
      </h2>

      {/* Excerpt */}
      <p className="text-secondary-600 leading-relaxed mb-4 line-clamp-3">
        {excerpt}
      </p>

      {/* Meta Info */}
      <div className="flex items-center justify-between pt-4 border-t border-secondary-100">
        <time className="text-sm text-secondary-500" dateTime={created_at}>
          {formatDate(created_at)}
        </time>
        
        <Link 
          to={`/blog/${slug}`}
          className="text-primary-600 hover:text-primary-700 font-medium text-sm transition-colors"
        >
          Read more →
        </Link>
      </div>
    </article>
  )
}

export default PostCard

