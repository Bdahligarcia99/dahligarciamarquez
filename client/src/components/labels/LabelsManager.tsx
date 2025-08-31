// Labels Management Component (Admin only)
import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { Label, getSessionToken } from '../../lib/supabase'

export default function LabelsManager() {
  const { profile } = useAuth()
  const [labels, setLabels] = useState<Label[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newLabelName, setNewLabelName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const fetchLabels = async () => {
    try {
      const response = await fetch('/api/labels')
      if (!response.ok) throw new Error('Failed to fetch labels')
      const data = await response.json()
      setLabels(data)
    } catch (error) {
      console.error('Error fetching labels:', error)
      setError('Failed to load labels')
    } finally {
      setLoading(false)
    }
  }

  const createLabel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLabelName.trim()) return

    setCreating(true)
    setError(null)

    try {
      const token = await getSessionToken()
      const response = await fetch('/api/labels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newLabelName.trim() })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create label')
      }

      const newLabel = await response.json()
      setLabels([...labels, newLabel])
      setNewLabelName('')
    } catch (error) {
      console.error('Error creating label:', error)
      setError(error instanceof Error ? error.message : 'Failed to create label')
    } finally {
      setCreating(false)
    }
  }

  const deleteLabel = async (id: string) => {
    if (!confirm('Are you sure you want to delete this label?')) return

    try {
      const token = await getSessionToken()
      const response = await fetch(`/api/labels/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete label')
      }

      setLabels(labels.filter(label => label.id !== id))
    } catch (error) {
      console.error('Error deleting label:', error)
      setError(error instanceof Error ? error.message : 'Failed to delete label')
    }
  }

  useEffect(() => {
    fetchLabels()
  }, [])

  if (profile?.role !== 'admin') {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Admin access required</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Loading labels...</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Manage Labels</h1>

      {/* Create new label */}
      <div className="mb-8 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-lg font-semibold mb-4">Create New Label</h2>
        <form onSubmit={createLabel} className="flex gap-2">
          <input
            type="text"
            placeholder="Label name"
            value={newLabelName}
            onChange={(e) => setNewLabelName(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={creating || !newLabelName.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </form>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Labels list */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {labels.map((label) => (
          <div key={label.id} className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{label.name}</h3>
                <p className="text-sm text-gray-600">/{label.slug}</p>
                <p className="text-xs text-gray-500">
                  Created {new Date(label.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => deleteLabel(label.id)}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {labels.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-600">No labels created yet</p>
        </div>
      )}
    </div>
  )
}
