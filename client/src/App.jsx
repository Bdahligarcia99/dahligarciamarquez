// client/src/App.jsx
import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { api, getApiBase } from './lib/api'
import Posts from './features/posts/Posts'
import Dashboard from './features/dashboard/Dashboard'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import BlogList from './pages/BlogList'
import BlogPost from './pages/BlogPost'
import StoriesPage from './pages/StoriesPage'
import StoryDetail from './pages/StoryDetail'
import NotFound from './components/NotFound'

function App() {
  const [apiResponse, setApiResponse] = useState(null)
  const [apiError, setApiError] = useState(null)
  const [loading, setLoading] = useState(false)

  const testApiCall = async () => {
    setLoading(true)
    setApiError(null)
    setApiResponse(null)
    
    try {
      const data = await api('/api/hello')
      setApiResponse(data)
    } catch (error) {
      setApiError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Router>
      <div className="min-h-screen bg-secondary-50">
        <Navbar />
        
        {/* API Test Section - only show on home page */}
        <div className="bg-blue-50 border-b border-blue-200 py-4">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h3 className="text-lg font-semibold mb-2">API Configuration</h3>
              <p className="text-sm text-gray-600 mb-3">
                <strong>VITE_API_URL:</strong> {getApiBase() || 'Not set'}
              </p>
              
              <button
                onClick={testApiCall}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Testing...' : 'Ping API'}
              </button>
              
              {apiResponse && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded">
                  <strong>Success:</strong> {JSON.stringify(apiResponse, null, 2)}
                </div>
              )}
              
              {apiError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                  <strong>Error:</strong> {apiError}
                </div>
              )}
            </div>
          </div>
        </div>

        <main className="container mx-auto px-4 py-8 max-w-6xl">
          {/* API Debug Info */}
          <div className="mb-4">
            <small className="text-gray-500">
              Backend: {getApiBase() || 'Not configured'}
            </small>
          </div>
          
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/posts" element={<Posts />} />
            <Route path="/dashboard/*" element={<Dashboard />} />
            <Route path="/blog" element={<BlogList />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/stories" element={<StoriesPage />} />
            <Route path="/stories/:slug" element={<StoryDetail />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App