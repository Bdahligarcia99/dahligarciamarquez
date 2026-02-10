// client/src/App.jsx
import { useState, Suspense, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'

import { CompressionProvider } from './hooks/useCompressionSettings'
import { NavbarProvider } from './context/NavbarContext'
import { DraftRegistryProvider } from './context/DraftRegistryContext'
import ConditionalAuthProvider from './components/ConditionalAuthProvider'
import ComingSoonGuard from './components/ComingSoonGuard'
import Posts from './features/posts/Posts'
import Dashboard from './features/dashboard/Dashboard'
import CardBuilderPage from './features/dashboard/CardBuilderPage'
import ErrorBoundary from './components/ErrorBoundary'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Home from './pages/Home'
import BlogList from './pages/BlogList'
import BlogPost from './pages/BlogPost'
import About from './pages/About'
import Contact from './pages/Contact'
import StoriesPage from './pages/StoriesPage'
import StoryDetail from './pages/StoryDetail'
import NotFound from './components/NotFound'
import DevNetInspector from './components/DevNetInspector'

// Import PostPreview for the new preview route
import PostPreview from './components/posts/PostPreview'

// Import auth components
import SignIn from './components/auth/SignIn'
import SignUp from './components/auth/SignUp'
import ForgotPassword from './components/auth/ForgotPassword'
import ProtectedRoute from './components/auth/ProtectedRoute'
import ProfileSettings from './pages/ProfileSettings'

function AppShell() {
  const location = useLocation()

  // Check if current route is dashboard (admin area) or auth page
  const isDashboardRoute = location.pathname.startsWith('/dashboard')
  const isAuthRoute = location.pathname.startsWith('/auth/')
  const isHomePage = location.pathname === '/'
  const isCardBuilder = location.pathname.startsWith('/dashboard/card-builder')

  return (
    <>
      <div className="min-h-screen bg-secondary-50 flex flex-col">
        {/* Hide navbar on auth pages and card builder */}
        {!isAuthRoute && !isCardBuilder && <Navbar />}

        <main className={`flex-1 ${(isHomePage || isCardBuilder) ? '' : 'container mx-auto px-4 py-8 max-w-6xl'}`}>
          
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/posts" element={<Navigate to="/dashboard/posts" replace />} />
            <Route 
              path="/dashboard/*" 
              element={
                <ProtectedRoute requireRole="admin">
                  <ErrorBoundary>
                    <Suspense fallback={<div style={{padding: 16}}>Loading...</div>}>
                      <Dashboard />
                    </Suspense>
                  </ErrorBoundary>
                </ProtectedRoute>
              } 
            />
            <Route path="/blog" element={<BlogList />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/stories" element={<StoriesPage />} />
            <Route path="/stories/:slug" element={<StoryDetail />} />
            
            {/* Authentication routes */}
            <Route path="/auth/signin" element={<SignIn />} />
            <Route path="/auth/signup" element={<SignUp />} />
            <Route path="/auth/forgot-password" element={<ForgotPassword />} />
            
            {/* Profile routes */}
            <Route 
              path="/profile/settings" 
              element={
                <ProtectedRoute>
                  <ProfileSettings />
                </ProtectedRoute>
              } 
            />
            
            {/* Post Preview Route - renders outside dashboard layout */}
            <Route 
              path="/posts/:id/preview" 
              element={
                <ProtectedRoute requireRole="admin">
                  <ErrorBoundary>
                    <Suspense fallback={<div style={{padding: 16}}>Loading preview...</div>}>
                      <PostPreview />
                    </Suspense>
                  </ErrorBoundary>
                </ProtectedRoute>
              } 
            />
            
            {/* UI Builder - full screen preview */}
            <Route 
              path="/dashboard/card-builder/:pageId" 
              element={
                <ProtectedRoute requireRole="admin">
                  <ErrorBoundary>
                    <CardBuilderPage />
                  </ErrorBoundary>
                </ProtectedRoute>
              } 
            />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>

        {/* Footer - only show on public routes */}
        {!isDashboardRoute && <Footer />}
      </div>

      {/* Dev-only network inspector */}
      <DevNetInspector />
    </>
  )
}

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ConditionalAuthProvider>
        <NavbarProvider>
          <DraftRegistryProvider>
            <ComingSoonGuard>
              <CompressionProvider>
                <AppShell />
              </CompressionProvider>
            </ComingSoonGuard>
          </DraftRegistryProvider>
        </NavbarProvider>
      </ConditionalAuthProvider>
    </Router>
  )
}

export default App