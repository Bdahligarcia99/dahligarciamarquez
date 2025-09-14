-- Add cover_image_alt column to posts table for accessibility
-- Migration: 0004_add_cover_image_alt.sql

-- Add cover_image_alt column for storing cover image alt text
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS cover_image_alt TEXT;

-- Add constraint to ensure alt text is provided when cover image exists
-- Note: This constraint will be enforced at the application level for better UX
-- (allowing users to save drafts without cover images)

-- Add index for potential future searching by alt text
CREATE INDEX IF NOT EXISTS posts_cover_image_alt_idx ON posts(cover_image_alt) 
WHERE cover_image_alt IS NOT NULL;

-- Comments for documentation
COMMENT ON COLUMN posts.cover_image_alt IS 'Alt text for cover image accessibility (required when cover_image_url is present)';
