import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { SITE_NAME } from '../config/branding'
import { setDocumentTitle, setMetaDescription } from '../utils/metadata'
import { getPageWallpaper, getUniversalWallpaper } from '../lib/wallpaperApi'

// Test data for cards - with grid positioning for Pinterest-style layout
// gridArea format: "rowStart / colStart / rowEnd / colEnd"
const CARD_DATA = [
  {
    id: 1,
    type: 'snippet',
    gridArea: '1 / 1 / 3 / 2', // tall thin left
    content: {
      title: "Currently Reading",
      text: "One Hundred Years of Solitude"
    }
  },
  {
    id: 2,
    type: 'quote',
    gridArea: '1 / 2 / 2 / 3', // tall thin second from left
    content: {
      text: "Start where you are.",
      author: "Arthur Ashe"
    }
  },
  {
    id: 3,
    type: 'image',
    gridArea: '1 / 3 / 3 / 5', // wide middle top
    content: {
      placeholder: true,
      caption: "Morning coffee ritual"
    }
  },
  {
    id: 4,
    type: 'featured-entry',
    gridArea: '1 / 5 / 4 / 6', // tall right
    content: {
      title: "My Journey into Creative Writing",
      excerpt: "How I discovered the joy of putting thoughts into words and the unexpected places it took me...",
      link: "/blog"
    }
  },
  {
    id: 5,
    type: 'book',
    gridArea: '2 / 2 / 4 / 3', // medium second column
    content: {
      title: "The Alchemist",
      author: "Paulo Coelho",
      note: "A reminder to follow your dreams."
    }
  },
  {
    id: 6,
    type: 'project',
    gridArea: '3 / 3 / 4 / 5', // wide bottom middle
    content: {
      title: "Personal Website Redesign",
      status: "In Progress",
      description: "Building a space that truly reflects who I am."
    }
  },
  {
    id: 7,
    type: 'quote',
    gridArea: '3 / 1 / 5 / 2', // tall bottom left
    content: {
      text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.",
      author: "Aristotle"
    }
  },
  {
    id: 8,
    type: 'snippet',
    gridArea: '4 / 2 / 5 / 4', // wide second row
    content: {
      title: "Favorite Tools",
      text: "Cursor, Figma, Notion, and a good cup of coffee"
    }
  },
  {
    id: 9,
    type: 'image',
    gridArea: '4 / 4 / 6 / 6', // large bottom right
    content: {
      placeholder: true,
      caption: "Weekend sketches"
    }
  },
  {
    id: 10,
    type: 'featured-entry',
    gridArea: '5 / 1 / 6 / 3', // wide bottom left
    content: {
      title: "The Art of Slow Living",
      excerpt: "Finding peace in a world that never stops moving.",
      link: "/blog"
    }
  },
  {
    id: 11,
    type: 'project',
    gridArea: '5 / 3 / 6 / 4', // small
    content: {
      title: "Digital Garden",
      status: "Planning",
      description: "A collection of interconnected notes and ideas."
    }
  },
]

