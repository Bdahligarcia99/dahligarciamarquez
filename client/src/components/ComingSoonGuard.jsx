// Coming Soon Guard - blocks non-admin users when maintenance mode is active
import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabaseAdminGet } from '../lib/api'

export default function ComingSoonGuard({ children }) {
  const { profile, loading: authLoading } = useAuth()
  const [comingSoonEnabled, setComingSoonEnabled] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    checkComingSoonStatus()
  }, [])

  const checkComingSoonStatus = async () => {
    try {
      // Use regular fetch since this needs to be accessible without auth
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://api.dahligarciamarquez.com'}/api/coming-soon`)
      if (response.ok) {
        const data = await response.json()
        setComingSoonEnabled(data.enabled)
      } else {
        // If endpoint doesn't exist or fails, assume it's off
        setComingSoonEnabled(false)
      }
    } catch (error) {
      // If we can't check status, assume it's off (fail open)
      console.warn('Failed to check Coming Soon status:', error)
      setComingSoonEnabled(false)
    } finally {
      setChecking(false)
    }
  }

  // Show loading while checking auth and coming soon status
  if (authLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // If Coming Soon is enabled and user is not admin, show coming soon page
  if (comingSoonEnabled && profile?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-secondary-600">
        <div className="max-w-2xl px-6 py-12 text-center text-white">
          <h1 className="text-6xl font-bold mb-6 animate-pulse">Coming Soon!</h1>
          <p className="text-xl mb-8 opacity-90">
            We're working hard to bring you something amazing. Please check back soon.
          </p>
          <div className="text-lg opacity-75">
            {import.meta.env.VITE_SITE_NAME || 'Dahli Garcia Marquez'}
          </div>
        </div>
      </div>
    )
  }

  // Allow access
  return children
}

