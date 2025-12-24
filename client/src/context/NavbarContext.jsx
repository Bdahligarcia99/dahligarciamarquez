// client/src/context/NavbarContext.jsx
// Context for managing navbar visibility settings
import { createContext, useContext, useState } from 'react'

const NavbarContext = createContext(null)

// All nav item IDs
const ALL_NAV_ITEMS = ['home', 'journals', 'about', 'contact']

export function NavbarProvider({ children }) {
  const [hiddenItems, setHiddenItems] = useState({})

  // Count how many items are currently visible
  const visibleCount = ALL_NAV_ITEMS.filter(id => !hiddenItems[id]).length

  // Check if this is the last visible item
  const isLastVisible = (itemId) => {
    return visibleCount === 1 && !hiddenItems[itemId]
  }

  const toggleHidden = (itemId) => {
    // Prevent hiding if this is the last visible item
    if (isLastVisible(itemId)) {
      return false // Indicate toggle was prevented
    }
    
    setHiddenItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }))
    return true // Indicate toggle succeeded
  }

  const isHidden = (itemId) => {
    return hiddenItems[itemId] || false
  }

  return (
    <NavbarContext.Provider value={{ hiddenItems, toggleHidden, isHidden, isLastVisible, visibleCount }}>
      {children}
    </NavbarContext.Provider>
  )
}

export function useNavbarSettings() {
  const context = useContext(NavbarContext)
  if (!context) {
    // Return default values if context is not available
    return {
      hiddenItems: {},
      toggleHidden: () => true,
      isHidden: () => false,
      isLastVisible: () => false,
      visibleCount: 4
    }
  }
  return context
}

