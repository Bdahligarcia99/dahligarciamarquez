-- Migration: Add post_images table for optimized image tracking
-- This table pre-computes image relationships for fast library queries

-- Create post_images table for tracking image usage in posts
CREATE TABLE IF NOT EXISTS post_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  image_type VARCHAR(20) NOT NULL, -- 'cover', 'inline'
  alt_text TEXT,
  width INTEGER,
  height INTEGER,
  usage_context JSONB, -- Store position, caption, figure data, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Foreign key constraint (will work with both Supabase UUID and local SERIAL)
  CONSTRAINT fk_post_images_post_id FOREIGN KEY (post_id) 
    REFERENCES posts(id) ON DELETE CASCADE
);

-- Create indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_post_images_post_id ON post_images(post_id);
CREATE INDEX IF NOT EXISTS idx_post_images_url ON post_images(image_url);
CREATE INDEX IF NOT EXISTS idx_post_images_type ON post_images(image_type);
CREATE INDEX IF NOT EXISTS idx_post_images_created_at ON post_images(created_at DESC);

-- Composite index for common queries (post + type)
CREATE INDEX IF NOT EXISTS idx_post_images_post_type ON post_images(post_id, image_type);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_post_images_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_post_images_updated_at ON post_images;
CREATE TRIGGER update_post_images_updated_at
  BEFORE UPDATE ON post_images
  FOR EACH ROW
  EXECUTE FUNCTION update_post_images_updated_at();

-- Add reconciliation tracking table
CREATE TABLE IF NOT EXISTS image_reconciliation_log (
  id SERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'running', -- 'running', 'completed', 'failed'
  posts_processed INTEGER DEFAULT 0,
  images_found INTEGER DEFAULT 0,
  images_added INTEGER DEFAULT 0,
  images_updated INTEGER DEFAULT 0,
  images_removed INTEGER DEFAULT 0,
  error_message TEXT,
  triggered_by VARCHAR(50) DEFAULT 'manual' -- 'manual', 'scheduled', 'auto'
);

-- Index for reconciliation log queries
CREATE INDEX IF NOT EXISTS idx_reconciliation_log_started_at ON image_reconciliation_log(started_at DESC);

-- Add helpful comments
COMMENT ON TABLE post_images IS 'Pre-computed image relationships for fast library queries';
COMMENT ON COLUMN post_images.image_type IS 'Type of image usage: cover, inline';
COMMENT ON COLUMN post_images.usage_context IS 'JSON context: position, caption, figure attributes';
COMMENT ON TABLE image_reconciliation_log IS 'Tracks full reconciliation runs for monitoring';
