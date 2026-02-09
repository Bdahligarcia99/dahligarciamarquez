-- Migration: Fix Ambiguous Column References in Curator Functions
-- 
-- Fixes the "column reference is ambiguous" errors in:
-- - get_all_journals_for_picker()
-- - get_all_collections_for_picker()
-- - get_post_journals()
-- - get_post_collections()
--
-- The issue was that subquery column names conflicted with RETURNS TABLE column names.

-- ============================================================================
-- FIX: get_all_journals_for_picker
-- ============================================================================
CREATE OR REPLACE FUNCTION get_all_journals_for_picker()
RETURNS TABLE (
  journal_id UUID,
  journal_name TEXT,
  journal_slug TEXT,
  journal_icon_emoji TEXT,
  journal_icon_type TEXT,
  journal_icon_image_url TEXT,
  journal_status TEXT,
  entry_count BIGINT,
  collection_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id,
    j.name,
    j.slug,
    j.icon_emoji,
    j.icon_type,
    j.icon_image_url,
    j.status,
    COALESCE(je_counts.cnt, 0::BIGINT),
    COALESCE(c_counts.cnt, 0::BIGINT)
  FROM journals j
  LEFT JOIN (
    SELECT je.journal_id AS jid, COUNT(*)::BIGINT AS cnt
    FROM journal_entries je
    GROUP BY je.journal_id
  ) je_counts ON je_counts.jid = j.id
  LEFT JOIN (
    SELECT col.journal_id AS jid, COUNT(*)::BIGINT AS cnt
    FROM collections col
    GROUP BY col.journal_id
  ) c_counts ON c_counts.jid = j.id
  WHERE j.owner_id = auth.uid() OR is_admin()
  ORDER BY j.display_order, j.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FIX: get_all_collections_for_picker
-- ============================================================================
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
    c.id,
    c.name,
    c.slug,
    c.icon_emoji,
    c.status,
    j.id,
    j.name,
    j.icon_emoji,
    j.icon_type,
    j.status,
    COALESCE(e_counts.cnt, 0::BIGINT)
  FROM collections c
  JOIN journals j ON j.id = c.journal_id
  LEFT JOIN (
    SELECT ce.collection_id AS cid, COUNT(*)::BIGINT AS cnt
    FROM collection_entries ce
    GROUP BY ce.collection_id
  ) e_counts ON e_counts.cid = c.id
  WHERE j.owner_id = auth.uid() OR is_admin()
  ORDER BY j.display_order, j.name, c.display_order, c.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FIX: get_post_journals
-- ============================================================================
CREATE OR REPLACE FUNCTION get_post_journals(p_post_id UUID)
RETURNS TABLE (
  journal_id UUID,
  journal_name TEXT,
  journal_slug TEXT,
  journal_icon_emoji TEXT,
  journal_icon_type TEXT,
  journal_icon_image_url TEXT,
  journal_status TEXT,
  display_order INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id,
    j.name,
    j.slug,
    j.icon_emoji,
    j.icon_type,
    j.icon_image_url,
    j.status,
    je.display_order
  FROM journal_entries je
  JOIN journals j ON j.id = je.journal_id
  WHERE je.post_id = p_post_id
  ORDER BY j.display_order, je.display_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FIX: get_post_collections
-- ============================================================================
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
    c.id,
    c.name,
    c.slug,
    c.icon_emoji,
    j.id,
    j.name,
    j.icon_emoji,
    j.icon_type,
    ce.display_order
  FROM collection_entries ce
  JOIN collections c ON c.id = ce.collection_id
  JOIN journals j ON j.id = c.journal_id
  WHERE ce.post_id = p_post_id
  ORDER BY j.display_order, c.display_order, ce.display_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RE-GRANT PERMISSIONS (in case they were dropped)
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_all_journals_for_picker() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_collections_for_picker() TO authenticated;
GRANT EXECUTE ON FUNCTION get_post_journals(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_post_collections(UUID) TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION get_all_journals_for_picker IS 'Get all journals available for the Entry Editor picker (fixed ambiguous column refs)';
COMMENT ON FUNCTION get_all_collections_for_picker IS 'Get all collections available for the Entry Editor picker (fixed ambiguous column refs)';
COMMENT ON FUNCTION get_post_journals IS 'Get all journals a post is directly assigned to (fixed ambiguous column refs)';
COMMENT ON FUNCTION get_post_collections IS 'Get all collections a post belongs to (fixed ambiguous column refs)';
