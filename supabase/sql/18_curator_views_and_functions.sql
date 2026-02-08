-- Migration: Curator Views and Helper Functions
-- 
-- Provides convenient views and RPC functions for the Curator system

-- ============================================================================
-- VIEWS FOR EASIER QUERYING
-- ============================================================================

-- View: Journals with collection counts
CREATE OR REPLACE VIEW journals_with_stats AS
SELECT 
  j.*,
  COALESCE(c.collection_count, 0) AS collection_count,
  COALESCE(e.entry_count, 0) AS total_entry_count
FROM journals j
LEFT JOIN (
  SELECT journal_id, COUNT(*) AS collection_count
  FROM collections
  GROUP BY journal_id
) c ON c.journal_id = j.id
LEFT JOIN (
  SELECT c.journal_id, COUNT(ce.id) AS entry_count
  FROM collections c
  LEFT JOIN collection_entries ce ON ce.collection_id = c.id
  GROUP BY c.journal_id
) e ON e.journal_id = j.id;

-- View: Collections with entry counts
CREATE OR REPLACE VIEW collections_with_stats AS
SELECT 
  c.*,
  j.name AS journal_name,
  j.icon_emoji AS journal_icon_emoji,
  j.icon_type AS journal_icon_type,
  j.icon_image_url AS journal_icon_image_url,
  COALESCE(e.entry_count, 0) AS entry_count
FROM collections c
JOIN journals j ON j.id = c.journal_id
LEFT JOIN (
  SELECT collection_id, COUNT(*) AS entry_count
  FROM collection_entries
  GROUP BY collection_id
) e ON e.collection_id = c.id;

-- View: Collection entries with post details
CREATE OR REPLACE VIEW collection_entries_with_posts AS
SELECT 
  ce.*,
  p.title AS post_title,
  p.slug AS post_slug,
  p.excerpt AS post_excerpt,
  p.cover_image_url AS post_cover_image_url,
  p.status AS post_status,
  p.created_at AS post_created_at,
  p.updated_at AS post_updated_at,
  c.name AS collection_name,
  c.slug AS collection_slug,
  j.id AS journal_id,
  j.name AS journal_name
FROM collection_entries ce
JOIN posts p ON p.id = ce.post_id
JOIN collections c ON c.id = ce.collection_id
JOIN journals j ON j.id = c.journal_id;

-- ============================================================================
-- RPC FUNCTIONS FOR FRONTEND
-- ============================================================================

-- Get all journals for current user (with stats)
CREATE OR REPLACE FUNCTION get_user_journals()
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  icon_type TEXT,
  icon_emoji TEXT,
  icon_image_url TEXT,
  status TEXT,
  wallpaper_url TEXT,
  wallpaper_blur INTEGER,
  display_order INTEGER,
  description TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  collection_count BIGINT,
  total_entry_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id, j.name, j.slug, j.icon_type, j.icon_emoji, j.icon_image_url,
    j.status, j.wallpaper_url, j.wallpaper_blur, j.display_order,
    j.description, j.created_at, j.updated_at,
    COALESCE(c.collection_count, 0::BIGINT) AS collection_count,
    COALESCE(e.entry_count, 0::BIGINT) AS total_entry_count
  FROM journals j
  LEFT JOIN (
    SELECT journal_id, COUNT(*)::BIGINT AS collection_count
    FROM collections
    GROUP BY journal_id
  ) c ON c.journal_id = j.id
  LEFT JOIN (
    SELECT col.journal_id, COUNT(ce.id)::BIGINT AS entry_count
    FROM collections col
    LEFT JOIN collection_entries ce ON ce.collection_id = col.id
    GROUP BY col.journal_id
  ) e ON e.journal_id = j.id
  WHERE j.owner_id = auth.uid() OR is_admin()
  ORDER BY j.display_order, j.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get collections for a specific journal
