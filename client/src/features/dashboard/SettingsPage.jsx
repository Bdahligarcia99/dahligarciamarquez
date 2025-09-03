// client/src/features/dashboard/SettingsPage.jsx
import { useState, useEffect } from 'react'
import { API_URL, API_MISCONFIGURED, apiGet, api, getApiBase } from '../../lib/api'
import StatusBadge from './components/StatusBadge'

const SettingsPage = () => {
  const [health, setHealth] = useState(null)
  const [dbNow, setDbNow] = useState(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [dbLoading, setDbLoading] = useState(false)
  
  // API Test Widget state
  const [apiResponse, setApiResponse] = useState(null)
  const [apiError, setApiError] = useState(null)
  const [apiTestLoading, setApiTestLoading] = useState(false)

  const checkHealth = async () => {
    try {
      setHealthLoading(true)
      const healthData = await apiGet('/healthz')
      setHealth(healthData)
    } catch (err) {
      setHealth({ ok: false, error: err.message })
    } finally {
      setHealthLoading(false)
    }
  }

  const checkDbNow = async () => {
    try {
      setDbLoading(true)
      const dbData = await apiGet('/api/db/now')
      setDbNow(dbData)
    } catch (err) {
      setDbNow({ error: err.message })
    } finally {
      setDbLoading(false)
    }
  }

  useEffect(() => {
    checkHealth()
    checkDbNow()
  }, [])

  const refreshStatus = () => {
    checkHealth()
    checkDbNow()
  }

  // API Test Widget functionality
  const testApiCall = async () => {
    setApiTestLoading(true)
    setApiError(null)
    setApiResponse(null)
    
    try {
      const data = await api('/api/hello')
      setApiResponse(data)
    } catch (error) {
      setApiError(error.message)
    } finally {
      setApiTestLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* API Misconfiguration Banner */}
      {API_MISCONFIGURED && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 mb-1">
                API Configuration Missing
              </h3>
              <p className="text-sm text-red-700">
                VITE_API_URL is not set. Go to Vercel → Project → Settings → Environment Variables and add VITE_API_URL=https://api.dahligarciamarquez.com (Production & Preview), then redeploy with 'Clear build cache'.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* API Configuration */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold mb-4">API Configuration</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Base URL (VITE_API_URL)
            </label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm font-mono">
              {getApiBase() || 'Not set'}
            </div>
          </div>
        </div>
      </div>

      {/* API Test Widget */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold mb-4">API Connection Test</h2>
        <p className="text-sm text-gray-600 mb-4">
          Test the connection to your backend API by pinging the <code className="bg-gray-100 px-1 rounded">/api/hello</code> endpoint.
        </p>
        
        <button
          onClick={testApiCall}
          disabled={apiTestLoading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {apiTestLoading ? 'Testing...' : 'Ping API'}
        </button>
        
        {apiResponse && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded">
            <strong>Success:</strong> 
            <pre className="mt-1 text-sm overflow-auto">{JSON.stringify(apiResponse, null, 2)}</pre>
          </div>
        )}
        
        {apiError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
            <strong>Error:</strong> {apiError}
          </div>
        )}
      </div>

      {/* Live Status Checks */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Live Status</h2>
          <button
            onClick={refreshStatus}
            disabled={healthLoading || dbLoading}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
        
        <div className="space-y-4">
          {/* Health Check */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium">API Health Check</h3>
              <StatusBadge
                status={health?.ok}
                loading={healthLoading}
              />
            </div>
            <div className="text-sm text-gray-600">
              <strong>Endpoint:</strong> <code className="bg-gray-100 px-1 rounded">/healthz</code>
            </div>
            {health?.uptime && (
              <div className="text-sm text-gray-600 mt-1">
                <strong>Uptime:</strong> {Math.round(health.uptime)} seconds
              </div>
            )}
            {health?.error && (
              <div className="text-sm text-red-600 mt-1">
                <strong>Error:</strong> {health.error}
              </div>
            )}
          </div>

          {/* Database Check */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium">Database Connection</h3>
              <StatusBadge
                status={dbNow && !dbNow.error ? 'success' : 'error'}
                loading={dbLoading}
              />
            </div>
            <div className="text-sm text-gray-600">
              <strong>Endpoint:</strong> <code className="bg-gray-100 px-1 rounded">/api/db/now</code>
            </div>
            {dbNow && !dbNow.error && (
              <div className="text-sm text-gray-600 mt-1">
                <strong>Current DB Time:</strong> {new Date(dbNow.now).toLocaleString()}
              </div>
            )}
            {dbNow?.error && (
              <div className="text-sm text-red-600 mt-1">
                <strong>Error:</strong> {dbNow.error}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* API Documentation Link */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold mb-4">Resources</h2>
        <div className="space-y-2">
          <a
            href={`${API_URL}/docs`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm"
          >
            API Documentation
            <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
