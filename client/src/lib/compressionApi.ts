// Compression API client functions
import { supabaseAdminGet, supabaseAdminPatch, supabaseAdminPost } from './api'

export interface CompressionSettings {
  compression_enabled: boolean
  auto_compress: boolean
  size_threshold_kb: number
  dimension_threshold_px: number
  quality_preset: 'high' | 'balanced' | 'aggressive' | 'custom'
  custom_quality: number
  convert_photos_to_webp: boolean
  preserve_png_for_graphics: boolean
  always_preserve_format: boolean
  enable_legacy_compression: boolean
}

export interface CompressionResult {
  url: string
  path: string
  width: number
  height: number
  originalSize: number
  compressedSize: number
  compressionRatio: number
  format: string
  compressionStats: string
}

export interface CompressionStats {
  totalImages: number
  compressedImages: number
  totalOriginalSize: number
  totalCompressedSize: number
  totalSavings: number
  averageCompressionRatio: number
}

/**
 * Get current compression settings
 */
export async function getCompressionSettings(): Promise<CompressionSettings> {
  return await supabaseAdminGet('/api/compression/settings')
}

/**
 * Update compression settings
 */
export async function updateCompressionSettings(settings: Partial<CompressionSettings>): Promise<{ success: boolean; message: string }> {
  return await supabaseAdminPatch('/api/compression/settings', settings)
}

/**
 * Download and compress an image from URL
 */
export async function compressImageFromUrl(
  url: string, 
  options?: {
    quality?: 'high' | 'balanced' | 'aggressive' | number
    format?: 'auto' | 'webp' | 'jpeg' | 'png'
  }
): Promise<CompressionResult> {
  return await supabaseAdminPost('/api/compression/compress-url', {
    url,
    ...options
  })
}

/**
 * Get compression statistics
 */
export async function getCompressionStats(): Promise<CompressionStats> {
  return await supabaseAdminGet('/api/compression/stats')
}

/**
 * Default compression settings
 */
export const defaultCompressionSettings: CompressionSettings = {
  compression_enabled: true,
  auto_compress: true,
  size_threshold_kb: 500,
  dimension_threshold_px: 2000,
  quality_preset: 'balanced',
  custom_quality: 75,
  convert_photos_to_webp: true,
  preserve_png_for_graphics: true,
  always_preserve_format: false,
  enable_legacy_compression: true
}
