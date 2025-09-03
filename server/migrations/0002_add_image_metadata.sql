-- Add alt_text and title columns to images table
-- Migration: 0002_add_image_metadata.sql

-- Add alt_text column (required for accessibility)
ALTER TABLE images 
ADD COLUMN IF NOT EXISTS alt_text TEXT;

-- Add title column (optional, for image captions/titles)
ALTER TABLE images 
ADD COLUMN IF NOT EXISTS title TEXT;

-- Add updated_at column for tracking modifications
ALTER TABLE images 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Add constraint to ensure alt_text is not empty when provided
ALTER TABLE images 
ADD CONSTRAINT images_alt_text_not_empty 
CHECK (alt_text IS NULL OR LENGTH(TRIM(alt_text)) > 0);

-- Add constraint for title length
ALTER TABLE images 
ADD CONSTRAINT images_title_length 
CHECK (title IS NULL OR LENGTH(title) <= 120);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_images_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists and recreate
DROP TRIGGER IF EXISTS images_updated_at ON images;
CREATE TRIGGER images_updated_at
  BEFORE UPDATE ON images
  FOR EACH ROW EXECUTE FUNCTION update_images_updated_at();

-- Add index on updated_at for performance
CREATE INDEX IF NOT EXISTS images_updated_at_idx ON images(updated_at DESC);

COMMENT ON COLUMN images.alt_text IS 'Alternative text for accessibility (required when set)';
COMMENT ON COLUMN images.title IS 'Optional title/caption for the image (max 120 chars)';
COMMENT ON COLUMN images.updated_at IS 'Timestamp when the image metadata was last updated';
