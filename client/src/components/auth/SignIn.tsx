// Sign In Component
import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import AuthLoadingOverlay from '../AuthLoadingOverlay'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showAuthLoading, setShowAuthLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSigningIn, setIsSigningIn] = useState(false)
  const { signIn, user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Watch for authentication state changes
  useEffect(() => {
    console.log('🔍 SignIn useEffect - user:', !!user, 'authLoading:', authLoading, 'showAuthLoading:', showAuthLoading, 'isSigningIn:', isSigningIn)
    
    if (user && !authLoading) {
      if (isSigningIn) {
        // User just became authenticated during sign-in process
        console.log('🚀 User authenticated during sign-in, showing loading overlay...')
        setIsSigningIn(false)
        setShowAuthLoading(true)
        
        // Use a separate effect for the timer to avoid cleanup issues
        return
      } else if (!showAuthLoading) {
        // User was already authenticated when component loaded AND we're not showing loading overlay
        console.log('🔄 User already authenticated, redirecting immediately...')
        const from = location.state?.from?.pathname || '/'
        navigate(from, { replace: true })
      }
    }
  }, [user, authLoading, showAuthLoading, isSigningIn, navigate, location])

  // Separate effect for handling the loading overlay timer
  useEffect(() => {
    if (showAuthLoading && user && !authLoading) {
      console.log('⏰ Starting redirect timer...')
      const timer = setTimeout(() => {
        console.log('⏰ Timer complete, redirecting...')
        setShowAuthLoading(false)
        const from = location.state?.from?.pathname || '/'
        navigate(from, { replace: true })
      }, 1500)
      
      // Fallback timer in case something goes wrong
      const fallbackTimer = setTimeout(() => {
        console.log('🚨 Fallback timer triggered - forcing redirect')
        setShowAuthLoading(false)
        const from = location.state?.from?.pathname || '/'
        navigate(from, { replace: true })
      }, 3000)
      
      return () => {
        console.log('🧹 Cleaning up timers')
        clearTimeout(timer)
        clearTimeout(fallbackTimer)
      }
    }
  }, [showAuthLoading, user, authLoading, navigate, location])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setIsSigningIn(true)

    console.log('🔐 Starting sign-in process...')
    try {
      const result = await signIn(email, password)
      console.log('🔍 Sign-in result:', result)

      if (result.error) {
        console.log('❌ Sign-in error:', result.error.message)
        setError(result.error.message)
        setLoading(false)
        setIsSigningIn(false)
      } else {
        // Don't show loading overlay immediately - wait for auth state change
        console.log('✅ Sign-in request successful, waiting for auth state change...')
        setLoading(false)
        // isSigningIn stays true until useEffect detects user authentication
      }
    } catch (err) {
      console.log('❌ Sign-in exception:', err)
      setError('An unexpected error occurred')
      setLoading(false)
      setIsSigningIn(false)
    }
  }

  const handleAuthComplete = () => {
    console.log('🎯 Manual auth complete triggered')
    setShowAuthLoading(false)
    const from = location.state?.from?.pathname || '/'
    navigate(from, { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        {/* Back button */}
        <div className="flex justify-start">
          <button
            onClick={() => navigate('/')}
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </button>
        </div>
        
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
            Sign in to your account
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="sr-only">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="password" className="sr-only">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>

          <div className="text-center space-y-2">
            <Link
              to="/auth/forgot-password"
              className="text-indigo-600 hover:text-indigo-500 text-sm"
            >
              Forgot your password?
            </Link>
            <div>
              <span className="text-gray-600 text-sm">Don't have an account? </span>
              <Link
                to="/auth/signup"
                className="text-indigo-600 hover:text-indigo-500 text-sm"
              >
                Sign up
              </Link>
            </div>
          </div>
        </form>
      </div>
      
      {/* Loading overlay for successful sign in */}
        <AuthLoadingOverlay
          isVisible={showAuthLoading}
          message="Signing you in..."
          onComplete={handleAuthComplete}
          autoComplete={false}
        />
    </div>
  )
}
