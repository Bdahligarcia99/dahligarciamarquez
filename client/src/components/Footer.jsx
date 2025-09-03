// client/src/components/Footer.jsx
import { Link } from 'react-router-dom'
import { SITE_NAME } from '../config/branding'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer role="contentinfo" className="bg-secondary-800 text-secondary-300 mt-16">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Links Row */}
        <nav className="flex flex-wrap justify-center gap-6 mb-6" aria-label="Footer">
          <Link 
            to="/" 
            className="hover:text-white transition-colors"
          >
            Home
          </Link>
          <Link 
            to="/stories" 
            className="hover:text-white transition-colors"
          >
            Stories
          </Link>
          <Link 
            to="/blog" 
            className="hover:text-white transition-colors"
          >
            Blog
          </Link>
        </nav>

        {/* Copyright */}
        <div className="text-center text-sm">
          <p>© {currentYear} {SITE_NAME}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
