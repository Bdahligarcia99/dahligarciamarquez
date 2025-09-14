// Compression API routes
import { Router } from 'express'
import { requireAdmin } from '../src/middleware/requireAdmin.ts'
import { CompressionService, CompressionOptions } from '../src/services/compressionService.ts'
import { storage } from '../src/storage/index.js'
import { query } from '../src/db.ts'

const router = Router()

/**
 * GET /api/compression/settings - Get compression settings
 */
router.get('/settings', requireAdmin, async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        compression_enabled,
        auto_compress,
        size_threshold_kb,
        dimension_threshold_px,
        quality_preset,
        custom_quality,
        convert_photos_to_webp,
        preserve_png_for_graphics,
        always_preserve_format,
        enable_legacy_compression
      FROM compression_settings 
      WHERE user_id IS NULL 
      ORDER BY created_at DESC 
      LIMIT 1
    `)
    
    if (result.rows.length === 0) {
      // Return default settings if none exist
      return res.json({
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
      })
    }
    
    res.json(result.rows[0])
  } catch (error) {
    console.error('Error fetching compression settings:', error)
    res.status(500).json({ error: 'Failed to fetch compression settings' })
  }
})

/**
 * PATCH /api/compression/settings - Update compression settings
 */
router.patch('/settings', requireAdmin, async (req, res) => {
  try {
    const {
      compression_enabled,
      auto_compress,
      size_threshold_kb,
      dimension_threshold_px,
      quality_preset,
      custom_quality,
      convert_photos_to_webp,
      preserve_png_for_graphics,
      always_preserve_format,
      enable_legacy_compression
    } = req.body
    
    // Validate input - be more tolerant of undefined values
    if (compression_enabled !== undefined && typeof compression_enabled !== 'boolean') {
      return res.status(400).json({ error: 'compression_enabled must be boolean' })
    }
    
    if (quality_preset && !['high', 'balanced', 'aggressive', 'custom'].includes(quality_preset)) {
      return res.status(400).json({ error: 'Invalid quality_preset' })
    }
    
    if (custom_quality && (custom_quality < 10 || custom_quality > 100)) {
      return res.status(400).json({ error: 'custom_quality must be between 10 and 100' })
    }
    
    // Get current settings first
    const currentResult = await query(`
      SELECT * FROM compression_settings 
      WHERE user_id IS NULL 
      ORDER BY created_at DESC 
      LIMIT 1
    `)
    
    const currentSettings = currentResult.rows[0] || {
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
    
    // Merge with provided values
    const updatedSettings = {
      compression_enabled: compression_enabled !== undefined ? compression_enabled : currentSettings.compression_enabled,
      auto_compress: auto_compress !== undefined ? auto_compress : currentSettings.auto_compress,
      size_threshold_kb: size_threshold_kb !== undefined ? size_threshold_kb : currentSettings.size_threshold_kb,
      dimension_threshold_px: dimension_threshold_px !== undefined ? dimension_threshold_px : currentSettings.dimension_threshold_px,
      quality_preset: quality_preset !== undefined ? quality_preset : currentSettings.quality_preset,
      custom_quality: custom_quality !== undefined ? custom_quality : currentSettings.custom_quality,
      convert_photos_to_webp: convert_photos_to_webp !== undefined ? convert_photos_to_webp : currentSettings.convert_photos_to_webp,
      preserve_png_for_graphics: preserve_png_for_graphics !== undefined ? preserve_png_for_graphics : currentSettings.preserve_png_for_graphics,
      always_preserve_format: always_preserve_format !== undefined ? always_preserve_format : currentSettings.always_preserve_format,
      enable_legacy_compression: enable_legacy_compression !== undefined ? enable_legacy_compression : currentSettings.enable_legacy_compression
    }
    
    // Update or insert settings - use simpler approach
    if (currentResult.rows.length > 0) {
      // Update existing record
      await query(`
        UPDATE compression_settings SET
          compression_enabled = $1,
          auto_compress = $2,
          size_threshold_kb = $3,
          dimension_threshold_px = $4,
          quality_preset = $5,
          custom_quality = $6,
          convert_photos_to_webp = $7,
          preserve_png_for_graphics = $8,
          always_preserve_format = $9,
          enable_legacy_compression = $10,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id IS NULL
      `, [
        updatedSettings.compression_enabled,
        updatedSettings.auto_compress,
        updatedSettings.size_threshold_kb,
        updatedSettings.dimension_threshold_px,
        updatedSettings.quality_preset,
        updatedSettings.custom_quality,
        updatedSettings.convert_photos_to_webp,
        updatedSettings.preserve_png_for_graphics,
        updatedSettings.always_preserve_format,
        updatedSettings.enable_legacy_compression
      ])
    } else {
      // Insert new record
      await query(`
        INSERT INTO compression_settings (
          user_id,
          compression_enabled,
          auto_compress,
          size_threshold_kb,
          dimension_threshold_px,
          quality_preset,
          custom_quality,
          convert_photos_to_webp,
          preserve_png_for_graphics,
          always_preserve_format,
          enable_legacy_compression
        ) VALUES (
          NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        )
      `, [
        updatedSettings.compression_enabled,
        updatedSettings.auto_compress,
        updatedSettings.size_threshold_kb,
        updatedSettings.dimension_threshold_px,
        updatedSettings.quality_preset,
        updatedSettings.custom_quality,
        updatedSettings.convert_photos_to_webp,
        updatedSettings.preserve_png_for_graphics,
        updatedSettings.always_preserve_format,
        updatedSettings.enable_legacy_compression
      ])
    }
    
    res.json({ success: true, message: 'Compression settings updated' })
  } catch (error) {
    console.error('Error updating compression settings:', error)
    
    // Provide more specific error information
    if (error.code === '42703') {
      res.status(500).json({ error: 'Database schema outdated - please run migrations' })
    } else if (error.code === '42P01') {
      res.status(500).json({ error: 'Compression settings table does not exist - please run migrations' })
    } else {
      res.status(500).json({ error: `Failed to update compression settings: ${error.message}` })
    }
  }
})

/**
 * POST /api/compression/compress-url - Download and compress image from URL
 */
router.post('/compress-url', requireAdmin, async (req, res) => {
  try {
    const { url, quality, format } = req.body
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' })
    }
    
    // Validate URL format
    try {
      new URL(url)
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' })
    }
    
    // Get compression settings
    const settingsResult = await query(`
      SELECT * FROM compression_settings 
      WHERE user_id IS NULL 
      ORDER BY created_at DESC 
      LIMIT 1
    `)
    
    const settings = settingsResult.rows[0] || {
      compression_enabled: true,
      quality_preset: 'balanced',
      custom_quality: 75,
      convert_photos_to_webp: true,
      preserve_png_for_graphics: true
    }
    
    // If compression is disabled, just download and save original
    if (!settings.compression_enabled) {
      return res.status(400).json({ 
        error: 'Compression is disabled. Please enable compression in settings.' 
      })
    }
    
    // Prepare compression options
    const compressionOptions: CompressionOptions = {
      quality: quality || settings.quality_preset === 'custom' ? settings.custom_quality : settings.quality_preset,
      format: format || 'auto',
      convertPhotosToWebP: settings.convert_photos_to_webp,
      preservePngForGraphics: settings.preserve_png_for_graphics
    }
    
    // Download and compress
    const result = await CompressionService.compressFromUrl(url, compressionOptions)
    
    // Save compressed image to storage
    const { url: storageUrl, path } = await storage.putImage({
      buffer: result.buffer,
      mime: result.mimeType,
      filenameHint: `compressed-${Date.now()}.${result.format}`
    })
    
    // Store metadata if image_metadata table exists
    try {
      await query(`
        INSERT INTO image_metadata (
          path, mime_type, file_size_bytes, is_public,
          is_compressed, original_size_bytes, compressed_size_bytes,
          compression_ratio, compression_quality, original_format
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        path,
        result.mimeType,
        result.compressedSize,
        true,
        true,
        result.originalSize,
        result.compressedSize,
        result.compressionRatio,
        typeof compressionOptions.quality === 'string' ? compressionOptions.quality : compressionOptions.quality.toString(),
        result.originalUrl
      ])
    } catch (error) {
      console.warn('Could not store image metadata:', error)
    }
    
    res.json({
      url: storageUrl,
      path,
      width: result.width,
      height: result.height,
      originalSize: result.originalSize,
      compressedSize: result.compressedSize,
      compressionRatio: result.compressionRatio,
      format: result.format,
      compressionStats: CompressionService.formatCompressionStats(result)
    })
    
  } catch (error: any) {
    console.error('Error compressing URL image:', error)
    res.status(500).json({ 
      error: error.message || 'Failed to compress image from URL' 
    })
  }
})

