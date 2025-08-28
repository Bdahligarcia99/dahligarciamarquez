// client/src/features/dashboard/components/KpiCard.jsx
const KpiCard = ({ title, value, loading = false, error = null }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <h3 className="text-sm font-medium text-gray-500 mb-2">{title}</h3>
      {loading ? (
        <div className="text-2xl font-bold text-gray-400">Loading...</div>
      ) : error ? (
        <div className="text-2xl font-bold text-red-500">Error</div>
      ) : (
        <div className="text-2xl font-bold text-gray-900">{value}</div>
      )}
    </div>
  )
}

export default KpiCard
