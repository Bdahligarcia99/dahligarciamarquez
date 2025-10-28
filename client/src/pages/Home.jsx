import { Link } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import { SITE_NAME } from '../config/branding'
import { setDocumentTitle, setMetaDescription } from '../utils/metadata'

const Home = () => {
  const [scrollProgress, setScrollProgress] = useState(0)
  const containerRef = useRef(null)

  useEffect(() => {
    setDocumentTitle()
    setMetaDescription(`Personal stories and experiences from ${SITE_NAME}. Dive into tales that inspire, challenge, and connect us all.`)

    let ticking = false
    
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (containerRef.current) {
            setScrollProgress(window.scrollY)
          }
          ticking = false
        })
        ticking = true
      }
    }

    // Set initial value
    setScrollProgress(window.scrollY)
    
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // White section grows from 0 to 66.67vh (reaches 2/3 at scroll 667)
  const whiteHeight = Math.min(scrollProgress / 10, 66.67)
  
  // Scroll thresholds for staged fade effect
  const TITLE_LOCK_SCROLL = 300      // Title reaches top and locks
  const TITLE_FADE_END = 450         // Title fully faded
  const DESC_LOCK_SCROLL = 550       // Description reaches top and locks
  const DESC_FADE_END = 700          // Description fully faded
  
  // Title: scrolls up → locks at top → fades while locked
  let titleY, titleOpacity
  if (scrollProgress < TITLE_LOCK_SCROLL) {
    // Title moving up normally
    titleY = 400 - scrollProgress
    titleOpacity = 1
  } else if (scrollProgress < TITLE_FADE_END) {
    // Title locked at top, fading
    titleY = 100
    const fadeProgress = (scrollProgress - TITLE_LOCK_SCROLL) / (TITLE_FADE_END - TITLE_LOCK_SCROLL)
    titleOpacity = 1 - fadeProgress
  } else {
    // Title gone
    titleY = 100
    titleOpacity = 0
  }
  
  // Description: scrolls → pauses while title fades → resumes → locks → fades
  let descY, descOpacity
  if (scrollProgress < TITLE_LOCK_SCROLL) {
    // Description moving up with title
    descY = 500 - scrollProgress
    descOpacity = 1
  } else if (scrollProgress < TITLE_FADE_END) {
    // Description paused (waiting for title to fade)
    descY = 500 - TITLE_LOCK_SCROLL
    descOpacity = 1
  } else if (scrollProgress < DESC_LOCK_SCROLL) {
    // Description resuming movement to top
    const resumeProgress = scrollProgress - TITLE_FADE_END
    descY = (500 - TITLE_LOCK_SCROLL) - resumeProgress
    descOpacity = 1
  } else if (scrollProgress < DESC_FADE_END) {
    // Description locked at top, fading
    descY = 100
    const fadeProgress = (scrollProgress - DESC_LOCK_SCROLL) / (DESC_FADE_END - DESC_LOCK_SCROLL)
    descOpacity = 1 - fadeProgress
  } else {
    // Description gone
    descY = 100
    descOpacity = 0
  }

  return (
    <div ref={containerRef} className="max-w-full" style={{ height: '3000px' }}>
      {/* Fixed Banner at Top - Never moves */}
      <div className="fixed top-0 left-0 right-0 w-full h-screen overflow-hidden z-0">
        <img 
          src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=2000&h=1200&fit=crop" 
          alt="Mountain landscape at sunrise"
          className="w-full h-full object-cover"
          loading="eager"
        />
      </div>

      {/* Text elements with individual positioning */}
      <div className="fixed inset-0 z-20 pointer-events-none">
        <div className="text-center px-4 max-w-4xl mx-auto">
          {/* Title - Individual position control */}
          {titleOpacity > 0 && (
            <h1 
              className="text-5xl md:text-7xl font-serif font-bold text-white drop-shadow-2xl absolute left-0 right-0"
              style={{ 
                top: `${titleY}px`,
                opacity: titleOpacity
              }}
            >
              Welcome to {SITE_NAME}
            </h1>
          )}
          
          {/* Description - Individual position control */}
          {descOpacity > 0 && (
            <p 
              className="text-xl md:text-2xl text-white/90 leading-relaxed drop-shadow-lg max-w-2xl mx-auto absolute left-0 right-0 px-4"
              style={{ 
                top: `${descY}px`,
                opacity: descOpacity
              }}
            >
              A personal collection of thoughts, experiences, and stories from my journey. 
              Dive into tales that inspire, challenge, and connect us all.
            </p>
          )}
        </div>
      </div>

      {/* White section that grows to cover 2/3 of banner */}
      <div 
        className="fixed bottom-0 left-0 right-0 bg-white z-10 overflow-y-auto"
        style={{ height: `${whiteHeight}vh`, transition: 'none' }}
      >
        {/* Sticky button container at top of white section */}
        <div className="sticky top-0 bg-white z-20 pt-16 pb-8 flex justify-center">
          <Link 
            to="/blog" 
            className="btn-primary text-lg px-8 py-3 inline-block pointer-events-auto"
          >
            Explore Stories
          </Link>
        </div>
        
        {/* Scrollable content below button */}
        <div className="max-w-4xl mx-auto px-4 pb-16">
            <div className="grid md:grid-cols-3 gap-8 py-16">
              <div className="text-center">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="text-xl font-serif font-semibold text-secondary-900 mb-2">
                  Personal Stories
                </h3>
                <p className="text-secondary-600">
                  Authentic experiences and reflections from my personal journey
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="text-xl font-serif font-semibold text-secondary-900 mb-2">
                  Insights & Ideas
                </h3>
                <p className="text-secondary-600">
                  Thoughts and discoveries that have shaped my perspective
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-serif font-semibold text-secondary-900 mb-2">
                  Community
                </h3>
                <p className="text-secondary-600">
                  Stories that bring us together and build connections
                </p>
              </div>
            </div>

            {/* CTA Section */}
            <div className="bg-primary-50 rounded-lg p-8 text-center my-16">
              <h2 className="text-2xl font-serif font-semibold text-secondary-900 mb-4">
                Ready to dive in?
              </h2>
              <p className="text-secondary-600 mb-6">
                Start exploring the collection of stories and find the ones that resonate with you.
              </p>
              <Link 
                to="/blog" 
                className="btn-primary"
              >
                Browse All Stories
              </Link>
            </div>
        </div>
      </div>
    </div>
  )
}

export default Home

