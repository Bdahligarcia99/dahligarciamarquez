-- Supabase Row Level Security (RLS) Policies
-- Implements fine-grained access control for all tables

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE images ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PROFILES POLICIES
-- Users can view and update their own profile; admins can view/update all
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON profiles;
CREATE POLICY "profiles_select_own_or_admin" ON profiles
  FOR SELECT USING (
    id = auth.uid() OR is_admin()
  );

DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON profiles;
CREATE POLICY "profiles_update_own_or_admin" ON profiles
  FOR UPDATE USING (
    id = auth.uid() OR is_admin()
  );

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (
    id = auth.uid()
  );

-- LABELS POLICIES
-- Public read access; only admins can modify
DROP POLICY IF EXISTS "labels_select_all" ON labels;
CREATE POLICY "labels_select_all" ON labels
  FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "labels_insert_admin" ON labels;
CREATE POLICY "labels_insert_admin" ON labels
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "labels_update_admin" ON labels;
CREATE POLICY "labels_update_admin" ON labels
  FOR UPDATE USING (is_admin());

DROP POLICY IF EXISTS "labels_delete_admin" ON labels;
CREATE POLICY "labels_delete_admin" ON labels
  FOR DELETE USING (is_admin());

-- POSTS POLICIES
-- Published posts are public; drafts only visible to author/admin
DROP POLICY IF EXISTS "posts_select_published_or_own" ON posts;
CREATE POLICY "posts_select_published_or_own" ON posts
  FOR SELECT USING (
    status = 'published' OR 
    author_id = auth.uid() OR 
    is_admin()
  );

DROP POLICY IF EXISTS "posts_insert_authenticated" ON posts;
CREATE POLICY "posts_insert_authenticated" ON posts
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND (
      author_id = auth.uid() OR is_admin()
    )
  );

DROP POLICY IF EXISTS "posts_update_own_or_admin" ON posts;
CREATE POLICY "posts_update_own_or_admin" ON posts
  FOR UPDATE USING (
    author_id = auth.uid() OR is_admin()
  );

DROP POLICY IF EXISTS "posts_delete_own_or_admin" ON posts;
CREATE POLICY "posts_delete_own_or_admin" ON posts
  FOR DELETE USING (
    author_id = auth.uid() OR is_admin()
  );

-- POST_LABELS POLICIES
-- Can view labels for visible posts; can modify if own post or admin
DROP POLICY IF EXISTS "post_labels_select_visible_posts" ON post_labels;
CREATE POLICY "post_labels_select_visible_posts" ON post_labels
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

DROP POLICY IF EXISTS "post_labels_insert_own_or_admin" ON post_labels;
CREATE POLICY "post_labels_insert_own_or_admin" ON post_labels
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = post_id AND (
        p.author_id = auth.uid() OR is_admin()
      )
    )
  );

DROP POLICY IF EXISTS "post_labels_update_own_or_admin" ON post_labels;
CREATE POLICY "post_labels_update_own_or_admin" ON post_labels
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = post_id AND (
        p.author_id = auth.uid() OR is_admin()
      )
    )
  );

DROP POLICY IF EXISTS "post_labels_delete_own_or_admin" ON post_labels;
CREATE POLICY "post_labels_delete_own_or_admin" ON post_labels
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = post_id AND (
        p.author_id = auth.uid() OR is_admin()
      )
    )
  );

-- IMAGES POLICIES
-- Public images visible to all; private images only to owner/admin
DROP POLICY IF EXISTS "images_select_public_or_own" ON images;
CREATE POLICY "images_select_public_or_own" ON images
  FOR SELECT USING (
    is_public = true OR 
    owner_id = auth.uid() OR 
    is_admin()
  );

DROP POLICY IF EXISTS "images_insert_authenticated" ON images;
CREATE POLICY "images_insert_authenticated" ON images
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND (
      owner_id = auth.uid() OR is_admin()
    )
  );

DROP POLICY IF EXISTS "images_update_own_or_admin" ON images;
CREATE POLICY "images_update_own_or_admin" ON images
  FOR UPDATE USING (
    owner_id = auth.uid() OR is_admin()
  );

DROP POLICY IF EXISTS "images_delete_own_or_admin" ON images;
CREATE POLICY "images_delete_own_or_admin" ON images
  FOR DELETE USING (
    owner_id = auth.uid() OR is_admin()
  );

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