// Card component based on type - Pinterest style large cards
const Card = ({ data }) => {
  const baseClasses = `bg-white rounded-2xl shadow-xl p-8 h-full hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 flex flex-col`

  switch (data.type) {
    case 'quote':
      return (
        <div className={`${baseClasses} flex flex-col justify-center`}>
          <svg className="w-12 h-12 text-gray-200 mb-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
          </svg>
          <p className="text-gray-700 italic text-2xl leading-relaxed mb-6 font-serif">"{data.content.text}"</p>
          <p className="text-gray-500 text-base font-medium">— {data.content.author}</p>
        </div>
      )

    case 'featured-entry':
      return (
        <Link to={data.content.link} className={`${baseClasses} flex flex-col group`}>
          <span className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-4">Featured</span>
          <h3 className="text-2xl font-serif font-bold text-gray-900 mb-4 group-hover:text-blue-600 transition-colors">
            {data.content.title}
          </h3>
          <p className="text-gray-600 text-lg flex-grow leading-relaxed">{data.content.excerpt}</p>
          <span className="text-blue-600 font-medium mt-6 flex items-center gap-2 text-base">
            Read more 
            <svg className="w-5 h-5 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </Link>
      )

    case 'image':
      return (
        <div className={`${baseClasses} flex flex-col`}>
          <div className="flex-grow bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center mb-4 min-h-[200px]">
            <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-gray-500 text-base text-center font-medium">{data.content.caption}</p>
        </div>
      )

    case 'book':
      return (
        <div className={`${baseClasses} flex flex-col`}>
          <div className="flex items-start gap-5 mb-5">
            <div className="w-16 h-24 bg-gradient-to-br from-amber-100 to-amber-300 rounded-lg shadow-md flex items-center justify-center flex-shrink-0">
              <svg className="w-8 h-8 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <h4 className="font-bold text-xl text-gray-900 mb-1">{data.content.title}</h4>
              <p className="text-base text-gray-500">{data.content.author}</p>
            </div>
          </div>
          <p className="text-gray-600 text-lg leading-relaxed">{data.content.note}</p>
        </div>
      )

    case 'project':
      return (
        <div className={`${baseClasses} flex flex-col`}>
          <div className="flex items-center justify-between mb-5">
            <span className="text-sm font-semibold text-purple-600 uppercase tracking-wider">Project</span>
            <span className={`text-sm px-3 py-1.5 rounded-full font-medium ${
              data.content.status === 'In Progress' 
                ? 'bg-green-100 text-green-700' 
                : 'bg-yellow-100 text-yellow-700'
            }`}>
              {data.content.status}
            </span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-4">{data.content.title}</h3>
          <p className="text-gray-600 text-lg leading-relaxed">{data.content.description}</p>
        </div>
      )

    case 'snippet':
      return (
        <div className={`${baseClasses} flex flex-col justify-center`}>
          <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">
            {data.content.title}
          </h4>
          <p className="text-gray-800 font-medium text-xl">{data.content.text}</p>
        </div>
      )

    default:
      return null
  }
}

