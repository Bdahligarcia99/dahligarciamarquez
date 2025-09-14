// Compression controls component for use in ImagePicker and other image inputs
import React from 'react'
import SmartTooltip from './SmartTooltip'

export interface CompressionControlsProps {
  // Compression state
  enabled: boolean
  quality: 'high' | 'balanced' | 'aggressive' | 'custom'
  customQuality?: number
  
  // Callbacks
  onEnabledChange: (enabled: boolean) => void
  onQualityChange: (quality: 'high' | 'balanced' | 'aggressive' | 'custom') => void
  onCustomQualityChange?: (quality: number) => void
  
  // UI state
  disabled?: boolean
  disabledTooltip?: string
  size?: 'sm' | 'md'
  className?: string
}

const CompressionControls: React.FC<CompressionControlsProps> = ({
  enabled,
  quality,
  customQuality = 75,
  onEnabledChange,
  onQualityChange,
  onCustomQualityChange,
  disabled = false,
  disabledTooltip = "Compression is disabled in settings",
  size = 'md',
  className = ''
}) => {
  const isDisabled = disabled || !enabled
  const sizeClasses = size === 'sm' ? 'text-xs' : 'text-sm'
  
  const QualityOption: React.FC<{
    value: 'high' | 'balanced' | 'aggressive' | 'custom'
    label: string
    description: string
  }> = ({ value, label, description }) => (
    <label className={`flex items-center space-x-2 cursor-pointer ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <input
        type="radio"
        name="compressionQuality"
        value={value}
        checked={quality === value}
        onChange={() => !isDisabled && onQualityChange(value)}
        disabled={isDisabled}
        className="text-blue-600 focus:ring-blue-500"
      />
      <div className="flex-1">
        <div className={`font-medium text-gray-900 ${sizeClasses}`}>{label}</div>
        <div className={`text-gray-500 ${size === 'sm' ? 'text-xs' : 'text-xs'}`}>{description}</div>
      </div>
    </label>
  )

  const controlsContent = (
    <div className={`space-y-3 ${className}`}>
      {/* Master Enable/Disable Toggle */}
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="compressionEnabled"
          checked={enabled}
          onChange={(e) => !disabled && onEnabledChange(e.target.checked)}
          disabled={disabled}
          className={`rounded border-gray-300 text-blue-600 focus:ring-blue-500 ${disabled ? 'opacity-50' : ''}`}
        />
        <label 
          htmlFor="compressionEnabled" 
          className={`${sizeClasses} font-medium text-gray-900 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Compress this image
        </label>
      </div>

      {/* Quality Settings */}
      {enabled && (
        <div className="ml-6 space-y-2">
          <div className={`${sizeClasses} font-medium text-gray-700 mb-2`}>Quality:</div>
          
          <div className="space-y-2">
            <QualityOption
              value="high"
              label="High Quality (85%)"
              description="Minimal compression, best quality"
            />
            
            <QualityOption
              value="balanced"
              label="Balanced (75%)"
              description="Good balance of size and quality"
            />
            
            <QualityOption
              value="aggressive"
              label="Aggressive (60%)"
              description="Maximum compression, smaller files"
            />
            
            <QualityOption
              value="custom"
              label="Custom"
              description="Set your own quality level"
            />
            
            {/* Custom Quality Slider */}
            {quality === 'custom' && (
              <div className="ml-6 mt-2">
                <div className="flex items-center space-x-3">
                  <label className={`${sizeClasses} text-gray-600 whitespace-nowrap`}>
                    Quality: {customQuality}%
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={customQuality}
                    onChange={(e) => !isDisabled && onCustomQualityChange?.(parseInt(e.target.value))}
                    disabled={isDisabled}
                    className={`flex-1 ${isDisabled ? 'opacity-50' : ''}`}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>Smaller</span>
                  <span>Better Quality</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )

  // If disabled, wrap in tooltip
  if (disabled && disabledTooltip) {
    return (
      <SmartTooltip content={disabledTooltip}>
        <div className="opacity-50">
          {controlsContent}
        </div>
      </SmartTooltip>
    )
  }

  return controlsContent
}

export default CompressionControls
