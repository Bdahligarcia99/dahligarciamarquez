// client/src/components/Footer.jsx
import { Link } from 'react-router-dom'
import { SITE_NAME, SITE_VERSION } from '../config/branding'
import BrandImage from './BrandImage'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer role="contentinfo" className="bg-secondary-800 text-secondary-300 mt-16">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Footer Logo */}
        <div className="flex justify-center mb-6">
          <Link to="/">
            <BrandImage 
              slot="footer-logo"
              maxHeight={36}
              maxWidth={180}
              fallback={<span className="font-bold">{SITE_NAME}</span>}
              showPlaceholder={true}
            />
          </Link>
        </div>

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
            Journals
          </Link>
        </nav>

        {/* Copyright */}
        <div className="text-center text-sm">
          <p>© {currentYear} {SITE_NAME}. All rights reserved.</p>
          <p className="text-secondary-500 text-xs mt-1">v{SITE_VERSION}</p>
        </div>
      </div>
    </footer>
  )
}
