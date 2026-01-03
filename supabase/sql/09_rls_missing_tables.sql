-- Enable RLS on tables that were missing it
-- Fixes Supabase Security Advisor warnings

-- ============================================
-- COMPRESSION_SETTINGS - Admin-only table
-- ============================================
ALTER TABLE compression_settings ENABLE ROW LEVEL SECURITY;

-- Public can read compression settings (needed for client-side preview)
DROP POLICY IF EXISTS "compression_settings_select_all" ON compression_settings;
CREATE POLICY "compression_settings_select_all" ON compression_settings
  FOR SELECT TO authenticated, anon USING (true);

-- Only admins can modify compression settings
DROP POLICY IF EXISTS "compression_settings_insert_admin" ON compression_settings;
CREATE POLICY "compression_settings_insert_admin" ON compression_settings
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "compression_settings_update_admin" ON compression_settings;
CREATE POLICY "compression_settings_update_admin" ON compression_settings
  FOR UPDATE USING (is_admin());

DROP POLICY IF EXISTS "compression_settings_delete_admin" ON compression_settings;
CREATE POLICY "compression_settings_delete_admin" ON compression_settings
  FOR DELETE USING (is_admin());

-- ============================================
-- POST_IMAGES - Tracks images in posts
-- ============================================
ALTER TABLE post_images ENABLE ROW LEVEL SECURITY;

-- Can view post_images for posts you can see (published or own)
DROP POLICY IF EXISTS "post_images_select_visible_posts" ON post_images;
CREATE POLICY "post_images_select_visible_posts" ON post_images
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = post_id AND (
        p.status = 'published' OR 
        p.author_id = auth.uid() OR 
        is_admin()
      )
    )
  );

-- Can insert post_images for own posts or if admin
DROP POLICY IF EXISTS "post_images_insert_own_or_admin" ON post_images;
CREATE POLICY "post_images_insert_own_or_admin" ON post_images
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = post_id AND (
        p.author_id = auth.uid() OR is_admin()
      )
    )
  );

-- Can update post_images for own posts or if admin
DROP POLICY IF EXISTS "post_images_update_own_or_admin" ON post_images;
CREATE POLICY "post_images_update_own_or_admin" ON post_images
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = post_id AND (
        p.author_id = auth.uid() OR is_admin()
      )
    )
  );

-- Can delete post_images for own posts or if admin
DROP POLICY IF EXISTS "post_images_delete_own_or_admin" ON post_images;
CREATE POLICY "post_images_delete_own_or_admin" ON post_images
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = post_id AND (
        p.author_id = auth.uid() OR is_admin()
      )
    )
  );

-- ============================================
-- IMAGE_RECONCILIATION_LOG - Internal admin log
-- ============================================
ALTER TABLE image_reconciliation_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view reconciliation logs
DROP POLICY IF EXISTS "image_reconciliation_log_select_admin" ON image_reconciliation_log;
CREATE POLICY "image_reconciliation_log_select_admin" ON image_reconciliation_log
  FOR SELECT USING (is_admin());

-- Only admins can insert (or service role via backend)
DROP POLICY IF EXISTS "image_reconciliation_log_insert_admin" ON image_reconciliation_log;
CREATE POLICY "image_reconciliation_log_insert_admin" ON image_reconciliation_log
  FOR INSERT WITH CHECK (is_admin());

-- Only admins can update
DROP POLICY IF EXISTS "image_reconciliation_log_update_admin" ON image_reconciliation_log;
CREATE POLICY "image_reconciliation_log_update_admin" ON image_reconciliation_log
  FOR UPDATE USING (is_admin());

-- Only admins can delete
DROP POLICY IF EXISTS "image_reconciliation_log_delete_admin" ON image_reconciliation_log;
CREATE POLICY "image_reconciliation_log_delete_admin" ON image_reconciliation_log
  FOR DELETE USING (is_admin());

-- ============================================
-- SYSTEM_SETTINGS - System configuration
-- ============================================
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read system settings (some may be needed client-side)
DROP POLICY IF EXISTS "system_settings_select_all" ON system_settings;
CREATE POLICY "system_settings_select_all" ON system_settings
  FOR SELECT TO authenticated, anon USING (true);

-- Only admins can modify system settings
DROP POLICY IF EXISTS "system_settings_insert_admin" ON system_settings;
CREATE POLICY "system_settings_insert_admin" ON system_settings
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "system_settings_update_admin" ON system_settings;
CREATE POLICY "system_settings_update_admin" ON system_settings
  FOR UPDATE USING (is_admin());

DROP POLICY IF EXISTS "system_settings_delete_admin" ON system_settings;
CREATE POLICY "system_settings_delete_admin" ON system_settings
  FOR DELETE USING (is_admin());

