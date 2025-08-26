import { Link } from 'react-router-dom'

const NotFound = () => {
  return (
    <div className="text-center py-16">
      <div className="max-w-md mx-auto">
        {/* 404 Illustration */}
        <div className="mb-8">
          <svg className="w-32 h-32 text-secondary-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-1.009-5.824-2.562M15 6.306a7.962 7.962 0 00-6 0M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        {/* Error Message */}
        <h1 className="text-6xl font-serif font-bold text-secondary-900 mb-4">
          404
        </h1>
        <h2 className="text-2xl font-serif font-semibold text-secondary-800 mb-4">
          Page Not Found
        </h2>
        <p className="text-secondary-600 mb-8 leading-relaxed">
          Oops! The story you're looking for seems to have wandered off. 
          Let's get you back on track to discover amazing stories.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link 
            to="/" 
            className="btn-primary"
          >
            Go Home
          </Link>
          <Link 
            to="/blog" 
            className="btn-secondary"
          >
            Browse Stories
          </Link>
        </div>
      </div>
    </div>
  )
}

export default NotFound

