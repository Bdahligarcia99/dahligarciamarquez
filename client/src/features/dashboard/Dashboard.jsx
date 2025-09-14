// client/src/features/dashboard/Dashboard.jsx
import React, { useState, Suspense } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import ErrorBoundary from '../../components/ErrorBoundary'
import StatusChip from '../../components/StatusChip'
import Overview from './Overview'
import PostsPage from './PostsPage'
import SettingsPage from './SettingsPage'
import ImageLibrary from './ImageLibrary'

import { lazySafe } from '../../lib/lazySafe'

// Lazy load the PostEditor for better performance
const PostEditor = lazySafe(() => import('../../components/posts/PostEditor'), 'PostEditor')

const Dashboard = () => {
  const location = useLocation()
  
  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  const navItems = [
    { 
      path: '/dashboard', 
      label: 'Overview', 
      exact: true,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    { 
      path: '/dashboard/posts', 
      label: 'Posts',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      )
    },
    { 
      path: '/dashboard/images', 
      label: 'Images',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    { 
      path: '/dashboard/settings', 
      label: 'Settings',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Responsive Sidebar - Icons + Text on large screens, Icons only on small screens */}
        <nav className="bg-white shadow-sm border-r border-gray-200 min-h-screen ml-4 flex-shrink-0 w-16 lg:w-56">
          <div className="py-4">
            {/* Dashboard Title */}
            <div className="flex items-center mb-6 px-2 lg:px-4">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </div>
              {/* Dashboard text - hidden on small screens */}
              <h2 className="ml-3 text-lg font-bold text-gray-900 hidden lg:block">Dashboard</h2>
            </div>
            
            {/* Navigation Items */}
            <ul className="space-y-2">
              {navItems.map((item) => (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    title={item.label}
                    className={`flex items-center transition-colors mx-2 lg:mx-4 rounded-lg ${
                      (item.exact ? location.pathname === item.path : isActive(item.path))
                        ? 'bg-blue-100 text-blue-700 border-l-4 border-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    } ${
                      // Small screens: center icons in square buttons
                      'justify-center w-12 h-12 lg:justify-start lg:w-auto lg:h-auto lg:px-3 lg:py-2'
                    }`}
                  >
                    {item.icon}
                    {/* Text labels - hidden on small screens */}
                    <span className="ml-3 text-sm font-medium hidden lg:block">
                      {item.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            
            {/* Status Chip */}
            <div className="mt-6 px-2 lg:px-4">
              <div className="flex justify-center lg:justify-start">
                <StatusChip />
              </div>
            </div>
          </div>
        </nav>

        {/* Centered Main Content with Gap */}
        <div className="flex-1 flex justify-center ml-8">
          <ErrorBoundary>
            <Suspense fallback={<div style={{padding: 16}}>Loading...</div>}>
              <Routes>
                <Route index element={<Overview />} />
                <Route path="posts" element={<PostsPage />} />
                <Route path="posts/new" element={
                  <Suspense fallback={<div className="p-4">Loading editor…</div>}>
                    <PostEditor />
                  </Suspense>
                } />
                <Route path="posts/:id/edit" element={
                  <Suspense fallback={<div className="p-4">Loading editor…</div>}>
                    <PostEditor />
                  </Suspense>
                } />
                <Route path="images" element={<ImageLibrary />} />
                <Route path="settings" element={<SettingsPage />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
