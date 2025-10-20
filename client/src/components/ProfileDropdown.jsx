// Profile Dropdown Component
import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import AuthLoadingOverlay from './AuthLoadingOverlay'

export default function ProfileDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const [showSignOutLoading, setShowSignOutLoading] = useState(false)
  const dropdownRef = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()
  
  // Use auth context - now always available thanks to ConditionalAuthProvider
  const authContext = useAuth()
  const { user, profile, signOut } = authContext
  

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close dropdown when route changes
  useEffect(() => {
    setIsOpen(false)
  }, [location.pathname])

  const handleSignOut = async () => {
    setIsOpen(false) // Close dropdown immediately
    setShowSignOutLoading(true) // Show loading overlay
    
    try {
      // Navigate to home page FIRST, before signing out
      // This prevents ProtectedRoute from redirecting to sign-in
      navigate('/', { replace: true })
      
      // Small delay to ensure navigation completes before auth state changes
      await new Promise(resolve => setTimeout(resolve, 100))
      
      if (signOut) {
        await signOut()
      }
    } catch (error) {
      console.error('Sign out error:', error)
      // Ensure we're on home page even if sign out fails
      navigate('/', { replace: true })
    } finally {
      setShowSignOutLoading(false)
    }
  }

  const handleSignOutComplete = () => {
    // Loading state is now handled in handleSignOut's finally block
    // This function is kept for AuthLoadingOverlay compatibility
  }


  return (
    <div className="profile-dropdown" ref={dropdownRef}>
      {/* Profile Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="profile-icon-button"
        aria-label="Profile menu"
        aria-expanded={isOpen}
      >
        {user ? (
          // User Avatar (first letter of display name or email)
          <div className="user-avatar">
            {(profile?.display_name || user.email)?.charAt(0).toUpperCase() || 'U'}
          </div>
        ) : (
          // Generic Profile Icon
          <svg 
            className="profile-icon" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" 
            />
          </svg>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="dropdown-menu">
          {user ? (
            // Logged in menu
            <>
              <div className="dropdown-header">
                <div className="user-name">{profile?.display_name || user.email?.split('@')[0] || 'User'}</div>
                <div className="user-email">{user.email}</div>
              </div>
              <div className="dropdown-divider"></div>
              <Link
                to="/profile/settings"
                className="dropdown-item"
                onClick={() => setIsOpen(false)}
              >
                <svg className="dropdown-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </Link>
              <button
                onClick={handleSignOut}
                className="dropdown-item"
                type="button"
              >
                <svg className="dropdown-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </>
          ) : (
            // Not logged in menu
            <>
              <div className="dropdown-header">
                <div className="user-status">Not signed in</div>
              </div>
              <div className="dropdown-divider"></div>
              <Link
                to="/auth/signin"
                className="dropdown-item"
                onClick={() => setIsOpen(false)}
              >
                <svg className="dropdown-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Sign In
              </Link>
              <Link
                to="/auth/signup"
                className="dropdown-item"
                onClick={() => setIsOpen(false)}
              >
                <svg className="dropdown-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Sign Up
              </Link>
            </>
          )}
        </div>
      )}
      
      {/* Loading overlay for sign out */}
      <AuthLoadingOverlay
        isVisible={showSignOutLoading}
        message="Signing you out..."
        onComplete={handleSignOutComplete}
        autoComplete={false}
      />
    </div>
  )
}
