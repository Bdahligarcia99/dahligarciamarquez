import { Link, useLocation } from 'react-router-dom'

const Navbar = () => {
  const location = useLocation()

  const isActive = (path) => {
    return location.pathname === path
  }

  return (
    <nav className="bg-white shadow-sm border-b border-secondary-200 sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex justify-between items-center h-16">
          {/* Logo/Brand */}
          <Link 
            to="/" 
            className="text-xl font-serif font-bold text-secondary-900 hover:text-primary-600 transition-colors"
          >
            My Stories
          </Link>

          {/* Navigation Links */}
          <div className="flex space-x-8">
            <Link
              to="/"
              className={`font-medium transition-colors ${
                isActive('/') 
                  ? 'text-primary-600 border-b-2 border-primary-600 pb-1' 
                  : 'text-secondary-600 hover:text-secondary-900'
              }`}
            >
              Home
            </Link>
            <Link
              to="/stories"
              className={`font-medium transition-colors ${
                isActive('/stories') || location.pathname.startsWith('/stories/') 
                  ? 'text-primary-600 border-b-2 border-primary-600 pb-1' 
                  : 'text-secondary-600 hover:text-secondary-900'
              }`}
            >
              Stories
            </Link>
            <Link
              to="/posts"
              className={`font-medium transition-colors ${
                isActive('/posts') 
                  ? 'text-primary-600 border-b-2 border-primary-600 pb-1' 
                  : 'text-secondary-600 hover:text-secondary-900'
              }`}
            >
              Posts
            </Link>
            <Link
              to="/blog"
              className={`font-medium transition-colors ${
                isActive('/blog') || location.pathname.startsWith('/blog/') 
                  ? 'text-primary-600 border-b-2 border-primary-600 pb-1' 
                  : 'text-secondary-600 hover:text-secondary-900'
              }`}
            >
              Blog
            </Link>
            <Link
              to="/dashboard"
              className={`font-medium transition-colors ${
                isActive('/dashboard') || location.pathname.startsWith('/dashboard/') 
                  ? 'text-primary-600 border-b-2 border-primary-600 pb-1' 
                  : 'text-secondary-600 hover:text-secondary-900'
              }`}
            >
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar

