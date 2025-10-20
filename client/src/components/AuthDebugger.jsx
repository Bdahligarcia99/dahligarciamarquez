// In-app auth debugger component
import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { getSupabaseClient } from '../lib/supabase'

export default function AuthDebugger() {
  const { user, profile, loading, refreshProfile } = useAuth()
  const [debugInfo, setDebugInfo] = useState(null)
  const [isVisible, setIsVisible] = useState(false)

  const runDebug = async () => {
    console.log('🔍 Starting debug check...')
    const client = getSupabaseClient()
    console.log('🔍 Supabase client:', !!client)
    console.log('🔍 Current user:', user)
    console.log('🔍 Current profile:', profile)
    
    const info = {
      timestamp: new Date().toISOString(),
      loading,
      user: user ? {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      } : null,
      profile,
      supabaseConfigured: !!client
    }

    // Check localStorage
    try {
      const keys = Object.keys(localStorage)
      const supabaseKeys = keys.filter(key => key.includes('supabase') || key.startsWith('sb-'))
      info.localStorageKeys = supabaseKeys
    } catch (e) {
      info.localStorageError = e.message
    }

    // Try to fetch fresh profile data
    if (user && client) {
      try {
        const { data: freshProfile, error } = await client
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        
        info.freshProfile = freshProfile
        info.profileError = error?.message
      } catch (e) {
        info.profileFetchError = e.message
      }
    }

    setDebugInfo(info)
  }

  const handleRefreshProfile = async () => {
    try {
      await refreshProfile()
      await runDebug() // Update debug info after refresh
    } catch (error) {
      console.error('Profile refresh failed:', error)
    }
  }

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsVisible(true)}
          className="bg-gray-800 text-white px-3 py-2 rounded-lg text-sm hover:bg-gray-700"
        >
          🔍 Debug Auth
        </button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white border border-gray-300 rounded-lg shadow-lg max-w-md max-h-96 overflow-y-auto">
      <div className="p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-gray-800">🔍 Auth Debug</h3>
          <button
            onClick={() => setIsVisible(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2 mb-3">
          <button
            onClick={runDebug}
            className="w-full bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700"
          >
            Run Debug Check
          </button>
          <button
            onClick={handleRefreshProfile}
            className="w-full bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700"
          >
            Refresh Profile
          </button>
        </div>

        {debugInfo && (
          <div className="text-xs space-y-2">
            <div className="bg-gray-100 p-2 rounded">
              <strong>Loading:</strong> {debugInfo.loading ? 'Yes' : 'No'}
            </div>
            
            <div className="bg-gray-100 p-2 rounded">
              <strong>User:</strong> {debugInfo.user ? (
                <div>
                  <div>ID: {debugInfo.user.id}</div>
                  <div>Email: {debugInfo.user.email}</div>
                </div>
              ) : 'None'}
            </div>

            <div className="bg-gray-100 p-2 rounded">
              <strong>Current Profile:</strong> {debugInfo.profile ? (
                <div>
                  <div>Role: <span className={debugInfo.profile.role === 'admin' ? 'text-green-600 font-bold' : 'text-orange-600'}>{debugInfo.profile.role}</span></div>
                  <div>Name: {debugInfo.profile.display_name}</div>
                </div>
              ) : 'None'}
            </div>

            {debugInfo.freshProfile && (
              <div className="bg-blue-50 p-2 rounded border border-blue-200">
                <strong>Fresh DB Profile:</strong>
                <div>Role: <span className={debugInfo.freshProfile.role === 'admin' ? 'text-green-600 font-bold' : 'text-orange-600'}>{debugInfo.freshProfile.role}</span></div>
                <div>Name: {debugInfo.freshProfile.display_name}</div>
              </div>
            )}

            {debugInfo.profileError && (
              <div className="bg-red-50 p-2 rounded border border-red-200 text-red-700">
                <strong>Profile Error:</strong> {debugInfo.profileError}
              </div>
            )}

            <div className="bg-gray-100 p-2 rounded">
              <strong>localStorage Keys:</strong> {debugInfo.localStorageKeys?.length || 0}
            </div>

            <details className="bg-gray-50 p-2 rounded">
              <summary className="cursor-pointer font-medium">Raw Data</summary>
              <pre className="text-xs mt-2 overflow-x-auto">{JSON.stringify(debugInfo, null, 2)}</pre>
            </details>
          </div>
        )}
      </div>
    </div>
  )
}
