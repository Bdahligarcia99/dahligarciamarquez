-- Migration: Add compression settings table (SAFE VERSION)
-- This version handles cases where parts of the migration already exist

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS compression_settings (
  id SERIAL PRIMARY KEY,
  user_id TEXT, -- For future multi-user support, nullable for now (single admin)
  
  -- Master toggle
  compression_enabled BOOLEAN DEFAULT true,
  
  -- Auto-compression settings
  auto_compress BOOLEAN DEFAULT true,
  size_threshold_kb INTEGER DEFAULT 500,
  dimension_threshold_px INTEGER DEFAULT 2000,
  
  -- Quality settings
  quality_preset VARCHAR(20) DEFAULT 'balanced', -- 'high', 'balanced', 'aggressive', 'custom'
  custom_quality INTEGER DEFAULT 75, -- Used when quality_preset = 'custom'
  
  -- Format handling
  convert_photos_to_webp BOOLEAN DEFAULT true,
  preserve_png_for_graphics BOOLEAN DEFAULT true,
  always_preserve_format BOOLEAN DEFAULT false,
  
  -- Legacy compression system
  enable_legacy_compression BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add the new column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'compression_settings' AND column_name = 'enable_legacy_compression') THEN
    ALTER TABLE compression_settings ADD COLUMN enable_legacy_compression BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Create function if it doesn't exist
CREATE OR REPLACE FUNCTION update_compression_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if it exists, then create it
DROP TRIGGER IF EXISTS update_compression_settings_updated_at ON compression_settings;
CREATE TRIGGER update_compression_settings_updated_at
  BEFORE UPDATE ON compression_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_compression_settings_updated_at();

-- Insert or update default settings
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
  NULL, -- Single admin, no user_id needed yet
  true,
  true,
  500,
  2000,
  'balanced',
  75,
  true,
  true,
  false,
  true
) ON CONFLICT DO NOTHING;

-- Add compression metadata to existing image_metadata table if it exists
DO $$
BEGIN
  -- Check if image_metadata table exists and add compression columns
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'image_metadata') THEN
    -- Add compression tracking columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_metadata' AND column_name = 'is_compressed') THEN
      ALTER TABLE image_metadata ADD COLUMN is_compressed BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_metadata' AND column_name = 'original_size_bytes') THEN
      ALTER TABLE image_metadata ADD COLUMN original_size_bytes INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_metadata' AND column_name = 'compressed_size_bytes') THEN
      ALTER TABLE image_metadata ADD COLUMN compressed_size_bytes INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_metadata' AND column_name = 'compression_ratio') THEN
      ALTER TABLE image_metadata ADD COLUMN compression_ratio INTEGER; -- Percentage
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_metadata' AND column_name = 'compression_quality') THEN
      ALTER TABLE image_metadata ADD COLUMN compression_quality VARCHAR(20);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'image_metadata' AND column_name = 'original_format') THEN
      ALTER TABLE image_metadata ADD COLUMN original_format VARCHAR(10);
    END IF;
  END IF;
END $$;
