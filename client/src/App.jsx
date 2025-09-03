// client/src/App.jsx
import { useState, Suspense, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'

import { AdminProvider } from './features/admin/AdminProvider'
import AdminLogin from './features/admin/AdminLogin'
import AdminTokenModal from './components/AdminTokenModal'
import Posts from './features/posts/Posts'
import Dashboard from './features/dashboard/Dashboard'
import RequireAdmin from './features/dashboard/RequireAdmin'
import ErrorBoundary from './components/ErrorBoundary'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import BlogList from './pages/BlogList'
import BlogPost from './pages/BlogPost'
import StoriesPage from './pages/StoriesPage'
import StoryDetail from './pages/StoryDetail'
import NotFound from './components/NotFound'

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

  return (
    <>
      <div className="min-h-screen bg-secondary-50">
        <Navbar onRequestAdminModal={() => setModalOpen(true)} />

        <main className="container mx-auto px-4 py-8 max-w-6xl">
          
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
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
      
      <AdminTokenModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  )
}

function App() {
  return (
    <Router>
      <AdminProvider>
        <AppShell />
      </AdminProvider>
    </Router>
  )
}

export default App