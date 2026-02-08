-- Migration: Get Collections for a Post
-- 
-- Adds a function to retrieve all collections that a post belongs to,
-- which is needed by the Entry Editor to display/manage collection assignments.

-- ============================================================================
-- FUNCTION: Get collections for a specific post
-- ============================================================================

-- Get all collections that contain a specific post (for Entry Editor)
CREATE OR REPLACE FUNCTION get_post_collections(p_post_id UUID)
RETURNS TABLE (
  collection_id UUID,
  collection_name TEXT,
  collection_slug TEXT,
  collection_icon_emoji TEXT,
  journal_id UUID,
  journal_name TEXT,
  journal_icon_emoji TEXT,
  journal_icon_type TEXT,
  display_order INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id AS collection_id,
    c.name AS collection_name,
    c.slug AS collection_slug,
    c.icon_emoji AS collection_icon_emoji,
    j.id AS journal_id,
    j.name AS journal_name,
    j.icon_emoji AS journal_icon_emoji,
    j.icon_type AS journal_icon_type,
    ce.display_order
  FROM collection_entries ce
  JOIN collections c ON c.id = ce.collection_id
  JOIN journals j ON j.id = c.journal_id
  WHERE ce.post_id = p_post_id
  ORDER BY j.display_order, c.display_order, ce.display_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get all available collections (for picker in Entry Editor)
-- Returns collections grouped by journal, with their entry counts
CREATE OR REPLACE FUNCTION get_all_collections_for_picker()
RETURNS TABLE (
  collection_id UUID,
  collection_name TEXT,
  collection_slug TEXT,
  collection_icon_emoji TEXT,
  collection_status TEXT,
  journal_id UUID,
  journal_name TEXT,
  journal_icon_emoji TEXT,
  journal_icon_type TEXT,
  journal_status TEXT,
  entry_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id AS collection_id,
    c.name AS collection_name,
    c.slug AS collection_slug,
    c.icon_emoji AS collection_icon_emoji,
    c.status AS collection_status,
    j.id AS journal_id,
    j.name AS journal_name,
    j.icon_emoji AS journal_icon_emoji,
    j.icon_type AS journal_icon_type,
    j.status AS journal_status,
    COALESCE(e.entry_count, 0::BIGINT) AS entry_count
  FROM collections c
  JOIN journals j ON j.id = c.journal_id
  LEFT JOIN (
    SELECT collection_id, COUNT(*)::BIGINT AS entry_count
    FROM collection_entries
    GROUP BY collection_id
  ) e ON e.collection_id = c.id
  WHERE j.owner_id = auth.uid() OR is_admin()
  ORDER BY j.display_order, j.name, c.display_order, c.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_post_collections(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_collections_for_picker() TO authenticated;
