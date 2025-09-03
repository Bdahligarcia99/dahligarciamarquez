// client/src/features/dashboard/Overview.jsx
import { useState, useEffect } from 'react'
import { apiGet, apiAdminGet } from '../../lib/api'
import { isHTTPError } from '../../lib/httpErrors'
import KpiCard from './components/KpiCard'
import StatusBadge from './components/StatusBadge'
import AdminTokenControls from './components/AdminTokenControls'

const Overview = () => {
  const [posts, setPosts] = useState([])
  const [health, setHealth] = useState(null)
  const [dbNow, setDbNow] = useState(null)
  const [adminHealth, setAdminHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [healthLoading, setHealthLoading] = useState(true)
  const [dbLoading, setDbLoading] = useState(true)
  const [adminHealthLoading, setAdminHealthLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchData()
    checkHealth()
    checkDbNow()
    checkAdminHealth()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const postsData = await apiAdminGet('/api/posts')
      // Handle both old format (array) and new format (object with items)
      setPosts(Array.isArray(postsData) ? postsData : postsData.items || [])
    } catch (err) {
      console.error('Failed to fetch posts:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const checkHealth = async () => {
    try {
      setHealthLoading(true)
      const healthData = await apiGet('/healthz')
      setHealth(healthData)
    } catch (err) {
      console.error('Health check failed:', err)
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
      console.error('Database check failed:', err)
      setDbNow({ error: err.message })
    } finally {
      setDbLoading(false)
    }
  }

  const checkAdminHealth = async () => {
    try {
      setAdminHealthLoading(true)
      const healthData = await apiAdminGet('/api/admin/health')
      setAdminHealth(healthData)
    } catch (err) {
      console.error('Admin health check failed:', err)
      setAdminHealth({ error: err.message })
    } finally {
      setAdminHealthLoading(false)
    }
  }

  useEffect(() => {
    checkHealth()
    checkDbNow()
  }, [])

  const getLastPostTime = () => {
    if (!posts.length) return 'No posts yet'
    const lastPost = posts[0] // posts are returned newest first
    return new Date(lastPost.created_at).toLocaleString()
  }

  const recentPosts = posts.slice(0, 5)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard Overview</h1>
        
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <KpiCard
            title="Total Posts"
            value={loading ? undefined : posts.length}
            loading={loading}
            error={error}
          />
          <KpiCard
            title="Last Post"
            value={loading ? undefined : getLastPostTime()}
            loading={loading}
            error={error}
          />
        </div>

        {/* Status Section */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
          <h2 className="text-lg font-semibold mb-4">System Status</h2>
          <div className="space-y-3">
            <StatusBadge
              status={health?.ok}
              label="API Health"
              loading={healthLoading}
            />
            <StatusBadge
              status={dbNow && !dbNow.error ? 'success' : 'error'}
              label="Database"
              loading={dbLoading}
            />
            {dbNow && !dbNow.error && (
              <div className="text-sm text-gray-600">
                <strong>DB Time:</strong> {new Date(dbNow.now).toLocaleString()}
              </div>
            )}
          </div>
        </div>

        {/* System Health */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold mb-4">System Health</h2>
          {adminHealthLoading ? (
            <div className="text-gray-500">Loading health data...</div>
          ) : adminHealth?.error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded">
              <h3 className="font-medium text-red-800 mb-2">Health Check Failed</h3>
              <p className="text-sm text-red-700">{adminHealth.error}</p>
            </div>
          ) : adminHealth ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* API Health */}
              <KpiCard
                title="API Status"
                value={adminHealth.api?.status || 'unknown'}
                subtitle={`Version: ${adminHealth.api?.version || 'unknown'}`}
                variant={adminHealth.api?.status === 'ok' ? 'success' : 'error'}
              />
              
              {/* Database Health */}
              <KpiCard
                title="Database"
                value={adminHealth.db?.status || 'unknown'}
                subtitle={
                  adminHealth.db?.postsCount !== null 
                    ? `${adminHealth.db.postsCount} posts` 
                    : 'Connection failed'
                }
                variant={adminHealth.db?.status === 'ok' ? 'success' : 'error'}
              />
              
              {/* Storage Info */}
              <KpiCard
                title="Storage"
                value={adminHealth.storage?.driver || 'unknown'}
                subtitle="Storage driver"
                variant="info"
              />
            </div>
          ) : (
            <div className="text-gray-500">No health data available</div>
          )}
        </div>

        {/* Recent Posts */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold mb-4">Recent Posts</h2>
          {loading ? (
            <div className="text-gray-500">Loading posts...</div>
          ) : error ? (
            <>
              {isHTTPError(error, 500) ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded">
                  <h3 className="font-medium text-red-800 mb-2">Admin token not configured on server</h3>
                  <p className="text-sm text-red-700 mb-2">
                    Set <code className="bg-red-100 px-1 rounded">ADMIN_TOKEN</code> in your server environment and redeploy (Clear build cache).
                  </p>
                  <AdminTokenControls onAfter={fetchData} />
                </div>
              ) : isHTTPError(error, 401) ? (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
                  <h3 className="font-medium text-yellow-800 mb-2">Admin access required</h3>
                  <p className="text-sm text-yellow-700 mb-2">
                    Your browser session has no admin token or it's invalid.
                  </p>
                  <AdminTokenControls onAfter={fetchData} />
                </div>
              ) : (
                <div className="p-4 bg-red-50 border border-red-200 rounded">
                  <h3 className="font-medium text-red-800 mb-2">Failed to load posts</h3>
                  <pre className="text-sm text-red-700">{String(error)}</pre>
                </div>
              )}
            </>
          ) : recentPosts.length === 0 ? (
            <div className="text-gray-500">No posts found</div>
          ) : (
            <div className="space-y-3">
              {recentPosts.map((post) => (
                <div key={post.id} className="border-l-4 border-blue-500 pl-4">
                  <h3 className="font-medium text-gray-900">{post.title}</h3>
                  <p className="text-sm text-gray-500">
                    {new Date(post.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Overview
