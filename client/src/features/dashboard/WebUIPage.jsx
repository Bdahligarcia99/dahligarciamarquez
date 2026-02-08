// client/src/features/dashboard/WebUIPage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNavbarSettings } from '../../context/NavbarContext'
import ImagePicker from '../../components/editor/ImagePicker'
import { uploadImage } from '../../utils/uploadImage'
import { getAllPageWallpapers, setPageWallpaper, removePageWallpaper, setUniversalWallpaper, clearUniversalWallpaper } from '../../lib/wallpaperApi'

const WebUIPage = () => {
  const navigate = useNavigate()
  const [activeNavItem, setActiveNavItem] = useState('home')
  const [showImagePicker, setShowImagePicker] = useState(false)
  const [wallpapers, setWallpapers] = useState({})
  const [wallpaperLoading, setWallpaperLoading] = useState(true)
  const [wallpaperSaving, setWallpaperSaving] = useState(false)
  const [wallpaperError, setWallpaperError] = useState(null)
  const [universalPageId, setUniversalPageId] = useState(null)
  const [showUniversalConfirm, setShowUniversalConfirm] = useState(false)
  const [pendingUniversalPageId, setPendingUniversalPageId] = useState(null)
  const [showAddTabModal, setShowAddTabModal] = useState(false)
  const [newTabName, setNewTabName] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const { 
    navItems, 
    toggleHidden, 
    isHidden, 
    isLastVisible,
    addNavItem,
    removeNavItem,
    canDeleteItem,
    isCustomItem,
    loading,
    saving,
    error 
  } = useNavbarSettings()
  
  // Load wallpapers from Supabase on mount
  useEffect(() => {
    const loadWallpapers = async () => {
      setWallpaperLoading(true)
      setWallpaperError(null)
      
      const { data, error } = await getAllPageWallpapers()
      
      if (error) {
        console.error('Failed to load wallpapers:', error)
        setWallpaperError('Failed to load wallpapers')
        // Fall back to localStorage
        const savedWallpapers = localStorage.getItem('page_wallpapers')
        if (savedWallpapers) {
          try {
            const parsed = JSON.parse(savedWallpapers)
            setWallpapers(parsed.wallpapers || parsed)
            setUniversalPageId(parsed.universalPageId || null)
          } catch (e) {
            console.error('Failed to parse saved wallpapers:', e)
          }
        }
      } else if (data) {
        setWallpapers(data.wallpapers)
        setUniversalPageId(data.universalPageId)
        // Also save to localStorage as backup
        localStorage.setItem('page_wallpapers', JSON.stringify(data))
      }
      
      setWallpaperLoading(false)
    }
    
    loadWallpapers()
  }, [])
  
  // Get current wallpaper for active tab
  const currentWallpaper = wallpapers[activeNavItem] || null
  
  // Handle wallpaper selection
  const handleWallpaperSelect = async (payload) => {
    setWallpaperSaving(true)
    setWallpaperError(null)
    
    try {
      let wallpaperUrl = payload.url
      
      // If a file was uploaded, we need to upload it to storage
      if (payload.file) {
        const result = await uploadImage(payload.file)
        wallpaperUrl = result.url
      }
      
      const wallpaperData = {
        url: wallpaperUrl,
        alt: payload.alt
      }
      
      // Save to Supabase
      const { success, error } = await setPageWallpaper(activeNavItem, wallpaperData)
      
      if (error) {
        console.error('Failed to save wallpaper to Supabase:', error)
        setWallpaperError('Failed to save wallpaper')
      }
      
      // Update local state regardless (optimistic update)
      const newWallpapers = {
        ...wallpapers,
        [activeNavItem]: wallpaperData
      }
      setWallpapers(newWallpapers)
      
      // Also save to localStorage as backup
      localStorage.setItem('page_wallpapers', JSON.stringify(newWallpapers))
      
    } catch (err) {
      console.error('Failed to save wallpaper:', err)
      setWallpaperError('Failed to save wallpaper')
    } finally {
      setWallpaperSaving(false)
    }
  }
  
  // Remove wallpaper
  const handleRemoveWallpaper = async () => {
    setWallpaperSaving(true)
    setWallpaperError(null)
    
    try {
      // Remove from Supabase
      const { success, error } = await removePageWallpaper(activeNavItem)
      
      if (error) {
        console.error('Failed to remove wallpaper from Supabase:', error)
        setWallpaperError('Failed to remove wallpaper')
      }
      
      // Update local state
      const newWallpapers = { ...wallpapers }
      delete newWallpapers[activeNavItem]
      setWallpapers(newWallpapers)
      
      // If this was the universal wallpaper, clear it
      if (universalPageId === activeNavItem) {
        setUniversalPageId(null)
        await clearUniversalWallpaper()
      }
      
      // Update localStorage
      localStorage.setItem('page_wallpapers', JSON.stringify({ wallpapers: newWallpapers, universalPageId }))
      
    } catch (err) {
      console.error('Failed to remove wallpaper:', err)
      setWallpaperError('Failed to remove wallpaper')
    } finally {
      setWallpaperSaving(false)
    }
  }
  
  // Handle setting as universal wallpaper
  const handleSetUniversal = () => {
    // If there's already a different universal, show confirmation
    if (universalPageId && universalPageId !== activeNavItem) {
      setPendingUniversalPageId(activeNavItem)
      setShowUniversalConfirm(true)
    } else {
      // No existing universal or it's the same page, just set it
      confirmSetUniversal(activeNavItem)
    }
  }
  
  // Confirm setting as universal
  const confirmSetUniversal = async (pageId) => {
    setWallpaperSaving(true)
    setWallpaperError(null)
    setShowUniversalConfirm(false)
    setPendingUniversalPageId(null)
    
    try {
      const { error } = await setUniversalWallpaper(pageId)
      
      if (error) {
        console.error('Failed to set universal wallpaper:', error)
        setWallpaperError('Failed to set universal wallpaper')
      } else {
        setUniversalPageId(pageId)
        // Update localStorage
        localStorage.setItem('page_wallpapers', JSON.stringify({ wallpapers, universalPageId: pageId }))
      }
    } catch (err) {
      console.error('Failed to set universal wallpaper:', err)
      setWallpaperError('Failed to set universal wallpaper')
    } finally {
      setWallpaperSaving(false)
    }
  }
  
  // Clear universal wallpaper
  const handleClearUniversal = async () => {
    setWallpaperSaving(true)
    setWallpaperError(null)
    
    try {
      const { error } = await clearUniversalWallpaper()
      
      if (error) {
        console.error('Failed to clear universal wallpaper:', error)
        setWallpaperError('Failed to clear universal wallpaper')
      } else {
        setUniversalPageId(null)
        localStorage.setItem('page_wallpapers', JSON.stringify({ wallpapers, universalPageId: null }))
      }
    } catch (err) {
      console.error('Failed to clear universal wallpaper:', err)
      setWallpaperError('Failed to clear universal wallpaper')
    } finally {
      setWallpaperSaving(false)
    }
  }
  
  // Handle blur change
  const handleBlurChange = async (blurValue) => {
    if (!currentWallpaper) return
    
    // Update local state immediately for responsive UI
    const updatedWallpaper = {
      ...currentWallpaper,
      blur: blurValue
    }
    const newWallpapers = {
      ...wallpapers,
      [activeNavItem]: updatedWallpaper
    }
    setWallpapers(newWallpapers)
    
    // Save to Supabase (debounced would be ideal but keeping it simple)
    try {
      const { error } = await setPageWallpaper(activeNavItem, updatedWallpaper)
      if (error) {
        console.error('Failed to save blur setting:', error)
      }
      // Update localStorage backup
      localStorage.setItem('page_wallpapers', JSON.stringify({ wallpapers: newWallpapers, universalPageId }))
    } catch (err) {
      console.error('Failed to save blur setting:', err)
    }
  }
  
  // Get the label for a page id
  const getPageLabel = (pageId) => {
    const item = navItems.find(n => n.id === pageId)
    return item?.label || pageId
  }
  
  // Handle adding a new tab
  const handleAddTab = async () => {
    if (!newTabName.trim()) return
    
    const success = await addNavItem(newTabName.trim())
    if (success) {
      // Switch to the new tab
      const newId = newTabName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      setActiveNavItem(newId)
      setNewTabName('')
      setShowAddTabModal(false)
    }
  }
  
  // Handle removing a tab
  const handleRemoveTab = async () => {
    const success = await removeNavItem(activeNavItem)
    if (success) {
      // Switch to home after deletion
      setActiveNavItem('home')
      setShowDeleteConfirm(false)
    }
  }

  const selectedItem = navItems.find(item => item.id === activeNavItem)
  const isSelectedHidden = isHidden(activeNavItem)
  const isSelectedLastVisible = isLastVisible(activeNavItem)

  return (
    <div className="p-8 max-w-4xl w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Web UI</h1>
        {saving && (
          <span className="flex items-center gap-2 text-sm text-blue-600">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Saving...
          </span>
        )}
        {error && (
          <span className="text-sm text-red-600 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </span>
        )}
      </div>
      
      {/* Navbar Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="ml-3 text-gray-500">Loading navbar settings...</span>
            </div>
          ) : (
          <>
          {/* Horizontal Tab Navigation */}
          <div className="border-b border-gray-200 mb-4">
            <nav className="flex space-x-8 items-center">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveNavItem(item.id)}
                  className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                    activeNavItem === item.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } ${isHidden(item.id) ? 'opacity-50 line-through' : ''}`}
                >
                  {item.label}
                  {item.isCustom && (
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" title="Custom tab" />
                  )}
                  {isHidden(item.id) && (
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  )}
                </button>
              ))}
              
              {/* Add new tab button */}
              <button
                onClick={() => setShowAddTabModal(true)}
                className="py-3 px-2 border-b-2 border-transparent text-gray-400 hover:text-green-600 hover:border-green-300 transition-colors"
                title="Add new tab"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </nav>
          </div>
          
          {/* Selected item details */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={selectedItem?.label || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Path
                </label>
                <input
                  type="text"
                  value={selectedItem?.path || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500"
                />
              </div>
              
              {/* Hide from navbar checkbox */}
              <div className="pt-2 border-t border-gray-200">
                <label className={`flex items-center gap-3 ${isSelectedLastVisible ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    checked={isSelectedHidden}
                    onChange={() => toggleHidden(activeNavItem)}
                    disabled={isSelectedLastVisible}
                    className={`w-5 h-5 border-gray-300 rounded focus:ring-blue-500 ${
                      isSelectedLastVisible 
                        ? 'text-gray-300 cursor-not-allowed' 
                        : 'text-blue-600 cursor-pointer'
                    }`}
                  />
                  <span className={`text-sm font-medium ${isSelectedLastVisible ? 'text-gray-400' : 'text-gray-700'}`}>
                    Hide from navbar
                  </span>
                </label>
                {isSelectedLastVisible ? (
                  <p className="text-xs text-amber-600 mt-1 ml-8 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    At least one nav item must remain visible
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 mt-1 ml-8">
                    When checked, this item won't appear in the site navigation
                  </p>
                )}
              </div>
              
              {/* Delete tab option */}
              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={!canDeleteItem()}
                  className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    canDeleteItem()
                      ? 'text-red-600 bg-red-50 hover:bg-red-100'
                      : 'text-gray-400 bg-gray-100 cursor-not-allowed'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete this tab
                </button>
                {!canDeleteItem() ? (
                  <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    At least one page must remain on the site
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 mt-2">
                    Deleting will remove this tab from the navbar and all associated settings.
                  </p>
                )}
              </div>

              <p className="text-xs text-green-600 italic text-center mt-4 flex items-center justify-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Changes are automatically saved
              </p>
            </div>
          </div>
          </>
          )}
        </div>
      </div>

      {/* Wallpaper Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900">Page Wallpaper</h3>
            </div>
            {wallpaperSaving && (
              <span className="flex items-center gap-2 text-sm text-blue-600">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </span>
            )}
            {wallpaperError && (
              <span className="flex items-center gap-1 text-sm text-red-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {wallpaperError}
              </span>
            )}
          </div>
          
          <p className="text-sm text-gray-500 mb-4">
            Set a background wallpaper for the <span className="font-semibold">{selectedItem?.label}</span> page
          </p>
          
          {wallpaperLoading ? (
            <div className="flex items-center justify-center py-8">
              <svg className="animate-spin h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : currentWallpaper ? (
            /* Wallpaper Preview */
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
              <div className="flex gap-4">
                {/* Preview thumbnail */}
                <div className="relative w-48 h-32 rounded-lg overflow-hidden border border-gray-300 flex-shrink-0">
                  <img 
                    src={currentWallpaper.url} 
                    alt={currentWallpaper.alt || 'Page wallpaper'}
                    className="w-full h-full object-cover"
                    style={{ filter: currentWallpaper.blur ? `blur(${currentWallpaper.blur}px)` : 'none' }}
                    onError={(e) => {
                      e.target.style.display = 'none'
                      e.target.nextSibling.style.display = 'flex'
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-200" style={{ display: 'none' }}>
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                </div>
                
                {/* Info and actions */}
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">
                      <span className="font-medium">Alt text:</span> {currentWallpaper.alt || 'No alt text'}
                    </p>
                    <p className="text-xs text-gray-400 truncate max-w-xs" title={currentWallpaper.url}>
                      {currentWallpaper.url.length > 50 
                        ? currentWallpaper.url.substring(0, 50) + '...' 
                        : currentWallpaper.url}
                    </p>
                  </div>
                  
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => setShowImagePicker(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Change
                    </button>
                    <button
                      onClick={handleRemoveWallpaper}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Remove
                    </button>
                  </div>
                  
                  {/* Blur Slider */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span className="text-sm font-medium text-gray-700">Blur Effect</span>
                      </div>
                      <span className="text-sm text-gray-500 font-mono">{currentWallpaper.blur || 0}px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      step="1"
                      value={currentWallpaper.blur || 0}
                      onChange={(e) => handleBlurChange(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>None</span>
                      <span>Maximum</span>
                    </div>
                  </div>
                  
                  {/* Universal Wallpaper Toggle */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm font-medium text-gray-700">Universal Wallpaper</span>
                      </div>
                      {universalPageId === activeNavItem ? (
                        <button
                          onClick={handleClearUniversal}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-600 bg-purple-100 rounded-md hover:bg-purple-200 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Currently Default
                        </button>
                      ) : (
                        <button
                          onClick={handleSetUniversal}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                        >
                          Set as Default
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {universalPageId === activeNavItem 
                        ? 'This wallpaper shows on pages without their own wallpaper'
                        : universalPageId
                          ? `Current default: ${getPageLabel(universalPageId)}`
                          : 'Set as default for pages without wallpaper'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : universalPageId && wallpapers[universalPageId] && activeNavItem !== universalPageId ? (
            /* Using universal/default wallpaper */
            <div className="bg-purple-50 rounded-lg border border-purple-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-purple-700">Using default wallpaper from {getPageLabel(universalPageId)}</span>
              </div>
              
              <div className="flex gap-4">
                {/* Preview thumbnail of universal wallpaper */}
                <div className="relative w-32 h-20 rounded-lg overflow-hidden border border-purple-300 flex-shrink-0 opacity-75">
                  <img 
                    src={wallpapers[universalPageId].url} 
                    alt={wallpapers[universalPageId].alt || 'Default wallpaper'}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-purple-500/10" />
                </div>
                
                <div className="flex-1 flex flex-col justify-between">
                  <p className="text-xs text-purple-600">
                    This page will display the default wallpaper. Add a custom wallpaper to override.
                  </p>
                  
                  <button
                    onClick={() => setShowImagePicker(true)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-100 rounded-md hover:bg-purple-200 transition-colors self-start mt-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Custom Wallpaper
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* No wallpaper set and no universal */
            <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
              <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-500 mb-4">No wallpaper set for this page</p>
              <button
                onClick={() => setShowImagePicker(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Wallpaper
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Image Picker Modal */}
      <ImagePicker
        open={showImagePicker}
        onClose={() => setShowImagePicker(false)}
        onConfirm={handleWallpaperSelect}
      />
      
      {/* Universal Wallpaper Confirmation Modal */}
      {showUniversalConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Change Default Wallpaper?</h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              Switching default wallpaper from <span className="font-semibold">{getPageLabel(universalPageId)}</span> to <span className="font-semibold">{getPageLabel(pendingUniversalPageId)}</span>.
              Pages without their own wallpaper will now show the {getPageLabel(pendingUniversalPageId)} wallpaper.
            </p>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowUniversalConfirm(false)
                  setPendingUniversalPageId(null)
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmSetUniversal(pendingUniversalPageId)}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 transition-colors"
              >
                Switch Default
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Add New Tab Modal */}
      {showAddTabModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Add New Tab</h3>
            </div>
            
            <p className="text-gray-600 mb-4">
              Enter a name for the new navigation tab. This will create a new page that you can customize.
            </p>
            
            <input
              type="text"
              value={newTabName}
              onChange={(e) => setNewTabName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTab()}
              placeholder="Tab name (e.g., Portfolio, Gallery)"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 mb-4"
              autoFocus
            />
            
            {newTabName && (
              <p className="text-xs text-gray-500 mb-4">
                Path will be: <code className="bg-gray-100 px-1 py-0.5 rounded">/{newTabName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}</code>
              </p>
            )}
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowAddTabModal(false)
                  setNewTabName('')
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTab}
                disabled={!newTabName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Tab
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete Tab Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Delete Tab?</h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <span className="font-semibold">{selectedItem?.label}</span>? 
              This will remove the tab from the navbar and delete all associated settings including wallpaper and UI layout.
            </p>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveTab}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
              >
                Delete Tab
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UI Builder Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center mb-6">
        <svg className="w-12 h-12 mx-auto mb-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
        <p className="text-lg font-medium text-gray-900 mb-2">UI Builder</p>
        <p className="text-sm text-gray-500 mb-4">
          Customize the layout and UI elements for the <span className="font-semibold">{selectedItem?.label}</span> page
        </p>
        <button
          onClick={() => navigate(`/dashboard/card-builder/${activeNavItem}`)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          Edit Page UI
        </button>
      </div>

      {/* Other sections placeholder */}
      <div className="bg-white rounded-lg shadow-sm border border-dashed border-gray-300 p-8 text-center text-gray-500">
        <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
        <p className="text-lg font-medium">More Customization Options</p>
        <p className="text-sm mt-1">Footer, Branding, Colors, and more coming soon</p>
      </div>
    </div>
  )
}

export default WebUIPage