const Home = () => {
  const [scrollProgress, setScrollProgress] = useState(0)
  const [pageWallpaper, setPageWallpaper] = useState(null)
  const containerRef = useRef(null)

  // Load page wallpaper from Supabase (with universal fallback)
  useEffect(() => {
    const loadWallpaper = async () => {
      // First try to get page-specific wallpaper
      const { data, error } = await getPageWallpaper('home')
      if (!error && data) {
        setPageWallpaper(data)
      } else {
        // Fallback to universal wallpaper
        const { data: universal } = await getUniversalWallpaper()
        if (universal?.wallpaper) {
          setPageWallpaper(universal.wallpaper)
        }
      }
    }
    loadWallpaper()
  }, [])

  useEffect(() => {
    setDocumentTitle()
    setMetaDescription(`Personal stories and experiences from ${SITE_NAME}. Dive into tales that inspire, challenge, and connect us all.`)

    let ticking = false
    
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrollProgress(window.scrollY)
          ticking = false
        })
        ticking = true
      }
    }

    setScrollProgress(window.scrollY)
    
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Parallax effect - image scrolls slower than page
  const imageOffset = scrollProgress * 0.3

  // Scroll thresholds for staged fade effect
  // Title starts at 280px, navbar is at ~112px, so fade should start around scroll 120-130
  const TITLE_LOCK_SCROLL = 120
  const TITLE_FADE_END = 220
  const DESC_LOCK_SCROLL = 320
  const DESC_FADE_END = 420
  
  // Title animation - starts at 280px, scrolls up, then fades in place
  const TITLE_START = 280
  const TITLE_LOCKED_Y = TITLE_START - TITLE_LOCK_SCROLL // Position when locked
  
  let titleY, titleOpacity
  if (scrollProgress < TITLE_LOCK_SCROLL) {
    titleY = TITLE_START - scrollProgress
    titleOpacity = 1
  } else if (scrollProgress < TITLE_FADE_END) {
    titleY = TITLE_LOCKED_Y // Stay at locked position while fading
    const fadeProgress = (scrollProgress - TITLE_LOCK_SCROLL) / (TITLE_FADE_END - TITLE_LOCK_SCROLL)
    titleOpacity = 1 - fadeProgress
  } else {
    titleY = TITLE_LOCKED_Y
    titleOpacity = 0
  }
  
  // Description animation
  const DESC_START = 360 // Gap from title
  const DESC_LOCKED_Y = DESC_START - TITLE_LOCK_SCROLL // Position when title locks
  const DESC_FINAL_Y = DESC_LOCKED_Y - (DESC_LOCK_SCROLL - TITLE_FADE_END) // Position when desc locks
  
  let descY, descOpacity
  if (scrollProgress < TITLE_LOCK_SCROLL) {
    descY = DESC_START - scrollProgress
    descOpacity = 1
  } else if (scrollProgress < TITLE_FADE_END) {
    descY = DESC_LOCKED_Y // Pause while title fades
    descOpacity = 1
  } else if (scrollProgress < DESC_LOCK_SCROLL) {
    const resumeProgress = scrollProgress - TITLE_FADE_END
    descY = DESC_LOCKED_Y - resumeProgress
    descOpacity = 1
  } else if (scrollProgress < DESC_FADE_END) {
    descY = DESC_FINAL_Y // Stay at locked position while fading
    const fadeProgress = (scrollProgress - DESC_LOCK_SCROLL) / (DESC_FADE_END - DESC_LOCK_SCROLL)
    descOpacity = 1 - fadeProgress
  } else {
    descY = DESC_FINAL_Y
    descOpacity = 0
  }

  return (
    <div ref={containerRef}>
      {/* Fixed Wallpaper with parallax */}
      <div className="fixed top-0 left-0 right-0 w-full h-screen overflow-hidden z-0">
        {pageWallpaper?.url ? (
          <img 
            src={pageWallpaper.url} 
            alt={pageWallpaper.alt || 'Page wallpaper'}
            className="w-full object-cover"
            style={{
              height: '150vh',
              transform: `translateY(-${imageOffset}px)`,
              filter: pageWallpaper.blur ? `blur(${pageWallpaper.blur}px)` : 'none'
            }}
            loading="eager"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center border-4 border-dashed border-gray-300 bg-gray-100">
            <div className="text-center text-gray-400">
              <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-xl font-medium">No Wallpaper Set</p>
              <p className="text-sm mt-1">Set wallpaper in Dashboard → Web UI → Home</p>
            </div>
          </div>
        )}
        {/* Dark overlay for better text readability */}
        <div className="absolute inset-0 bg-black/30" />
      </div>

      {/* Welcome Text with scroll effects */}
      <div className="fixed inset-0 z-30 pointer-events-none" role="banner" aria-label="Welcome section">
        <div className="text-center px-4 max-w-4xl mx-auto relative">
          {titleOpacity > 0 && (
            <h1 
              className="text-3xl md:text-5xl font-serif font-bold text-white drop-shadow-2xl absolute left-0 right-0 pointer-events-auto cursor-text whitespace-nowrap"
              style={{ top: `${titleY}px`, opacity: titleOpacity, userSelect: 'text', WebkitUserSelect: 'text' }}
            >
              Welcome to {SITE_NAME}
            </h1>
          )}
          
          {descOpacity > 0 && (
            <p 
              className="text-xl md:text-2xl text-white/90 leading-relaxed drop-shadow-lg max-w-2xl mx-auto absolute left-0 right-0 px-4 pointer-events-auto cursor-text"
              style={{ top: `${descY}px`, opacity: descOpacity, userSelect: 'text', WebkitUserSelect: 'text' }}
            >
              A personal collection of thoughts, experiences, and stories from my journey. 
              Dive into tales that inspire, challenge, and connect us all.
            </p>
          )}
        </div>
      </div>

      {/* Scrollable Cards Section */}
      <div className="relative z-20 pt-[70vh]">
        <div className="w-full px-4 md:px-6 lg:px-8 py-8">
          {/* Pinterest-style CSS Grid */}
          <div 
            className="grid gap-6"
            style={{
              gridTemplateColumns: 'repeat(5, 1fr)',
              gridTemplateRows: 'repeat(6, 180px)',
            }}
          >
            {CARD_DATA.map((card) => (
              <div 
                key={card.id} 
                style={{ gridArea: card.gridArea }}
              >
                <Card data={card} />
              </div>
            ))}
          </div>
        </div>
        
        {/* Bottom padding for scroll space */}
        <div className="h-32" />
      </div>
    </div>
  )
}

export default Home