/**
 * GET /api/compression/stats - Get compression statistics
 */
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        COUNT(*) as total_images,
        COUNT(CASE WHEN is_compressed = true THEN 1 END) as compressed_images,
        SUM(CASE WHEN is_compressed = true THEN original_size_bytes ELSE 0 END) as total_original_size,
        SUM(CASE WHEN is_compressed = true THEN compressed_size_bytes ELSE 0 END) as total_compressed_size,
        AVG(CASE WHEN is_compressed = true THEN compression_ratio ELSE NULL END) as avg_compression_ratio
      FROM image_metadata
      WHERE is_public = true
    `)
    
    const stats = result.rows[0]
    const totalSavings = (stats.total_original_size || 0) - (stats.total_compressed_size || 0)
    
    res.json({
      totalImages: parseInt(stats.total_images) || 0,
      compressedImages: parseInt(stats.compressed_images) || 0,
      totalOriginalSize: parseInt(stats.total_original_size) || 0,
      totalCompressedSize: parseInt(stats.total_compressed_size) || 0,
      totalSavings,
      averageCompressionRatio: Math.round(parseFloat(stats.avg_compression_ratio) || 0)
    })
  } catch (error) {
    console.error('Error fetching compression stats:', error)
    res.status(500).json({ error: 'Failed to fetch compression statistics' })
  }
})

export default router
