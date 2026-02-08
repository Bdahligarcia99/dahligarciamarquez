// client/src/features/dashboard/CardBuilderPage.jsx
// Preview page for building cards - shows the page without cards
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { SITE_NAME } from '../../config/branding'
import { 
  saveLayoutSlot, 
  getLayoutSlots, 
  publishLayoutSlot, 
  deleteLayoutSlot, 
  renameLayoutSlot,
  MAX_SLOTS,
  DEFAULT_LAYOUT_SETTINGS 
} from '../../lib/layoutApi'
import { getPageWallpaper, getUniversalWallpaper, setPageWallpaper, removePageWallpaper, setUniversalWallpaper, clearUniversalWallpaper } from '../../lib/wallpaperApi'
import ImagePicker from '../../components/editor/ImagePicker'
import { uploadImage } from '../../utils/uploadImage'

// Grid configuration
const GRID_SPACING = 40 // pixels between anchor points
const GRID_DOT_SIZE = 6 // dot diameter in pixels
const GRID_OFFSET_TOP = 112 // top-28 = 7rem = 112px

// Helper: snap coordinates to nearest grid point
const snapToGrid = (x, y) => {
  const snappedX = Math.round((x - GRID_SPACING / 2) / GRID_SPACING) * GRID_SPACING + GRID_SPACING / 2
  const snappedY = Math.round((y - GRID_SPACING / 2) / GRID_SPACING) * GRID_SPACING + GRID_SPACING / 2
  return { x: snappedX, y: snappedY }
}

// Helper: check if a point is inside any existing card
const isPointInCard = (x, y, cards) => {
  return cards.some(card => {
    const minX = Math.min(...card.points.map(p => p.x))
    const maxX = Math.max(...card.points.map(p => p.x))
    const minY = Math.min(...card.points.map(p => p.y))
    const maxY = Math.max(...card.points.map(p => p.y))
    return x >= minX && x <= maxX && y >= minY && y <= maxY
  })
}

// Helper: create rectangle from 2 corner points (returns all 4 corners in order)
const createRectangleFromCorners = (p1, p2) => {
  // p1 and p2 are opposite corners
  // Create all 4 corners in clockwise order starting from top-left
  const minX = Math.min(p1.x, p2.x)
  const maxX = Math.max(p1.x, p2.x)
  const minY = Math.min(p1.y, p2.y)
  const maxY = Math.max(p1.y, p2.y)
  
  return [
    { x: minX, y: minY }, // top-left
    { x: maxX, y: minY }, // top-right
    { x: maxX, y: maxY }, // bottom-right
    { x: minX, y: maxY }, // bottom-left
  ]
}

// Helper: get card dimensions from points
const getCardDimensions = (points) => {
  const minX = Math.min(...points.map(p => p.x))
  const maxX = Math.max(...points.map(p => p.x))
  const minY = Math.min(...points.map(p => p.y))
  const maxY = Math.max(...points.map(p => p.y))
  return {
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    minX, maxX, minY, maxY
  }
}

// Helper: get card bounds
const getCardBounds = (points) => {
  const minX = Math.min(...points.map(p => p.x))
  const maxX = Math.max(...points.map(p => p.x))
  const minY = Math.min(...points.map(p => p.y))
  const maxY = Math.max(...points.map(p => p.y))
  return { minX, maxX, minY, maxY }
}

// Helper: get font stack from font family key
const getFontStack = (fontFamily) => {
  const fontStacks = {
    sans: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    serif: 'Georgia, Cambria, "Times New Roman", Times, serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    cursive: 'cursive',
    fantasy: 'fantasy',
    times: '"Times New Roman", Times, serif',
    arial: 'Arial, Helvetica, sans-serif',
    courier: '"Courier New", Courier, monospace',
    verdana: 'Verdana, Geneva, sans-serif',
    trebuchet: '"Trebuchet MS", Helvetica, sans-serif',
    impact: 'Impact, Charcoal, sans-serif',
  }
  return fontStacks[fontFamily] || fontStacks.sans
}

// Helper: detect which edge of a card the mouse is near (within threshold)
const detectEdge = (mouseX, mouseY, points, threshold = 10) => {
  const { minX, maxX, minY, maxY } = getCardBounds(points)
  
  // Check if mouse is near any edge
  const nearLeft = Math.abs(mouseX - minX) < threshold && mouseY > minY && mouseY < maxY
  const nearRight = Math.abs(mouseX - maxX) < threshold && mouseY > minY && mouseY < maxY
  const nearTop = Math.abs(mouseY - minY) < threshold && mouseX > minX && mouseX < maxX
  const nearBottom = Math.abs(mouseY - maxY) < threshold && mouseX > minX && mouseX < maxX
  
  if (nearTop) return 'top'
  if (nearRight) return 'right'
  if (nearBottom) return 'bottom'
  if (nearLeft) return 'left'
  return null
}

// Custom resize cursor SVG (4 diagonal arrows pointing outward)
const RESIZE_CURSOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4l5 5M4 4h4M4 4v4"/><path d="M20 4l-5 5M20 4h-4M20 4v4"/><path d="M4 20l5-5M4 20h4M4 20v-4"/><path d="M20 20l-5-5M20 20h-4M20 20v-4"/></svg>`
const RESIZE_CURSOR = `url('data:image/svg+xml;utf8,${encodeURIComponent(RESIZE_CURSOR_SVG)}') 12 12, nwse-resize`

