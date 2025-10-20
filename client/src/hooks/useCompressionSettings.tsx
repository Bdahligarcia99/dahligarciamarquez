// Compression settings hook and context
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { CompressionSettings, getCompressionSettings, updateCompressionSettings, defaultCompressionSettings } from '../lib/compressionApi'
import { getAdminToken } from '../lib/adminAuth'

interface CompressionContextType {
  settings: CompressionSettings
  loading: boolean
  error: string | null
  updateSettings: (newSettings: Partial<CompressionSettings>) => Promise<void>
  isCompressionEnabled: boolean
  refreshSettings: () => Promise<void>
}

const CompressionContext = createContext<CompressionContextType | null>(null)

export function CompressionProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<CompressionSettings>(defaultCompressionSettings)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshSettings = async () => {
    // Only fetch if we have an admin token
    const adminToken = getAdminToken()
    if (!adminToken) {
      setSettings(defaultCompressionSettings)
      setLoading(false)
      setError(null)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const fetchedSettings = await getCompressionSettings()
      setSettings(fetchedSettings)
    } catch (err) {
      console.error('Failed to fetch compression settings:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch settings')
      // Use default settings on error
      setSettings(defaultCompressionSettings)
    } finally {
      setLoading(false)
    }
  }

  const updateSettingsHandler = async (newSettings: Partial<CompressionSettings>) => {
    try {
      setError(null)
      
      // Optimistically update UI
      const updatedSettings = { ...settings, ...newSettings }
      setSettings(updatedSettings)
      
      // Save to server
      await updateCompressionSettings(newSettings)
    } catch (err) {
      console.error('Failed to update compression settings:', err)
      setError(err instanceof Error ? err.message : 'Failed to update settings')
      
      // Revert optimistic update on error
      await refreshSettings()
      throw err
    }
  }

  useEffect(() => {
    refreshSettings()
  }, [])

  const contextValue: CompressionContextType = {
    settings,
    loading,
    error,
    updateSettings: updateSettingsHandler,
    isCompressionEnabled: settings.compression_enabled,
    refreshSettings
  }

  return (
    <CompressionContext.Provider value={contextValue}>
      {children}
    </CompressionContext.Provider>
  )
}

export function useCompressionSettings() {
  const context = useContext(CompressionContext)
  if (!context) {
    throw new Error('useCompressionSettings must be used within a CompressionProvider')
  }
  return context
}

// Hook for getting compression settings without provider (for components that don't need updates)
export function useCompressionSettingsStatic() {
  const [settings, setSettings] = useState<CompressionSettings>(defaultCompressionSettings)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    
    // Only fetch if we have an admin token
    const adminToken = getAdminToken()
    if (!adminToken) {
      if (mounted) {
        setSettings(defaultCompressionSettings)
        setLoading(false)
      }
      return
    }
    
    getCompressionSettings()
      .then(fetchedSettings => {
        if (mounted) {
          setSettings(fetchedSettings)
          setLoading(false)
        }
      })
      .catch(err => {
        console.error('Failed to fetch compression settings:', err)
        if (mounted) {
          setSettings(defaultCompressionSettings)
          setLoading(false)
        }
      })

    return () => {
      mounted = false
    }
  }, [])

  return {
    settings,
    loading,
    isCompressionEnabled: settings.compression_enabled
  }
}
