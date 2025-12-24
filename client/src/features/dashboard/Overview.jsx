// client/src/features/dashboard/Overview.jsx
import React from 'react'
import { supabaseFetchPostsTotal } from '../../lib/api'
import { useNavigate } from 'react-router-dom'
import DataInspectorCard from './components/DataInspectorCard'
import SystemStatusCard from '../../components/SystemStatusCard'
import StorageUsageCard from '../../components/StorageUsageCard'

const DEFAULT_STATS = { postsCount: 0 }

export default function Overview() {
  const navigate = useNavigate()
  const [stats, setStats] = React.useState(DEFAULT_STATS)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(null)

  React.useEffect(() => {
    const ac = new AbortController()
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const total = await supabaseFetchPostsTotal({ signal: ac.signal })
        
        // Dev logging
        if (import.meta.env.DEV) {
          console.log('[Overview] posts total:', total)
        }
        
        setStats({ postsCount: total })
      } catch (e) {
        setError('Could not load overview stats.')
        setStats(DEFAULT_STATS)
      } finally {
        setLoading(false)
      }
    })()
    return () => ac.abort()
  }, [])

  const postsCount = stats?.postsCount ?? 0

  if (loading) return <div className="p-4 text-sm opacity-75">Loading overview…</div>

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-3 rounded-lg border border-amber-400 bg-amber-50 text-amber-800 text-sm">
          {error}
        </div>
      )}
      
      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl border bg-white">
          <div className="text-xs uppercase opacity-60">Entries</div>
          <div className="text-2xl font-semibold">{postsCount}</div>
        </div>
      </div>
      
      {/* System Status and Storage Usage Cards */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SystemStatusCard />
        <StorageUsageCard />
      </div>
      
      {/* Data Inspector Card */}
      <div className="mt-6">
        <DataInspectorCard />
      </div>
    </div>
  )
}
