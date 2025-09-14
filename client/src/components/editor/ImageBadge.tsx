import React from 'react'
import { ImageMetadata } from '../../utils/imageTypeDetection'

interface ImageBadgeProps {
  metadata: ImageMetadata
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const ImageBadge: React.FC<ImageBadgeProps> = ({ metadata, className = '', size = 'sm' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4 text-xs',
    md: 'w-5 h-5 text-sm', 
    lg: 'w-6 h-6 text-base'
  }

  const badgeClasses = metadata.isUpload
    ? 'bg-blue-500 text-white border-blue-600'
    : 'bg-orange-500 text-white border-orange-600'

  const icon = metadata.isUpload ? (
    // Upload icon
    <svg className="w-full h-full" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
    </svg>
  ) : (
    // External link icon
    <svg className="w-full h-full" fill="currentColor" viewBox="0 0 20 20">
      <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
      <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
    </svg>
  )

  return (
    <div 
      className={`
        inline-flex items-center justify-center rounded-full border-2 shadow-sm
        ${sizeClasses[size]}
        ${badgeClasses}
        ${className}
      `}
      title={metadata.isUpload ? 'Uploaded file' : 'External URL'}
    >
      {icon}
    </div>
  )
}

export default ImageBadge