CREATE OR REPLACE FUNCTION get_journal_collections(p_journal_id UUID)
RETURNS TABLE (
  id UUID,
  journal_id UUID,
  name TEXT,
  slug TEXT,
  status TEXT,
  icon_emoji TEXT,
  display_order INTEGER,
  description TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  entry_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id, c.journal_id, c.name, c.slug, c.status, c.icon_emoji,
    c.display_order, c.description, c.created_at, c.updated_at,
    COALESCE(e.entry_count, 0::BIGINT) AS entry_count
  FROM collections c
  LEFT JOIN (
    SELECT collection_id, COUNT(*)::BIGINT AS entry_count
    FROM collection_entries
    GROUP BY collection_id
  ) e ON e.collection_id = c.id
  WHERE c.journal_id = p_journal_id
  ORDER BY c.display_order, c.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get entries for a specific collection
CREATE OR REPLACE FUNCTION get_collection_entries(p_collection_id UUID)
RETURNS TABLE (
  entry_id UUID,
  post_id UUID,
  display_order INTEGER,
  added_at TIMESTAMPTZ,
  post_title TEXT,
  post_slug TEXT,
  post_excerpt TEXT,
  post_cover_image_url TEXT,
  post_status TEXT,
  post_created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ce.id AS entry_id,
    ce.post_id,
    ce.display_order,
    ce.created_at AS added_at,
    p.title AS post_title,
    p.slug AS post_slug,
    p.excerpt AS post_excerpt,
    p.cover_image_url AS post_cover_image_url,
    p.status AS post_status,
    p.created_at AS post_created_at
  FROM collection_entries ce
  JOIN posts p ON p.id = ce.post_id
  WHERE ce.collection_id = p_collection_id
  ORDER BY ce.display_order, ce.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get unassigned posts (not in any collection)
CREATE OR REPLACE FUNCTION get_unassigned_posts()
RETURNS TABLE (
  id UUID,
  title TEXT,
  slug TEXT,
  excerpt TEXT,
  cover_image_url TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id, p.title, p.slug, p.excerpt, p.cover_image_url,
    p.status, p.created_at, p.updated_at
  FROM posts p
  WHERE NOT EXISTS (
    SELECT 1 FROM collection_entries ce WHERE ce.post_id = p.id
  )
  AND (p.author_id = auth.uid() OR is_admin())
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add post to collection
CREATE OR REPLACE FUNCTION add_post_to_collection(
  p_collection_id UUID,
  p_post_id UUID,
  p_display_order INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_entry_id UUID;
  v_max_order INTEGER;
BEGIN
  -- Get max display order if not provided
  IF p_display_order IS NULL THEN
    SELECT COALESCE(MAX(display_order), -1) + 1 INTO v_max_order
    FROM collection_entries
    WHERE collection_id = p_collection_id;
  ELSE
    v_max_order := p_display_order;
  END IF;
  
  INSERT INTO collection_entries (collection_id, post_id, display_order)
  VALUES (p_collection_id, p_post_id, v_max_order)
  ON CONFLICT (collection_id, post_id) DO UPDATE SET display_order = v_max_order
  RETURNING id INTO v_entry_id;
  
  RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove post from collection
CREATE OR REPLACE FUNCTION remove_post_from_collection(
  p_collection_id UUID,
  p_post_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_deleted BOOLEAN;
BEGIN
  DELETE FROM collection_entries
  WHERE collection_id = p_collection_id AND post_id = p_post_id;
  
  v_deleted := FOUND;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reorder entries in a collection
CREATE OR REPLACE FUNCTION reorder_collection_entries(
  p_collection_id UUID,
  p_entry_ids UUID[]
)
RETURNS BOOLEAN AS $$
DECLARE
  v_order INTEGER := 0;
  v_entry_id UUID;
BEGIN
  FOREACH v_entry_id IN ARRAY p_entry_ids
  LOOP
    UPDATE collection_entries
    SET display_order = v_order
    WHERE id = v_entry_id AND collection_id = p_collection_id;
    v_order := v_order + 1;
  END LOOP;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reorder journals
CREATE OR REPLACE FUNCTION reorder_journals(p_journal_ids UUID[])
RETURNS BOOLEAN AS $$
DECLARE
  v_order INTEGER := 0;
  v_journal_id UUID;
BEGIN
  FOREACH v_journal_id IN ARRAY p_journal_ids
  LOOP
    UPDATE journals
    SET display_order = v_order
    WHERE id = v_journal_id AND (owner_id = auth.uid() OR is_admin());
    v_order := v_order + 1;
  END LOOP;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reorder collections within a journal
CREATE OR REPLACE FUNCTION reorder_collections(
  p_journal_id UUID,
  p_collection_ids UUID[]
)
RETURNS BOOLEAN AS $$
DECLARE
  v_order INTEGER := 0;
  v_collection_id UUID;
BEGIN
  FOREACH v_collection_id IN ARRAY p_collection_ids
  LOOP
    UPDATE collections
    SET display_order = v_order
    WHERE id = v_collection_id AND journal_id = p_journal_id;
    v_order := v_order + 1;
  END LOOP;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get full curator hierarchy for a user (journals -> collections -> entry counts)
CREATE OR REPLACE FUNCTION get_curator_hierarchy()
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(
    json_build_object(
      'id', j.id,
      'name', j.name,
      'slug', j.slug,
      'icon_type', j.icon_type,
      'icon_emoji', j.icon_emoji,
      'icon_image_url', j.icon_image_url,
      'status', j.status,
      'wallpaper_url', j.wallpaper_url,
      'wallpaper_blur', j.wallpaper_blur,
      'display_order', j.display_order,
      'collections', COALESCE((
        SELECT json_agg(
          json_build_object(
            'id', c.id,
            'name', c.name,
            'slug', c.slug,
            'status', c.status,
            'icon_emoji', c.icon_emoji,
            'display_order', c.display_order,
            'entry_count', (
              SELECT COUNT(*) FROM collection_entries ce WHERE ce.collection_id = c.id
            )
          ) ORDER BY c.display_order, c.created_at
        )
        FROM collections c
        WHERE c.journal_id = j.id
      ), '[]'::json)
    ) ORDER BY j.display_order, j.created_at
  ) INTO v_result
  FROM journals j
  WHERE j.owner_id = auth.uid() OR is_admin();
  
  RETURN COALESCE(v_result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT EXECUTE ON FUNCTIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_user_journals() TO authenticated;
GRANT EXECUTE ON FUNCTION get_journal_collections(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_collection_entries(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_unassigned_posts() TO authenticated;
GRANT EXECUTE ON FUNCTION add_post_to_collection(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_post_from_collection(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reorder_collection_entries(UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION reorder_journals(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION reorder_collections(UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_curator_hierarchy() TO authenticated;

-- Grant view access
GRANT SELECT ON journals_with_stats TO authenticated, anon;
GRANT SELECT ON collections_with_stats TO authenticated, anon;
GRANT SELECT ON collection_entries_with_posts TO authenticated, anon;
