// client/src/features/dashboard/components/StatusBadge.jsx
const StatusBadge = ({ status, label, loading = false }) => {
  const getStatusColor = () => {
    if (loading) return 'bg-gray-100 text-gray-600'
    switch (status) {
      case 'success':
      case 'ok':
      case true:
        return 'bg-green-100 text-green-800'
      case 'error':
      case 'fail':
      case false:
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-yellow-100 text-yellow-800'
    }
  }

  const getStatusText = () => {
    if (loading) return 'Checking...'
    if (status === true || status === 'ok' || status === 'success') return 'Online'
    if (status === false || status === 'error' || status === 'fail') return 'Offline'
    return status || 'Unknown'
  }

  return (
    <div className="flex items-center space-x-2">
      {label && <span className="text-sm text-gray-600">{label}:</span>}
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}>
        {getStatusText()}
      </span>
    </div>
  )
}

export default StatusBadge
