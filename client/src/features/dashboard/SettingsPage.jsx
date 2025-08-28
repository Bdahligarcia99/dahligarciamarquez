// client/src/features/dashboard/SettingsPage.jsx
import { useState, useEffect } from 'react'
import { API_URL, apiGet } from '../../lib/api'
import StatusBadge from './components/StatusBadge'

const SettingsPage = () => {
  const [health, setHealth] = useState(null)
  const [dbNow, setDbNow] = useState(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [dbLoading, setDbLoading] = useState(false)

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* API Configuration */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold mb-4">API Configuration</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Base URL
            </label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm font-mono">
              {API_URL}
            </div>
          </div>
        </div>
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
