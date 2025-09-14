// Compression Settings Component for Dashboard
import React, { useState } from 'react'
import { useCompressionSettings } from '../../../hooks/useCompressionSettings'

const CompressionSettings = () => {
  const { settings, loading, error, updateSettings, isCompressionEnabled } = useCompressionSettings()
  const [saveStatus, setSaveStatus] = useState(null)

  // Mock stats for now (will be replaced with real data later)
  const stats = {
    compressedImages: 0,
    totalSavings: 0,
    averageCompressionRatio: 0
  }

  const handleSettingChange = async (key, value) => {
    try {
      await updateSettings({ [key]: value })
      setSaveStatus({ type: 'success', message: 'Settings saved successfully' })
      
      // Clear status after 3 seconds
      setTimeout(() => setSaveStatus(null), 3000)
    } catch (error) {
      setSaveStatus({ type: 'error', message: `Failed to save: ${error.message}` })
      setTimeout(() => setSaveStatus(null), 5000)
    }
  }


  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Image Compression</h3>
        <p className="mt-1 text-sm text-gray-500">
          Configure automatic image compression to reduce file sizes and improve loading performance.
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Save Status */}
        {saveStatus && (
          <div className={`p-3 rounded-md ${
            saveStatus.type === 'success' 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {saveStatus.message}
          </div>
        )}

        {/* Master Control */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h4 className="text-base font-medium text-gray-900">Enable Image Compression</h4>
              <p className="text-sm text-gray-500 mt-1">
                Master toggle to enable or disable all image compression features
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.compression_enabled}
                onChange={(e) => handleSettingChange('compression_enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* Legacy Compression System */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h4 className="text-base font-medium text-gray-900">Enable Legacy Compression</h4>
              <p className="text-sm text-gray-500 mt-1">
                Enable the old client-side compression system that shows "This image is large" warnings
              </p>
              <p className="text-xs text-gray-400 mt-1">
                <span className="font-medium">Legacy:</span> Canvas-based, fixed 82% quality | <span className="font-medium">New:</span> Server-side Sharp, configurable quality
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enable_legacy_compression}
                onChange={(e) => handleSettingChange('enable_legacy_compression', e.target.checked)}
                disabled={!isCompressionEnabled}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* Compression Statistics - Coming Soon */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-base font-medium text-gray-900 mb-3">Compression Statistics</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-400">--</div>
              <div className="text-sm text-gray-500">Images Compressed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-400">--</div>
              <div className="text-sm text-gray-500">Space Saved</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-400">--</div>
              <div className="text-sm text-gray-500">Average Reduction</div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Statistics will be available once compression is active.
          </p>
        </div>

        {/* Settings Grid */}
        <div className={`space-y-6 ${!isCompressionEnabled ? 'opacity-50' : ''}`}>
          
          {/* Automatic Compression */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="text-base font-medium text-gray-900 mb-3">Automatic Compression</h4>
            
            <div className="space-y-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.auto_compress}
                  onChange={(e) => handleSettingChange('auto_compress', e.target.checked)}
                  disabled={!isCompressionEnabled}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Auto-compress large images</span>
              </label>

              {settings.auto_compress && (
                <div className="ml-6 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Size threshold: {settings.size_threshold_kb} KB
                    </label>
                    <input
                      type="range"
                      min="100"
                      max="2000"
                      step="50"
                      value={settings.size_threshold_kb}
                      onChange={(e) => handleSettingChange('size_threshold_kb', parseInt(e.target.value))}
                      disabled={!isCompressionEnabled}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>100 KB</span>
                      <span>2 MB</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Dimension threshold: {settings.dimension_threshold_px} px
                    </label>
                    <input
                      type="range"
                      min="1000"
                      max="4000"
                      step="100"
                      value={settings.dimension_threshold_px}
                      onChange={(e) => handleSettingChange('dimension_threshold_px', parseInt(e.target.value))}
                      disabled={!isCompressionEnabled}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>1000px</span>
                      <span>4000px</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Compression Levels */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="text-base font-medium text-gray-900 mb-3">Compression Quality</h4>
            
            <div className="space-y-3">
              {[
                { value: 'high', label: 'High Quality (85%)', description: 'Minimal compression, best quality' },
                { value: 'balanced', label: 'Balanced (75%)', description: 'Good balance of size and quality' },
                { value: 'aggressive', label: 'Aggressive (60%)', description: 'Maximum compression, smaller files' },
                { value: 'custom', label: 'Custom', description: 'Set your own quality level' }
              ].map(({ value, label, description }) => (
                <label key={value} className="flex items-start">
                  <input
                    type="radio"
                    name="quality_preset"
                    value={value}
                    checked={settings.quality_preset === value}
                    onChange={(e) => handleSettingChange('quality_preset', e.target.value)}
                    disabled={!isCompressionEnabled}
                    className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="ml-2">
                    <div className="text-sm font-medium text-gray-900">{label}</div>
                    <div className="text-sm text-gray-500">{description}</div>
                  </div>
                </label>
              ))}

              {settings.quality_preset === 'custom' && (
                <div className="ml-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Custom Quality: {settings.custom_quality}%
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={settings.custom_quality}
                    onChange={(e) => handleSettingChange('custom_quality', parseInt(e.target.value))}
                    disabled={!isCompressionEnabled}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Smaller files</span>
                    <span>Better quality</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Format Handling */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="text-base font-medium text-gray-900 mb-3">Format Handling</h4>
            
            <div className="space-y-3">
              <label className="flex items-start">
                <input
                  type="checkbox"
                  checked={settings.convert_photos_to_webp}
                  onChange={(e) => handleSettingChange('convert_photos_to_webp', e.target.checked)}
                  disabled={!isCompressionEnabled}
                  className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="ml-2">
                  <div className="text-sm font-medium text-gray-900">Convert photos to WebP</div>
                  <div className="text-sm text-gray-500">Better compression for photographic images</div>
                </div>
              </label>

              <label className="flex items-start">
                <input
                  type="checkbox"
                  checked={settings.preserve_png_for_graphics}
                  onChange={(e) => handleSettingChange('preserve_png_for_graphics', e.target.checked)}
                  disabled={!isCompressionEnabled}
                  className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="ml-2">
                  <div className="text-sm font-medium text-gray-900">Keep PNG for graphics/logos</div>
                  <div className="text-sm text-gray-500">Preserve PNG format for images with transparency</div>
                </div>
              </label>

              <label className="flex items-start">
                <input
                  type="checkbox"
                  checked={settings.always_preserve_format}
                  onChange={(e) => handleSettingChange('always_preserve_format', e.target.checked)}
                  disabled={!isCompressionEnabled}
                  className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="ml-2">
                  <div className="text-sm font-medium text-gray-900">Always preserve original format</div>
                  <div className="text-sm text-gray-500">Never convert between formats, only compress</div>
                </div>
              </label>
            </div>
          </div>

          {/* Bulk Operations */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="text-base font-medium text-gray-900 mb-3">Bulk Operations</h4>
            
            <div className="space-y-3">
              <button
                onClick={() => {
                  // TODO: Implement bulk compression
                  alert('Bulk compression coming soon!')
                }}
                disabled={!isCompressionEnabled}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  isCompressionEnabled
                    ? 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Compress All Existing Images
              </button>
              
              <button
                onClick={() => {
                  // TODO: Implement revert functionality
                  alert('Revert functionality coming soon!')
                }}
                disabled={!isCompressionEnabled}
                className={`ml-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  isCompressionEnabled
                    ? 'bg-gray-600 text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Revert Recent Compressions
              </button>
            </div>
            
            <p className="text-xs text-gray-500 mt-2">
              Bulk operations will be implemented in a future update.
            </p>
          </div>

        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <div className="text-red-800 text-sm">
              Error loading compression settings: {error}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CompressionSettings
