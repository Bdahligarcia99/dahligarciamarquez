-- Post Images Table
-- This table tracks images used in posts for the image library feature

-- Create the post_images table if it doesn't exist
CREATE TABLE IF NOT EXISTS post_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  image_type TEXT NOT NULL CHECK (image_type IN ('cover', 'inline')),
  alt_text TEXT,
  width INTEGER,
  height INTEGER,
  usage_context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS post_images_post_id_idx ON post_images(post_id);
CREATE INDEX IF NOT EXISTS post_images_image_url_idx ON post_images(image_url);
CREATE INDEX IF NOT EXISTS post_images_image_type_idx ON post_images(image_type);
CREATE INDEX IF NOT EXISTS post_images_created_at_idx ON post_images(created_at DESC);

-- Add a unique constraint to prevent exact duplicates
CREATE UNIQUE INDEX IF NOT EXISTS post_images_unique_url_type_post 
ON post_images(post_id, image_url, image_type);

-- Enable RLS
ALTER TABLE post_images ENABLE ROW LEVEL SECURITY;

-- RLS Policies (if not already created in 09_rls_missing_tables.sql)

-- Can view post_images for posts you can see (published or own)
DROP POLICY IF EXISTS "post_images_select_visible_posts" ON post_images;
CREATE POLICY "post_images_select_visible_posts" ON post_images
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = post_id AND (
        p.status = 'published' OR
        p.author_id = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
      )
    )
  );

-- Can insert post_images for own posts or if admin
DROP POLICY IF EXISTS "post_images_insert_own_or_admin" ON post_images;
CREATE POLICY "post_images_insert_own_or_admin" ON post_images
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = post_id AND (
        p.author_id = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
      )
    )
  );

-- Can update post_images for own posts or if admin
DROP POLICY IF EXISTS "post_images_update_own_or_admin" ON post_images;
CREATE POLICY "post_images_update_own_or_admin" ON post_images
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = post_id AND (
        p.author_id = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
      )
    )
  );

-- Can delete post_images for own posts or if admin
DROP POLICY IF EXISTS "post_images_delete_own_or_admin" ON post_images;
CREATE POLICY "post_images_delete_own_or_admin" ON post_images
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = post_id AND (
        p.author_id = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
      )
    )
  );

-- Grant permissions
GRANT ALL ON post_images TO authenticated;
GRANT SELECT ON post_images TO anon;

COMMENT ON TABLE post_images IS 'Tracks images used in posts for the image library and deduplication features';
COMMENT ON COLUMN post_images.image_type IS 'Type of image: cover (post cover image) or inline (embedded in content)';
COMMENT ON COLUMN post_images.usage_context IS 'Additional context about how the image is used (captions, position, etc)';
