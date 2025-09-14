import React, { useState, useRef, useEffect } from 'react'

interface SmartTooltipProps {
  content: string
  children: React.ReactNode
  disabled?: boolean
  className?: string
  delay?: number
}

const SmartTooltip: React.FC<SmartTooltipProps> = ({
  content,
  children,
  disabled = false,
  className = '',
  delay = 300
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState<'top' | 'bottom' | 'left' | 'right'>('top')
  const containerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout>()

  const calculatePosition = () => {
    if (!containerRef.current || !tooltipRef.current) return

    const containerRect = containerRef.current.getBoundingClientRect()
    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    
    const spaceTop = containerRect.top
    const spaceBottom = viewportHeight - containerRect.bottom
    const spaceLeft = containerRect.left
    const spaceRight = viewportWidth - containerRect.right
    
    // Determine best position based on available space
    let bestPosition: 'top' | 'bottom' | 'left' | 'right' = 'top'
    
    // Prefer top/bottom first (more natural for most tooltips)
    if (spaceTop >= tooltipRect.height + 8) {
      bestPosition = 'top'
    } else if (spaceBottom >= tooltipRect.height + 8) {
      bestPosition = 'bottom'
    } else if (spaceRight >= tooltipRect.width + 8) {
      bestPosition = 'right'
    } else if (spaceLeft >= tooltipRect.width + 8) {
      bestPosition = 'left'
    } else {
      // If no space is sufficient, use the side with most space
      const maxSpace = Math.max(spaceTop, spaceBottom, spaceLeft, spaceRight)
      if (maxSpace === spaceTop) bestPosition = 'top'
      else if (maxSpace === spaceBottom) bestPosition = 'bottom'
      else if (maxSpace === spaceRight) bestPosition = 'right'
      else bestPosition = 'left'
    }
    
    setPosition(bestPosition)
  }

  const handleMouseEnter = () => {
    if (disabled || !content.trim()) return
    
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true)
    }, delay)
  }

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsVisible(false)
  }

  useEffect(() => {
    if (isVisible) {
      // Small delay to ensure tooltip is rendered before calculating position
      const timer = setTimeout(calculatePosition, 10)
      return () => clearTimeout(timer)
    }
  }, [isVisible])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const getTooltipClasses = () => {
    const baseClasses = "absolute z-50 px-2 py-1 text-xs bg-gray-900 text-white rounded shadow-lg whitespace-nowrap max-w-xs pointer-events-none transition-opacity duration-200"
    
    const positionClasses = {
      top: "bottom-full left-1/2 transform -translate-x-1/2 mb-2",
      bottom: "top-full left-1/2 transform -translate-x-1/2 mt-2", 
      left: "right-full top-1/2 transform -translate-y-1/2 mr-2",
      right: "left-full top-1/2 transform -translate-y-1/2 ml-2"
    }
    
    const opacityClass = isVisible ? "opacity-100" : "opacity-0"
    
    return `${baseClasses} ${positionClasses[position]} ${opacityClass} ${className}`
  }

  const getArrowClasses = () => {
    const arrowClasses = {
      top: "absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900",
      bottom: "absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900",
      left: "absolute left-full top-1/2 transform -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-l-4 border-transparent border-l-gray-900",
      right: "absolute right-full top-1/2 transform -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-gray-900"
    }
    
    return arrowClasses[position]
  }

  return (
    <div 
      ref={containerRef}
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      
      {/* Smart Tooltip */}
      {content.trim() && (
        <div
          ref={tooltipRef}
          className={getTooltipClasses()}
          style={{ 
            visibility: isVisible ? 'visible' : 'hidden',
            // Prevent tooltip from being clipped by container bounds
            wordBreak: 'break-word'
          }}
        >
          {content}
          <div className={getArrowClasses()}></div>
        </div>
      )}
    </div>
  )
}

export default SmartTooltip
