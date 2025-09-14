import React, { useState, useRef, useEffect } from 'react'
import SmartTooltip from './SmartTooltip'

interface TruncatedTextProps {
  text: string
  maxLength?: number
  className?: string
  containerClassName?: string
  showTooltip?: boolean
}

const TruncatedText: React.FC<TruncatedTextProps> = ({
  text,
  maxLength = 30,
  className = '',
  containerClassName = '',
  showTooltip = true
}) => {
  // Check if text needs truncation
  const needsTruncation = text.length > maxLength
  const displayText = needsTruncation ? `${text.substring(0, maxLength)}...` : text

  return (
    <div className={containerClassName}>
      <SmartTooltip
        content={needsTruncation && showTooltip ? text : ''}
        disabled={!needsTruncation || !showTooltip}
      >
        <span className={className}>
          {displayText}
        </span>
      </SmartTooltip>
    </div>
  )
}

export default TruncatedText