const CardBuilderPage = () => {
  const { pageId } = useParams()
  const navigate = useNavigate()
  const [scrollProgress, setScrollProgress] = useState(0)
  const [toolbarMode, setToolbarMode] = useState(false)
  const [showGrid, setShowGrid] = useState(false)
  const [pencilMode, setPencilMode] = useState(false)
  const [eraserMode, setEraserMode] = useState(false)
  const [moveMode, setMoveMode] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [resizeMode, setResizeMode] = useState(false)
  const [inspectorMode, setInspectorMode] = useState(false)
  const [conveyorMode, setConveyorMode] = useState(false)
  const [propertiesMode, setPropertiesMode] = useState(false)
  const [propertiesTab, setPropertiesTab] = useState('content') // 'content', 'capabilities', 'effects', or 'system'
  const [elementsSubTab, setElementsSubTab] = useState('text') // 'text', 'image', or 'media'
  const [showMoreFonts, setShowMoreFonts] = useState(false) // Expanded font picker
  const [isolatedCardId, setIsolatedCardId] = useState(null) // Card in isolation mode
  const [selectedTextBoxId, setSelectedTextBoxId] = useState(null) // Selected text box for editing
  const [editingTextBoxId, setEditingTextBoxId] = useState(null) // Text box being typed in
  const [isolationDragTextBox, setIsolationDragTextBox] = useState(null) // Dragging text box state
  const [isolationResizeTextBox, setIsolationResizeTextBox] = useState(null) // Resizing text box state
  const [currentPoints, setCurrentPoints] = useState([]) // Points being placed (max 4)
  const [cards, setCards] = useState([]) // Completed cards
  const [actionHistory, setActionHistory] = useState([]) // History of actions for undo/redo
  const [historyIndex, setHistoryIndex] = useState(-1) // Current position in history (-1 = at present)
  const [deletedCardsBackup, setDeletedCardsBackup] = useState(null) // Backup of all cards when "delete all" is used
  const [hoveredPointIndex, setHoveredPointIndex] = useState(null) // Track hovered anchor point
  const [hoveredCardId, setHoveredCardId] = useState(null) // Track hovered card for eraser/move/select
  const [inspectedCardId, setInspectedCardId] = useState(null) // Track card being inspected with pencil tool
  const [activeCardId, setActiveCardId] = useState(null) // Track card being edited with pencil tool styling
  const [mousePos, setMousePos] = useState(null) // Track mouse position for preview
  
  // Pencil tool card styling settings
  const defaultCardStyle = {
    backgroundColor: '#ffffff',
    opacity: 1,
    borderRadius: 0,
    borderWidth: 0,
    borderStyle: 'solid',
    borderColor: '#000000'
  }
  const [pencilSettings, setPencilSettings] = useState(defaultCardStyle)
  const [previewSettings, setPreviewSettings] = useState(null) // Live preview before apply
  const [pencilSettingsLocked, setPencilSettingsLocked] = useState(false) // Lock settings for new cards
  const [selectedCardId, setSelectedCardId] = useState(null) // Track selected card for move
  const [selectedCards, setSelectedCards] = useState([]) // Track selected cards with select tool
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState(null) // Where the drag started
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 }) // Current drag offset
  const [hoveredEdge, setHoveredEdge] = useState(null) // { cardId, edge: 'top'|'right'|'bottom'|'left' }
  const [resizingEdge, setResizingEdge] = useState(null) // Currently being resized
  const [resizeOffset, setResizeOffset] = useState(0) // Offset while resizing
  const [showSettingsPane, setShowSettingsPane] = useState(false) // Settings side panel
  const [scrollRatio, setScrollRatio] = useState(2) // Conveyor:Wallpaper ratio (2 = 2:1)
  const [scrollSpeed, setScrollSpeed] = useState(1) // Scroll velocity multiplier (1 = normal)
  const [wallpaperPosition, setWallpaperPosition] = useState(0) // 0-100%, where wallpaper scroll window starts on conveyor
  const [isDraggingWallpaper, setIsDraggingWallpaper] = useState(false) // Dragging the wallpaper slider
  const [alignmentMargin, setAlignmentMargin] = useState(1) // Edge margin in grid units (1 = 40px)
  const [verticalAlignMode, setVerticalAlignMode] = useState('conveyor') // 'conveyor' or 'viewport'
  const [isSaving, setIsSaving] = useState(false) // Saving state
  const [isLoading, setIsLoading] = useState(true) // Loading state
  const [saveMessage, setSaveMessage] = useState(null) // { type: 'success' | 'error', text: string }
  const [currentWallpaper, setCurrentWallpaper] = useState(null) // Wallpaper from Supabase { url, alt, blur }
  const [layoutSlots, setLayoutSlots] = useState([]) // All saved layout slots
  const [currentSlot, setCurrentSlot] = useState(null) // Currently selected slot { slot_number, name }
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false) // Track unsaved changes
  const [showSlotWarning, setShowSlotWarning] = useState(false) // Warning modal for switching slots
  const [pendingSlotSwitch, setPendingSlotSwitch] = useState(null) // Slot to switch to after warning
  const [editingSlotName, setEditingSlotName] = useState(null) // Slot being renamed
  const [saveMode, setSaveMode] = useState(false) // Save/Manage layouts mode active
  const [hideSlotContents, setHideSlotContents] = useState(false) // Hide cards when managing layouts
  
  // Settings Pane State Management
  // settingsPaneOwner tracks which tool's settings are displayed ('pencil', 'move', 'properties', 'save', 'conveyor', or null)
  const [settingsPaneOwner, setSettingsPaneOwner] = useState(null)
  // For Move tool stacking in isolation mode
  const [moveSettingsStacked, setMoveSettingsStacked] = useState(false)
  const [previousSettingsOwner, setPreviousSettingsOwner] = useState(null)
  
  // Global Settings Dialog State
  const [showGlobalSettings, setShowGlobalSettings] = useState(false)
  const [globalSettingsSummaryExpanded, setGlobalSettingsSummaryExpanded] = useState(true)
  
  // Wallpaper Management State
  const [wallpaperBlur, setWallpaperBlur] = useState(0) // Blur amount in pixels (0-20)
  const [isUniversalWallpaper, setIsUniversalWallpaper] = useState(false) // Is current page's wallpaper the universal default?
  const [isUsingFallbackWallpaper, setIsUsingFallbackWallpaper] = useState(false) // Is page using the universal fallback?
  const [universalSourcePageId, setUniversalSourcePageId] = useState(null) // Page ID that is the source of universal wallpaper
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false)
  const [wallpaperSaving, setWallpaperSaving] = useState(false)
  const [wallpaperError, setWallpaperError] = useState(null)
  
  // Image Slots/Elements State
  // Each slot links 1:1 with an image element on the card
  // Structure: { id, imageElementId, url?, alt?, assigned: boolean }
  const [imageSlots, setImageSlots] = useState([])
  const [activeImageSlotId, setActiveImageSlotId] = useState(null) // Currently active slot
  const [selectedCardImageId, setSelectedCardImageId] = useState(null) // Selected image element on card
  const [showCardImagePicker, setShowCardImagePicker] = useState(false) // ImagePicker for card images
  const [editingSlotId, setEditingSlotId] = useState(null) // Which slot is being edited via picker
  
  const containerRef = useRef(null)
  const gridRef = useRef(null)
  const wallpaperTrackRef = useRef(null)

  // Base wallpaper height
  const baseWallpaperHeight = 150 // vh
  
  // Calculate conveyor length based on ratio
  // Ratio 1:1 = conveyor matches wallpaper (150vh)
  // Ratio 2:1 = conveyor is 2x wallpaper (300vh)
  // Ratio 3:1 = conveyor is 3x wallpaper (450vh)
  const conveyorLength = baseWallpaperHeight * scrollRatio
  
  // Calculate max wallpaper position (percentage)
  // At ratio 2:1, wallpaper (150vh) can slide from 0% to 50% of conveyor (300vh)
  const maxWallpaperPositionPercent = Math.max(0, ((conveyorLength - baseWallpaperHeight) / conveyorLength) * 100)
  
  // Ratio presets
  const ratioPresets = [
    { name: '1:1', ratio: 1, description: 'No parallax, move together' },
    { name: '2:1', ratio: 2, description: 'Subtle depth' },
    { name: '3:1', ratio: 3, description: 'Medium depth' },
    { name: '4:1', ratio: 4, description: 'Strong depth' },
    { name: '5:1', ratio: 5, description: 'Deep parallax' },
  ]
  
  // Speed presets
  const speedPresets = [
    { name: '0.25x', speed: 0.25, description: 'Very slow' },
    { name: '0.5x', speed: 0.5, description: 'Slow' },
    { name: '1x', speed: 1, description: 'Normal' },
    { name: '1.5x', speed: 1.5, description: 'Fast' },
    { name: '2x', speed: 2, description: 'Very fast' },
    { name: '3x', speed: 3, description: 'Ultra fast' },
  ]

  // Load all layout slots and wallpaper on mount
  useEffect(() => {
    const loadSlots = async () => {
      setIsLoading(true)
      try {
        // Load layout slots
        const { data: slots, error } = await getLayoutSlots(pageId)
        if (error) {
          console.error('Failed to load layout slots:', error)
        } else if (slots && slots.length > 0) {
          setLayoutSlots(slots)
          // Load the first slot (or published one if exists)
          const publishedSlot = slots.find(s => s.is_published) || slots[0]
          loadSlotData(publishedSlot)
          setCurrentSlot({ slot_number: publishedSlot.slot_number, name: publishedSlot.name })
          console.log('✅ Layout slots loaded for page:', pageId)
        } else {
          // No slots yet - start fresh
          setLayoutSlots([])
          setCurrentSlot(null)
        }
        
        // Load page wallpaper (with universal fallback)
        const { data: wallpaper, error: wallpaperError } = await getPageWallpaper(pageId)
        const { data: universal } = await getUniversalWallpaper()
        
        if (wallpaperError) {
          console.error('Failed to load page wallpaper:', wallpaperError)
        } else if (wallpaper) {
          setCurrentWallpaper(wallpaper)
          setWallpaperBlur(wallpaper.blur || 0)
          // Check if this page's wallpaper is the universal default
          setIsUniversalWallpaper(universal?.pageId === pageId)
          setIsUsingFallbackWallpaper(false)
          setUniversalSourcePageId(universal?.pageId || null)
          console.log('✅ Page wallpaper loaded for page:', pageId, wallpaper)
        } else if (universal?.wallpaper) {
          // Fallback to universal wallpaper
          setCurrentWallpaper(universal.wallpaper)
          setWallpaperBlur(universal.wallpaper.blur || 0)
          setIsUniversalWallpaper(false)
          setIsUsingFallbackWallpaper(true)
          setUniversalSourcePageId(universal.pageId)
          console.log('✅ Using universal wallpaper for page:', pageId, universal.wallpaper)
        } else {
          // No wallpaper at all
          setCurrentWallpaper(null)
          setIsUniversalWallpaper(false)
          setIsUsingFallbackWallpaper(false)
          setUniversalSourcePageId(null)
        }
      } catch (err) {
        console.error('Error loading layout slots:', err)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadSlots()
  }, [pageId])

  // Helper to load data from a slot into the editor
  const loadSlotData = (slot) => {
    if (slot.cards && Array.isArray(slot.cards)) {
      setCards(slot.cards)
      setDeletedCardsBackup(null)
    } else {
      setCards([])
    }
    if (slot.settings) {
      if (slot.settings.scrollRatio !== undefined) setScrollRatio(slot.settings.scrollRatio)
      if (slot.settings.scrollSpeed !== undefined) setScrollSpeed(slot.settings.scrollSpeed)
      if (slot.settings.wallpaperPosition !== undefined) setWallpaperPosition(slot.settings.wallpaperPosition)
      if (slot.settings.alignmentMargin !== undefined) setAlignmentMargin(slot.settings.alignmentMargin)
    }
    setHasUnsavedChanges(false)
  }

  // Track changes to mark as unsaved
  useEffect(() => {
    if (!isLoading && currentSlot) {
      setHasUnsavedChanges(true)
    }
  }, [cards, scrollRatio, scrollSpeed, wallpaperPosition, alignmentMargin])

  // Switch to a different slot
  const switchToSlot = (slot) => {
    if (hasUnsavedChanges && currentSlot) {
      // Show warning
      setShowSlotWarning(true)
      setPendingSlotSwitch(slot)
    } else {
      // Switch directly
      loadSlotData(slot)
      setCurrentSlot({ slot_number: slot.slot_number, name: slot.name })
    }
  }

  // Confirm slot switch (discard changes)
  const confirmSlotSwitch = () => {
    if (pendingSlotSwitch) {
      loadSlotData(pendingSlotSwitch)
      setCurrentSlot({ slot_number: pendingSlotSwitch.slot_number, name: pendingSlotSwitch.name })
    }
    setShowSlotWarning(false)
    setPendingSlotSwitch(null)
  }

  // Cancel slot switch
  const cancelSlotSwitch = () => {
    setShowSlotWarning(false)
    setPendingSlotSwitch(null)
  }

  // Create a new slot
  const createNewSlot = () => {
    if (layoutSlots.length >= MAX_SLOTS) {
      setSaveMessage({ type: 'error', text: `Maximum ${MAX_SLOTS} slots reached` })
      setTimeout(() => setSaveMessage(null), 3000)
      return
    }
    
    const nextNum = layoutSlots.length > 0 
      ? Math.max(...layoutSlots.map(s => s.slot_number)) + 1 
      : 1
    
    // Check for unsaved changes first
    if (hasUnsavedChanges && currentSlot) {
      setShowSlotWarning(true)
      setPendingSlotSwitch({ slot_number: nextNum, name: `Layout ${nextNum}`, cards: [], settings: DEFAULT_LAYOUT_SETTINGS, isNew: true })
    } else {
      // Create new empty slot
      setCards([])
      setScrollRatio(DEFAULT_LAYOUT_SETTINGS.scrollRatio)
      setScrollSpeed(DEFAULT_LAYOUT_SETTINGS.scrollSpeed)
      setWallpaperPosition(DEFAULT_LAYOUT_SETTINGS.wallpaperPosition)
      setAlignmentMargin(DEFAULT_LAYOUT_SETTINGS.alignmentMargin)
      setCurrentSlot({ slot_number: nextNum, name: `Layout ${nextNum}`, isNew: true })
      setHasUnsavedChanges(false)
    }
  }

  // Save layout function (quick save to current slot)
  const handleSaveLayout = useCallback(async () => {
    setIsSaving(true)
    setSaveMessage(null)
    
    try {
      const settings = {
        scrollRatio,
        scrollSpeed,
        wallpaperPosition,
        alignmentMargin
      }
      
      // Determine slot number and name
      const slotNumber = currentSlot?.slot_number || 1
      const slotName = currentSlot?.name || 'Layout 1'
      
      const { data, error } = await saveLayoutSlot(pageId, slotNumber, slotName, cards, settings)
      
      if (error) {
        setSaveMessage({ type: 'error', text: 'Failed to save layout' })
        console.error('Save error:', error)
      } else {
        setSaveMessage({ type: 'success', text: `Saved to "${slotName}"` })
        setHasUnsavedChanges(false)
        
        // Update slots list
        const updatedSlots = layoutSlots.some(s => s.slot_number === slotNumber)
          ? layoutSlots.map(s => s.slot_number === slotNumber ? data : s)
          : [...layoutSlots, data]
        setLayoutSlots(updatedSlots)
        
        // Update current slot if it was new
        if (currentSlot?.isNew) {
          setCurrentSlot({ slot_number: slotNumber, name: slotName })
        }
        
        console.log('✅ Layout saved:', data)
      }
    } catch (err) {
      setSaveMessage({ type: 'error', text: 'Failed to save layout' })
      console.error('Save error:', err)
    } finally {
      setIsSaving(false)
      setTimeout(() => setSaveMessage(null), 3000)
    }
  }, [pageId, cards, scrollRatio, scrollSpeed, wallpaperPosition, alignmentMargin, currentSlot, layoutSlots])

  // Open save/manage layouts panel
  const openSavePanel = () => {
    setSaveMode(true)
    // Save HAS settings - take ownership of settings pane
    setSettingsPaneOwner('save')
    setShowSettingsPane(true)
    setMoveSettingsStacked(false)
  }

  // Publish layout function (publishes the selected slot)
  const handlePublishLayout = useCallback(async () => {
    if (!currentSlot) {
      setSaveMessage({ type: 'error', text: 'No layout selected to publish' })
      setTimeout(() => setSaveMessage(null), 3000)
      return
    }
    
    setIsSaving(true)
    setSaveMessage(null)
    
    try {
      const settings = {
        scrollRatio,
        scrollSpeed,
        wallpaperPosition,
        alignmentMargin
      }
      
      // Save first
      const { error: saveError } = await saveLayoutSlot(
        pageId, 
        currentSlot.slot_number, 
        currentSlot.name, 
        cards, 
        settings
      )
      if (saveError) {
        setSaveMessage({ type: 'error', text: 'Failed to save before publishing' })
        return
      }
      
      // Then publish this slot
      const { data, error: publishError } = await publishLayoutSlot(pageId, currentSlot.slot_number)
      if (publishError) {
        setSaveMessage({ type: 'error', text: 'Failed to publish layout' })
      } else {
        setSaveMessage({ type: 'success', text: `"${currentSlot.name}" published!` })
        setHasUnsavedChanges(false)
        
        // Update slots to reflect published state
        setLayoutSlots(layoutSlots.map(s => ({
          ...s,
          is_published: s.slot_number === currentSlot.slot_number
        })))
      }
    } catch (err) {
      setSaveMessage({ type: 'error', text: 'Failed to publish layout' })
      console.error('Publish error:', err)
    } finally {
      setIsSaving(false)
      setTimeout(() => setSaveMessage(null), 3000)
    }
  }, [pageId, cards, scrollRatio, scrollSpeed, wallpaperPosition, alignmentMargin, currentSlot, layoutSlots])

  // Delete a slot
  const handleDeleteSlot = async (slotNumber) => {
    if (layoutSlots.length <= 1) {
      setSaveMessage({ type: 'error', text: 'Cannot delete the last layout' })
      setTimeout(() => setSaveMessage(null), 3000)
      return
    }
    
    try {
      const { success, error } = await deleteLayoutSlot(pageId, slotNumber)
      if (error) {
        setSaveMessage({ type: 'error', text: 'Failed to delete layout' })
      } else {
        const updatedSlots = layoutSlots.filter(s => s.slot_number !== slotNumber)
        setLayoutSlots(updatedSlots)
        
        // If we deleted the current slot, switch to another
        if (currentSlot?.slot_number === slotNumber && updatedSlots.length > 0) {
          switchToSlot(updatedSlots[0])
        }
        
        setSaveMessage({ type: 'success', text: 'Layout deleted' })
      }
    } catch (err) {
      setSaveMessage({ type: 'error', text: 'Failed to delete layout' })
    }
    setTimeout(() => setSaveMessage(null), 3000)
  }

  // Rename a slot
  const handleRenameSlot = async (slotNumber, newName) => {
    try {
      const { data, error } = await renameLayoutSlot(pageId, slotNumber, newName)
      if (error) {
        setSaveMessage({ type: 'error', text: 'Failed to rename layout' })
      } else {
        setLayoutSlots(layoutSlots.map(s => 
          s.slot_number === slotNumber ? { ...s, name: newName } : s
        ))
        if (currentSlot?.slot_number === slotNumber) {
          setCurrentSlot({ ...currentSlot, name: newName })
        }
      }
    } catch (err) {
      setSaveMessage({ type: 'error', text: 'Failed to rename layout' })
    }
    setEditingSlotName(null)
  }

  // Delete a specific anchor point by index
  const deletePoint = (index) => {
    // Remove the point and all points after it (since later points depend on earlier ones)
    setCurrentPoints(currentPoints.slice(0, index))
  }

  // Delete a card by id (used by eraser tool)
  const deleteCard = (cardId) => {
    const cardToDelete = cards.find(card => card.id === cardId)
    if (cardToDelete) {
      // Record action for undo
      addToHistory({
        type: 'delete',
        cardId,
        card: cardToDelete
      })
      setCards(cards.filter(card => card.id !== cardId))
    }
  }

  // Add action to history (clears any redo history)
  const addToHistory = (action) => {
    // If we're not at the end of history, truncate forward history
    const newHistory = historyIndex >= 0 
      ? actionHistory.slice(0, actionHistory.length - historyIndex)
      : actionHistory
    setActionHistory([...newHistory, action])
    setHistoryIndex(-1) // Reset to present
  }

  // Undo - reverse the last action OR restore all deleted cards
  const undoAction = () => {
    // If no cards but we have a backup from "delete all", restore them
    if (cards.length === 0 && deletedCardsBackup && deletedCardsBackup.length > 0) {
      setCards(deletedCardsBackup)
      setDeletedCardsBackup(null)
      return
    }
    
    // Find the action to undo
    const undoIndex = historyIndex >= 0 ? historyIndex + 1 : 0
    if (undoIndex >= actionHistory.length) return
    
    const action = actionHistory[actionHistory.length - 1 - undoIndex]
    if (!action) return
    
    // Reverse the action
    switch (action.type) {
      case 'create':
        // Remove the created card
        setCards(cards.filter(c => c.id !== action.cardId))
        break
      case 'delete':
        // Restore the deleted card
        setCards([...cards, action.card])
        break
      case 'move':
        // Reverse the move
        setCards(cards.map(c => 
          c.id === action.cardId 
            ? { ...c, points: c.points.map(p => ({ x: p.x - action.offsetX, y: p.y - action.offsetY })) }
            : c
        ))
        break
      case 'resize':
        // Restore original points
        setCards(cards.map(c => 
          c.id === action.cardId 
            ? { ...c, points: action.originalPoints }
            : c
        ))
        break
      case 'textbox_create':
        // Remove the created text box
        setCards(cards.map(c => {
          if (c.id !== action.cardId) return c
          return { ...c, textBoxes: (c.textBoxes || []).filter(tb => tb.id !== action.textBoxId) }
        }))
        setSelectedTextBoxId(null)
        break
      case 'textbox_delete':
        // Restore the deleted text box
        setCards(cards.map(c => {
          if (c.id !== action.cardId) return c
          return { ...c, textBoxes: [...(c.textBoxes || []), action.textBox] }
        }))
        break
      case 'textbox_move':
        // Reverse the text box move
        setCards(cards.map(c => {
          if (c.id !== action.cardId) return c
          return {
            ...c,
            textBoxes: (c.textBoxes || []).map(tb =>
              tb.id === action.textBoxId ? { ...tb, x: action.startX, y: action.startY } : tb
            )
          }
        }))
        break
      case 'textbox_resize':
        // Restore original text box size
        setCards(cards.map(c => {
          if (c.id !== action.cardId) return c
          return {
            ...c,
            textBoxes: (c.textBoxes || []).map(tb =>
              tb.id === action.textBoxId ? { ...tb, ...action.originalProps } : tb
            )
          }
        }))
        break
      case 'textbox_delete_all':
        // Restore all deleted text boxes
        setCards(cards.map(c => {
          if (c.id !== action.cardId) return c
          return { ...c, textBoxes: action.textBoxes }
        }))
        break
      case 'style':
        // Restore old style
        setCards(cards.map(c => 
          c.id === action.cardId 
            ? { ...c, style: action.oldStyle }
            : c
        ))
        break
    }
    
    setHistoryIndex(undoIndex)
  }
  
  // Check if undo has something to restore
  const canUndo = (
    (historyIndex < 0 && actionHistory.length > 0) || 
    (historyIndex >= 0 && historyIndex < actionHistory.length - 1) ||
    (deletedCardsBackup && deletedCardsBackup.length > 0)
  )
  
  // Count of undoable actions
  const undoCount = historyIndex >= 0 
    ? actionHistory.length - 1 - historyIndex 
    : actionHistory.length

  // Redo - reapply the last undone action
  const redoAction = () => {
    if (historyIndex < 0) return // Nothing to redo
    
    const action = actionHistory[actionHistory.length - historyIndex]
    if (!action) return
    
    // Reapply the action
    switch (action.type) {
      case 'create':
        // Re-add the created card
        setCards([...cards, action.card])
        break
      case 'delete':
        // Re-delete the card
        setCards(cards.filter(c => c.id !== action.cardId))
        break
      case 'move':
        // Reapply the move
        setCards(cards.map(c => 
          c.id === action.cardId 
            ? { ...c, points: c.points.map(p => ({ x: p.x + action.offsetX, y: p.y + action.offsetY })) }
            : c
        ))
        break
      case 'resize':
        // Reapply resize (use new points)
        setCards(cards.map(c => 
          c.id === action.cardId 
            ? { ...c, points: action.newPoints }
            : c
        ))
        break
      case 'textbox_create':
        // Re-add the created text box
        setCards(cards.map(c => {
          if (c.id !== action.cardId) return c
          return { ...c, textBoxes: [...(c.textBoxes || []), action.textBox] }
        }))
        break
      case 'textbox_delete':
        // Re-delete the text box
        setCards(cards.map(c => {
          if (c.id !== action.cardId) return c
          return { ...c, textBoxes: (c.textBoxes || []).filter(tb => tb.id !== action.textBoxId) }
        }))
        setSelectedTextBoxId(null)
        break
      case 'textbox_move':
        // Reapply the text box move
        setCards(cards.map(c => {
          if (c.id !== action.cardId) return c
          return {
            ...c,
            textBoxes: (c.textBoxes || []).map(tb =>
              tb.id === action.textBoxId ? { ...tb, x: action.endX, y: action.endY } : tb
            )
          }
        }))
        break
      case 'textbox_resize':
        // Reapply text box resize
        setCards(cards.map(c => {
          if (c.id !== action.cardId) return c
          return {
            ...c,
            textBoxes: (c.textBoxes || []).map(tb =>
              tb.id === action.textBoxId ? { ...tb, ...action.newProps } : tb
            )
          }
        }))
        break
      case 'textbox_delete_all':
        // Re-delete all text boxes
        setCards(cards.map(c => {
          if (c.id !== action.cardId) return c
          return { ...c, textBoxes: [] }
        }))
        setSelectedTextBoxId(null)
        break
      case 'style':
        // Reapply new style
        setCards(cards.map(c => 
          c.id === action.cardId 
            ? { ...c, style: action.newStyle }
            : c
        ))
        break
    }
    
    setHistoryIndex(historyIndex - 1)
  }
  
  // Count of redoable actions
  const redoCount = historyIndex >= 0 ? historyIndex + 1 : 0

  // Delete all cards (with backup for undo)
  const deleteAllCards = () => {
    if (cards.length > 0) {
      setDeletedCardsBackup(cards) // Save backup before deleting
    }
    setCards([])
    setActionHistory([]) // Clear action history
    setHistoryIndex(-1)
    setSelectedCards([])
    setSelectedCardId(null)
    setHoveredCardId(null)
  }

  // Toggle between tools (mutually exclusive)
  // Tools WITH settings: pencil, properties, move, save, conveyor
  // Tools WITHOUT settings: eraser, select, resize
  //
  // KEY RULES:
  // 1. Outside isolation mode: single-provider only, no stacking
  // 2. Inside isolation mode: stacking allowed (Move can overlay)
  // 3. Tools without settings NEVER change settingsPaneOwner
  // 4. Deactivating a tool clears it as owner (unless in isolation with stacking)
  
  const activatePencil = () => {
    setPencilMode(true)
    setEraserMode(false)
    setMoveMode(false)
    setSelectMode(false)
    setResizeMode(false)
    setPropertiesMode(false)
    // Inspector mode stays independent - don't turn it off
    setConveyorMode(false)
    setSelectedCardId(null)
    setSelectedCards([])
    // Don't exit isolation mode - tools should work on text boxes
    // Grid is optional - user can toggle manually
    // Pencil HAS settings - take ownership (but don't auto-open)
    setSettingsPaneOwner('pencil')
    setMoveSettingsStacked(false)
  }
  
  // Deactivate Pencil and clear ownership if it was the owner
  const deactivatePencil = () => {
    setPencilMode(false)
    setActiveCardId(null)
    setPreviewSettings(null)
    // Clear ownership if Pencil was the owner
    if (settingsPaneOwner === 'pencil') {
      setSettingsPaneOwner(null)
    }
  }

  const activateEraser = () => {
    setEraserMode(true)
    setPencilMode(false)
    setMoveMode(false)
    setSelectMode(false)
    setResizeMode(false)
    setPropertiesMode(false)
    // Inspector mode stays independent
    setConveyorMode(false)
    setSelectedCardId(null)
    setSelectedCards([])
    setCurrentPoints([]) // Clear any in-progress drawing
    setActiveCardId(null) // Clear active card for pencil styling
    setPreviewSettings(null)
    // Note: Eraser can work in isolation mode for text boxes, so don't exit
    // Eraser has NO settings - DO NOT change settingsPaneOwner
    setMoveSettingsStacked(false)
  }

  const activateSelect = () => {
    setSelectMode(true)
    setPencilMode(false)
    setEraserMode(false)
    setMoveMode(false)
    setResizeMode(false)
    // Inspector mode stays independent
    setConveyorMode(false)
    setSelectedCardId(null)
    setCurrentPoints([])
    setActiveCardId(null) // Clear active card for pencil styling
    setPreviewSettings(null)
    // Select has NO settings - DO NOT change settingsPaneOwner
    setMoveSettingsStacked(false)
  }

  // Move tool behavior depends on isolation mode:
  // OUTSIDE isolation: Normal tool toggle (no stacking, Move becomes/clears owner)
  // INSIDE isolation: 3-state toggle with stacking
  const handleMoveToolClick = () => {
    if (!isolatedCardId) {
      // OUTSIDE isolation mode: Normal tool toggle (no stacking)
      if (moveMode) {
        // Deactivate Move and clear ownership if it was the owner
        setMoveMode(false)
        if (settingsPaneOwner === 'move') {
          setSettingsPaneOwner(null)
        }
      } else {
        // Activate Move as normal tool with settings
        setMoveMode(true)
        setPencilMode(false)
        setEraserMode(false)
        setSelectMode(false)
        setResizeMode(false)
        setPropertiesMode(false)
        setConveyorMode(false)
        setSelectedCards([])
        setCurrentPoints([])
        setActiveCardId(null)
        setPreviewSettings(null)
        // Move HAS settings - take ownership (single provider, no stacking)
        setSettingsPaneOwner('move')
        setMoveSettingsStacked(false)
      }
      return
    }
    
    // INSIDE isolation mode: 3-state toggle with stacking
    if (!moveMode) {
      // State 1: First click - activate Move without changing settings pane
      setMoveMode(true)
      setPencilMode(false)
      setEraserMode(false)
      setSelectMode(false)
      setResizeMode(false)
      // DON'T set propertiesMode to false - let it stay if it was active
      setConveyorMode(false)
      setSelectedCards([])
      setCurrentPoints([])
      setActiveCardId(null)
      setPreviewSettings(null)
      // DON'T change settingsPaneOwner - preserve current pane contents
      setMoveSettingsStacked(false)
    } else if (!moveSettingsStacked) {
      // State 2: Second click - keep Move active, stack Move settings
      setPreviousSettingsOwner(settingsPaneOwner)
      setMoveSettingsStacked(true)
      // Open settings pane if not already open
      if (!showSettingsPane) {
        setShowSettingsPane(true)
      }
    } else {
      // State 3: Third click - deactivate Move, remove only Move settings
      setMoveMode(false)
      setMoveSettingsStacked(false)
      // Settings pane reverts to showing only the primary owner (no change needed)
    }
  }

  // Legacy activateMove for internal use (when called from other places)
  const activateMove = () => {
    setMoveMode(true)
    setPencilMode(false)
    setEraserMode(false)
    setSelectMode(false)
    setResizeMode(false)
    setPropertiesMode(false)
    // Inspector mode stays independent
    setConveyorMode(false)
    setSelectedCards([])
    setCurrentPoints([]) // Clear any in-progress drawing
    setActiveCardId(null) // Clear active card for pencil styling
    setPreviewSettings(null)
    // Don't exit isolation mode - tools should work on text boxes
    setSettingsPaneOwner('move')
    setMoveSettingsStacked(false)
  }

  const activateResize = () => {
    setResizeMode(true)
    setPencilMode(false)
    setEraserMode(false)
    setMoveMode(false)
    setSelectMode(false)
    setPropertiesMode(false)
    // Inspector mode stays independent
    setConveyorMode(false)
    setSelectedCardId(null)
    setSelectedCards([])
    setCurrentPoints([])
    setActiveCardId(null) // Clear active card for pencil styling
    setPreviewSettings(null)
    // Don't exit isolation mode - tools should work on text boxes
    // Resize has NO settings - DO NOT change settingsPaneOwner
    setMoveSettingsStacked(false)
  }

  // Inspector is now a toggle overlay - doesn't affect other tools
  const toggleInspector = () => {
    setInspectorMode(!inspectorMode)
  }

  const activateConveyor = () => {
    setConveyorMode(true)
    setPencilMode(false)
    setEraserMode(false)
    setMoveMode(false)
    setSelectMode(false)
    setResizeMode(false)
    setPropertiesMode(false)
    // Inspector mode stays independent
    setSelectedCardId(null)
    setSelectedCards([])
    setCurrentPoints([])
    setActiveCardId(null) // Clear active card for pencil styling
    setPreviewSettings(null)
    // Conveyor HAS settings - take ownership
    setSettingsPaneOwner('conveyor')
    setShowSettingsPane(true) // Auto-open settings pane
    setMoveSettingsStacked(false)
  }

  const activateProperties = () => {
    setPropertiesMode(true)
    setPencilMode(false)
    setEraserMode(false)
    setMoveMode(false)
    setSelectMode(false)
    setResizeMode(false)
    setConveyorMode(false)
    // Inspector mode stays independent
    setSelectedCardId(null)
    setSelectedCards([])
    setCurrentPoints([])
    setActiveCardId(null) // Clear active card for pencil styling
    setPreviewSettings(null)
    // Properties HAS settings - take ownership
    setSettingsPaneOwner('properties')
    setShowSettingsPane(true) // Auto-open settings pane for properties
    setMoveSettingsStacked(false)
  }
  
  // Deactivate Properties and clear ownership if it was the owner
  const deactivateProperties = () => {
    setPropertiesMode(false)
    // Clear ownership if Properties was the owner (and not in isolation mode where persistence is allowed)
    if (settingsPaneOwner === 'properties' && !isolatedCardId) {
      setSettingsPaneOwner(null)
    }
  }

  // Exit isolation mode
  const exitIsolationMode = () => {
    setIsolatedCardId(null)
    setSelectedTextBoxId(null)
    setEditingTextBoxId(null)
    setIsolationDragTextBox(null)
    setIsolationResizeTextBox(null)
    // Clear stacked Move settings when exiting isolation
    if (moveSettingsStacked) {
      setMoveSettingsStacked(false)
    }
    // Clear image slots and selection when exiting isolation
    setImageSlots([])
    setActiveImageSlotId(null)
    setSelectedCardImageId(null)
    setShowCardImagePicker(false)
    setEditingSlotId(null)
  }

  // Enter isolation mode for a card
  const enterIsolationMode = (cardId) => {
    setIsolatedCardId(cardId)
    setSelectedTextBoxId(null)
    // Initialize image slots from the card's existing images
    const card = cards.find(c => c.id === cardId)
    if (card?.images && card.images.length > 0) {
      const slots = card.images.map(img => ({
        id: `slot-${img.id}`,
        imageElementId: img.id,
        url: img.url || null,
        alt: img.alt || '',
        assigned: !!img.url
      }))
      setImageSlots(slots)
    } else {
      setImageSlots([])
    }
    setActiveImageSlotId(null)
    setSelectedCardImageId(null)
    setEditingTextBoxId(null)
  }

  // ===== WALLPAPER HANDLERS =====
  
  // Handle wallpaper selection from ImagePicker
  const handleWallpaperSelect = async (payload) => {
    setWallpaperSaving(true)
    setWallpaperError(null)
    
    try {
      let imageUrl = payload.url
      
      // If a file was uploaded, upload it first
      if (payload.file) {
        const uploadResult = await uploadImage(payload.file)
        if (uploadResult.error) {
          throw new Error(uploadResult.error)
        }
        imageUrl = uploadResult.url
      }
      
      // Save wallpaper to database
      const wallpaperData = {
        url: imageUrl,
        alt: payload.alt || 'Page wallpaper',
        blur: wallpaperBlur
      }
      
      const { error } = await setPageWallpaper(pageId, wallpaperData)
      
      if (error) {
        console.error('Failed to save wallpaper:', error)
        setWallpaperError('Failed to save wallpaper')
      } else {
        setCurrentWallpaper(wallpaperData)
        setIsUsingFallbackWallpaper(false) // Page now has its own wallpaper
        setShowWallpaperPicker(false)
      }
    } catch (err) {
      console.error('Failed to save wallpaper:', err)
      setWallpaperError('Failed to save wallpaper')
    } finally {
      setWallpaperSaving(false)
    }
  }
  
  // Handle removing page wallpaper
  const handleRemoveWallpaper = async () => {
    setWallpaperSaving(true)
    setWallpaperError(null)
    
    try {
      const { error } = await removePageWallpaper(pageId)
      
      if (error) {
        console.error('Failed to remove wallpaper:', error)
        setWallpaperError('Failed to remove wallpaper')
      } else {
        // Check for universal fallback
        const { data: universal } = await getUniversalWallpaper()
        if (universal?.wallpaper && universal.pageId !== pageId) {
          setCurrentWallpaper(universal.wallpaper)
          setWallpaperBlur(universal.wallpaper.blur || 0)
          setIsUsingFallbackWallpaper(true)
          setUniversalSourcePageId(universal.pageId)
        } else {
          setCurrentWallpaper(null)
          setWallpaperBlur(0)
          setIsUsingFallbackWallpaper(false)
        }
        // Clear universal status if this page was the universal source
        if (isUniversalWallpaper) {
          setIsUniversalWallpaper(false)
          setUniversalSourcePageId(null)
        }
      }
    } catch (err) {
      console.error('Failed to remove wallpaper:', err)
      setWallpaperError('Failed to remove wallpaper')
    } finally {
      setWallpaperSaving(false)
    }
  }
  
  // Handle setting current wallpaper as universal default
  const handleSetUniversal = async () => {
    if (!currentWallpaper?.url) return
    
    setWallpaperSaving(true)
    setWallpaperError(null)
    
    try {
      const { error } = await setUniversalWallpaper(pageId)
      
      if (error) {
        console.error('Failed to set universal wallpaper:', error)
        setWallpaperError('Failed to set as default')
      } else {
        setIsUniversalWallpaper(true)
        setUniversalSourcePageId(pageId)
      }
    } catch (err) {
      console.error('Failed to set universal wallpaper:', err)
      setWallpaperError('Failed to set as default')
    } finally {
      setWallpaperSaving(false)
    }
  }
  
  // Handle clearing universal wallpaper status
  const handleClearUniversal = async () => {
    setWallpaperSaving(true)
    setWallpaperError(null)
    
    try {
      const { error } = await clearUniversalWallpaper()
      
      if (error) {
        console.error('Failed to clear universal wallpaper:', error)
        setWallpaperError('Failed to clear default')
      } else {
        setIsUniversalWallpaper(false)
        setUniversalSourcePageId(null)
      }
    } catch (err) {
      console.error('Failed to clear universal wallpaper:', err)
      setWallpaperError('Failed to clear default')
    } finally {
      setWallpaperSaving(false)
    }
  }
  
  // Handle blur change - update state and save to database
  const handleBlurChange = async (newBlur) => {
    setWallpaperBlur(newBlur)
    
    // If we have a wallpaper, save the blur setting
    if (currentWallpaper?.url) {
      try {
        const wallpaperData = {
          ...currentWallpaper,
          blur: newBlur
        }
        await setPageWallpaper(pageId, wallpaperData)
        setCurrentWallpaper(wallpaperData)
      } catch (err) {
        console.error('Failed to save blur setting:', err)
      }
    }
  }

  // ===== IMAGE ELEMENT FUNCTIONS =====
  
  // Create a new image element on the card and link it to a slot
  const createImageSlot = () => {
    if (!isolatedCardId) return
    
    const card = cards.find(c => c.id === isolatedCardId)
    if (!card) return
    
    const bounds = getCardBounds(card.points)
    const cardWidth = bounds.maxX - bounds.minX
    const cardHeight = bounds.maxY - bounds.minY
    
    // Create image element at default position (similar to text boxes)
    const imageElementId = Date.now()
    const imageElement = {
      id: imageElementId,
      x: cardWidth * 0.1, // 10% from left edge
      y: cardHeight * 0.1, // 10% from top edge
      width: cardWidth * 0.4, // 40% of card width
      height: cardHeight * 0.4, // 40% of card height
      url: null,
      alt: ''
    }
    
    // Add image element to card
    setCards(cards.map(c => {
      if (c.id !== isolatedCardId) return c
      return {
        ...c,
        images: [...(c.images || []), imageElement]
      }
    }))
    
    // Create linked slot
    const slot = {
      id: `slot-${imageElementId}`,
      imageElementId: imageElementId,
      url: null,
      alt: '',
      assigned: false
    }
    
    setImageSlots([...imageSlots, slot])
    setActiveImageSlotId(slot.id)
    setSelectedCardImageId(imageElementId)
  }
  
  // Assign image to a slot (and its linked element)
  const assignImageToSlot = (slotId, imageData) => {
    const slot = imageSlots.find(s => s.id === slotId)
    if (!slot) return
    
    // Update the slot
    setImageSlots(imageSlots.map(s => 
      s.id === slotId 
        ? { ...s, url: imageData.url, alt: imageData.alt || '', assigned: true }
        : s
    ))
    
    // Update the linked image element on the card
    if (slot.imageElementId && isolatedCardId) {
      setCards(cards.map(c => {
        if (c.id !== isolatedCardId) return c
        return {
          ...c,
          images: (c.images || []).map(img => 
            img.id === slot.imageElementId
              ? { ...img, url: imageData.url, alt: imageData.alt || '' }
              : img
          )
        }
      }))
    }
  }
  
  // Clear image from a slot (but keep the element)
  const clearImageSlot = (slotId) => {
    const slot = imageSlots.find(s => s.id === slotId)
    if (!slot) return
    
    // Clear the slot
    setImageSlots(imageSlots.map(s => 
      s.id === slotId 
        ? { ...s, url: null, alt: '', assigned: false }
        : s
    ))
    
    // Clear the linked image element
    if (slot.imageElementId && isolatedCardId) {
      setCards(cards.map(c => {
        if (c.id !== isolatedCardId) return c
        return {
          ...c,
          images: (c.images || []).map(img => 
            img.id === slot.imageElementId
              ? { ...img, url: null, alt: '' }
              : img
          )
        }
      }))
    }
    
    if (activeImageSlotId === slotId) {
      setActiveImageSlotId(null)
    }
  }
  
  // Delete an image slot and its linked element
  const deleteImageSlot = (slotId) => {
    const slot = imageSlots.find(s => s.id === slotId)
    if (!slot) return
    
    // Remove the slot
    setImageSlots(imageSlots.filter(s => s.id !== slotId))
    
    // Remove the linked image element from the card
    if (slot.imageElementId && isolatedCardId) {
      setCards(cards.map(c => {
        if (c.id !== isolatedCardId) return c
        return {
          ...c,
          images: (c.images || []).filter(img => img.id !== slot.imageElementId)
        }
      }))
    }
    
    if (activeImageSlotId === slotId) {
      setActiveImageSlotId(null)
    }
    if (selectedCardImageId === slot.imageElementId) {
      setSelectedCardImageId(null)
    }
  }
  
  // Activate/select an image slot (and its linked element)
  const activateImageSlot = (slotId) => {
    if (activeImageSlotId === slotId) {
      // Deactivate
      setActiveImageSlotId(null)
      setSelectedCardImageId(null)
    } else {
      // Activate
      const slot = imageSlots.find(s => s.id === slotId)
      setActiveImageSlotId(slotId)
      if (slot?.imageElementId) {
        setSelectedCardImageId(slot.imageElementId)
      }
    }
  }
  
  // Open picker for a specific slot
  const openPickerForSlot = (slotId) => {
    setEditingSlotId(slotId)
    setShowCardImagePicker(true)
    activateImageSlot(slotId)
  }
  
  // Find slot by its linked image element ID
  const findSlotByImageElementId = (imageElementId) => {
    return imageSlots.find(s => s.imageElementId === imageElementId)
  }
  
  // Update an image element on a card (for move/resize)
  const updateCardImage = (cardId, imageId, updates) => {
    setCards(cards.map(c => {
      if (c.id !== cardId) return c
      return {
        ...c,
        images: (c.images || []).map(img => 
          img.id === imageId ? { ...img, ...updates } : img
        )
      }
    }))
  }
  
  // Delete an image element from a card
  const deleteCardImage = (cardId, imageId) => {
    // Also remove the linked slot
    const slot = findSlotByImageElementId(imageId)
    if (slot) {
      setImageSlots(imageSlots.filter(s => s.id !== slot.id))
      if (activeImageSlotId === slot.id) {
        setActiveImageSlotId(null)
      }
    }
    
    setCards(cards.map(c => {
      if (c.id !== cardId) return c
      return {
        ...c,
        images: (c.images || []).filter(img => img.id !== imageId)
      }
    }))
    
    if (selectedCardImageId === imageId) {
      setSelectedCardImageId(null)
    }
  }
  
  // Handle image selection from ImagePicker for card images
  const handleCardImageSelect = async (payload) => {
    if (!editingSlotId) return
    
    try {
      let imageUrl = payload.url
      
      // If a file was uploaded, upload it first
      if (payload.file) {
        const uploadResult = await uploadImage(payload.file)
        if (uploadResult.error) {
          console.error('Failed to upload image:', uploadResult.error)
          return
        }
        imageUrl = uploadResult.url
      }
      
      // Assign to the slot
      assignImageToSlot(editingSlotId, {
        url: imageUrl,
        alt: payload.alt || ''
      })
      
      setShowCardImagePicker(false)
      setEditingSlotId(null)
    } catch (err) {
      console.error('Failed to handle image selection:', err)
    }
  }
  
  // Check if an image element has an assigned image
  const isImageElementAssigned = (imageElementId) => {
    const card = cards.find(c => c.id === isolatedCardId)
    if (!card) return false
    const img = (card.images || []).find(i => i.id === imageElementId)
    return img?.url ? true : false
  }

  // Add text box to a card
  const addTextBoxToCard = (cardId) => {
    const card = cards.find(c => c.id === cardId)
    if (!card) return
    
    const bounds = getCardBounds(card.points)
    const cardWidth = bounds.maxX - bounds.minX
    const cardHeight = bounds.maxY - bounds.minY
    
    // Create a text box at default position (centered, reasonable size)
    const textBox = {
      id: Date.now(),
      x: cardWidth * 0.1, // 10% from left edge (relative to card)
      y: cardHeight * 0.1, // 10% from top edge (relative to card)
      width: cardWidth * 0.8, // 80% of card width
      height: 60, // Default height
      content: 'Text',
      fontSize: 16,
      fontFamily: 'sans', // 'sans', 'serif', 'mono'
      fontWeight: 'normal',
      fontStyle: 'normal',
      textAlign: 'left',
      textDecoration: 'none', // 'none', 'underline', 'line-through'
      listType: 'none', // 'none', 'bullet', 'numbered'
      isQuote: false, // quote block styling
      link: '' // URL for link
    }
    
    // Record action for undo
    addToHistory({
      type: 'textbox_create',
      cardId,
      textBoxId: textBox.id,
      textBox
    })
    
    // Update the card with the new text box
    setCards(cards.map(c => {
      if (c.id !== cardId) return c
      return {
        ...c,
        textBoxes: [...(c.textBoxes || []), textBox]
      }
    }))
    
    // Select the new text box
    setSelectedTextBoxId(textBox.id)
    setHasUnsavedChanges(true)
  }

  // Update text box properties
  const updateTextBox = (cardId, textBoxId, updates) => {
    setCards(cards.map(c => {
      if (c.id !== cardId) return c
      return {
        ...c,
        textBoxes: (c.textBoxes || []).map(tb => 
          tb.id === textBoxId ? { ...tb, ...updates } : tb
        )
      }
    }))
    setHasUnsavedChanges(true)
  }

  // Delete text box from a card
  const deleteTextBox = (cardId, textBoxId) => {
    // Find the text box before deleting for undo
    const card = cards.find(c => c.id === cardId)
    const textBox = card?.textBoxes?.find(tb => tb.id === textBoxId)
    
    if (textBox) {
      // Record action for undo
      addToHistory({
        type: 'textbox_delete',
        cardId,
        textBoxId,
        textBox
      })
    }
    
    setCards(cards.map(c => {
      if (c.id !== cardId) return c
      return {
        ...c,
        textBoxes: (c.textBoxes || []).filter(tb => tb.id !== textBoxId)
      }
    }))
    setSelectedTextBoxId(null)
    setEditingTextBoxId(null)
    setHasUnsavedChanges(true)
  }

  // Record text box move to history (called on mouse up after moving)
  const recordTextBoxMove = (cardId, textBoxId, startX, startY, endX, endY) => {
    if (startX === endX && startY === endY) return // No actual move
    addToHistory({
      type: 'textbox_move',
      cardId,
      textBoxId,
      startX,
      startY,
      endX,
      endY
    })
  }

  // Record text box resize to history (called on mouse up after resizing)
  const recordTextBoxResize = (cardId, textBoxId, originalProps, newProps) => {
    if (originalProps.width === newProps.width && originalProps.height === newProps.height) return
    addToHistory({
      type: 'textbox_resize',
      cardId,
      textBoxId,
      originalProps,
      newProps
    })
  }

  // Delete all text boxes from the isolated card (trash can in isolation mode)
  const deleteAllTextBoxes = () => {
    if (!isolatedCardId) return
    const card = cards.find(c => c.id === isolatedCardId)
    if (!card || !card.textBoxes || card.textBoxes.length === 0) return
    
    // Record action for undo (stores all deleted text boxes)
    addToHistory({
      type: 'textbox_delete_all',
      cardId: isolatedCardId,
      textBoxes: [...card.textBoxes]
    })
    
    setCards(cards.map(c => {
      if (c.id !== isolatedCardId) return c
      return { ...c, textBoxes: [] }
    }))
    setSelectedTextBoxId(null)
    setEditingTextBoxId(null)
    setHasUnsavedChanges(true)
  }

  // Determine if inspector is effectively active (manual or auto via pencil)
  // Inspector is disabled when a card is active for editing in pencil mode
  const isInspectorActive = (inspectorMode || (pencilMode && currentPoints.length === 0)) && !activeCardId

  // Toggle card selection
  const toggleCardSelection = (cardId) => {
    setSelectedCards(prev => 
      prev.includes(cardId) 
        ? prev.filter(id => id !== cardId)
        : [...prev, cardId]
    )
  }

  // Pencil tool - toggle active card for styling
  const toggleActiveCard = (cardId) => {
    if (activeCardId === cardId) {
      // Clicking active card deactivates it
      setActiveCardId(null)
      setPreviewSettings(null)
    } else {
      // Activate card (or switch to different card) and load its current style into preview
      const card = cards.find(c => c.id === cardId)
      const currentStyle = card?.style || defaultCardStyle
      setActiveCardId(cardId)
      setPreviewSettings({ ...currentStyle })
      setPencilSettings({ ...currentStyle })
      // Clear hover state to prevent visual artifacts
      setHoveredCardId(null)
    }
  }

  // Apply pencil settings to active card
  const applyPencilSettings = () => {
    if (!activeCardId) return
    
    const settingsToApply = previewSettings || pencilSettings
    
    // Record action for undo
    const card = cards.find(c => c.id === activeCardId)
    addToHistory({
      type: 'style',
      cardId: activeCardId,
      oldStyle: card?.style || defaultCardStyle,
      newStyle: settingsToApply
    })
    
    setCards(cards.map(c => 
      c.id === activeCardId 
        ? { ...c, style: { ...settingsToApply } }
        : c
    ))
    
    setPencilSettings({ ...settingsToApply })
    setPreviewSettings(null)
    setHasUnsavedChanges(true)
  }

  // Cancel preview and revert to original
  const cancelPencilPreview = () => {
    if (!activeCardId) return
    const card = cards.find(c => c.id === activeCardId)
    setPreviewSettings(null)
    setPencilSettings(card?.style || defaultCardStyle)
  }

  // Get effective style for a card (considering preview)
  const getCardStyle = (card) => {
    if (activeCardId === card.id && previewSettings) {
      return previewSettings
    }
    return card.style || defaultCardStyle
  }

  // Move card by offset (snap to grid)
  const moveCard = (cardId, offsetX, offsetY, skipHistory = false) => {
    // Snap offset to grid
    const snappedOffsetX = Math.round(offsetX / GRID_SPACING) * GRID_SPACING
    const snappedOffsetY = Math.round(offsetY / GRID_SPACING) * GRID_SPACING
    
    if (snappedOffsetX === 0 && snappedOffsetY === 0) return
    
    // Record action for undo (unless skipping, e.g. for undo/redo itself)
    if (!skipHistory) {
      addToHistory({
        type: 'move',
        cardId,
        offsetX: snappedOffsetX,
        offsetY: snappedOffsetY
      })
    }
    
    setCards(cards.map(card => {
      if (card.id !== cardId) return card
      return {
        ...card,
        points: card.points.map(p => ({
          x: p.x + snappedOffsetX,
          y: p.y + snappedOffsetY
        }))
      }
    }))
  }

  // Resize card by moving an edge (snap to grid)
  const resizeCard = (cardId, edge, offset) => {
    const snappedOffset = Math.round(offset / GRID_SPACING) * GRID_SPACING
    if (snappedOffset === 0) return
    
    const card = cards.find(c => c.id === cardId)
    if (!card) return
    
    const originalPoints = [...card.points]
    const bounds = getCardBounds(card.points)
    let { minX, maxX, minY, maxY } = bounds
    
    // Apply the offset to the appropriate edge
    // Ensure minimum size of 1 grid spacing
    switch (edge) {
      case 'top':
        minY = Math.min(minY + snappedOffset, maxY - GRID_SPACING)
        break
      case 'bottom':
        maxY = Math.max(maxY + snappedOffset, minY + GRID_SPACING)
        break
      case 'left':
        minX = Math.min(minX + snappedOffset, maxX - GRID_SPACING)
        break
      case 'right':
        maxX = Math.max(maxX + snappedOffset, minX + GRID_SPACING)
        break
    }
    
    const newPoints = [
      { x: minX, y: minY }, // top-left
      { x: maxX, y: minY }, // top-right
      { x: maxX, y: maxY }, // bottom-right
      { x: minX, y: maxY }, // bottom-left
    ]
    
    // Record action for undo
    addToHistory({
      type: 'resize',
      cardId,
      edge,
      originalPoints,
      newPoints
    })
    
    setCards(cards.map(c => 
      c.id === cardId ? { ...c, points: newPoints } : c
    ))
  }

  useEffect(() => {
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

  // Handle mouse move for live preview and dragging
  const handleGridMouseMove = (e) => {
    const rect = gridRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Handle dragging in move mode
    if (moveMode && isDragging && dragStart) {
      const offsetX = x - dragStart.x
      const offsetY = y - dragStart.y
      setDragOffset({ x: offsetX, y: offsetY })
      return
    }

    // Handle resizing
    if (resizeMode && resizingEdge && dragStart) {
      const edge = resizingEdge.edge
      let offset = 0
      if (edge === 'top' || edge === 'bottom') {
        offset = y - dragStart.y
      } else {
        offset = x - dragStart.x
      }
      setResizeOffset(offset)
      return
    }

    // Handle resize edge detection
    if (resizeMode && !resizingEdge) {
      let foundEdge = null
      for (const card of cards) {
        const edge = detectEdge(x, y, card.points, 15)
        if (edge) {
          foundEdge = { cardId: card.id, edge }
          break
        }
      }
      setHoveredEdge(foundEdge)
    }

    // Handle pencil preview
    if (pencilMode && showGrid && currentPoints.length === 1) {
      const snapped = snapToGrid(x, y)
      setMousePos(snapped)
    } else {
      setMousePos(null)
    }
  }

  // Handle mouse down for move tool
  const handleCardMouseDown = (e, cardId) => {
    if (!moveMode) return
    e.stopPropagation()
    
    const rect = gridRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    setSelectedCardId(cardId)
    setIsDragging(true)
    setDragStart({ x, y })
    setDragOffset({ x: 0, y: 0 })
  }

  // Handle mouse down for resize tool (on edge)
  const handleEdgeMouseDown = (e) => {
    if (!resizeMode || !hoveredEdge) return
    e.stopPropagation()
    
    const rect = gridRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    setResizingEdge(hoveredEdge)
    setDragStart({ x, y })
    setResizeOffset(0)
  }

  // Handle mouse up to finish dragging or resizing
  const handleGridMouseUp = () => {
    if (moveMode && isDragging && selectedCardId) {
      // Apply the move
      moveCard(selectedCardId, dragOffset.x, dragOffset.y)
      setIsDragging(false)
      setDragStart(null)
      setDragOffset({ x: 0, y: 0 })
    }
    
    if (resizeMode && resizingEdge) {
      // Apply the resize
      resizeCard(resizingEdge.cardId, resizingEdge.edge, resizeOffset)
      setResizingEdge(null)
      setDragStart(null)
      setResizeOffset(0)
    }
  }

  // Handle grid click for pencil tool
  const handleGridClick = (e) => {
    if (!pencilMode || !showGrid) return

    const rect = gridRef.current.getBoundingClientRect()
    // Calculate position relative to the grid element
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const snapped = snapToGrid(x, y)

    // Check if point is in existing card
    if (isPointInCard(snapped.x, snapped.y, cards)) {
      return // Can't place here
    }

    // Check if this is a duplicate point
    if (currentPoints.some(p => p.x === snapped.x && p.y === snapped.y)) {
      return
    }

    if (currentPoints.length === 0) {
      // First corner - any valid grid point
      setCurrentPoints([snapped])
    } else if (currentPoints.length === 1) {
      // Second corner - must be different from first (not same point)
      // Also ensure it creates a rectangle with some size
      const p1 = currentPoints[0]
      if (snapped.x !== p1.x && snapped.y !== p1.y) {
        // Valid second corner - create the rectangle
        const rectanglePoints = createRectangleFromCorners(p1, snapped)
        
        // Check if any corner of the new rectangle is inside an existing card
        const overlapsExisting = rectanglePoints.some(pt => 
          isPointInCard(pt.x, pt.y, cards)
        )
        
        if (!overlapsExisting) {
          const newCard = {
            id: Date.now(),
            points: rectanglePoints,
            // Apply locked settings or default
            style: pencilSettingsLocked ? { ...pencilSettings } : { ...defaultCardStyle }
          }
          // Record action for undo
          addToHistory({
            type: 'create',
            cardId: newCard.id,
            card: newCard
          })
          setCards([...cards, newCard])
          setDeletedCardsBackup(null) // Clear backup when creating new cards
          setCurrentPoints([]) // Reset for next card
        }
      } else {
        // Same row or column - just update the point (user might want to reposition)
        setCurrentPoints([snapped])
      }
    }
  }

  // Cancel current drawing with Escape key, or exit isolation mode, or deselect active card
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isolatedCardId) {
          // Exit isolation mode
          exitIsolationMode()
        } else if (pencilMode && activeCardId) {
          // Deselect active card first
          setActiveCardId(null)
          setPreviewSettings(null)
        } else if (pencilMode) {
          setCurrentPoints([])
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pencilMode, isolatedCardId, activeCardId])

  // Page titles for different routes
  const pageTitles = {
    home: 'Home',
    journals: 'Journals',
    about: 'About',
    contact: 'Contact'
  }

  // Parallax effect with position offset
  // wallpaperPosition controls where in the conveyor journey the wallpaper scrolling occurs
  
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 1000
  
  // Total SCROLLABLE distance (conveyor length minus viewport)
  // This is the actual distance you can scroll, not the total page height
  const totalScrollableVh = conveyorLength - 100 // e.g., 300vh - 100vh = 200vh scrollable
  const totalScrollablePx = (totalScrollableVh / 100) * viewportHeight
  
  // Wallpaper scroll window size as a portion of the scrollable distance
  // The wallpaper window should be proportional: at 2:1 ratio, wallpaper window is 50% of scrollable
  const wallpaperWindowRatio = baseWallpaperHeight / conveyorLength // e.g., 150/300 = 0.5 at 2:1
  const wallpaperWindowPx = totalScrollablePx * wallpaperWindowRatio
  
  // Max position for wallpaper (so it doesn't go past the end)
  const maxPositionRatio = 1 - wallpaperWindowRatio // e.g., 0.5 at 2:1
  const clampedPosition = Math.min(wallpaperPosition / 100, maxPositionRatio)
  
  // Where the wallpaper scroll window starts and ends (in scroll pixels)
  const wallpaperStartPx = clampedPosition * totalScrollablePx
  const wallpaperEndPx = wallpaperStartPx + wallpaperWindowPx
  
  // Current scroll position (adjusted by speed)
  const currentScrollPx = scrollProgress * scrollSpeed
  
  // Calculate wallpaper offset based on where we are in the scroll window
  let imageOffset = 0
  const maxWallpaperScroll = viewportHeight * 0.5 // 50vh max scroll (150vh - 100vh viewport)
  
  if (currentScrollPx < wallpaperStartPx) {
    // Before wallpaper window - wallpaper at top
    imageOffset = 0
  } else if (currentScrollPx > wallpaperEndPx) {
    // After wallpaper window - wallpaper at bottom (max scroll)
    imageOffset = maxWallpaperScroll
  } else {
    // Within wallpaper window - scroll proportionally
    const progressInWindow = (currentScrollPx - wallpaperStartPx) / wallpaperWindowPx
    imageOffset = progressInWindow * maxWallpaperScroll
  }

  // Scroll animation calculations for home page text
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
  const DESC_START = 360
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
    <div ref={containerRef} style={{ minHeight: `${conveyorLength}vh` }}>
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 flex items-center gap-3">
            <svg className="w-6 h-6 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-gray-700 font-medium">Loading layout...</span>
          </div>
        </div>
      )}

      {/* Save/Publish Toast Notification */}
      {saveMessage && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 transition-all ${
          saveMessage.type === 'success' 
            ? 'bg-green-600 text-white' 
            : 'bg-red-600 text-white'
        }`}>
          {saveMessage.type === 'success' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <span className="font-medium">{saveMessage.text}</span>
        </div>
      )}

      {/* Unsaved Changes Warning Modal */}
      {showSlotWarning && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center">
          <div className="bg-gray-900 rounded-lg p-6 max-w-md mx-4 border border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-orange-600/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white">Unsaved Changes</h3>
            </div>
            <p className="text-gray-300 mb-6">
              You have unsaved changes in "{currentSlot?.name}". 
              {pendingSlotSwitch?.isNew 
                ? ' Creating a new layout will discard these changes.'
                : ` Switching to "${pendingSlotSwitch?.name}" will discard these changes.`
              }
            </p>
            <div className="flex gap-3">
              <button
                onClick={cancelSlotSwitch}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmSlotSwitch}
                className="flex-1 px-4 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition-colors"
              >
                Discard & Switch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fixed Header Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard/web-ui')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Web UI
            </button>
            <span className="text-gray-300">|</span>
            <h1 className="text-lg font-semibold text-gray-900">
              Edit Page UI: {pageTitles[pageId] || pageId}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Isolation mode takes priority in status display */}
            {isolatedCardId ? (
              <>
                <span className="text-sm text-gray-500">Isolation Mode</span>
                <span className="px-2 py-1 bg-cyan-100 text-cyan-700 text-xs font-medium rounded">
                  Editing card content • ESC to exit
                </span>
              </>
            ) : pencilMode && currentPoints.length === 1 ? (
              <>
                <span className="text-sm text-gray-500">Drawing rectangle</span>
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                  Click opposite corner
                </span>
              </>
            ) : pencilMode && activeCardId ? (
              <>
                <span className="text-sm text-gray-500">Card Selected</span>
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                  Editing style • Click card again to deselect
                </span>
              </>
            ) : isInspectorActive && inspectedCardId ? (
              <>
                <span className="text-sm text-gray-500">Inspector Mode</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                  Viewing dimensions
                </span>
              </>
            ) : pencilMode ? (
              <>
                <span className="text-sm text-gray-500">Pencil Tool Active</span>
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                  Click to draw • Click card to style
                </span>
              </>
            ) : inspectorMode ? (
              <>
                <span className="text-sm text-gray-500">Inspector Tool Active</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                  Showing all dimensions & distances
                </span>
              </>
            ) : eraserMode ? (
              <>
                <span className="text-sm text-gray-500">Eraser Tool Active</span>
                <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                  Click card to delete
                </span>
              </>
            ) : moveMode && isDragging ? (
              <>
                <span className="text-sm text-gray-500">Moving card</span>
                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                  Release to place
                </span>
              </>
            ) : moveMode ? (
              <>
                <span className="text-sm text-gray-500">Move Tool Active</span>
                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                  Click & drag card
                </span>
              </>
            ) : selectMode ? (
              <>
                <span className="text-sm text-gray-500">Select Tool Active</span>
                <span className="px-2 py-1 bg-cyan-100 text-cyan-700 text-xs font-medium rounded">
                  {selectedCards.length > 0 ? `${selectedCards.length} selected` : 'Click cards to select'}
                </span>
              </>
            ) : resizeMode && resizingEdge ? (
              <>
                <span className="text-sm text-gray-500">Resizing {resizingEdge.edge} edge</span>
                <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded">
                  Release to apply
                </span>
              </>
            ) : resizeMode ? (
              <>
                <span className="text-sm text-gray-500">Resize Tool Active</span>
                <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded">
                  Hover card edge to resize
                </span>
              </>
            ) : conveyorMode ? (
              <>
                <span className="text-sm text-gray-500">Conveyor Tool Active</span>
                <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-medium rounded">
                  Adjust scroll settings in panel
                </span>
              </>
            ) : propertiesMode ? (
              <>
                <span className="text-sm text-gray-500">Properties Tool Active</span>
                <span className="px-2 py-1 bg-cyan-100 text-cyan-700 text-xs font-medium rounded">
                  Click a card to edit its content
                </span>
              </>
            ) : (
              <>
                <span className="text-sm text-gray-500">Preview Mode</span>
                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded">
                  {cards.length} card{cards.length !== 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Navbar Placeholder / Toolbar */}
      <div className={`fixed top-14 left-0 right-0 z-40 backdrop-blur-sm border-b px-4 py-3 transition-all duration-300 ${
        toolbarMode 
          ? 'bg-gray-900/95 border-gray-700' 
          : 'bg-white/80 border-dashed border-gray-300'
      }`}>
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          {toolbarMode ? (
            /* Toolbar Mode */
            <>
              <div className="flex items-center gap-1">
                {/* Card Tools */}
                <button className="p-2 rounded-lg hover:bg-gray-700 text-gray-300 hover:text-white transition-colors" title="Add Text Card">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                  </svg>
                </button>
                <button className="p-2 rounded-lg hover:bg-gray-700 text-gray-300 hover:text-white transition-colors" title="Add Image Card">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
                <button className="p-2 rounded-lg hover:bg-gray-700 text-gray-300 hover:text-white transition-colors" title="Add Quote Card">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                  </svg>
                </button>
                <button className="p-2 rounded-lg hover:bg-gray-700 text-gray-300 hover:text-white transition-colors" title="Add Link Card">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </button>
                
                <div className="w-px h-6 bg-gray-600 mx-2" />
                
                <button className="p-2 rounded-lg hover:bg-gray-700 text-gray-300 hover:text-white transition-colors" title="Add Book Card">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </button>
                <button className="p-2 rounded-lg hover:bg-gray-700 text-gray-300 hover:text-white transition-colors" title="Add Project Card">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </button>
                <button className="p-2 rounded-lg hover:bg-gray-700 text-gray-300 hover:text-white transition-colors" title="Add Snippet Card">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                </button>
                
                <div className="w-px h-6 bg-gray-600 mx-2" />
                
                {/* Layout Tools */}
                <button 
                  onClick={() => setShowGrid(!showGrid)}
                  className={`p-2 rounded-lg transition-colors ${
                    showGrid 
                      ? 'bg-blue-600 text-white hover:bg-blue-700' 
                      : 'hover:bg-gray-700 text-gray-300 hover:text-white'
                  }`} 
                  title={showGrid ? "Hide Grid" : "Show Grid"}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="4" cy="4" r="1.5" fill="currentColor" />
                    <circle cx="12" cy="4" r="1.5" fill="currentColor" />
                    <circle cx="20" cy="4" r="1.5" fill="currentColor" />
                    <circle cx="4" cy="12" r="1.5" fill="currentColor" />
                    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                    <circle cx="20" cy="12" r="1.5" fill="currentColor" />
                    <circle cx="4" cy="20" r="1.5" fill="currentColor" />
                    <circle cx="12" cy="20" r="1.5" fill="currentColor" />
                    <circle cx="20" cy="20" r="1.5" fill="currentColor" />
                  </svg>
                </button>
                <button 
                  onClick={() => !isolatedCardId && (pencilMode ? deactivatePencil() : activatePencil())}
                  disabled={!!isolatedCardId}
                  className={`p-2 rounded-lg transition-colors ${
                    isolatedCardId
                      ? 'opacity-40 cursor-not-allowed text-gray-500'
                      : pencilMode 
                        ? 'bg-green-600 text-white hover:bg-green-700' 
                        : 'hover:bg-gray-700 text-gray-300 hover:text-white'
                  }`} 
                  title={isolatedCardId ? "Exit isolation mode first" : pencilMode ? "Deactivate Pencil Tool" : "Draw Card (Pencil Tool)"}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button 
                  onClick={() => eraserMode ? setEraserMode(false) : activateEraser()}
                  className={`p-2 rounded-lg transition-colors ${
                    eraserMode 
                      ? 'bg-red-600 text-white hover:bg-red-700' 
                      : 'hover:bg-gray-700 text-gray-300 hover:text-white'
                  }`} 
                  title={eraserMode ? "Deactivate Eraser Tool" : isolatedCardId ? "Erase Element" : "Erase Card"}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19h14M9 15l6-6m-4 0l4 4M4.5 15.5l4-4a1.414 1.414 0 012 0l5 5a1.414 1.414 0 010 2l-1 1a1.414 1.414 0 01-2 0l-5-5a1.414 1.414 0 010-2l-3 3z" />
                  </svg>
                </button>
                <button 
                  onClick={handleMoveToolClick}
                  className={`p-2 rounded-lg transition-colors ${
                    moveMode && moveSettingsStacked && isolatedCardId
                      ? 'bg-purple-600 text-white hover:bg-purple-700 ring-2 ring-purple-400'
                      : moveMode 
                      ? 'bg-purple-600 text-white hover:bg-purple-700' 
                      : 'hover:bg-gray-700 text-gray-300 hover:text-white'
                  }`} 
                  title={moveMode ? "Deactivate Move Tool" : isolatedCardId ? "Move Element" : "Move Card"}
                >
                  {/* Move icon: perpendicular lines with arrows at all 4 ends */}
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {/* Vertical line */}
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v18" />
                    {/* Horizontal line */}
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h18" />
                    {/* Arrow tips: up */}
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l-3 3m3-3l3 3" />
                    {/* Arrow tips: down */}
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21l-3-3m3 3l3-3" />
                    {/* Arrow tips: left */}
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l3-3m-3 3l3 3" />
                    {/* Arrow tips: right */}
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12l-3-3m3 3l-3 3" />
                  </svg>
                </button>
                <button 
                  onClick={() => resizeMode ? setResizeMode(false) : activateResize()}
                  className={`p-2 rounded-lg transition-colors ${
                    resizeMode 
                      ? 'bg-amber-600 text-white hover:bg-amber-700' 
                      : 'hover:bg-gray-700 text-gray-300 hover:text-white'
                  }`} 
                  title={resizeMode ? "Deactivate Resize Tool" : isolatedCardId ? "Resize Element" : "Resize Card"}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                </button>
                <button 
                  onClick={() => !isolatedCardId && toggleInspector()}
                  disabled={!!isolatedCardId}
                  className={`p-2 rounded-lg transition-colors ${
                    isolatedCardId
                      ? 'opacity-40 cursor-not-allowed text-gray-500'
                      : inspectorMode
                        ? 'bg-blue-600 text-white hover:bg-blue-700' 
                        : 'hover:bg-gray-700 text-gray-300 hover:text-white'
                  }`} 
                  title={isolatedCardId ? "Exit isolation mode first" : inspectorMode ? "Deactivate Inspector" : "Inspector Tool (Overlay)"}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
                <button 
                  onClick={() => conveyorMode ? setConveyorMode(false) : activateConveyor()}
                  className={`p-2 rounded-lg transition-colors ${
                    conveyorMode 
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                      : 'hover:bg-gray-700 text-gray-300 hover:text-white'
                  }`} 
                  title={conveyorMode ? "Deactivate Conveyor Tool" : "Conveyor Settings"}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </button>
                <button 
                  onClick={() => propertiesMode ? deactivateProperties() : activateProperties()}
                  className={`p-2 rounded-lg transition-colors ${
                    propertiesMode 
                      ? 'bg-cyan-600 text-white hover:bg-cyan-700' 
                      : 'hover:bg-gray-700 text-gray-300 hover:text-white'
                  }`} 
                  title={propertiesMode ? "Deactivate Properties Tool" : "Card Properties (Edit Content)"}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </button>
                
                <div className="w-px h-6 bg-gray-600 mx-2" />
                
                {/* Global Settings Button */}
                <button 
                  onClick={() => setShowGlobalSettings(true)}
                  className={`p-2 rounded-lg transition-colors ${
                    showGlobalSettings 
                      ? 'bg-gray-600 text-white' 
                      : 'hover:bg-gray-700 text-gray-300 hover:text-white'
                  }`} 
                  title="Global Settings (Scroll, Wallpaper)"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
                
                <div className="w-px h-6 bg-gray-600 mx-2" />
                
                {/* Actions */}
                <button 
                  onClick={() => {
                    if (pencilMode && currentPoints.length > 0) {
                      // If drawing, remove last point
                      setCurrentPoints(currentPoints.slice(0, -1))
                    } else {
                      // Otherwise, undo last action (or restore deleted)
                      undoAction()
                    }
                  }}
                  disabled={currentPoints.length === 0 && !canUndo}
                  className={`p-2 rounded-lg transition-colors ${
                    currentPoints.length > 0 || canUndo
                      ? 'bg-orange-600 text-white hover:bg-orange-700'
                      : 'hover:bg-gray-700 text-gray-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed'
                  }`} 
                  title={
                    pencilMode && currentPoints.length > 0 
                      ? "Remove Last Point" 
                      : cards.length === 0 && deletedCardsBackup?.length > 0
                        ? `Restore ${deletedCardsBackup.length} Deleted Cards`
                        : `Undo (${undoCount} actions)`
                  }
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                </button>
                <button 
                  onClick={redoAction}
                  disabled={redoCount === 0}
                  className={`p-2 rounded-lg transition-colors ${
                    redoCount > 0
                      ? 'bg-orange-600 text-white hover:bg-orange-700'
                      : 'hover:bg-gray-700 text-gray-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed'
                  }`} 
                  title={`Redo (${redoCount} actions)`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                  </svg>
                </button>
                {/* Delete All Button - different behavior in isolation mode */}
                <button 
                  onClick={isolatedCardId ? deleteAllTextBoxes : deleteAllCards}
                  disabled={isolatedCardId 
                    ? !(cards.find(c => c.id === isolatedCardId)?.textBoxes?.length > 0)
                    : cards.length === 0
                  }
                  className={`p-2 rounded-lg transition-colors ${
                    (isolatedCardId 
                      ? cards.find(c => c.id === isolatedCardId)?.textBoxes?.length > 0
                      : cards.length > 0)
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'hover:bg-gray-700 text-gray-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed'
                  }`} 
                  title={isolatedCardId 
                    ? `Delete All Text Boxes (${cards.find(c => c.id === isolatedCardId)?.textBoxes?.length || 0})`
                    : `Delete All Cards (${cards.length})`
                  }
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                
                <div className="w-px h-6 bg-gray-600 mx-2" />
                
                {/* Settings Icon (decorative - no function) */}
                <button 
                  className="p-2 rounded-lg text-gray-500 cursor-default"
                  title="Page Settings"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
                
                {/* Save Layout Button (Quick Save) */}
                <button
                  onClick={handleSaveLayout}
                  disabled={isSaving}
                  className={`p-2 rounded-lg transition-colors ${
                    isSaving 
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                      : hasUnsavedChanges
                        ? 'bg-orange-600 text-white hover:bg-orange-700'
                        : 'hover:bg-gray-700 text-gray-300 hover:text-white'
                  }`}
                  title={isSaving ? "Saving..." : `Quick Save${currentSlot ? ` to "${currentSlot.name}"` : ''}`}
                >
                  {isSaving ? (
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                  )}
                </button>
                
                {/* Manage Layouts Button */}
                <button
                  onClick={() => !isolatedCardId && openSavePanel()}
                  disabled={!!isolatedCardId}
                  className={`p-2 rounded-lg transition-colors ${
                    isolatedCardId
                      ? 'opacity-40 cursor-not-allowed text-gray-500'
                      : saveMode && showSettingsPane
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'hover:bg-gray-700 text-gray-300 hover:text-white'
                  }`}
                  title={isolatedCardId ? "Exit isolation mode first" : "Manage Layouts"}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </button>
              </div>
              
              {/* Close Toolbar Button */}
              <button
                onClick={() => setToolbarMode(false)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-all duration-300 ${
                  showSettingsPane ? 'mr-12' : ''
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Close Tools
              </button>
              
              {/* Settings Pane Toggle - Right Edge */}
              <button 
                onClick={() => setShowSettingsPane(!showSettingsPane)}
                className={`fixed right-4 top-1/2 -translate-y-1/2 p-3 rounded-l-lg transition-all duration-300 z-50 shadow-lg ${
                  showSettingsPane
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 translate-x-[calc(100%-12px)]'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-600'
                }`}
                style={{ right: showSettingsPane ? '384px' : '0' }}
                title={showSettingsPane ? "Hide Settings Pane" : "Open Settings Pane"}
              >
                <svg 
                  className={`w-5 h-5 transition-transform duration-300 ${showSettingsPane ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </>
          ) : (
            /* Normal Navbar Preview Mode */
            <>
              <div className="text-gray-400 font-medium">{SITE_NAME}</div>
              <div className="flex items-center gap-6 text-sm text-gray-400">
                <span className={pageId === 'home' ? 'text-blue-500 font-medium' : ''}>Home</span>
                <span className={pageId === 'journals' ? 'text-blue-500 font-medium' : ''}>Journals</span>
                <span className={pageId === 'about' ? 'text-blue-500 font-medium' : ''}>About</span>
                <span className={pageId === 'contact' ? 'text-blue-500 font-medium' : ''}>Contact</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setToolbarMode(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add Cards
                </button>
                <button
                  onClick={handlePublishLayout}
                  disabled={isSaving}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-white text-sm font-medium transition-colors ${
                    isSaving 
                      ? 'bg-green-800 cursor-not-allowed' 
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {isSaving ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  )}
                  {isSaving ? 'Publishing...' : 'Publish Layout'}
                </button>
                <div className="w-8 h-8 rounded-full bg-gray-200" />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Fixed Wallpaper with parallax */}
      <div className="fixed top-28 left-0 right-0 w-full h-screen overflow-hidden z-0">
        {currentWallpaper?.url ? (
          <img 
            src={currentWallpaper.url} 
            alt={currentWallpaper.alt || 'Page wallpaper'}
            className="w-full object-cover"
            style={{
              height: '150vh',
              transform: `translateY(-${imageOffset}px)`,
              filter: currentWallpaper.blur ? `blur(${currentWallpaper.blur}px)` : 'none'
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
              <p className="text-sm mt-1">Set wallpaper in Dashboard → Web UI → {pageId}</p>
            </div>
          </div>
        )}
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/30" />
      </div>

      {/* Scroll Progress Indicator - Shows when inspector mode is active */}
      {inspectorMode && (
        <div 
          className={`fixed top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-2 transition-all duration-300 ${
            showSettingsPane ? 'right-[408px]' : 'right-6'
          }`}
        >
          {/* Progress bar track */}
          <div className="relative w-3 h-48 bg-gray-800/50 rounded-full overflow-hidden backdrop-blur-sm border border-white/20">
            {/* Progress bar fill (inverted - shows remaining) */}
            <div 
              className="absolute bottom-0 left-0 right-0 bg-blue-500 transition-all duration-150"
              style={{ 
                height: `${Math.max(0, 100 - Math.min(100, (scrollProgress / (document.documentElement.scrollHeight - window.innerHeight)) * 100))}%` 
              }}
            />
          </div>
          {/* Percentage label */}
          <div className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-md shadow-lg">
            {Math.max(0, Math.round(100 - Math.min(100, (scrollProgress / (document.documentElement.scrollHeight - window.innerHeight)) * 100)))}%
          </div>
          <span className="text-white text-xs font-medium bg-gray-900/70 px-2 py-1 rounded backdrop-blur-sm">
            remaining
          </span>
        </div>
      )}

      {/* Isolation Mode Overlay - Shows when editing a card's content */}
      {isolatedCardId && (() => {
        const card = cards.find(c => c.id === isolatedCardId)
        if (!card) return null
        
        const bounds = getCardBounds(card.points)
        const cardWidth = bounds.maxX - bounds.minX
        const cardHeight = bounds.maxY - bounds.minY
        const textBoxes = card.textBoxes || []
        
        // Calculate scale to fit card nicely in viewport (max 80% of viewport, accounting for toolbar)
        const maxWidth = window.innerWidth * 0.7
        const maxHeight = (window.innerHeight - 112) * 0.75 // 112px = toolbar height (top-28)
        const scaleX = maxWidth / cardWidth
        const scaleY = maxHeight / cardHeight
        const scale = Math.min(scaleX, scaleY, 1.5) // Cap at 1.5x
        
        const scaledWidth = cardWidth * scale
        const scaledHeight = cardHeight * scale
        
        // Grid spacing for the card's internal grid
        const CARD_GRID_SPACING = 20
        
        return (
          <div 
            className="fixed top-28 left-0 right-0 bottom-0 z-40 flex items-center justify-center"
            onClick={(e) => {
              // Only deselect text box if clicking on the backdrop
              if (e.target === e.currentTarget) {
                setSelectedTextBoxId(null)
                setEditingTextBoxId(null)
              }
            }}
          >
            {/* Dark backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            
            {/* Centered card container */}
            <div 
              className="relative bg-white rounded-lg shadow-2xl overflow-hidden"
              style={{ 
                width: scaledWidth, 
                height: scaledHeight,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Card internal grid (for positioning) - only shows when grid tool is active */}
              {showGrid && (
                <div 
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage: `radial-gradient(circle, rgba(0,0,0,0.15) 1px, transparent 1px)`,
                    backgroundSize: `${CARD_GRID_SPACING}px ${CARD_GRID_SPACING}px`,
                  }}
                />
              )}
              
              {/* Text boxes */}
              {textBoxes.map((tb) => {
                const isSelected = selectedTextBoxId === tb.id
                const isEditing = editingTextBoxId === tb.id
                
                // Check if text box selection is blocked (Image tab active without move mode)
                const isTextSelectionBlocked = propertiesMode && elementsSubTab === 'image' && !moveMode
                
                return (
                  <div
                    key={tb.id}
                    className={`absolute border-2 transition-colors overflow-hidden box-border ${
                      eraserMode ? 'cursor-pointer hover:border-red-500 hover:bg-red-500/20' :
                      moveMode ? 'cursor-move' :
                      resizeMode ? '' : // Use inline style for custom cursor
                      isTextSelectionBlocked ? 'cursor-not-allowed opacity-50' :
                      'cursor-default'
                    } ${
                      isSelected ? 'border-cyan-500' : 
                      isTextSelectionBlocked ? 'border-transparent' : 
                      'border-transparent hover:border-cyan-300'
                    }`}
                    style={{
                      left: tb.x * scale,
                      top: tb.y * scale,
                      width: tb.width * scale,
                      height: tb.height * scale,
                      minWidth: 0,
                      minHeight: 0,
                      ...(resizeMode && { cursor: RESIZE_CURSOR }),
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (eraserMode) {
                        // Delete text box with eraser
                        deleteTextBox(isolatedCardId, tb.id)
                        return
                      }
                      // Selection restriction: if Image tab is active and not in move mode, don't select text
                      if (propertiesMode && elementsSubTab === 'image' && !moveMode) {
                        return // Block text box selection when Image tab is active
                      }
                      setSelectedTextBoxId(tb.id)
                      // Deselect any image element when selecting a text box
                      setSelectedCardImageId(null)
                      setActiveImageSlotId(null)
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      if (eraserMode) return
                      // Selection restriction for double-click as well
                      if (propertiesMode && elementsSubTab === 'image' && !moveMode) {
                        return
                      }
                      setEditingTextBoxId(tb.id)
                    }}
                    onMouseDown={(e) => {
                      // Only allow dragging in move mode
                      if (!moveMode || isEditing) return
                      e.preventDefault()
                      const startX = e.clientX
                      const startY = e.clientY
                      const startTbX = tb.x
                      const startTbY = tb.y
                      let currentX = startTbX
                      let currentY = startTbY
                      
                      const handleMouseMove = (moveEvent) => {
                        const dx = (moveEvent.clientX - startX) / scale
                        const dy = (moveEvent.clientY - startY) / scale
                        currentX = Math.max(0, Math.min(cardWidth - tb.width, startTbX + dx))
                        currentY = Math.max(0, Math.min(cardHeight - tb.height, startTbY + dy))
                        updateTextBox(isolatedCardId, tb.id, { x: currentX, y: currentY })
                      }
                      
                      const handleMouseUp = () => {
                        // Snap to grid
                        const snappedX = Math.round(currentX / CARD_GRID_SPACING) * CARD_GRID_SPACING
                        const snappedY = Math.round(currentY / CARD_GRID_SPACING) * CARD_GRID_SPACING
                        updateTextBox(isolatedCardId, tb.id, { x: snappedX, y: snappedY })
                        // Record move to history
                        recordTextBoxMove(isolatedCardId, tb.id, startTbX, startTbY, snappedX, snappedY)
                        window.removeEventListener('mousemove', handleMouseMove)
                        window.removeEventListener('mouseup', handleMouseUp)
                      }
                      
                      window.addEventListener('mousemove', handleMouseMove)
                      window.addEventListener('mouseup', handleMouseUp)
                    }}
                  >
                    {/* Text content */}
                    {isEditing ? (
                      <textarea
                        autoFocus
                        className="w-full h-full p-2 resize-none bg-transparent border-none outline-none"
                        style={{
                          fontSize: tb.fontSize * scale,
                          fontWeight: tb.fontWeight,
                          fontStyle: tb.fontStyle,
                          textAlign: tb.textAlign,
                          fontFamily: getFontStack(tb.fontFamily),
                        }}
                        value={tb.content}
                        onChange={(e) => updateTextBox(isolatedCardId, tb.id, { content: e.target.value })}
                        onBlur={() => setEditingTextBoxId(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setEditingTextBoxId(null)
                        }}
                      />
                    ) : (
                      <div 
                        className={`w-full h-full p-2 overflow-hidden pointer-events-none ${
                          tb.isQuote ? 'border-l-4 border-gray-400 pl-4 italic bg-gray-100/50' : ''
                        }`}
                        style={{
                          fontSize: tb.fontSize * scale,
                          fontWeight: tb.fontWeight,
                          fontStyle: tb.isQuote ? 'italic' : tb.fontStyle,
                          textAlign: tb.textAlign,
                          textDecoration: tb.textDecoration || 'none',
                          wordBreak: 'break-word',
                          whiteSpace: 'pre-wrap',
                          fontFamily: getFontStack(tb.fontFamily),
                        }}
                      >
                        {tb.listType === 'bullet' ? (
                          <ul className="list-disc list-inside">
                            {tb.content.split('\n').map((line, i) => <li key={i}>{line}</li>)}
                          </ul>
                        ) : tb.listType === 'numbered' ? (
                          <ol className="list-decimal list-inside">
                            {tb.content.split('\n').map((line, i) => <li key={i}>{line}</li>)}
                          </ol>
                        ) : tb.link ? (
                          <span className="text-blue-600 underline">{tb.content}</span>
                        ) : (
                          tb.content
                        )}
                      </div>
                    )}
                    
                    {/* Resize handles (when selected AND resize mode is active) */}
                    {isSelected && !isEditing && resizeMode && (
                      <>
                        {/* Right edge */}
                        <div 
                          className="absolute top-0 right-0 w-2 h-full cursor-ew-resize bg-cyan-500/50 hover:bg-cyan-500"
                          onMouseDown={(e) => {
                            e.stopPropagation()
                            const startX = e.clientX
                            const startWidth = tb.width
                            const startHeight = tb.height
                            let currentWidth = startWidth
                            
                            const handleMouseMove = (moveEvent) => {
                              const dx = (moveEvent.clientX - startX) / scale
                              currentWidth = Math.max(40, Math.min(cardWidth - tb.x, startWidth + dx))
                              updateTextBox(isolatedCardId, tb.id, { width: currentWidth })
                            }
                            
                            const handleMouseUp = () => {
                              const snappedWidth = Math.round(currentWidth / CARD_GRID_SPACING) * CARD_GRID_SPACING
                              const finalWidth = Math.max(40, snappedWidth)
                              updateTextBox(isolatedCardId, tb.id, { width: finalWidth })
                              // Record resize to history
                              recordTextBoxResize(isolatedCardId, tb.id, 
                                { width: startWidth, height: startHeight },
                                { width: finalWidth, height: startHeight }
                              )
                              window.removeEventListener('mousemove', handleMouseMove)
                              window.removeEventListener('mouseup', handleMouseUp)
                            }
                            
                            window.addEventListener('mousemove', handleMouseMove)
                            window.addEventListener('mouseup', handleMouseUp)
                          }}
                        />
                        {/* Bottom edge */}
                        <div 
                          className="absolute bottom-0 left-0 w-full h-2 cursor-ns-resize bg-cyan-500/50 hover:bg-cyan-500"
                          onMouseDown={(e) => {
                            e.stopPropagation()
                            const startY = e.clientY
                            const startWidth = tb.width
                            const startHeight = tb.height
                            let currentHeight = startHeight
                            
                            const handleMouseMove = (moveEvent) => {
                              const dy = (moveEvent.clientY - startY) / scale
                              currentHeight = Math.max(30, Math.min(cardHeight - tb.y, startHeight + dy))
                              updateTextBox(isolatedCardId, tb.id, { height: currentHeight })
                            }
                            
                            const handleMouseUp = () => {
                              const snappedHeight = Math.round(currentHeight / CARD_GRID_SPACING) * CARD_GRID_SPACING
                              const finalHeight = Math.max(30, snappedHeight)
                              updateTextBox(isolatedCardId, tb.id, { height: finalHeight })
                              // Record resize to history
                              recordTextBoxResize(isolatedCardId, tb.id,
                                { width: startWidth, height: startHeight },
                                { width: startWidth, height: finalHeight }
                              )
                              window.removeEventListener('mousemove', handleMouseMove)
                              window.removeEventListener('mouseup', handleMouseUp)
                            }
                            
                            window.addEventListener('mousemove', handleMouseMove)
                            window.addEventListener('mouseup', handleMouseUp)
                          }}
                        />
                        {/* Bottom-right corner */}
                        <div 
                          className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize bg-cyan-500 rounded-tl"
                          onMouseDown={(e) => {
                            e.stopPropagation()
                            const startX = e.clientX
                            const startY = e.clientY
                            const startWidth = tb.width
                            const startHeight = tb.height
                            let currentWidth = startWidth
                            let currentHeight = startHeight
                            
                            const handleMouseMove = (moveEvent) => {
                              const dx = (moveEvent.clientX - startX) / scale
                              const dy = (moveEvent.clientY - startY) / scale
                              currentWidth = Math.max(40, Math.min(cardWidth - tb.x, startWidth + dx))
                              currentHeight = Math.max(30, Math.min(cardHeight - tb.y, startHeight + dy))
                              updateTextBox(isolatedCardId, tb.id, { width: currentWidth, height: currentHeight })
                            }
                            
                            const handleMouseUp = () => {
                              const snappedWidth = Math.round(currentWidth / CARD_GRID_SPACING) * CARD_GRID_SPACING
                              const snappedHeight = Math.round(currentHeight / CARD_GRID_SPACING) * CARD_GRID_SPACING
                              const finalWidth = Math.max(40, snappedWidth)
                              const finalHeight = Math.max(30, snappedHeight)
                              updateTextBox(isolatedCardId, tb.id, { 
                                width: finalWidth, 
                                height: finalHeight 
                              })
                              // Record resize to history
                              recordTextBoxResize(isolatedCardId, tb.id,
                                { width: startWidth, height: startHeight },
                                { width: finalWidth, height: finalHeight }
                              )
                              window.removeEventListener('mousemove', handleMouseMove)
                              window.removeEventListener('mouseup', handleMouseUp)
                            }
                            
                            window.addEventListener('mousemove', handleMouseMove)
                            window.addEventListener('mouseup', handleMouseUp)
                          }}
                        />
                      </>
                    )}
                  </div>
                )
              })}
              
              {/* Image elements on card */}
              {(card.images || []).map((img) => {
                const isSelected = selectedCardImageId === img.id
                // Check if image selection is blocked (Text tab active without move mode)
                const isImageSelectionBlocked = propertiesMode && elementsSubTab === 'text' && !moveMode
                
                return (
                  <div
                    key={img.id}
                    className={`absolute border-2 transition-colors overflow-hidden box-border ${
                      eraserMode ? 'cursor-pointer hover:border-red-500 hover:bg-red-500/20' :
                      moveMode ? 'cursor-move' :
                      resizeMode ? '' : // Use inline style for custom cursor
                      isImageSelectionBlocked ? 'cursor-not-allowed opacity-50' :
                      'cursor-default'
                    } ${
                      isSelected ? 'border-blue-500' : 
                      isImageSelectionBlocked ? 'border-transparent' :
                      'border-transparent hover:border-blue-300'
                    }`}
                    style={{
                      left: img.x * scale,
                      top: img.y * scale,
                      width: img.width * scale,
                      height: img.height * scale,
                      backgroundColor: img.url ? 'transparent' : 'rgba(59, 130, 246, 0.1)',
                      ...(resizeMode && { cursor: RESIZE_CURSOR }),
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (eraserMode) {
                        // Delete image element with eraser
                        deleteCardImage(isolatedCardId, img.id)
                        return
                      }
                      // Selection restriction: if Text tab is active and not in move mode, don't select images
                      if (propertiesMode && elementsSubTab === 'text' && !moveMode) {
                        return // Block image selection when Text tab is active
                      }
                      setSelectedCardImageId(img.id)
                      // Also activate the linked slot
                      const slot = findSlotByImageElementId(img.id)
                      if (slot) {
                        setActiveImageSlotId(slot.id)
                      }
                      // Deselect any text box when selecting an image
                      setSelectedTextBoxId(null)
                      setEditingTextBoxId(null)
                    }}
                    onMouseDown={(e) => {
                      // Only allow dragging in move mode
                      if (!moveMode) return
                      e.preventDefault()
                      const startX = e.clientX
                      const startY = e.clientY
                      const startImgX = img.x
                      const startImgY = img.y
                      let currentX = startImgX
                      let currentY = startImgY
                      
                      const handleMouseMove = (moveEvent) => {
                        const dx = (moveEvent.clientX - startX) / scale
                        const dy = (moveEvent.clientY - startY) / scale
                        currentX = Math.max(0, Math.min(cardWidth - img.width, startImgX + dx))
                        currentY = Math.max(0, Math.min(cardHeight - img.height, startImgY + dy))
                        updateCardImage(isolatedCardId, img.id, { x: currentX, y: currentY })
                      }
                      
                      const handleMouseUp = () => {
                        // Snap to grid
                        const snappedX = Math.round(currentX / CARD_GRID_SPACING) * CARD_GRID_SPACING
                        const snappedY = Math.round(currentY / CARD_GRID_SPACING) * CARD_GRID_SPACING
                        updateCardImage(isolatedCardId, img.id, { x: snappedX, y: snappedY })
                        window.removeEventListener('mousemove', handleMouseMove)
                        window.removeEventListener('mouseup', handleMouseUp)
                      }
                      
                      window.addEventListener('mousemove', handleMouseMove)
                      window.addEventListener('mouseup', handleMouseUp)
                    }}
                  >
                    {/* Image content or placeholder */}
                    {img.url ? (
                      <img
                        src={img.url}
                        alt={img.alt || 'Image'}
                        className="w-full h-full object-cover pointer-events-none"
                        draggable={false}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-blue-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    
                    {/* Resize handles (when selected AND resize mode is active) */}
                    {isSelected && resizeMode && (
                      <>
                        {/* Right edge */}
                        <div 
                          className="absolute top-0 right-0 w-2 h-full cursor-ew-resize bg-blue-500/50 hover:bg-blue-500"
                          onMouseDown={(e) => {
                            e.stopPropagation()
                            const startX = e.clientX
                            const startWidth = img.width
                            let currentWidth = startWidth
                            
                            const handleMouseMove = (moveEvent) => {
                              const dx = (moveEvent.clientX - startX) / scale
                              currentWidth = Math.max(40, Math.min(cardWidth - img.x, startWidth + dx))
                              updateCardImage(isolatedCardId, img.id, { width: currentWidth })
                            }
                            
                            const handleMouseUp = () => {
                              const finalWidth = Math.round(currentWidth / CARD_GRID_SPACING) * CARD_GRID_SPACING || 40
                              updateCardImage(isolatedCardId, img.id, { width: finalWidth })
                              window.removeEventListener('mousemove', handleMouseMove)
                              window.removeEventListener('mouseup', handleMouseUp)
                            }
                            
                            window.addEventListener('mousemove', handleMouseMove)
                            window.addEventListener('mouseup', handleMouseUp)
                          }}
                        />
                        {/* Bottom edge */}
                        <div 
                          className="absolute bottom-0 left-0 w-full h-2 cursor-ns-resize bg-blue-500/50 hover:bg-blue-500"
                          onMouseDown={(e) => {
                            e.stopPropagation()
                            const startY = e.clientY
                            const startHeight = img.height
                            let currentHeight = startHeight
                            
                            const handleMouseMove = (moveEvent) => {
                              const dy = (moveEvent.clientY - startY) / scale
                              currentHeight = Math.max(40, Math.min(cardHeight - img.y, startHeight + dy))
                              updateCardImage(isolatedCardId, img.id, { height: currentHeight })
                            }
                            
                            const handleMouseUp = () => {
                              const finalHeight = Math.round(currentHeight / CARD_GRID_SPACING) * CARD_GRID_SPACING || 40
                              updateCardImage(isolatedCardId, img.id, { height: finalHeight })
                              window.removeEventListener('mousemove', handleMouseMove)
                              window.removeEventListener('mouseup', handleMouseUp)
                            }
                            
                            window.addEventListener('mousemove', handleMouseMove)
                            window.addEventListener('mouseup', handleMouseUp)
                          }}
                        />
                        {/* Corner (bottom-right) */}
                        <div 
                          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize bg-blue-500/70 hover:bg-blue-500"
                          onMouseDown={(e) => {
                            e.stopPropagation()
                            const startX = e.clientX
                            const startY = e.clientY
                            const startWidth = img.width
                            const startHeight = img.height
                            let currentWidth = startWidth
                            let currentHeight = startHeight
                            
                            const handleMouseMove = (moveEvent) => {
                              const dx = (moveEvent.clientX - startX) / scale
                              const dy = (moveEvent.clientY - startY) / scale
                              currentWidth = Math.max(40, Math.min(cardWidth - img.x, startWidth + dx))
                              currentHeight = Math.max(40, Math.min(cardHeight - img.y, startHeight + dy))
                              updateCardImage(isolatedCardId, img.id, { width: currentWidth, height: currentHeight })
                            }
                            
                            const handleMouseUp = () => {
                              const finalWidth = Math.round(currentWidth / CARD_GRID_SPACING) * CARD_GRID_SPACING || 40
                              const finalHeight = Math.round(currentHeight / CARD_GRID_SPACING) * CARD_GRID_SPACING || 40
                              updateCardImage(isolatedCardId, img.id, { width: finalWidth, height: finalHeight })
                              window.removeEventListener('mousemove', handleMouseMove)
                              window.removeEventListener('mouseup', handleMouseUp)
                            }
                            
                            window.addEventListener('mousemove', handleMouseMove)
                            window.addEventListener('mouseup', handleMouseUp)
                          }}
                        />
                      </>
                    )}
                  </div>
                )
              })}
              
              {/* Card resize controls */}
              <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 text-white text-sm">
                <span className="bg-gray-900/80 px-2 py-1 rounded text-xs">
                  {Math.round(cardWidth)} × {Math.round(cardHeight)}px
                </span>
                <span className="bg-gray-900/80 px-2 py-1 rounded text-xs text-cyan-400">
                  Scale: {(scale * 100).toFixed(0)}%
                </span>
              </div>
            </div>
            
            {/* Instructions and Done Button */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center text-white">
              <p className="text-sm text-gray-300 mb-3">
                Click text to select • Double-click to edit • Drag to move
              </p>
              <button
                onClick={exitIsolationMode}
                className="flex items-center gap-2 px-6 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition-colors mx-auto"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Done Editing
              </button>
              <p className="text-xs text-gray-500 mt-2">
                or press ESC
              </p>
            </div>
          </div>
        )
      })()}

      {/* Canvas Overlay - Cards and optional Grid dots (scrolls with page content, independent of wallpaper) */}
      <div 
        ref={gridRef}
        onClick={handleGridClick}
        onMouseMove={handleGridMouseMove}
        onMouseUp={handleGridMouseUp}
        onMouseDown={handleEdgeMouseDown}
        onMouseLeave={() => { 
          setMousePos(null); 
          setHoveredCardId(null);
          setHoveredEdge(null);
          if (isDragging) {
            // Cancel drag if mouse leaves the grid
            setIsDragging(false)
            setDragStart(null)
            setDragOffset({ x: 0, y: 0 })
          }
          if (resizingEdge) {
            // Cancel resize if mouse leaves
            setResizingEdge(null)
            setDragStart(null)
            setResizeOffset(0)
          }
        }}
        className={`absolute top-28 left-0 right-0 z-10 ${
          pencilMode ? 'cursor-crosshair' : 
          eraserMode ? 'cursor-pointer' : 
          moveMode ? (isDragging ? 'cursor-grabbing' : 'cursor-default') :
          selectMode ? 'cursor-pointer' :
          propertiesMode ? 'cursor-pointer' :
          resizeMode ? (
            resizingEdge ? (resizingEdge.edge === 'top' || resizingEdge.edge === 'bottom' ? 'cursor-ns-resize' : 'cursor-ew-resize') :
            hoveredEdge ? (hoveredEdge.edge === 'top' || hoveredEdge.edge === 'bottom' ? 'cursor-ns-resize' : 'cursor-ew-resize') :
            '' // Use inline style for custom cursor
          ) :
          'pointer-events-none'
        }`}
        style={{
          height: `${conveyorLength}vh`,
          // Custom resize cursor when resize mode is active but not hovering over edges
          ...(resizeMode && !resizingEdge && !hoveredEdge && { cursor: RESIZE_CURSOR }),
          // Only show grid dots when showGrid is true
          ...(showGrid && {
            backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.7) 3px, transparent 3px)`,
            backgroundSize: `${GRID_SPACING}px ${GRID_SPACING}px`,
            backgroundPosition: `${GRID_SPACING / 2}px ${GRID_SPACING / 2}px`
          })
        }}
      >
          {/* SVG layer for drawing cards */}
          <svg className="absolute inset-0 w-full h-full overflow-visible" style={{ pointerEvents: (eraserMode || moveMode || selectMode || propertiesMode || (pencilMode && currentPoints.length === 0)) ? 'auto' : 'none' }}>
            {/* Completed cards (hidden when hideSlotContents is true) */}
            {!hideSlotContents && cards.map(card => {
              const isBeingDragged = moveMode && isDragging && selectedCardId === card.id
              const isBeingResized = resizeMode && resizingEdge && resizingEdge.cardId === card.id
              
              // Calculate display points with resize offset applied
              let displayPoints = card.points
              if (isBeingDragged) {
                displayPoints = card.points.map(p => ({ x: p.x + dragOffset.x, y: p.y + dragOffset.y }))
              } else if (isBeingResized) {
                const bounds = getCardBounds(card.points)
                let { minX, maxX, minY, maxY } = bounds
                const edge = resizingEdge.edge
                
                // Apply preview offset
                switch (edge) {
                  case 'top': minY += resizeOffset; break
                  case 'bottom': maxY += resizeOffset; break
                  case 'left': minX += resizeOffset; break
                  case 'right': maxX += resizeOffset; break
                }
                
                // Enforce minimum size
                if (edge === 'top') minY = Math.min(minY, maxY - GRID_SPACING)
                if (edge === 'bottom') maxY = Math.max(maxY, minY + GRID_SPACING)
                if (edge === 'left') minX = Math.min(minX, maxX - GRID_SPACING)
                if (edge === 'right') maxX = Math.max(maxX, minX + GRID_SPACING)
                
                displayPoints = [
                  { x: minX, y: minY },
                  { x: maxX, y: minY },
                  { x: maxX, y: maxY },
                  { x: minX, y: maxY },
                ]
              }
              
              const pathD = `M ${displayPoints[0].x} ${displayPoints[0].y} L ${displayPoints[1].x} ${displayPoints[1].y} L ${displayPoints[2].x} ${displayPoints[2].y} L ${displayPoints[3].x} ${displayPoints[3].y} Z`
              const isHovered = hoveredCardId === card.id
              const isInspected = isInspectorActive && inspectedCardId === card.id
              const isSelectedForMove = moveMode && selectedCardId === card.id
              const isSelectedCard = selectMode && selectedCards.includes(card.id)
              const isActiveCard = pencilMode && activeCardId === card.id
              const hasHoveredEdge = resizeMode && hoveredEdge && hoveredEdge.cardId === card.id
              const dimensions = getCardDimensions(displayPoints)
              const cardStyle = getCardStyle(card)
              
              // Convert hex color + opacity to rgba
              const hexToRgba = (hex, opacity) => {
                const r = parseInt(hex.slice(1, 3), 16)
                const g = parseInt(hex.slice(3, 5), 16)
                const b = parseInt(hex.slice(5, 7), 16)
                return `rgba(${r}, ${g}, ${b}, ${opacity})`
              }
              
              return (
                <g 
                  key={card.id}
                  className={eraserMode ? 'cursor-pointer' : moveMode ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : selectMode ? 'cursor-pointer' : propertiesMode ? 'cursor-pointer' : (pencilMode && currentPoints.length === 0) ? 'cursor-pointer' : isInspectorActive ? 'cursor-help' : ''}
                  style={{ pointerEvents: (eraserMode || moveMode || selectMode || propertiesMode || isInspectorActive || (pencilMode && currentPoints.length === 0)) ? 'auto' : 'none' }}
                  onMouseEnter={() => {
                    if (eraserMode || moveMode || selectMode || propertiesMode) setHoveredCardId(card.id)
                    if (pencilMode && currentPoints.length === 0 && !activeCardId) setHoveredCardId(card.id)
                    if (isInspectorActive) setInspectedCardId(card.id)
                  }}
                  onMouseLeave={() => {
                    if ((eraserMode || moveMode || selectMode || propertiesMode) && !isDragging) setHoveredCardId(null)
                    if (pencilMode && currentPoints.length === 0 && !activeCardId) setHoveredCardId(null)
                    if (isInspectorActive) setInspectedCardId(null)
                  }}
                  onMouseDown={(e) => handleCardMouseDown(e, card.id)}
                  onClick={(e) => {
                    if (eraserMode) {
                      e.stopPropagation()
                      deleteCard(card.id)
                    }
                    if (selectMode) {
                      e.stopPropagation()
                      toggleCardSelection(card.id)
                    }
                    if (propertiesMode && !isolatedCardId) {
                      e.stopPropagation()
                      enterIsolationMode(card.id)
                    }
                    // Pencil mode - toggle active card for styling
                    if (pencilMode && currentPoints.length === 0) {
                      e.stopPropagation()
                      toggleActiveCard(card.id)
                    }
                  }}
                >
                  {/* Active card glow effect */}
                  {isActiveCard && (
                    <rect 
                      x={dimensions.minX}
                      y={dimensions.minY}
                      width={dimensions.maxX - dimensions.minX}
                      height={dimensions.maxY - dimensions.minY}
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth="8"
                      opacity="0.5"
                      rx={cardStyle.borderRadius}
                      ry={cardStyle.borderRadius}
                      className="animate-pulse"
                    />
                  )}
                  <rect 
                    x={dimensions.minX}
                    y={dimensions.minY}
                    width={dimensions.maxX - dimensions.minX}
                    height={dimensions.maxY - dimensions.minY}
                    fill={
                      eraserMode && isHovered ? "rgba(239,68,68,0.3)" :
                      isBeingDragged ? "rgba(147,51,234,0.3)" :
                      isBeingResized ? "rgba(245,158,11,0.2)" :
                      moveMode && isHovered ? "rgba(147,51,234,0.2)" :
                      propertiesMode && isHovered ? "rgba(6,182,212,0.25)" :
                      isSelectedCard ? "rgba(6,182,212,0.25)" :
                      selectMode && isHovered ? "rgba(6,182,212,0.15)" :
                      isInspected ? "rgba(59,130,246,0.15)" :
                      isActiveCard ? hexToRgba(cardStyle.backgroundColor, cardStyle.opacity) :
                      (pencilMode && isHovered && currentPoints.length === 0 && !activeCardId) ? "rgba(34,197,94,0.15)" :
                      hexToRgba(cardStyle.backgroundColor, cardStyle.opacity)
                    }
                    stroke={
                      eraserMode && isHovered ? "#ef4444" :
                      isBeingDragged ? "#9333ea" :
                      isBeingResized ? "#f59e0b" :
                      moveMode && isHovered ? "#9333ea" :
                      propertiesMode && isHovered ? "#06b6d4" :
                      isSelectedCard ? "#06b6d4" :
                      selectMode && isHovered ? "#06b6d4" :
                      isInspected ? "#3b82f6" :
                      isActiveCard ? "#22c55e" :
                      (pencilMode && isHovered && currentPoints.length === 0 && !activeCardId) ? "#22c55e" :
                      cardStyle.borderWidth > 0 ? cardStyle.borderColor : "transparent"
                    }
                    strokeWidth={
                      (isHovered && !activeCardId) || isBeingDragged || isInspected || isSelectedCard || isBeingResized || isActiveCard ? "3" : 
                      cardStyle.borderWidth > 0 ? cardStyle.borderWidth : "0"
                    }
                    strokeDasharray={
                      isBeingDragged || isBeingResized ? "8,4" : 
                      cardStyle.borderStyle === 'dashed' ? "8,4" :
                      cardStyle.borderStyle === 'dotted' ? "2,4" :
                      "none"
                    }
                    rx={cardStyle.borderRadius}
                    ry={cardStyle.borderRadius}
                    className="transition-all duration-150"
                  />
                  {/* Edge highlight lines for resize mode */}
                  {resizeMode && (hasHoveredEdge || isBeingResized) && (() => {
                    const edge = isBeingResized ? resizingEdge.edge : hoveredEdge?.edge
                    const { minX, maxX, minY, maxY } = dimensions
                    let lineProps = {}
                    
                    switch (edge) {
                      case 'top':
                        lineProps = { x1: minX, y1: minY, x2: maxX, y2: minY }
                        break
                      case 'bottom':
                        lineProps = { x1: minX, y1: maxY, x2: maxX, y2: maxY }
                        break
                      case 'left':
                        lineProps = { x1: minX, y1: minY, x2: minX, y2: maxY }
                        break
                      case 'right':
                        lineProps = { x1: maxX, y1: minY, x2: maxX, y2: maxY }
                        break
                    }
                    
                    return (
                      <line
                        {...lineProps}
                        stroke="#f59e0b"
                        strokeWidth="6"
                        strokeLinecap="round"
                      />
                    )
                  })()}
                  {/* Dimensions display - show when inspected OR when inspector mode is active for all cards */}
                  {(isInspected || inspectorMode) && (
                    <>
                      <rect
                        x={dimensions.centerX - 45}
                        y={dimensions.centerY - 14}
                        width={90}
                        height={28}
                        rx={4}
                        fill={isInspected ? "#3b82f6" : "#1e40af"}
                      />
                      <text
                        x={dimensions.centerX}
                        y={dimensions.centerY}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="white"
                        fontSize="12"
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        {dimensions.width} × {dimensions.height}px
                      </text>
                    </>
                  )}
                  {/* Delete icon when hovered in eraser mode */}
                  {eraserMode && isHovered && (
                    <>
                      <rect
                        x={(displayPoints[0].x + displayPoints[2].x) / 2 - 16}
                        y={(displayPoints[0].y + displayPoints[2].y) / 2 - 16}
                        width={32}
                        height={32}
                        rx={6}
                        fill="#ef4444"
                      />
                      <text
                        x={(displayPoints[0].x + displayPoints[2].x) / 2}
                        y={(displayPoints[0].y + displayPoints[2].y) / 2}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="white"
                        fontSize="20"
                        fontWeight="bold"
                      >
                        ×
                      </text>
                    </>
                  )}
                  {/* Move icon when hovered in move mode */}
                  {moveMode && isHovered && !isBeingDragged && (
                    <>
                      <rect
                        x={(displayPoints[0].x + displayPoints[2].x) / 2 - 16}
                        y={(displayPoints[0].y + displayPoints[2].y) / 2 - 16}
                        width={32}
                        height={32}
                        rx={6}
                        fill="#9333ea"
                      />
                      <text
                        x={(displayPoints[0].x + displayPoints[2].x) / 2}
                        y={(displayPoints[0].y + displayPoints[2].y) / 2}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="white"
                        fontSize="16"
                        fontWeight="bold"
                      >
                        ↔
                      </text>
                    </>
                  )}
                  {/* Edit icon when hovered in properties mode */}
                  {propertiesMode && isHovered && !isolatedCardId && (
                    <>
                      <rect
                        x={(displayPoints[0].x + displayPoints[2].x) / 2 - 20}
                        y={(displayPoints[0].y + displayPoints[2].y) / 2 - 20}
                        width={40}
                        height={40}
                        rx={8}
                        fill="#06b6d4"
                      />
                      <text
                        x={(displayPoints[0].x + displayPoints[2].x) / 2}
                        y={(displayPoints[0].y + displayPoints[2].y) / 2}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="white"
                        fontSize="18"
                        fontWeight="bold"
                      >
                        ✎
                      </text>
                    </>
                  )}
                  {/* Selection checkmark when selected with select tool */}
                  {isSelectedCard && (
                    <>
                      <circle
                        cx={displayPoints[1].x - 12}
                        cy={displayPoints[1].y + 12}
                        r={12}
                        fill="#06b6d4"
                        stroke="white"
                        strokeWidth={2}
                      />
                      <text
                        x={displayPoints[1].x - 12}
                        y={displayPoints[1].y + 12}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="white"
                        fontSize="14"
                        fontWeight="bold"
                      >
                        ✓
                      </text>
                    </>
                  )}
                  {/* Anchor points on completed cards */}
                  {!isHovered && !isBeingDragged && !isSelectedCard && displayPoints.map((point, idx) => (
                    <circle
                      key={idx}
                      cx={point.x}
                      cy={point.y}
                      r={5}
                      fill="#3b82f6"
                      stroke="white"
                      strokeWidth={2}
                    />
                  ))}
                  {/* Text boxes on cards */}
                  {(card.textBoxes || []).map((tb) => {
                    const tbX = dimensions.minX + tb.x + (isBeingDragged ? dragOffset.x : 0)
                    const tbY = dimensions.minY + tb.y + (isBeingDragged ? dragOffset.y : 0)
                    return (
                      <foreignObject
                        key={tb.id}
                        x={tbX}
                        y={tbY}
                        width={tb.width}
                        height={tb.height}
                        style={{ pointerEvents: 'none' }}
                      >
                        <div 
                          xmlns="http://www.w3.org/1999/xhtml"
                          style={{
                            width: '100%',
                            height: '100%',
                            fontSize: `${tb.fontSize}px`,
                            fontWeight: tb.fontWeight,
                            fontStyle: tb.isQuote ? 'italic' : tb.fontStyle,
                            textAlign: tb.textAlign,
                            textDecoration: tb.textDecoration || 'none',
                            fontFamily: getFontStack(tb.fontFamily),
                            overflow: 'hidden',
                            padding: '4px',
                            color: tb.link ? '#2563eb' : '#000',
                            borderLeft: tb.isQuote ? '3px solid #9ca3af' : 'none',
                            paddingLeft: tb.isQuote ? '12px' : '4px',
                            backgroundColor: tb.isQuote ? 'rgba(243,244,246,0.5)' : 'transparent',
                          }}
                        >
                          {tb.listType === 'bullet' ? (
                            <ul style={{ listStyleType: 'disc', listStylePosition: 'inside', margin: 0, padding: 0 }}>
                              {tb.content.split('\n').map((line, i) => <li key={i}>{line}</li>)}
                            </ul>
                          ) : tb.listType === 'numbered' ? (
                            <ol style={{ listStyleType: 'decimal', listStylePosition: 'inside', margin: 0, padding: 0 }}>
                              {tb.content.split('\n').map((line, i) => <li key={i}>{line}</li>)}
                            </ol>
                          ) : (
                            tb.content
                          )}
                        </div>
                      </foreignObject>
                    )
                  })}
                </g>
              )
            })}

            {/* Distance measurements between cards when inspector mode is active */}
            {inspectorMode && cards.length >= 2 && (() => {
              const distances = []
              
              // For each pair of cards, calculate horizontal and vertical distances
              for (let i = 0; i < cards.length; i++) {
                for (let j = i + 1; j < cards.length; j++) {
                  const card1Bounds = getCardBounds(cards[i].points)
                  const card2Bounds = getCardBounds(cards[j].points)
                  
                  // Check horizontal gap (card2 is to the right of card1)
                  if (card2Bounds.minX > card1Bounds.maxX) {
                    // Check if they overlap vertically
                    const vertOverlap = !(card2Bounds.maxY < card1Bounds.minY || card2Bounds.minY > card1Bounds.maxY)
                    if (vertOverlap) {
                      const gap = card2Bounds.minX - card1Bounds.maxX
                      const midY = Math.max(card1Bounds.minY, card2Bounds.minY) + 
                                   (Math.min(card1Bounds.maxY, card2Bounds.maxY) - Math.max(card1Bounds.minY, card2Bounds.minY)) / 2
                      distances.push({
                        type: 'horizontal',
                        x1: card1Bounds.maxX,
                        x2: card2Bounds.minX,
                        y: midY,
                        gap
                      })
                    }
                  }
                  // Check horizontal gap (card1 is to the right of card2)
                  else if (card1Bounds.minX > card2Bounds.maxX) {
                    const vertOverlap = !(card2Bounds.maxY < card1Bounds.minY || card2Bounds.minY > card1Bounds.maxY)
                    if (vertOverlap) {
                      const gap = card1Bounds.minX - card2Bounds.maxX
                      const midY = Math.max(card1Bounds.minY, card2Bounds.minY) + 
                                   (Math.min(card1Bounds.maxY, card2Bounds.maxY) - Math.max(card1Bounds.minY, card2Bounds.minY)) / 2
                      distances.push({
                        type: 'horizontal',
                        x1: card2Bounds.maxX,
                        x2: card1Bounds.minX,
                        y: midY,
                        gap
                      })
                    }
                  }
                  
                  // Check vertical gap (card2 is below card1)
                  if (card2Bounds.minY > card1Bounds.maxY) {
                    // Check if they overlap horizontally
                    const horizOverlap = !(card2Bounds.maxX < card1Bounds.minX || card2Bounds.minX > card1Bounds.maxX)
                    if (horizOverlap) {
                      const gap = card2Bounds.minY - card1Bounds.maxY
                      const midX = Math.max(card1Bounds.minX, card2Bounds.minX) + 
                                   (Math.min(card1Bounds.maxX, card2Bounds.maxX) - Math.max(card1Bounds.minX, card2Bounds.minX)) / 2
                      distances.push({
                        type: 'vertical',
                        y1: card1Bounds.maxY,
                        y2: card2Bounds.minY,
                        x: midX,
                        gap
                      })
                    }
                  }
                  // Check vertical gap (card1 is below card2)
                  else if (card1Bounds.minY > card2Bounds.maxY) {
                    const horizOverlap = !(card2Bounds.maxX < card1Bounds.minX || card2Bounds.minX > card1Bounds.maxX)
                    if (horizOverlap) {
                      const gap = card1Bounds.minY - card2Bounds.maxY
                      const midX = Math.max(card1Bounds.minX, card2Bounds.minX) + 
                                   (Math.min(card1Bounds.maxX, card2Bounds.maxX) - Math.max(card1Bounds.minX, card2Bounds.minX)) / 2
                      distances.push({
                        type: 'vertical',
                        y1: card2Bounds.maxY,
                        y2: card1Bounds.minY,
                        x: midX,
                        gap
                      })
                    }
                  }
                }
              }
              
              return distances.map((d, idx) => (
                <g key={`distance-${idx}`}>
                  {d.type === 'horizontal' ? (
                    <>
                      {/* Horizontal distance line */}
                      <line
                        x1={d.x1}
                        y1={d.y}
                        x2={d.x2}
                        y2={d.y}
                        stroke="#f97316"
                        strokeWidth="2"
                        strokeDasharray="4,2"
                      />
                      {/* End caps */}
                      <line x1={d.x1} y1={d.y - 8} x2={d.x1} y2={d.y + 8} stroke="#f97316" strokeWidth="2" />
                      <line x1={d.x2} y1={d.y - 8} x2={d.x2} y2={d.y + 8} stroke="#f97316" strokeWidth="2" />
                      {/* Label */}
                      <rect
                        x={(d.x1 + d.x2) / 2 - 22}
                        y={d.y - 22}
                        width={44}
                        height={18}
                        rx={3}
                        fill="#f97316"
                      />
                      <text
                        x={(d.x1 + d.x2) / 2}
                        y={d.y - 13}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="white"
                        fontSize="10"
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        {Math.round(d.gap)}px
                      </text>
                    </>
                  ) : (
                    <>
                      {/* Vertical distance line */}
                      <line
                        x1={d.x}
                        y1={d.y1}
                        x2={d.x}
                        y2={d.y2}
                        stroke="#f97316"
                        strokeWidth="2"
                        strokeDasharray="4,2"
                      />
                      {/* End caps */}
                      <line x1={d.x - 8} y1={d.y1} x2={d.x + 8} y2={d.y1} stroke="#f97316" strokeWidth="2" />
                      <line x1={d.x - 8} y1={d.y2} x2={d.x + 8} y2={d.y2} stroke="#f97316" strokeWidth="2" />
                      {/* Label */}
                      <rect
                        x={d.x + 6}
                        y={(d.y1 + d.y2) / 2 - 9}
                        width={44}
                        height={18}
                        rx={3}
                        fill="#f97316"
                      />
                      <text
                        x={d.x + 28}
                        y={(d.y1 + d.y2) / 2}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="white"
                        fontSize="10"
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        {Math.round(d.gap)}px
                      </text>
                    </>
                  )}
                </g>
              ))
            })()}

            {/* Rectangle preview while drawing */}
            {currentPoints.length === 1 && mousePos && mousePos.x !== currentPoints[0].x && mousePos.y !== currentPoints[0].y && (() => {
              const previewWidth = Math.abs(mousePos.x - currentPoints[0].x)
              const previewHeight = Math.abs(mousePos.y - currentPoints[0].y)
              const previewCenterX = (currentPoints[0].x + mousePos.x) / 2
              const previewCenterY = (currentPoints[0].y + mousePos.y) / 2
              return (
              <g>
                {/* Preview rectangle outline */}
                <rect
                  x={Math.min(currentPoints[0].x, mousePos.x)}
                  y={Math.min(currentPoints[0].y, mousePos.y)}
                  width={previewWidth}
                  height={previewHeight}
                  fill="rgba(34, 197, 94, 0.2)"
                  stroke="#22c55e"
                  strokeWidth="2"
                  strokeDasharray="8,4"
                />
                {/* Dimensions label */}
                <rect
                  x={previewCenterX - 45}
                  y={previewCenterY - 14}
                  width={90}
                  height={28}
                  rx={4}
                  fill="#22c55e"
                />
                <text
                  x={previewCenterX}
                  y={previewCenterY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="white"
                  fontSize="12"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {previewWidth} × {previewHeight}px
                </text>
                {/* Preview second corner */}
                <circle
                  cx={mousePos.x}
                  cy={mousePos.y}
                  r={6}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth={2}
                  strokeDasharray="4,4"
                />
              </g>
              )
            })()}

            {/* First corner point being placed */}
            {currentPoints.length === 1 && (
              <g>
                {/* First corner - interactive */}
                <g 
                  className="cursor-pointer pointer-events-auto"
                  onMouseEnter={() => setHoveredPointIndex(0)}
                  onMouseLeave={() => setHoveredPointIndex(null)}
                  onClick={(e) => {
                    e.stopPropagation()
                    deletePoint(0)
                  }}
                >
                  {/* Larger hit area */}
                  <circle
                    cx={currentPoints[0].x}
                    cy={currentPoints[0].y}
                    r={15}
                    fill="transparent"
                  />
                  {/* Anchor point circle */}
                  <circle
                    cx={currentPoints[0].x}
                    cy={currentPoints[0].y}
                    r={hoveredPointIndex === 0 ? 12 : 8}
                    fill={hoveredPointIndex === 0 ? "#ef4444" : "#22c55e"}
                    stroke="white"
                    strokeWidth={3}
                    className="transition-all duration-150"
                  />
                  {/* Minus sign on hover, otherwise corner indicator */}
                  <text
                    x={currentPoints[0].x}
                    y={currentPoints[0].y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="white"
                    fontSize={hoveredPointIndex === 0 ? "16" : "12"}
                    fontWeight="bold"
                    className="pointer-events-none"
                  >
                    {hoveredPointIndex === 0 ? "−" : "1"}
                  </text>
                </g>
              </g>
            )}
          </svg>
        </div>

      {/* Page Content based on selected page */}
      {pageId === 'home' && (
        <>
          {/* Welcome Text with scroll effects */}
          <div className="fixed inset-0 z-30 pointer-events-none pt-28" role="banner">
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

        </>
      )}

      {/* Other pages - simple centered text */}
      {pageId !== 'home' && (
        <div className="relative z-20 pt-48 pb-32">
          <div className="text-center px-4">
            <h1 className="text-5xl md:text-7xl font-serif font-bold text-white drop-shadow-2xl mb-6">
              {pageTitles[pageId] || pageId}
            </h1>
            <p className="text-xl text-white/80 max-w-2xl mx-auto">
              Page content preview
            </p>
          </div>
        </div>
      )}

      {/* Global Settings Dialog Modal */}
      {showGlobalSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowGlobalSettings(false)}
          />
          
          {/* Modal */}
          <div className={`relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-h-[85vh] overflow-hidden flex ${
            globalSettingsSummaryExpanded ? 'w-[900px]' : 'w-[650px]'
          } transition-all duration-300`}>
            
            {/* Left Column: Conveyor Settings */}
            <div className="flex-1 p-6 overflow-y-auto border-r border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
                Scroll / Parallax
              </h3>
              
              {/* Ratio Section */}
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-medium text-gray-300 mb-3">Ratio (Conveyor Length)</h4>
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>1:1</span>
                    <span>10:1</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.5"
                    value={scrollRatio}
                    onChange={(e) => setScrollRatio(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <div className="text-center text-sm text-indigo-400 font-medium mt-1">
                    {scrollRatio}:1 ratio
                  </div>
                </div>
              </div>
              
              {/* Speed Section */}
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-medium text-gray-300 mb-3">Scroll Speed</h4>
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>0.1x</span>
                    <span>3x</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="3"
                    step="0.1"
                    value={scrollSpeed}
                    onChange={(e) => setScrollSpeed(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <div className="text-center text-sm text-amber-400 font-medium mt-1">
                    {scrollSpeed}x speed
                  </div>
                </div>
              </div>
              
              {/* Alignment Section */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-300 mb-3">Card Alignment</h4>
                <div className="mb-3">
                  <label className="text-xs text-gray-400">Edge Margin</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="range"
                      min="0"
                      max="5"
                      step="1"
                      value={alignmentMargin}
                      onChange={(e) => setAlignmentMargin(parseInt(e.target.value))}
                      className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                    <span className="text-sm text-cyan-400 font-mono w-16">{alignmentMargin * GRID_SPACING}px</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Middle Column: Wallpaper Settings */}
            <div className="flex-1 p-6 overflow-y-auto border-r border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Wallpaper
              </h3>
              
              {/* Wallpaper Status */}
              {isUsingFallbackWallpaper && (
                <div className="bg-blue-900/30 border border-blue-600/50 rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-2 text-blue-300 text-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Using universal default wallpaper
                  </div>
                </div>
              )}
              
              {isUniversalWallpaper && (
                <div className="bg-emerald-900/30 border border-emerald-600/50 rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-2 text-emerald-300 text-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    This page's wallpaper is the universal default
                  </div>
                </div>
              )}
              
              {/* Wallpaper Preview */}
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-medium text-gray-300 mb-3">Current Wallpaper</h4>
                {currentWallpaper?.url ? (
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-700">
                    <img 
                      src={currentWallpaper.url} 
                      alt={currentWallpaper.alt || 'Page wallpaper'}
                      className="w-full h-full object-cover"
                      style={{ filter: wallpaperBlur > 0 ? `blur(${wallpaperBlur}px)` : 'none' }}
                    />
                  </div>
                ) : (
                  <div className="aspect-video rounded-lg bg-gray-700 flex items-center justify-center">
                    <span className="text-gray-500 text-sm">No wallpaper set</span>
                  </div>
                )}
              </div>
              
              {/* Blur Slider */}
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-medium text-gray-300 mb-3">Blur Effect</h4>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>None</span>
                  <span>20px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="1"
                  value={wallpaperBlur}
                  onChange={(e) => handleBlurChange(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="text-center text-sm text-emerald-400 font-medium mt-1">
                  {wallpaperBlur}px blur
                </div>
              </div>
              
              {/* Wallpaper Actions */}
              <div className="space-y-2">
                <button
                  onClick={() => setShowWallpaperPicker(true)}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {currentWallpaper?.url ? 'Change Wallpaper' : 'Add Wallpaper'}
                </button>
                
                {currentWallpaper?.url && (
                  <>
                    <button
                      onClick={handleRemoveWallpaper}
                      disabled={wallpaperSaving}
                      className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 font-medium transition-colors border border-red-600/50"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Remove Wallpaper
                    </button>
                    
                    {!isUniversalWallpaper && !isUsingFallbackWallpaper && (
                      <button
                        onClick={handleSetUniversal}
                        disabled={wallpaperSaving}
                        className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Set as Universal Default
                      </button>
                    )}
                    
                    {isUniversalWallpaper && (
                      <button
                        onClick={handleClearUniversal}
                        disabled={wallpaperSaving}
                        className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Clear Universal Default
                      </button>
                    )}
                  </>
                )}
                
                {wallpaperError && (
                  <p className="text-red-400 text-sm text-center">{wallpaperError}</p>
                )}
              </div>
            </div>
            
            {/* Right Column: Summary (Collapsible) */}
            {globalSettingsSummaryExpanded && (
              <div className="w-56 p-6 bg-gray-800/50 overflow-y-auto">
                <h3 className="text-sm font-semibold text-gray-300 mb-4">Summary</h3>
                
                <div className="space-y-4">
                  {/* Scroll Settings Summary */}
                  <div>
                    <h4 className="text-xs text-gray-500 uppercase mb-2">Scroll</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Ratio</span>
                        <span className="text-indigo-400 font-mono">{scrollRatio}:1</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Speed</span>
                        <span className="text-amber-400 font-mono">{scrollSpeed}x</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Margin</span>
                        <span className="text-cyan-400 font-mono">{alignmentMargin * GRID_SPACING}px</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Wallpaper Summary */}
                  <div>
                    <h4 className="text-xs text-gray-500 uppercase mb-2">Wallpaper</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Status</span>
                        <span className={`font-medium ${currentWallpaper?.url ? 'text-emerald-400' : 'text-gray-500'}`}>
                          {currentWallpaper?.url ? 'Set' : 'None'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Blur</span>
                        <span className="text-emerald-400 font-mono">{wallpaperBlur}px</span>
                      </div>
                      {isUniversalWallpaper && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Default</span>
                          <span className="text-emerald-400">Yes</span>
                        </div>
                      )}
                      {isUsingFallbackWallpaper && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Source</span>
                          <span className="text-blue-400">Fallback</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Page Info */}
                  <div>
                    <h4 className="text-xs text-gray-500 uppercase mb-2">Page</h4>
                    <div className="text-sm text-gray-300 font-medium capitalize">{pageId}</div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Summary Toggle Button */}
            <button
              onClick={() => setGlobalSettingsSummaryExpanded(!globalSettingsSummaryExpanded)}
              className="absolute top-4 right-4 p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
              title={globalSettingsSummaryExpanded ? 'Hide Summary' : 'Show Summary'}
            >
              <svg className={`w-4 h-4 transition-transform ${globalSettingsSummaryExpanded ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            
            {/* Close Button */}
            <button
              onClick={() => setShowGlobalSettings(false)}
              className="absolute top-4 right-16 p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      
      {/* Wallpaper Picker Modal */}
      {showWallpaperPicker && (
        <ImagePicker
          onSelect={handleWallpaperSelect}
          onCancel={() => setShowWallpaperPicker(false)}
          title="Select Page Wallpaper"
          showLibrary={true}
        />
      )}
      
      {/* Card Image Picker Modal */}
      {showCardImagePicker && (
        <ImagePicker
          onSelect={handleCardImageSelect}
          onCancel={() => {
            setShowCardImagePicker(false)
            setEditingSlotId(null)
          }}
          title="Select Image for Card"
          showLibrary={true}
        />
      )}

      {/* Settings Side Pane */}
      <div 
        className={`fixed top-28 right-0 h-[calc(100vh-7rem)] w-96 bg-gray-900/95 backdrop-blur-sm border-l border-gray-700 z-50 transform transition-transform duration-300 ease-in-out ${
          showSettingsPane ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full overflow-y-auto p-4">
          {/* Header - uses settingsPaneOwner for consistent display */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              {settingsPaneOwner === 'save' && (
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              )}
              {settingsPaneOwner === 'pencil' && (
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              )}
              {settingsPaneOwner === 'conveyor' && (
                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              )}
              {settingsPaneOwner === 'move' && !moveSettingsStacked && (
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              )}
              {settingsPaneOwner === 'properties' && (
                <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
              <h3 className="text-lg font-semibold text-white">
                {settingsPaneOwner === 'save' ? 'Manage Layouts' : settingsPaneOwner === 'pencil' ? 'Card Styling' : settingsPaneOwner === 'properties' ? (isolatedCardId ? 'Card Properties' : 'Properties Tool') : settingsPaneOwner === 'conveyor' ? 'Conveyor Settings' : settingsPaneOwner === 'move' && !moveSettingsStacked ? (isolatedCardId ? 'Text Box Alignment' : 'Move Settings') : 'Tool Settings'}
              </h3>
              {/* Stacked indicator badge (only in isolation mode) */}
              {moveSettingsStacked && isolatedCardId && settingsPaneOwner !== 'move' && (
                <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full">+ Move</span>
              )}
            </div>
            <button
              onClick={() => { 
                setShowSettingsPane(false)
                // Clear saveMode and ownership if settings pane was showing save settings
                if (settingsPaneOwner === 'save') {
                  setSaveMode(false)
                  setSettingsPaneOwner(null)
                }
                // Clear stacked Move settings when closing pane
                if (moveSettingsStacked) {
                  setMoveSettingsStacked(false)
                }
              }}
              className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Layout Slots Management - shown when owner is 'save' AND save mode is active */}
          {settingsPaneOwner === 'save' && saveMode && (
            <>
              {/* Current slot indicator */}
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-300">Current Layout</h4>
                  {hasUnsavedChanges && (
                    <span className="text-xs bg-orange-600 text-white px-2 py-0.5 rounded">Unsaved</span>
                  )}
                </div>
                <div className="text-lg font-semibold text-white">
                  {currentSlot?.name || 'No layout selected'}
                </div>
                {currentSlot?.isNew && (
                  <p className="text-xs text-yellow-500 mt-1">New layout - save to create</p>
                )}
                
                {/* Hide/Show contents toggle */}
                <button
                  onClick={() => setHideSlotContents(!hideSlotContents)}
                  className={`mt-3 w-full flex items-center justify-center gap-2 p-2 rounded-lg text-sm font-medium transition-colors ${
                    hideSlotContents
                      ? 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {hideSlotContents ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Show Contents
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                      Hide Contents
                    </>
                  )}
                </button>
              </div>

              {/* Saved layouts list */}
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-300">Saved Layouts</h4>
                  <span className="text-xs text-gray-500">{layoutSlots.length}/{MAX_SLOTS}</span>
                </div>
                
                {layoutSlots.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No saved layouts yet. Click save to create your first layout.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {layoutSlots.map((slot) => (
                      <div 
                        key={slot.slot_number}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                          currentSlot?.slot_number === slot.slot_number
                            ? 'bg-green-600/20 border border-green-500'
                            : 'bg-gray-700 hover:bg-gray-600'
                        }`}
                        onClick={() => switchToSlot(slot)}
                      >
                        {/* Published indicator */}
                        {slot.is_published && (
                          <div className="w-2 h-2 rounded-full bg-green-500" title="Published" />
                        )}
                        
                        {/* Name (editable) */}
                        {editingSlotName === slot.slot_number ? (
                          <input
                            type="text"
                            defaultValue={slot.name}
                            autoFocus
                            className="flex-1 bg-gray-900 text-white text-sm px-2 py-1 rounded border border-gray-600 focus:border-green-500 focus:outline-none"
                            onBlur={(e) => handleRenameSlot(slot.slot_number, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRenameSlot(slot.slot_number, e.target.value)
                              if (e.key === 'Escape') setEditingSlotName(null)
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span 
                            className="flex-1 text-sm text-white truncate"
                            onDoubleClick={(e) => { e.stopPropagation(); setEditingSlotName(slot.slot_number) }}
                            title="Double-click to rename"
                          >
                            {slot.name}
                          </span>
                        )}
                        
                        {/* Delete button */}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteSlot(slot.slot_number) }}
                          className="p-1 rounded hover:bg-red-600/50 text-gray-400 hover:text-red-400 transition-colors"
                          title="Delete layout"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Add new slot button */}
                {layoutSlots.length < MAX_SLOTS && (
                  <button
                    onClick={createNewSlot}
                    className="w-full mt-3 flex items-center justify-center gap-2 p-2 rounded-lg border-2 border-dashed border-gray-600 text-gray-400 hover:border-green-500 hover:text-green-400 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-sm">New Layout</span>
                  </button>
                )}
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <button
                  onClick={handleSaveLayout}
                  disabled={isSaving}
                  className={`w-full flex items-center justify-center gap-2 p-3 rounded-lg font-medium transition-colors ${
                    isSaving
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {isSaving ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                      </svg>
                      Save Layout
                    </>
                  )}
                </button>
                
                <button
                  onClick={handlePublishLayout}
                  disabled={isSaving || !currentSlot || currentSlot.isNew}
                  className={`w-full flex items-center justify-center gap-2 p-3 rounded-lg font-medium transition-colors ${
                    isSaving || !currentSlot || currentSlot.isNew
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Publish Selected
                </button>
              </div>

              <p className="text-xs text-gray-500 mt-4 text-center">
                Double-click a layout name to rename it.
                <br />
                The published layout will be shown on the live site.
              </p>
            </>
          )}

          {/* Pencil Tool Settings - shown when owner is 'pencil' AND pencil is active (or in isolation) */}
          {settingsPaneOwner === 'pencil' && (pencilMode || isolatedCardId) && (
            <>
              {/* Active card indicator */}
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                    </svg>
                    Selection
                  </h4>
                </div>
                <div className="p-2 bg-gray-900 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Active card:</span>
                    <span className={`text-xs font-medium ${activeCardId ? 'text-green-400' : 'text-gray-500'}`}>
                      {activeCardId ? `Card #${activeCardId}` : 'None (click a card)'}
                    </span>
                  </div>
                </div>
                {!activeCardId && (
                  <p className="text-xs text-gray-500 mt-2">
                    Click on a card to select it for styling, or draw on empty space to create a new card.
                  </p>
                )}
              </div>

              {/* Card Style Settings */}
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                  Card Style
                </h4>

                {/* Background Color */}
                <div className="mb-4">
                  <label className="text-xs text-gray-400 mb-2 block">Background Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={previewSettings?.backgroundColor || pencilSettings.backgroundColor}
                      onChange={(e) => setPreviewSettings({
                        ...(previewSettings || pencilSettings),
                        backgroundColor: e.target.value
                      })}
                      className="w-10 h-10 rounded border border-gray-600 cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={previewSettings?.backgroundColor || pencilSettings.backgroundColor}
                      onChange={(e) => setPreviewSettings({
                        ...(previewSettings || pencilSettings),
                        backgroundColor: e.target.value
                      })}
                      className="flex-1 bg-gray-900 text-white text-sm px-3 py-2 rounded border border-gray-600 focus:border-green-500 focus:outline-none font-mono uppercase"
                      placeholder="#ffffff"
                    />
                  </div>
                </div>

                {/* Opacity */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-gray-400">Opacity</label>
                    <span className="text-xs text-gray-300 font-mono">{Math.round((previewSettings?.opacity ?? pencilSettings.opacity) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={previewSettings?.opacity ?? pencilSettings.opacity}
                    onChange={(e) => setPreviewSettings({
                      ...(previewSettings || pencilSettings),
                      opacity: parseFloat(e.target.value)
                    })}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                  />
                </div>

                {/* Border Radius */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-gray-400">Corner Radius</label>
                    <span className="text-xs text-gray-300 font-mono">{previewSettings?.borderRadius ?? pencilSettings.borderRadius}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="2"
                    value={previewSettings?.borderRadius ?? pencilSettings.borderRadius}
                    onChange={(e) => setPreviewSettings({
                      ...(previewSettings || pencilSettings),
                      borderRadius: parseInt(e.target.value)
                    })}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                  />
                </div>
              </div>

              {/* Border Settings */}
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                  </svg>
                  Border
                </h4>

                {/* Border Width */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-gray-400">Width</label>
                    <span className="text-xs text-gray-300 font-mono">{previewSettings?.borderWidth ?? pencilSettings.borderWidth}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="1"
                    value={previewSettings?.borderWidth ?? pencilSettings.borderWidth}
                    onChange={(e) => setPreviewSettings({
                      ...(previewSettings || pencilSettings),
                      borderWidth: parseInt(e.target.value)
                    })}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                  />
                </div>

                {/* Border Style */}
                <div className="mb-4">
                  <label className="text-xs text-gray-400 mb-2 block">Style</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['solid', 'dashed', 'dotted'].map(style => (
                      <button
                        key={style}
                        onClick={() => setPreviewSettings({
                          ...(previewSettings || pencilSettings),
                          borderStyle: style
                        })}
                        className={`p-2 rounded-lg text-xs font-medium capitalize transition-colors ${
                          (previewSettings?.borderStyle ?? pencilSettings.borderStyle) === style
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Border Color */}
                <div className="mb-4">
                  <label className="text-xs text-gray-400 mb-2 block">Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={previewSettings?.borderColor || pencilSettings.borderColor}
                      onChange={(e) => setPreviewSettings({
                        ...(previewSettings || pencilSettings),
                        borderColor: e.target.value
                      })}
                      className="w-10 h-10 rounded border border-gray-600 cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={previewSettings?.borderColor || pencilSettings.borderColor}
                      onChange={(e) => setPreviewSettings({
                        ...(previewSettings || pencilSettings),
                        borderColor: e.target.value
                      })}
                      className="flex-1 bg-gray-900 text-white text-sm px-3 py-2 rounded border border-gray-600 focus:border-green-500 focus:outline-none font-mono uppercase"
                      placeholder="#000000"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2 mb-4">
                <button
                  onClick={applyPencilSettings}
                  disabled={!activeCardId}
                  className={`w-full flex items-center justify-center gap-2 p-3 rounded-lg font-medium transition-colors ${
                    !activeCardId
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Apply to Card
                </button>
                
                {previewSettings && (
                  <button
                    onClick={cancelPencilPreview}
                    className="w-full flex items-center justify-center gap-2 p-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Cancel Changes
                  </button>
                )}
              </div>

              {/* Lock Settings Toggle */}
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className={`w-4 h-4 ${pencilSettingsLocked ? 'text-amber-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {pencilSettingsLocked ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                      )}
                    </svg>
                    <span className="text-sm text-gray-300">Lock for new cards</span>
                  </div>
                  <button
                    onClick={() => setPencilSettingsLocked(!pencilSettingsLocked)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      pencilSettingsLocked ? 'bg-amber-500' : 'bg-gray-600'
                    }`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      pencilSettingsLocked ? 'translate-x-7' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {pencilSettingsLocked 
                    ? 'New cards will use current style settings'
                    : 'New cards will use default white style'
                  }
                </p>
              </div>
            </>
          )}

          {/* Empty state when no tool with settings is selected */}
          {!conveyorMode && !moveMode && !propertiesMode && !saveMode && !pencilMode && (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <svg className="w-16 h-16 text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-gray-400 text-sm mb-2">No tool selected</p>
              <p className="text-gray-500 text-xs">Select a tool with settings<br />to see more options</p>
              <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Try the <strong className="text-cyan-400">Properties</strong> tool</span>
              </div>
            </div>
          )}

          {/* Move Tool Settings - shown when owner is 'move' AND move is active, OR when stacked in isolation */}
          {((settingsPaneOwner === 'move' && moveMode) || (moveSettingsStacked && isolatedCardId)) && (
            <>
              {/* Isolation Mode - Text Box Alignment */}
              {isolatedCardId ? (() => {
                const card = cards.find(c => c.id === isolatedCardId)
                if (!card) return null
                const bounds = getCardBounds(card.points)
                const cardWidth = bounds.maxX - bounds.minX
                const cardHeight = bounds.maxY - bounds.minY
                const textBoxes = card.textBoxes || []
                const selectedTb = textBoxes.find(tb => tb.id === selectedTextBoxId)
                const CARD_GRID = 20 // Internal card grid spacing
                
                return (
                  <>
                    {/* Selection status */}
                    <div className="bg-gray-800 rounded-lg p-4 mb-4">
                      <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                        Text Box Alignment
                      </h4>
                      <div className="mb-3 p-2 bg-gray-900 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">Selected:</span>
                          <span className={`text-xs font-medium ${selectedTextBoxId ? 'text-cyan-400' : 'text-gray-500'}`}>
                            {selectedTextBoxId ? 'Text box' : 'None'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-gray-400">Card size:</span>
                          <span className="text-xs text-gray-300 font-mono">{cardWidth} × {cardHeight}px</span>
                        </div>
                      </div>
                      
                      {/* Horizontal Alignment */}
                      <span className="text-xs text-gray-400 mb-2 block">Horizontal</span>
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        <button
                          onClick={() => {
                            if (!selectedTb) return
                            updateTextBox(isolatedCardId, selectedTextBoxId, { x: CARD_GRID })
                          }}
                          disabled={!selectedTextBoxId}
                          className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                            !selectedTextBoxId
                              ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                          }`}
                          title="Align to left of card"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v16M8 8h12M8 12h8M8 16h12" />
                          </svg>
                          <span className="text-[10px]">Left</span>
                        </button>
                        <button
                          onClick={() => {
                            if (!selectedTb) return
                            const newX = (cardWidth - selectedTb.width) / 2
                            updateTextBox(isolatedCardId, selectedTextBoxId, { x: Math.max(0, newX) })
                          }}
                          disabled={!selectedTextBoxId}
                          className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                            !selectedTextBoxId
                              ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                          }`}
                          title="Center horizontally in card"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16M6 8h12M8 12h8M6 16h12" />
                          </svg>
                          <span className="text-[10px]">Center</span>
                        </button>
                        <button
                          onClick={() => {
                            if (!selectedTb) return
                            const newX = cardWidth - selectedTb.width - CARD_GRID
                            updateTextBox(isolatedCardId, selectedTextBoxId, { x: Math.max(0, newX) })
                          }}
                          disabled={!selectedTextBoxId}
                          className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                            !selectedTextBoxId
                              ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                          }`}
                          title="Align to right of card"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 4v16M4 8h12M8 12h8M4 16h12" />
                          </svg>
                          <span className="text-[10px]">Right</span>
                        </button>
                      </div>
                      
                      {/* Vertical Alignment */}
                      <span className="text-xs text-gray-400 mb-2 block">Vertical</span>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => {
                            if (!selectedTb) return
                            updateTextBox(isolatedCardId, selectedTextBoxId, { y: CARD_GRID })
                          }}
                          disabled={!selectedTextBoxId}
                          className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                            !selectedTextBoxId
                              ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                          }`}
                          title="Align to top of card"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h16M8 8v12M12 8v8M16 8v12" />
                          </svg>
                          <span className="text-[10px]">Top</span>
                        </button>
                        <button
                          onClick={() => {
                            if (!selectedTb) return
                            const newY = (cardHeight - selectedTb.height) / 2
                            updateTextBox(isolatedCardId, selectedTextBoxId, { y: Math.max(0, newY) })
                          }}
                          disabled={!selectedTextBoxId}
                          className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                            !selectedTextBoxId
                              ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                          }`}
                          title="Center vertically in card"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16M8 6v12M12 8v8M16 6v12" />
                          </svg>
                          <span className="text-[10px]">Middle</span>
                        </button>
                        <button
                          onClick={() => {
                            if (!selectedTb) return
                            const newY = cardHeight - selectedTb.height - CARD_GRID
                            updateTextBox(isolatedCardId, selectedTextBoxId, { y: Math.max(0, newY) })
                          }}
                          disabled={!selectedTextBoxId}
                          className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                            !selectedTextBoxId
                              ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                          }`}
                          title="Align to bottom of card"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 20h16M8 4v12M12 8v8M16 4v12" />
                          </svg>
                          <span className="text-[10px]">Bottom</span>
                        </button>
                      </div>
                      
                      <p className="text-xs text-gray-500 mt-3 text-center">
                        {!selectedTextBoxId 
                          ? 'Click a text box to select it' 
                          : 'Aligns relative to card bounds'}
                      </p>
                    </div>
                  </>
                )
              })() : (
              <>
              {/* Normal Mode - Card Alignment */}
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  Horizontal Alignment
                </h4>
                
                {/* Selection status */}
                <div className="mb-4 p-2 bg-gray-900 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Selected:</span>
                    <span className={`text-xs font-medium ${selectedCardId ? 'text-amber-400' : 'text-gray-500'}`}>
                      {selectedCardId ? '1 card' : 'None'}
                    </span>
                  </div>
                  {selectedCards.length > 1 && (
                    <p className="text-xs text-yellow-500 mt-1">
                      Multi-select alignment coming soon
                    </p>
                  )}
                </div>

                {/* Edge Margin Setting */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-400">Edge Margin</span>
                    <span className="text-xs text-amber-400 font-mono">{alignmentMargin} grid {alignmentMargin === 1 ? 'unit' : 'units'} ({alignmentMargin * GRID_SPACING}px)</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="1"
                    value={alignmentMargin}
                    onChange={(e) => setAlignmentMargin(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>0 (edge)</span>
                    <span>5 (200px)</span>
                  </div>
                </div>
                
                {/* Alignment buttons */}
                <div className="grid grid-cols-3 gap-2">
                  {/* Align Left */}
                  <button
                    onClick={() => {
                      if (!selectedCardId || selectedCards.length > 1) return
                      const card = cards.find(c => c.id === selectedCardId)
                      if (!card) return
                      const bounds = getCardBounds(card.points)
                      const currentLeft = bounds.minX
                      const targetLeft = (alignmentMargin * GRID_SPACING) + (GRID_SPACING / 2)
                      const offsetX = targetLeft - currentLeft
                      // Snap to grid
                      const snappedOffsetX = Math.round(offsetX / GRID_SPACING) * GRID_SPACING
                      if (snappedOffsetX !== 0) {
                        moveCard(selectedCardId, snappedOffsetX, 0)
                      }
                    }}
                    disabled={!selectedCardId || selectedCards.length > 1}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg transition-colors ${
                      !selectedCardId || selectedCards.length > 1
                        ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                    }`}
                    title={`Align ${alignmentMargin * GRID_SPACING}px from left edge`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v16M8 8h12M8 12h8M8 16h12" />
                    </svg>
                    <span className="text-xs">Left</span>
                  </button>
                  
                  {/* Align Center */}
                  <button
                    onClick={() => {
                      if (!selectedCardId || selectedCards.length > 1 || !gridRef.current) return
                      const card = cards.find(c => c.id === selectedCardId)
                      if (!card) return
                      const bounds = getCardBounds(card.points)
                      const cardWidth = bounds.maxX - bounds.minX
                      const containerWidth = gridRef.current.offsetWidth
                      const targetCenterX = containerWidth / 2
                      const cardCenterX = bounds.minX + cardWidth / 2
                      const offsetX = targetCenterX - cardCenterX
                      // Snap to grid
                      const snappedOffsetX = Math.round(offsetX / GRID_SPACING) * GRID_SPACING
                      if (snappedOffsetX !== 0) {
                        moveCard(selectedCardId, snappedOffsetX, 0)
                      }
                    }}
                    disabled={!selectedCardId || selectedCards.length > 1}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg transition-colors ${
                      !selectedCardId || selectedCards.length > 1
                        ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                    }`}
                    title="Align to center (margin not applied)"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16M6 8h12M8 12h8M6 16h12" />
                    </svg>
                    <span className="text-xs">Center</span>
                  </button>
                  
                  {/* Align Right */}
                  <button
                    onClick={() => {
                      if (!selectedCardId || selectedCards.length > 1 || !gridRef.current) return
                      const card = cards.find(c => c.id === selectedCardId)
                      if (!card) return
                      const bounds = getCardBounds(card.points)
                      const containerWidth = gridRef.current.offsetWidth
                      const targetRight = containerWidth - (alignmentMargin * GRID_SPACING) - (GRID_SPACING / 2)
                      const currentRight = bounds.maxX
                      const offsetX = targetRight - currentRight
                      // Snap to grid
                      const snappedOffsetX = Math.round(offsetX / GRID_SPACING) * GRID_SPACING
                      if (snappedOffsetX !== 0) {
                        moveCard(selectedCardId, snappedOffsetX, 0)
                      }
                    }}
                    disabled={!selectedCardId || selectedCards.length > 1}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg transition-colors ${
                      !selectedCardId || selectedCards.length > 1
                        ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                    }`}
                    title={`Align ${alignmentMargin * GRID_SPACING}px from right edge`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 4v16M4 8h12M8 12h8M4 16h12" />
                    </svg>
                    <span className="text-xs">Right</span>
                  </button>
                </div>
                
                {/* Help text */}
                <p className="text-xs text-gray-500 mt-3 text-center">
                  {!selectedCardId 
                    ? 'Click a card to select it first' 
                    : 'Click an alignment to move the card'}
                </p>
              </div>

              {/* Vertical Alignment Section */}
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" transform="rotate(90 12 12)" />
                  </svg>
                  Vertical Alignment
                </h4>

                {/* Mode selector */}
                <div className="mb-4">
                  <span className="text-xs text-gray-400 mb-2 block">Reference Mode</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setVerticalAlignMode('conveyor')}
                      className={`px-3 py-2 text-xs rounded-lg transition-colors ${
                        verticalAlignMode === 'conveyor'
                          ? 'bg-amber-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                      title="Align relative to the full page height"
                    >
                      📜 Conveyor
                    </button>
                    <button
                      onClick={() => setVerticalAlignMode('viewport')}
                      className={`px-3 py-2 text-xs rounded-lg transition-colors ${
                        verticalAlignMode === 'viewport'
                          ? 'bg-amber-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                      title="Align relative to current viewport"
                    >
                      🖥️ Viewport
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {verticalAlignMode === 'conveyor' 
                      ? 'Positions relative to full scrollable page'
                      : 'Positions relative to what\'s visible on screen'}
                  </p>
                </div>
                
                {/* Vertical Alignment buttons */}
                <div className="grid grid-cols-3 gap-2">
                  {/* Align Top */}
                  <button
                    onClick={() => {
                      if (!selectedCardId || selectedCards.length > 1 || !gridRef.current) return
                      const card = cards.find(c => c.id === selectedCardId)
                      if (!card) return
                      const bounds = getCardBounds(card.points)
                      
                      let targetTop
                      if (verticalAlignMode === 'viewport') {
                        // Viewport-relative: top of visible area
                        const scrollY = window.scrollY
                        targetTop = scrollY + (alignmentMargin * GRID_SPACING) + (GRID_SPACING / 2)
                      } else {
                        // Conveyor-relative: top of the page
                        targetTop = (alignmentMargin * GRID_SPACING) + (GRID_SPACING / 2)
                      }
                      
                      const offsetY = targetTop - bounds.minY
                      const snappedOffsetY = Math.round(offsetY / GRID_SPACING) * GRID_SPACING
                      if (snappedOffsetY !== 0) {
                        moveCard(selectedCardId, 0, snappedOffsetY)
                      }
                    }}
                    disabled={!selectedCardId || selectedCards.length > 1}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg transition-colors ${
                      !selectedCardId || selectedCards.length > 1
                        ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                    }`}
                    title={`Align to top (${verticalAlignMode})`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h16M8 8v12M12 8v8M16 8v12" />
                    </svg>
                    <span className="text-xs">Top</span>
                  </button>
                  
                  {/* Align Middle */}
                  <button
                    onClick={() => {
                      if (!selectedCardId || selectedCards.length > 1 || !gridRef.current) return
                      const card = cards.find(c => c.id === selectedCardId)
                      if (!card) return
                      const bounds = getCardBounds(card.points)
                      const cardHeight = bounds.maxY - bounds.minY
                      
                      let targetCenterY
                      if (verticalAlignMode === 'viewport') {
                        // Viewport-relative: center of visible area
                        const scrollY = window.scrollY
                        const viewportHeight = window.innerHeight
                        targetCenterY = scrollY + (viewportHeight / 2)
                      } else {
                        // Conveyor-relative: center of the page
                        const containerHeight = gridRef.current.offsetHeight
                        targetCenterY = containerHeight / 2
                      }
                      
                      const cardCenterY = bounds.minY + cardHeight / 2
                      const offsetY = targetCenterY - cardCenterY
                      const snappedOffsetY = Math.round(offsetY / GRID_SPACING) * GRID_SPACING
                      if (snappedOffsetY !== 0) {
                        moveCard(selectedCardId, 0, snappedOffsetY)
                      }
                    }}
                    disabled={!selectedCardId || selectedCards.length > 1}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg transition-colors ${
                      !selectedCardId || selectedCards.length > 1
                        ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                    }`}
                    title={`Align to middle (${verticalAlignMode})`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16M8 6v12M12 8v8M16 6v12" />
                    </svg>
                    <span className="text-xs">Middle</span>
                  </button>
                  
                  {/* Align Bottom */}
                  <button
                    onClick={() => {
                      if (!selectedCardId || selectedCards.length > 1 || !gridRef.current) return
                      const card = cards.find(c => c.id === selectedCardId)
                      if (!card) return
                      const bounds = getCardBounds(card.points)
                      
                      let targetBottom
                      if (verticalAlignMode === 'viewport') {
                        // Viewport-relative: bottom of visible area
                        const scrollY = window.scrollY
                        const viewportHeight = window.innerHeight
                        targetBottom = scrollY + viewportHeight - (alignmentMargin * GRID_SPACING) - (GRID_SPACING / 2)
                      } else {
                        // Conveyor-relative: bottom of the page
                        const containerHeight = gridRef.current.offsetHeight
                        targetBottom = containerHeight - (alignmentMargin * GRID_SPACING) - (GRID_SPACING / 2)
                      }
                      
                      const offsetY = targetBottom - bounds.maxY
                      const snappedOffsetY = Math.round(offsetY / GRID_SPACING) * GRID_SPACING
                      if (snappedOffsetY !== 0) {
                        moveCard(selectedCardId, 0, snappedOffsetY)
                      }
                    }}
                    disabled={!selectedCardId || selectedCards.length > 1}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg transition-colors ${
                      !selectedCardId || selectedCards.length > 1
                        ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                    }`}
                    title={`Align to bottom (${verticalAlignMode})`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 20h16M8 4v12M12 8v8M16 4v12" />
                    </svg>
                    <span className="text-xs">Bottom</span>
                  </button>
                </div>
              </div>
              </>
              )}
            </>
          )}

          {/* Properties Tool Settings - shown when owner is 'properties' AND properties is active (or in isolation) */}
          {settingsPaneOwner === 'properties' && (propertiesMode || isolatedCardId) && (
            <>
              {/* Instructions when not in isolation */}
              {!isolatedCardId && (
                <div className="bg-gray-800 rounded-lg p-4 mb-4">
                  <div className="flex flex-col items-center text-center py-4">
                    <svg className="w-12 h-12 text-cyan-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                    </svg>
                    <p className="text-gray-300 font-medium mb-1">Click a card to edit</p>
                    <p className="text-gray-500 text-sm">Select a card to enter isolation mode and edit its content</p>
                  </div>
                </div>
              )}
              
              {/* Card Properties (when isolated) */}
              {isolatedCardId && (() => {
                const card = cards.find(c => c.id === isolatedCardId)
                if (!card) return null
                const bounds = getCardBounds(card.points)
                const cardWidth = bounds.maxX - bounds.minX
                const cardHeight = bounds.maxY - bounds.minY
                const textBoxes = card.textBoxes || []
                const selectedTextBox = textBoxes.find(tb => tb.id === selectedTextBoxId)
                
                return (
                  <>
                    {/* Card Info */}
                    <div className="bg-gray-800 rounded-lg p-4 mb-4">
                      <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" />
                        </svg>
                        Card Info
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-gray-900 rounded p-2">
                          <span className="text-gray-500">Width</span>
                          <span className="block text-cyan-400 font-mono">{cardWidth}px</span>
                        </div>
                        <div className="bg-gray-900 rounded p-2">
                          <span className="text-gray-500">Height</span>
                          <span className="block text-cyan-400 font-mono">{cardHeight}px</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Main Tabs: Content / Capabilities / Effects / System */}
                    <div className="flex gap-1 mb-4 bg-gray-800 p-1 rounded-lg">
                      <button
                        onClick={() => setPropertiesTab('content')}
                        className={`flex-1 px-2 py-2 text-xs font-medium rounded-md transition-colors ${
                          propertiesTab === 'content'
                            ? 'bg-cyan-600 text-white'
                            : 'text-gray-400 hover:text-white hover:bg-gray-700'
                        }`}
                      >
                        Content
                      </button>
                      <button
                        onClick={() => setPropertiesTab('capabilities')}
                        className={`flex-1 px-2 py-2 text-xs font-medium rounded-md transition-colors ${
                          propertiesTab === 'capabilities'
                            ? 'bg-cyan-600 text-white'
                            : 'text-gray-400 hover:text-white hover:bg-gray-700'
                        }`}
                      >
                        Capabilities
                      </button>
                      <button
                        onClick={() => setPropertiesTab('effects')}
                        className={`flex-1 px-2 py-2 text-xs font-medium rounded-md transition-colors ${
                          propertiesTab === 'effects'
                            ? 'bg-cyan-600 text-white'
                            : 'text-gray-400 hover:text-white hover:bg-gray-700'
                        }`}
                      >
                        Effects
                      </button>
                      <button
                        onClick={() => setPropertiesTab('system')}
                        className={`flex-1 px-2 py-2 text-xs font-medium rounded-md transition-colors ${
                          propertiesTab === 'system'
                            ? 'bg-cyan-600 text-white'
                            : 'text-gray-400 hover:text-white hover:bg-gray-700'
                        }`}
                      >
                        System
                      </button>
                    </div>
                    
                    {/* Content Tab (formerly Elements) */}
                    {propertiesTab === 'content' && (
                      <>
                        {/* Elements Sub-tabs: Text / Image / Media */}
                        <div className="flex gap-1 mb-4 bg-gray-700/50 p-1 rounded-lg">
                          <button
                            onClick={() => setElementsSubTab('text')}
                            className={`flex-1 px-2 py-1.5 text-xs font-medium rounded transition-colors ${
                              elementsSubTab === 'text'
                                ? 'bg-gray-600 text-white'
                                : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            Text
                          </button>
                          <button
                            onClick={() => setElementsSubTab('image')}
                            className={`flex-1 px-2 py-1.5 text-xs font-medium rounded transition-colors ${
                              elementsSubTab === 'image'
                                ? 'bg-gray-600 text-white'
                                : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            Image
                          </button>
                          <button
                            onClick={() => setElementsSubTab('media')}
                            className={`flex-1 px-2 py-1.5 text-xs font-medium rounded transition-colors ${
                              elementsSubTab === 'media'
                                ? 'bg-gray-600 text-white'
                                : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            Media
                          </button>
                        </div>
                        
                        {/* Text Sub-tab Content */}
                        {elementsSubTab === 'text' && (
                          <>
                            {/* Text Elements */}
                            <div className="bg-gray-800 rounded-lg p-4 mb-4">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" />
                                  </svg>
                                  Text Elements
                                </h4>
                                <span className="text-xs text-gray-500">{textBoxes.length}</span>
                              </div>
                              
                              {/* Add Text Button */}
                              <button
                                onClick={() => addTextBoxToCard(isolatedCardId)}
                                className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed border-gray-600 text-gray-400 hover:border-cyan-500 hover:text-cyan-400 transition-colors mb-3"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                <span className="text-sm">Add Text</span>
                              </button>
                              
                              {/* Text box list */}
                              {textBoxes.length > 0 && (
                                <div className="space-y-2">
                                  {textBoxes.map((tb, idx) => (
                                    <div
                                      key={tb.id}
                                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                                        selectedTextBoxId === tb.id
                                          ? 'bg-cyan-600/20 border border-cyan-500'
                                          : 'bg-gray-700 hover:bg-gray-600'
                                      }`}
                                      onClick={() => setSelectedTextBoxId(tb.id)}
                                    >
                                      <span className="text-xs text-gray-400">T{idx + 1}</span>
                                      <span className="flex-1 text-sm text-white truncate">
                                        {tb.content || 'Empty text'}
                                      </span>
                                      <span className="text-xs text-gray-500">{tb.fontSize}px</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                    
                    {/* Text Formatting (when text box selected) */}
                    {selectedTextBox && (
                      <div className="bg-gray-800 rounded-lg p-4 mb-4">
                        <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Text Formatting
                        </h4>
                        
                        {/* Font Family */}
                        <div className="mb-4">
                          <span className="text-xs text-gray-400 block mb-2">Font</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => updateTextBox(isolatedCardId, selectedTextBoxId, { fontFamily: 'sans' })}
                              className={`flex-1 p-2 rounded-lg transition-colors font-sans text-sm ${
                                !selectedTextBox.fontFamily || selectedTextBox.fontFamily === 'sans'
                                  ? 'bg-cyan-600 text-white'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                              title="Sans-serif (Inter)"
                            >
                              Aa
                            </button>
                            <button
                              onClick={() => updateTextBox(isolatedCardId, selectedTextBoxId, { fontFamily: 'serif' })}
                              className={`flex-1 p-2 rounded-lg transition-colors font-serif text-sm ${
                                selectedTextBox.fontFamily === 'serif'
                                  ? 'bg-cyan-600 text-white'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                              title="Serif (Georgia)"
                            >
                              Aa
                            </button>
                            <button
                              onClick={() => updateTextBox(isolatedCardId, selectedTextBoxId, { fontFamily: 'mono' })}
                              className={`flex-1 p-2 rounded-lg transition-colors font-mono text-sm ${
                                selectedTextBox.fontFamily === 'mono'
                                  ? 'bg-cyan-600 text-white'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                              title="Monospace"
                            >
                              Aa
                            </button>
                            <button
                              onClick={() => setShowMoreFonts(!showMoreFonts)}
                              className={`px-2 py-2 rounded-lg transition-colors text-xs ${
                                showMoreFonts
                                  ? 'bg-gray-600 text-white'
                                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
                              }`}
                              title="More fonts"
                            >
                              {showMoreFonts ? '−' : '+'}
                            </button>
                          </div>
                          <div className="flex justify-between text-[10px] text-gray-500 mt-1 pr-8">
                            <span>Sans</span>
                            <span>Serif</span>
                            <span>Mono</span>
                          </div>
                          
                          {/* Expanded font options */}
                          {showMoreFonts && (
                            <div className="mt-3 pt-3 border-t border-gray-700">
                              <span className="text-[10px] text-gray-500 block mb-2">More Fonts</span>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  onClick={() => updateTextBox(isolatedCardId, selectedTextBoxId, { fontFamily: 'cursive' })}
                                  className={`p-2 rounded-lg transition-colors text-sm ${
                                    selectedTextBox.fontFamily === 'cursive'
                                      ? 'bg-cyan-600 text-white'
                                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                  }`}
                                  style={{ fontFamily: 'cursive' }}
                                  title="Cursive"
                                >
                                  Cursive
                                </button>
                                <button
                                  onClick={() => updateTextBox(isolatedCardId, selectedTextBoxId, { fontFamily: 'fantasy' })}
                                  className={`p-2 rounded-lg transition-colors text-sm ${
                                    selectedTextBox.fontFamily === 'fantasy'
                                      ? 'bg-cyan-600 text-white'
                                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                  }`}
                                  style={{ fontFamily: 'fantasy' }}
                                  title="Fantasy"
                                >
                                  Fantasy
                                </button>
                                <button
                                  onClick={() => updateTextBox(isolatedCardId, selectedTextBoxId, { fontFamily: 'times' })}
                                  className={`p-2 rounded-lg transition-colors text-sm ${
                                    selectedTextBox.fontFamily === 'times'
                                      ? 'bg-cyan-600 text-white'
                                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                  }`}
                                  style={{ fontFamily: '"Times New Roman", Times, serif' }}
                                  title="Times New Roman"
                                >
                                  Times
                                </button>
                                <button
                                  onClick={() => updateTextBox(isolatedCardId, selectedTextBoxId, { fontFamily: 'arial' })}
                                  className={`p-2 rounded-lg transition-colors text-sm ${
                                    selectedTextBox.fontFamily === 'arial'
                                      ? 'bg-cyan-600 text-white'
                                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                  }`}
                                  style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
                                  title="Arial"
                                >
                                  Arial
                                </button>
                                <button
                                  onClick={() => updateTextBox(isolatedCardId, selectedTextBoxId, { fontFamily: 'courier' })}
                                  className={`p-2 rounded-lg transition-colors text-sm ${
                                    selectedTextBox.fontFamily === 'courier'
                                      ? 'bg-cyan-600 text-white'
                                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                  }`}
                                  style={{ fontFamily: '"Courier New", Courier, monospace' }}
                                  title="Courier New"
                                >
                                  Courier
                                </button>
                                <button
                                  onClick={() => updateTextBox(isolatedCardId, selectedTextBoxId, { fontFamily: 'verdana' })}
                                  className={`p-2 rounded-lg transition-colors text-sm ${
                                    selectedTextBox.fontFamily === 'verdana'
                                      ? 'bg-cyan-600 text-white'
                                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                  }`}
                                  style={{ fontFamily: 'Verdana, Geneva, sans-serif' }}
                                  title="Verdana"
                                >
                                  Verdana
                                </button>
                                <button
                                  onClick={() => updateTextBox(isolatedCardId, selectedTextBoxId, { fontFamily: 'trebuchet' })}
                                  className={`p-2 rounded-lg transition-colors text-sm ${
                                    selectedTextBox.fontFamily === 'trebuchet'
                                      ? 'bg-cyan-600 text-white'
                                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                  }`}
                                  style={{ fontFamily: '"Trebuchet MS", Helvetica, sans-serif' }}
                                  title="Trebuchet MS"
                                >
                                  Trebuchet
                                </button>
                                <button
                                  onClick={() => updateTextBox(isolatedCardId, selectedTextBoxId, { fontFamily: 'impact' })}
                                  className={`p-2 rounded-lg transition-colors text-sm ${
                                    selectedTextBox.fontFamily === 'impact'
                                      ? 'bg-cyan-600 text-white'
                                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                  }`}
                                  style={{ fontFamily: 'Impact, Charcoal, sans-serif' }}
                                  title="Impact"
                                >
                                  Impact
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Font Size */}
                        <div className="mb-4">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs text-gray-400">Font Size</span>
                            <span className="text-xs text-cyan-400 font-mono">{selectedTextBox.fontSize}px</span>
                          </div>
                          <input
                            type="range"
                            min="10"
                            max="72"
                            step="1"
                            value={selectedTextBox.fontSize}
                            onChange={(e) => updateTextBox(isolatedCardId, selectedTextBoxId, { fontSize: parseInt(e.target.value) })}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                          />
                          <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                            <span>10px</span>
                            <span>72px</span>
                          </div>
                        </div>
                        
                        {/* Bold / Italic / Underline / Strikethrough */}
                        <div className="mb-4">
                          <span className="text-xs text-gray-400 block mb-2">Style</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => updateTextBox(isolatedCardId, selectedTextBoxId, { 
                                fontWeight: selectedTextBox.fontWeight === 'bold' ? 'normal' : 'bold' 
                              })}
                              className={`flex-1 p-2 rounded-lg font-bold transition-colors ${
                                selectedTextBox.fontWeight === 'bold'
                                  ? 'bg-cyan-600 text-white'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                              title="Bold"
                            >
                              B
                            </button>
                            <button
                              onClick={() => updateTextBox(isolatedCardId, selectedTextBoxId, { 
                                fontStyle: selectedTextBox.fontStyle === 'italic' ? 'normal' : 'italic' 
                              })}
                              className={`flex-1 p-2 rounded-lg italic transition-colors ${
                                selectedTextBox.fontStyle === 'italic'
                                  ? 'bg-cyan-600 text-white'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                              title="Italic"
                            >
                              I
                            </button>
                            <button
                              onClick={() => updateTextBox(isolatedCardId, selectedTextBoxId, { 
                                textDecoration: selectedTextBox.textDecoration === 'underline' ? 'none' : 'underline' 
                              })}
                              className={`flex-1 p-2 rounded-lg underline transition-colors ${
                                selectedTextBox.textDecoration === 'underline'
                                  ? 'bg-cyan-600 text-white'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                              title="Underline"
                            >
                              U
                            </button>
                            <button
                              onClick={() => updateTextBox(isolatedCardId, selectedTextBoxId, { 
                                textDecoration: selectedTextBox.textDecoration === 'line-through' ? 'none' : 'line-through' 
                              })}
                              className={`flex-1 p-2 rounded-lg line-through transition-colors ${
                                selectedTextBox.textDecoration === 'line-through'
                                  ? 'bg-cyan-600 text-white'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                              title="Strikethrough"
                            >
                              S
                            </button>
                          </div>
                        </div>
                        
                        {/* List Type */}
                        <div className="mb-4">
                          <span className="text-xs text-gray-400 block mb-2">List Type</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => updateTextBox(isolatedCardId, selectedTextBoxId, { listType: 'none' })}
                              className={`flex-1 p-2 rounded-lg transition-colors ${
                                !selectedTextBox.listType || selectedTextBox.listType === 'none'
                                  ? 'bg-cyan-600 text-white'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                              title="No list"
                            >
                              <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16" />
                              </svg>
                            </button>
                            <button
                              onClick={() => updateTextBox(isolatedCardId, selectedTextBoxId, { listType: 'bullet' })}
                              className={`flex-1 p-2 rounded-lg transition-colors ${
                                selectedTextBox.listType === 'bullet'
                                  ? 'bg-cyan-600 text-white'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                              title="Bullet list"
                            >
                              <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                <circle cx="2" cy="6" r="1" fill="currentColor" />
                                <circle cx="2" cy="12" r="1" fill="currentColor" />
                                <circle cx="2" cy="18" r="1" fill="currentColor" />
                              </svg>
                            </button>
                            <button
                              onClick={() => updateTextBox(isolatedCardId, selectedTextBoxId, { listType: 'numbered' })}
                              className={`flex-1 p-2 rounded-lg transition-colors ${
                                selectedTextBox.listType === 'numbered'
                                  ? 'bg-cyan-600 text-white'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                              title="Numbered list"
                            >
                              <span className="text-sm font-mono">1.</span>
                            </button>
                          </div>
                        </div>
                        
                        {/* Quote / Link */}
                        <div className="mb-4">
                          <span className="text-xs text-gray-400 block mb-2">Special</span>
                          <div className="flex gap-2 mb-2">
                            <button
                              onClick={() => updateTextBox(isolatedCardId, selectedTextBoxId, { 
                                isQuote: !selectedTextBox.isQuote 
                              })}
                              className={`flex-1 p-2 rounded-lg transition-colors ${
                                selectedTextBox.isQuote
                                  ? 'bg-cyan-600 text-white'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                              title="Quote block"
                            >
                              <svg className="w-4 h-4 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => {
                                const url = selectedTextBox.link ? '' : prompt('Enter URL:', 'https://')
                                if (url !== null) {
                                  updateTextBox(isolatedCardId, selectedTextBoxId, { link: url })
                                }
                              }}
                              className={`flex-1 p-2 rounded-lg transition-colors ${
                                selectedTextBox.link
                                  ? 'bg-cyan-600 text-white'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                              title={selectedTextBox.link ? `Link: ${selectedTextBox.link}` : "Add link"}
                            >
                              <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                              </svg>
                            </button>
                          </div>
                          {selectedTextBox.link && (
                            <div className="text-xs text-cyan-400 truncate bg-gray-700 px-2 py-1 rounded">
                              {selectedTextBox.link}
                            </div>
                          )}
                        </div>
                        
                        {/* Text Alignment */}
                        <div className="mb-4">
                          <span className="text-xs text-gray-400 block mb-2">Alignment</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => updateTextBox(isolatedCardId, selectedTextBoxId, { textAlign: 'left' })}
                              className={`flex-1 p-2 rounded-lg transition-colors ${
                                selectedTextBox.textAlign === 'left'
                                  ? 'bg-cyan-600 text-white'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                              title="Align Left"
                            >
                              <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h14" />
                              </svg>
                            </button>
                            <button
                              onClick={() => updateTextBox(isolatedCardId, selectedTextBoxId, { textAlign: 'center' })}
                              className={`flex-1 p-2 rounded-lg transition-colors ${
                                selectedTextBox.textAlign === 'center'
                                  ? 'bg-cyan-600 text-white'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                              title="Align Center"
                            >
                              <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M5 18h14" />
                              </svg>
                            </button>
                            <button
                              onClick={() => updateTextBox(isolatedCardId, selectedTextBoxId, { textAlign: 'right' })}
                              className={`flex-1 p-2 rounded-lg transition-colors ${
                                selectedTextBox.textAlign === 'right'
                                  ? 'bg-cyan-600 text-white'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                              title="Align Right"
                            >
                              <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M6 18h14" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                          </>
                        )}
                        
                        {/* Image Sub-tab Content */}
                        {elementsSubTab === 'image' && (
                          <div className="bg-gray-800 rounded-lg p-4 mb-4">
                            {/* Add Image Button */}
                            <button
                              onClick={createImageSlot}
                              disabled={!isolatedCardId}
                              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors mb-4 ${
                                isolatedCardId
                                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                              }`}
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              Add Image
                            </button>
                            
                            {!isolatedCardId && (
                              <p className="text-gray-500 text-xs text-center mb-4">
                                Select a card to add images
                              </p>
                            )}
                            
                            {/* Image Slots List */}
                            {imageSlots.length > 0 ? (
                              <div className="space-y-2">
                                <p className="text-gray-400 text-xs font-medium mb-2">Image Slots ({imageSlots.length})</p>
                                {imageSlots.map((slot, index) => (
                                  <div
                                    key={slot.id}
                                    onClick={() => activateImageSlot(slot.id)}
                                    className={`p-3 rounded-lg cursor-pointer transition-all ${
                                      activeImageSlotId === slot.id
                                        ? 'bg-blue-600/30 border-2 border-blue-500'
                                        : slot.assigned
                                          ? 'bg-gray-700 border border-gray-600 hover:border-gray-500'
                                          : 'bg-gray-750 border border-dashed border-gray-600 hover:border-gray-500'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      {/* Thumbnail or Placeholder */}
                                      <div className={`w-12 h-12 rounded flex-shrink-0 overflow-hidden ${
                                        slot.url ? '' : 'bg-gray-600 flex items-center justify-center'
                                      }`}>
                                        {slot.url ? (
                                          <img
                                            src={slot.url}
                                            alt={slot.alt || 'Image'}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                          </svg>
                                        )}
                                      </div>
                                      
                                      {/* Slot Info */}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-300 truncate">
                                          Image {index + 1}
                                        </p>
                                        <p className={`text-xs ${slot.assigned ? 'text-green-400' : 'text-gray-500'}`}>
                                          {slot.assigned ? 'Assigned' : 'Empty - click to assign'}
                                        </p>
                                      </div>
                                      
                                      {/* Actions */}
                                      <div className="flex items-center gap-1">
                                        {/* Edit/Assign Button */}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            openPickerForSlot(slot.id)
                                          }}
                                          className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-600 rounded transition-colors"
                                          title={slot.assigned ? 'Change image' : 'Assign image'}
                                        >
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                          </svg>
                                        </button>
                                        
                                        {/* Clear Button (only if assigned) */}
                                        {slot.assigned && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              clearImageSlot(slot.id)
                                            }}
                                            className="p-1.5 text-gray-400 hover:text-yellow-400 hover:bg-gray-600 rounded transition-colors"
                                            title="Clear image"
                                          >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                            </svg>
                                          </button>
                                        )}
                                        
                                        {/* Delete Slot Button */}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            deleteImageSlot(slot.id)
                                          }}
                                          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-600 rounded transition-colors"
                                          title="Delete slot"
                                        >
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                          </svg>
                                        </button>
                                      </div>
                                    </div>
                                    
                                    {/* Active Indicator */}
                                    {activeImageSlotId === slot.id && (
                                      <div className="mt-2 pt-2 border-t border-gray-600">
                                        <p className="text-xs text-blue-400 flex items-center gap-1">
                                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                          </svg>
                                          Active - Selected on card
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : isolatedCardId ? (
                              <div className="flex flex-col items-center text-center py-6">
                                <svg className="w-10 h-10 text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <p className="text-gray-500 text-sm">No images yet</p>
                                <p className="text-gray-600 text-xs mt-1">Click "Add Image" to create an image element</p>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center text-center py-6">
                                <svg className="w-10 h-10 text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                                </svg>
                                <p className="text-gray-500 text-sm">Select a card first</p>
                                <p className="text-gray-600 text-xs mt-1">Click on a card to edit its images</p>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Media Sub-tab Content */}
                        {elementsSubTab === 'media' && (
                          <div className="bg-gray-800 rounded-lg p-4 mb-4">
                            <div className="flex flex-col items-center text-center py-8">
                              <svg className="w-12 h-12 text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <p className="text-gray-400 font-medium mb-1">Media Elements</p>
                              <p className="text-gray-500 text-sm">Coming soon</p>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    
                    {/* Capabilities Tab Content (Placeholder) */}
                    {propertiesTab === 'capabilities' && (
                      <div className="bg-gray-800 rounded-lg p-4 mb-4">
                        <div className="flex flex-col items-center text-center py-8">
                          <svg className="w-12 h-12 text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                          </svg>
                          <p className="text-gray-400 font-medium mb-1">Card Capabilities</p>
                          <p className="text-gray-500 text-sm">Coming soon</p>
                          <p className="text-gray-600 text-xs mt-2">Links, buttons, forms, interactivity</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Effects Tab Content (Placeholder) */}
                    {propertiesTab === 'effects' && (
                      <div className="bg-gray-800 rounded-lg p-4 mb-4">
                        <div className="flex flex-col items-center text-center py-8">
                          <svg className="w-12 h-12 text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <p className="text-gray-400 font-medium mb-1">Card Effects</p>
                          <p className="text-gray-500 text-sm">Coming soon</p>
                          <p className="text-gray-600 text-xs mt-2">Animations, transitions, hover effects</p>
                        </div>
                      </div>
                    )}
                    
                    {/* System Tab Content (Placeholder) */}
                    {propertiesTab === 'system' && (
                      <div className="bg-gray-800 rounded-lg p-4 mb-4">
                        <div className="flex flex-col items-center text-center py-8">
                          <svg className="w-12 h-12 text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <p className="text-gray-400 font-medium mb-1">System Settings</p>
                          <p className="text-gray-500 text-sm">Coming soon</p>
                          <p className="text-gray-600 text-xs mt-2">Card metadata, visibility, permissions</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Done Button */}
                    <button
                      onClick={exitIsolationMode}
                      className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 transition-colors font-medium"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Done Editing
                    </button>
                  </>
                )
              })()}
            </>
          )}

          {/* Conveyor/Parallax Settings Section - shown when owner is 'conveyor' AND conveyor is active */}
          {settingsPaneOwner === 'conveyor' && conveyorMode && (
            <>
              {/* Ratio Section */}
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                  Ratio (Conveyor Length)
                </h4>
                
                {/* Ratio Slider */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>1:1 (No parallax)</span>
                    <span>10:1 (Deep)</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.5"
                    value={scrollRatio}
                    onChange={(e) => setScrollRatio(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <div className="text-center text-sm text-indigo-400 font-medium mt-1">
                    {scrollRatio}:1 ratio
                  </div>
                </div>

                {/* Ratio Presets */}
                <div className="grid grid-cols-5 gap-1 mb-4">
                  {ratioPresets.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => setScrollRatio(preset.ratio)}
                      className={`px-2 py-1.5 text-xs rounded transition-colors ${
                        scrollRatio === preset.ratio
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                      title={preset.description}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Speed Section */}
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Speed (Scroll Velocity)
                </h4>
                
                {/* Speed Slider */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>0.25x (Slow)</span>
                    <span>3x (Fast)</span>
                  </div>
                  <input
                    type="range"
                    min="0.25"
                    max="3"
                    step="0.25"
                    value={scrollSpeed}
                    onChange={(e) => setScrollSpeed(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <div className="text-center text-sm text-amber-400 font-medium mt-1">
                    {scrollSpeed}x speed
                  </div>
                </div>

                {/* Speed Presets */}
                <div className="grid grid-cols-6 gap-1 mb-4">
                  {speedPresets.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => setScrollSpeed(preset.speed)}
                      className={`px-2 py-1.5 text-xs rounded transition-colors ${
                        scrollSpeed === preset.speed
                          ? 'bg-amber-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                      title={preset.description}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Wallpaper Position Section */}
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  Wallpaper Position
                </h4>
                <p className="text-xs text-gray-500 mb-3">Drag the wallpaper bar to set when it scrolls during the journey</p>
                
                {/* Interactive Conveyor Track with Draggable Wallpaper */}
                <div className="bg-gray-900 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2 select-none">
                    <span className="text-xs text-gray-400">Conveyor Track ({Math.round(conveyorLength)}vh)</span>
                    <span className="text-xs text-emerald-400 font-mono">Position: {Math.round(wallpaperPosition)}%</span>
                  </div>
                  
                  {/* Track container */}
                  <div 
                    ref={wallpaperTrackRef}
                    className="relative h-8 bg-gray-700 rounded-lg cursor-grab active:cursor-grabbing select-none"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      if (!wallpaperTrackRef.current) return
                      const rect = wallpaperTrackRef.current.getBoundingClientRect()
                      const x = e.clientX - rect.left
                      const percent = (x / rect.width) * 100
                      // Clamp to valid range
                      const wallpaperWidthPercent = (baseWallpaperHeight / conveyorLength) * 100
                      const maxPos = 100 - wallpaperWidthPercent
                      setWallpaperPosition(Math.max(0, Math.min(maxPos, percent)))
                      setIsDraggingWallpaper(true)
                      
                      // Handle mouse move/up on window for smooth dragging
                      const handleMouseMove = (moveEvent) => {
                        if (!wallpaperTrackRef.current) return
                        const moveRect = wallpaperTrackRef.current.getBoundingClientRect()
                        const moveX = moveEvent.clientX - moveRect.left
                        const movePercent = (moveX / moveRect.width) * 100
                        const moveMaxPos = 100 - wallpaperWidthPercent
                        setWallpaperPosition(Math.max(0, Math.min(moveMaxPos, movePercent)))
                      }
                      
                      const handleMouseUp = () => {
                        setIsDraggingWallpaper(false)
                        window.removeEventListener('mousemove', handleMouseMove)
                        window.removeEventListener('mouseup', handleMouseUp)
                      }
                      
                      window.addEventListener('mousemove', handleMouseMove)
                      window.addEventListener('mouseup', handleMouseUp)
                    }}
                  >
                    {/* Conveyor fill (full width) */}
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-900/50 to-indigo-800/50 rounded-lg pointer-events-none" />
                    
                    {/* Wallpaper slider */}
                    <div 
                      className={`absolute top-0 bottom-0 bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-lg pointer-events-none ${
                        isDraggingWallpaper ? 'shadow-lg shadow-emerald-500/50' : ''
                      }`}
                      style={{ 
                        left: `${wallpaperPosition}%`,
                        width: `${(baseWallpaperHeight / conveyorLength) * 100}%`,
                      }}
                    >
                      {/* Drag handle indicators */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="flex gap-0.5">
                          <div className="w-0.5 h-4 bg-white/40 rounded" />
                          <div className="w-0.5 h-4 bg-white/40 rounded" />
                          <div className="w-0.5 h-4 bg-white/40 rounded" />
                        </div>
                      </div>
                    </div>
                    
                    {/* Position markers */}
                    <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1 text-[8px] text-gray-500 pointer-events-none select-none">
                      <span>0%</span>
                      <span>50%</span>
                      <span>100%</span>
                    </div>
                  </div>
                  
                  {/* Position presets */}
                  <div className="grid grid-cols-3 gap-1 mt-3">
                    <button
                      onClick={() => setWallpaperPosition(0)}
                      className={`px-2 py-1.5 text-xs rounded transition-colors ${
                        wallpaperPosition === 0
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Start
                    </button>
                    <button
                      onClick={() => setWallpaperPosition(maxWallpaperPositionPercent / 2)}
                      className={`px-2 py-1.5 text-xs rounded transition-colors ${
                        Math.abs(wallpaperPosition - maxWallpaperPositionPercent / 2) < 5
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Middle
                    </button>
                    <button
                      onClick={() => setWallpaperPosition(maxWallpaperPositionPercent)}
                      className={`px-2 py-1.5 text-xs rounded transition-colors ${
                        Math.abs(wallpaperPosition - maxWallpaperPositionPercent) < 5
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      End
                    </button>
                  </div>
                </div>
              </div>

              {/* Visual Summary */}
              <div className="bg-gray-900 rounded-lg p-3 space-y-3 mb-4">
                <div className="text-xs text-gray-400 mb-2 text-center font-medium">Summary</div>
                
                {/* Speed indicator */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      Speed
                    </span>
                    <span className="text-xs text-amber-400 font-mono">{scrollSpeed}x</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-300"
                      style={{ width: `${(scrollSpeed / 3) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="pt-2 border-t border-gray-700 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Conveyor : Wallpaper</span>
                    <span className="text-xs text-gray-300 font-mono">{scrollRatio} : 1</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Wallpaper scrolls at</span>
                    <span className="text-xs text-gray-300 font-mono">{Math.round(wallpaperPosition)}% - {Math.round(wallpaperPosition + (baseWallpaperHeight / conveyorLength) * 100)}%</span>
                  </div>
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-xs text-gray-400">
                    <p className="mb-1"><strong className="text-gray-300">Ratio:</strong> Conveyor length relative to wallpaper</p>
                    <p className="mb-1"><strong className="text-gray-300">Speed:</strong> How fast elements move when you scroll</p>
                    <p><strong className="text-gray-300">Position:</strong> Drag to set when wallpaper scrolls during journey</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Helper message for tools without settings (Eraser, Select, Resize) */}
          {/* Show ONLY when: a tool without settings is active AND no valid settings are being shown */}
          {(() => {
            const toolWithoutSettingsActive = eraserMode || selectMode || resizeMode
            // Check if any settings are actually being rendered
            const pencilSettingsShowing = settingsPaneOwner === 'pencil' && (pencilMode || isolatedCardId)
            const moveSettingsShowing = (settingsPaneOwner === 'move' && moveMode) || (moveSettingsStacked && isolatedCardId)
            const propertiesSettingsShowing = settingsPaneOwner === 'properties' && (propertiesMode || isolatedCardId)
            const saveSettingsShowing = settingsPaneOwner === 'save' && saveMode
            const conveyorSettingsShowing = settingsPaneOwner === 'conveyor' && conveyorMode
            const anySettingsShowing = pencilSettingsShowing || moveSettingsShowing || propertiesSettingsShowing || saveSettingsShowing || conveyorSettingsShowing
            
            // Only show helper when tool without settings is active and NO settings are visible
            const showToolHelperMessage = toolWithoutSettingsActive && !anySettingsShowing
            
            if (showToolHelperMessage) {
              return (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <svg className="w-12 h-12 text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-gray-400 text-sm font-medium mb-2">
                    {eraserMode ? 'Eraser' : selectMode ? 'Select' : 'Resize'} tool active
                  </p>
                  <p className="text-gray-500 text-xs mb-4">
                    This tool has no additional settings.<br />
                    Select a tool with settings for more options.
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Try the <strong className="text-cyan-400">Properties</strong> tool</span>
                  </div>
                </div>
              )
            }
            return null
          })()}
          
          {/* Empty state when no tool with settings is active/showing AND no tool-without-settings helper is showing */}
          {(() => {
            const toolWithoutSettingsActive = eraserMode || selectMode || resizeMode
            const pencilSettingsShowing = settingsPaneOwner === 'pencil' && (pencilMode || isolatedCardId)
            const moveSettingsShowing = (settingsPaneOwner === 'move' && moveMode) || (moveSettingsStacked && isolatedCardId)
            const propertiesSettingsShowing = settingsPaneOwner === 'properties' && (propertiesMode || isolatedCardId)
            const saveSettingsShowing = settingsPaneOwner === 'save' && saveMode
            const conveyorSettingsShowing = settingsPaneOwner === 'conveyor' && conveyorMode
            const anySettingsShowing = pencilSettingsShowing || moveSettingsShowing || propertiesSettingsShowing || saveSettingsShowing || conveyorSettingsShowing
            // Also check if the helper message is showing (tool without settings + no settings visible)
            const helperMessageShowing = toolWithoutSettingsActive && !anySettingsShowing
            
            // Show empty state ONLY when nothing else is showing
            if (!anySettingsShowing && !helperMessageShowing) {
              return (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <svg className="w-16 h-16 text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <p className="text-gray-400 text-sm mb-2">No tool selected</p>
                  <p className="text-gray-500 text-xs">Select a tool with settings<br />to see more options</p>
                  <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                    <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Try the <strong className="text-cyan-400">Properties</strong> tool</span>
                  </div>
                </div>
              )
            }
            return null
          })()}
        </div>
      </div>
    </div>
  )
}

export default CardBuilderPage
