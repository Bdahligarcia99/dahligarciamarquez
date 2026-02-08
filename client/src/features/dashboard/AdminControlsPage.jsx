// client/src/features/dashboard/AdminControlsPage.jsx
// Admin Controls - Account management and administrative functions

const AdminControlsPage = () => {
  return (
    <div className="p-8 max-w-6xl w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Admin Controls</h1>
        <p className="text-gray-500 mt-1">Manage accounts, permissions, and administrative functions</p>
      </div>

      {/* Feature Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        
        {/* Account Management Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-lg">Account Management</h3>
              <p className="text-sm text-gray-500">View and manage user accounts</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">View all accounts</span>
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">Coming Soon</span>
            </div>
            <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Account details & activity</span>
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">Coming Soon</span>
            </div>
            <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Role management</span>
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">Coming Soon</span>
            </div>
          </div>
        </div>

        {/* System Entry Assignment Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-lg">System Entry Assignment</h3>
              <p className="text-sm text-gray-500">Assign system entries to users</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Assign entries by email</span>
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">Coming Soon</span>
            </div>
            <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Terms of Service assignment</span>
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">Coming Soon</span>
            </div>
            <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Bio & profile content</span>
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">Coming Soon</span>
            </div>
          </div>
        </div>

        {/* Account Deletion Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-lg">Account Deletion</h3>
              <p className="text-sm text-gray-500">Manage flagged and deleted accounts</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">View flagged accounts</span>
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">Coming Soon</span>
            </div>
            <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Review deletion requests</span>
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">Coming Soon</span>
            </div>
            <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Permanent deletion</span>
              <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">Coming Soon</span>
            </div>
          </div>
        </div>

        {/* Additional Controls Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-lg">Additional Controls</h3>
              <p className="text-sm text-gray-500">More administrative features</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Site-wide announcements</span>
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">Coming Soon</span>
            </div>
            <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Audit logs</span>
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">Coming Soon</span>
            </div>
            <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Backup & restore</span>
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">Coming Soon</span>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Notice Banner */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-slate-600 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">Admin-Only Access</h3>
            <p className="text-slate-300 text-sm">
              These controls are restricted to administrators. All actions are logged for security 
              and compliance purposes. Handle account data with care.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminControlsPage
