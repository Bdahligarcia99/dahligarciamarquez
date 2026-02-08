// client/src/context/NavbarContext.jsx
// Context for managing navbar visibility settings with Supabase persistence
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase'

const NavbarContext = createContext(null)

// Default nav items (fallback when Supabase is not available)
const DEFAULT_NAV_ITEMS = [
  { id: 'home', label: 'Home', path: '/', hidden: false, order: 1 },
  { id: 'journals', label: 'Journals', path: '/blog', hidden: false, order: 2 },
  { id: 'about', label: 'About', path: '/about', hidden: false, order: 3 },
  { id: 'contact', label: 'Contact', path: '/contact', hidden: false, order: 4 },
]

export function NavbarProvider({ children }) {
  const [navItems, setNavItems] = useState(DEFAULT_NAV_ITEMS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  // Fetch navbar items from Supabase on mount
  useEffect(() => {
    async function fetchNavbarItems() {
      if (!isSupabaseConfigured) {
        console.log('📍 NavbarContext: Supabase not configured, using defaults')
        setLoading(false)
        return
      }

      const supabase = getSupabaseClient()
      if (!supabase) {
        setLoading(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'navbar_items')
          .single()

        if (error) {
          // If the setting doesn't exist yet, use defaults
          if (error.code === 'PGRST116') {
            console.log('📍 NavbarContext: No navbar_items setting found, using defaults')
          } else {
            console.error('📍 NavbarContext: Error fetching navbar items:', error)
            setError(error.message)
          }
        } else if (data?.value) {
          console.log('📍 NavbarContext: Loaded navbar items from database')
          setNavItems(data.value)
        }
      } catch (err) {
        console.error('📍 NavbarContext: Fetch error:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchNavbarItems()
  }, [])

  // Compute hidden items map from navItems array
  const hiddenItems = navItems.reduce((acc, item) => {
    acc[item.id] = item.hidden
    return acc
  }, {})

  // Count how many items are currently visible
  const visibleCount = navItems.filter(item => !item.hidden).length

  // Check if this is the last visible item
  const isLastVisible = useCallback((itemId) => {
    return visibleCount === 1 && !hiddenItems[itemId]
  }, [visibleCount, hiddenItems])

  // Toggle visibility and persist to Supabase
  const toggleHidden = useCallback(async (itemId) => {
    // Prevent hiding if this is the last visible item
    if (isLastVisible(itemId)) {
      return false
    }

    // Optimistically update local state
    const updatedItems = navItems.map(item => 
      item.id === itemId ? { ...item, hidden: !item.hidden } : item
    )
    setNavItems(updatedItems)

    // Persist to Supabase if configured
    if (!isSupabaseConfigured) {
      return true
    }

    const supabase = getSupabaseClient()
    if (!supabase) {
      return true
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'navbar_items',
          value: updatedItems,
          description: 'Navbar items configuration - controls which items appear in site navigation'
        }, {
          onConflict: 'key'
        })

      if (error) {
        console.error('📍 NavbarContext: Error saving navbar items:', error)
        // Revert on error
        setNavItems(navItems)
        setError(error.message)
        return false
      }

      console.log('📍 NavbarContext: Saved navbar items to database')
      setError(null)
      return true
    } catch (err) {
      console.error('📍 NavbarContext: Save error:', err)
      // Revert on error
      setNavItems(navItems)
      setError(err.message)
      return false
    } finally {
      setSaving(false)
    }
  }, [navItems, isLastVisible])

  // Update label and persist to Supabase
  const updateLabel = useCallback(async (itemId, newLabel) => {
    const updatedItems = navItems.map(item =>
      item.id === itemId ? { ...item, label: newLabel } : item
    )
    setNavItems(updatedItems)

    if (!isSupabaseConfigured) {
      return true
    }

    const supabase = getSupabaseClient()
    if (!supabase) {
      return true
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'navbar_items',
          value: updatedItems,
          description: 'Navbar items configuration - controls which items appear in site navigation'
        }, {
          onConflict: 'key'
        })

      if (error) {
        console.error('📍 NavbarContext: Error saving navbar label:', error)
        setNavItems(navItems)
        setError(error.message)
        return false
      }

      console.log('📍 NavbarContext: Saved navbar label to database')
      setError(null)
      return true
    } catch (err) {
      console.error('📍 NavbarContext: Save error:', err)
      setNavItems(navItems)
      setError(err.message)
      return false
    } finally {
      setSaving(false)
    }
  }, [navItems])

  const isHidden = useCallback((itemId) => {
    return hiddenItems[itemId] || false
  }, [hiddenItems])

  const getNavItem = useCallback((itemId) => {
    return navItems.find(item => item.id === itemId)
  }, [navItems])

  // Check if item is a custom (user-created) item
  const isCustomItem = useCallback((itemId) => {
    return !DEFAULT_NAV_ITEMS.some(item => item.id === itemId)
  }, [])

  // Add a new nav item
  const addNavItem = useCallback(async (label) => {
    // Generate ID from label (slug format)
    const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    
    // Check if ID already exists
    if (navItems.some(item => item.id === id)) {
      setError('A tab with this name already exists')
      return false
    }
    
    // Calculate next order number
    const maxOrder = Math.max(...navItems.map(item => item.order || 0))
    
    const newItem = {
      id,
      label,
      path: `/${id}`,
      hidden: false,
      order: maxOrder + 1,
      isCustom: true // Mark as user-created
    }
    
    const updatedItems = [...navItems, newItem]
    setNavItems(updatedItems)

    // Persist to Supabase
    if (!isSupabaseConfigured) {
      return true
    }

    const supabase = getSupabaseClient()
    if (!supabase) {
      return true
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'navbar_items',
          value: updatedItems,
          description: 'Navbar items configuration - controls which items appear in site navigation'
        }, {
          onConflict: 'key'
        })

      if (error) {
        console.error('📍 NavbarContext: Error adding nav item:', error)
        setNavItems(navItems) // Revert
        setError(error.message)
        return false
      }

      console.log('📍 NavbarContext: Added new nav item:', newItem)
      setError(null)
      return true
    } catch (err) {
      console.error('📍 NavbarContext: Add error:', err)
      setNavItems(navItems) // Revert
      setError(err.message)
      return false
    } finally {
      setSaving(false)
    }
  }, [navItems])

  // Check if deletion is allowed (at least one page must remain)
  const canDeleteItem = useCallback(() => {
    return navItems.length > 1
  }, [navItems])

  // Remove a nav item (any item can be removed as long as at least one remains)
  const removeNavItem = useCallback(async (itemId) => {
    // Prevent removing the last item
    if (navItems.length <= 1) {
      setError('Cannot remove the last navigation item')
      return false
    }
    
    const updatedItems = navItems.filter(item => item.id !== itemId)
    setNavItems(updatedItems)

    // Persist to Supabase
    if (!isSupabaseConfigured) {
      return true
    }

    const supabase = getSupabaseClient()
    if (!supabase) {
      return true
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'navbar_items',
          value: updatedItems,
          description: 'Navbar items configuration - controls which items appear in site navigation'
        }, {
          onConflict: 'key'
        })

      if (error) {
        console.error('📍 NavbarContext: Error removing nav item:', error)
        setNavItems(navItems) // Revert
        setError(error.message)
        return false
      }

      console.log('📍 NavbarContext: Removed nav item:', itemId)
      setError(null)
      return true
    } catch (err) {
      console.error('📍 NavbarContext: Remove error:', err)
      setNavItems(navItems) // Revert
      setError(err.message)
      return false
    } finally {
      setSaving(false)
    }
  }, [navItems, isCustomItem])

  return (
    <NavbarContext.Provider value={{ 
      navItems,
      hiddenItems, 
      toggleHidden, 
      isHidden, 
      isLastVisible, 
      visibleCount,
      updateLabel,
      getNavItem,
      addNavItem,
      removeNavItem,
      canDeleteItem,
      isCustomItem,
      loading,
      saving,
      error
    }}>
      {children}
    </NavbarContext.Provider>
  )
}

export function useNavbarSettings() {
  const context = useContext(NavbarContext)
  if (!context) {
    // Return default values if context is not available
    return {
      navItems: DEFAULT_NAV_ITEMS,
      hiddenItems: {},
      toggleHidden: () => true,
      isHidden: () => false,
      isLastVisible: () => false,
      visibleCount: 4,
      updateLabel: () => true,
      getNavItem: () => null,
      addNavItem: () => true,
      removeNavItem: () => false,
      canDeleteItem: () => true,
      isCustomItem: () => false,
      loading: false,
      saving: false,
      error: null
    }
  }
  return context
}

