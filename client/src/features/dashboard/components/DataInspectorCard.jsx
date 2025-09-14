// client/src/features/dashboard/components/DataInspectorCard.jsx
import React from 'react'
import { getApiBase, fetchPostsTotal, apiAdminPost } from '../../../lib/api'

const DataInspectorCard = () => {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState(null)
  const [data, setData] = React.useState({
    apiBase: getApiBase(),
    dbInfo: null,
    postsCount: 0
  })
  const [seedLoading, setSeedLoading] = React.useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const [dbInfo, postsCount] = await Promise.all([
        // Fetch debug DB info
        fetch(`${getApiBase()}/__debug/db?counts=1`)
          .then(res => res.ok ? res.json() : null)
          .catch(() => null),
        // Fetch posts count
        fetchPostsTotal().catch(() => 0)
      ])

      setData(prev => ({
        ...prev,
        dbInfo,
        postsCount
      }))
    } catch (err) {
      setError('Failed to load data inspector info')
    } finally {
      setLoading(false)
    }
  }

  const seedSamplePost = async () => {
    try {
      setSeedLoading(true)
      
      const samplePost = {
        title: `Sample Post ${new Date().toLocaleTimeString()}`,
        content: 'This is a sample post created by the Data Inspector for testing purposes.',
        status: 'draft'
      }

      await apiAdminPost('/api/posts', samplePost)
      
      // Refresh data after successful seed
      await fetchData()
    } catch (err) {
      setError(`Seed failed: ${err.message}`)
    } finally {
      setSeedLoading(false)
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard?.writeText(text).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
    })
  }

  React.useEffect(() => {
    fetchData()
  }, [])

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Data Inspector</h3>
        <div className="flex gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          {import.meta.env.DEV && (
            <button
              onClick={seedSamplePost}
              disabled={seedLoading}
              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {seedLoading ? 'Seeding...' : 'Seed Sample Post'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* API Base */}
        <div>
          <div className="text-sm font-medium text-gray-700 mb-1">API Base</div>
          <div className="flex items-center gap-2">
            <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono flex-1">
              {data.apiBase || 'Not set'}
            </code>
            <button
              onClick={() => copyToClipboard(data.apiBase)}
              className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded"
              title="Copy to clipboard"
            >
              Copy
            </button>
          </div>
        </div>

        {/* Database Info */}
        <div>
          <div className="text-sm font-medium text-gray-700 mb-2">Database</div>
          {data.dbInfo ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-xs text-gray-500 uppercase">Provider</div>
                <div className="font-mono">{data.dbInfo.provider}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase">Host</div>
                <div className="font-mono">{data.dbInfo.hostMasked}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase">Database</div>
                <div className="font-mono">{data.dbInfo.dbName}</div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500 italic">
              Debug endpoint not available (production mode)
            </div>
          )}
        </div>

        {/* Posts Count */}
        <div>
          <div className="text-sm font-medium text-gray-700 mb-1">Posts Count</div>
          <div className="text-2xl font-bold text-gray-900">
            {loading ? '...' : data.postsCount}
            {data.dbInfo?.counts?.posts !== undefined && data.dbInfo.counts.posts !== data.postsCount && (
              <span className="ml-2 text-sm text-gray-500 font-normal">
                (DB: {data.dbInfo.counts.posts})
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DataInspectorCard
