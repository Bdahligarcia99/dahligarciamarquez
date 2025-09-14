// client/src/App.jsx
import { useState, Suspense, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'

import { AdminProvider } from './features/admin/AdminProvider'
import { CompressionProvider } from './hooks/useCompressionSettings'
import AdminLogin from './features/admin/AdminLogin'
import AdminTokenModal from './components/AdminTokenModal'
import Posts from './features/posts/Posts'
import Dashboard from './features/dashboard/Dashboard'
import RequireAdmin from './features/dashboard/RequireAdmin'
import ErrorBoundary from './components/ErrorBoundary'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Home from './pages/Home'
import BlogList from './pages/BlogList'
import BlogPost from './pages/BlogPost'
import StoriesPage from './pages/StoriesPage'
import StoryDetail from './pages/StoryDetail'
import NotFound from './components/NotFound'
import DevNetInspector from './components/DevNetInspector'

// Import PostPreview for the new preview route
import PostPreview from './components/posts/PostPreview'

function AppShell() {
  const location = useLocation()
  const [modalOpen, setModalOpen] = useState(false)

  // Query flag ?admin=1
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get("admin") === "1") {
      setModalOpen(true)
    }
  }, [location.search])

  // Desktop hotkey Ctrl+Alt+D
  useEffect(() => {
    function onKey(e) {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "d") {
        setModalOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Check if current route is dashboard (admin area)
  const isDashboardRoute = location.pathname.startsWith('/dashboard')

  return (
    <>
      <div className="min-h-screen bg-secondary-50 flex flex-col">
        <Navbar onRequestAdminModal={() => setModalOpen(true)} />

        <main className="container mx-auto px-4 py-8 max-w-6xl flex-1">
          
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/posts" element={<Navigate to="/dashboard/posts" replace />} />
            <Route 
              path="/dashboard/*" 
              element={
                <RequireAdmin>
                  <ErrorBoundary>
                    <Suspense fallback={<div style={{padding: 16}}>Loading...</div>}>
                      <Dashboard />
                    </Suspense>
                  </ErrorBoundary>
                </RequireAdmin>
              } 
            />
            <Route path="/blog" element={<BlogList />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/stories" element={<StoriesPage />} />
            <Route path="/stories/:slug" element={<StoryDetail />} />
            
            {/* Post Preview Route - renders outside dashboard layout */}
            <Route 
              path="/posts/:id/preview" 
              element={
                <RequireAdmin>
                  <ErrorBoundary>
                    <Suspense fallback={<div style={{padding: 16}}>Loading preview...</div>}>
                      <PostPreview />
                    </Suspense>
                  </ErrorBoundary>
                </RequireAdmin>
              } 
            />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>

        {/* Footer - only show on public routes */}
        {!isDashboardRoute && <Footer />}
      </div>
      
      <AdminTokenModal open={modalOpen} onClose={() => setModalOpen(false)} />

      {/* Dev-only network inspector */}
      <DevNetInspector />
    </>
  )
}

function App() {
  return (
    <Router>
      <AdminProvider>
        <CompressionProvider>
          <AppShell />
        </CompressionProvider>
      </AdminProvider>
    </Router>
  )
}

export default App