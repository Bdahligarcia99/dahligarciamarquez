// client/src/features/dashboard/Dashboard.jsx
import { useState } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import Overview from './Overview'
import PostsPage from './PostsPage'
import SettingsPage from './SettingsPage'

const Dashboard = () => {
  const location = useLocation()
  
  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  const navItems = [
    { path: '/dashboard', label: 'Overview', exact: true },
    { path: '/dashboard/posts', label: 'Posts' },
    { path: '/dashboard/settings', label: 'Settings' }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Left Navigation */}
        <nav className="w-64 bg-white shadow-sm border-r border-gray-200 min-h-screen">
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Dashboard</h2>
            <ul className="space-y-2">
              {navItems.map((item) => (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`block px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      (item.exact ? location.pathname === item.path : isActive(item.path))
                        ? 'bg-blue-100 text-blue-700 border-l-4 border-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* Main Content */}
        <div className="flex-1 p-8">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/posts" element={<PostsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
