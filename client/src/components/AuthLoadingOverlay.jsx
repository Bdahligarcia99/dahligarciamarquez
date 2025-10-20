// Authentication Loading Overlay Component
import { useEffect, useState } from 'react'

export default function AuthLoadingOverlay({ isVisible, message, onComplete, autoComplete = true }) {
  const [showContent, setShowContent] = useState(false)

  useEffect(() => {
    if (isVisible) {
      // Small delay to make the loading feel more natural
      const timer = setTimeout(() => {
        setShowContent(true)
      }, 100)
      return () => clearTimeout(timer)
    } else {
      setShowContent(false)
    }
  }, [isVisible])

  useEffect(() => {
    if (isVisible && onComplete && autoComplete) {
      // Auto-complete after a minimum time to feel natural
      const timer = setTimeout(() => {
        onComplete()
      }, 1500) // 1.5 seconds minimum
      return () => clearTimeout(timer)
    }
  }, [isVisible, onComplete, autoComplete])

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className={`bg-white rounded-lg shadow-xl p-8 max-w-sm mx-4 text-center transform transition-all duration-300 ${
        showContent ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
      }`}>
        {/* Loading Spinner */}
        <div className="mb-4">
          <div className="w-12 h-12 mx-auto border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
        
        {/* Message */}
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {message || 'Processing...'}
        </h3>
        
        {/* Subtitle */}
        <p className="text-sm text-gray-600">
          Please wait a moment
        </p>
      </div>
    </div>
  )
}
