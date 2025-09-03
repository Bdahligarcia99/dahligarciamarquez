-- Add content_html column to posts table for sanitized HTML storage
-- Migration: 0003_add_content_html.sql

-- Add content_html column for storing sanitized HTML content
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS content_html TEXT;

-- Add reading_time column for calculated reading time (in minutes)
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS reading_time INTEGER DEFAULT 1;

-- Add constraint to ensure reading_time is positive
ALTER TABLE posts 
ADD CONSTRAINT posts_reading_time_positive 
CHECK (reading_time IS NULL OR reading_time > 0);

-- Add index on content_html for search performance (if using full-text search)
CREATE INDEX IF NOT EXISTS posts_content_html_idx ON posts USING gin(to_tsvector('english', content_html));

-- Add index on reading_time for sorting/filtering
CREATE INDEX IF NOT EXISTS posts_reading_time_idx ON posts(reading_time);

-- Comments for documentation
COMMENT ON COLUMN posts.content_html IS 'Sanitized HTML content from rich text editor';
COMMENT ON COLUMN posts.reading_time IS 'Estimated reading time in minutes (based on ~200 WPM)';
