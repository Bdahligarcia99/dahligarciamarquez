-- Migration: Direct Journal-Entry Assignments
-- 
-- Allows entries to be assigned directly to journals (not just through collections).
-- - Entries can belong to multiple journals
-- - Entries can also belong to collections (independently)
-- - Collections can contain entries from ANY journal (not restricted)

-- ============================================================================
-- TABLE: Direct journal-to-post relationship
-- ============================================================================

CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journal_id UUID NOT NULL REFERENCES journals(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(journal_id, post_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS journal_entries_journal_id_idx ON journal_entries(journal_id);
CREATE INDEX IF NOT EXISTS journal_entries_post_id_idx ON journal_entries(post_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

-- Select: Can view if journal is published, or user owns it, or is admin
DROP POLICY IF EXISTS "journal_entries_select" ON journal_entries;
CREATE POLICY "journal_entries_select" ON journal_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM journals j
      WHERE j.id = journal_entries.journal_id
      AND (j.status = 'published' OR j.owner_id = auth.uid() OR is_admin())
    )
  );

-- Insert: Can add if user owns the journal or is admin
DROP POLICY IF EXISTS "journal_entries_insert" ON journal_entries;
CREATE POLICY "journal_entries_insert" ON journal_entries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM journals j
      WHERE j.id = journal_entries.journal_id
      AND (j.owner_id = auth.uid() OR is_admin())
    )
  );

-- Update: Can update if user owns the journal or is admin
DROP POLICY IF EXISTS "journal_entries_update" ON journal_entries;
CREATE POLICY "journal_entries_update" ON journal_entries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM journals j
      WHERE j.id = journal_entries.journal_id
      AND (j.owner_id = auth.uid() OR is_admin())
    )
  );

-- Delete: Can delete if user owns the journal or is admin
DROP POLICY IF EXISTS "journal_entries_delete" ON journal_entries;
CREATE POLICY "journal_entries_delete" ON journal_entries
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM journals j
      WHERE j.id = journal_entries.journal_id
      AND (j.owner_id = auth.uid() OR is_admin())
    )
  );

-- ============================================================================
-- RPC FUNCTIONS
-- ============================================================================

-- Add post directly to a journal
CREATE OR REPLACE FUNCTION add_post_to_journal(
  p_journal_id UUID,
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
    FROM journal_entries
    WHERE journal_id = p_journal_id;
  ELSE
    v_max_order := p_display_order;
  END IF;
  
  INSERT INTO journal_entries (journal_id, post_id, display_order)
  VALUES (p_journal_id, p_post_id, v_max_order)
  ON CONFLICT (journal_id, post_id) DO UPDATE SET display_order = v_max_order
  RETURNING id INTO v_entry_id;
  
  RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove post from a journal
CREATE OR REPLACE FUNCTION remove_post_from_journal(
  p_journal_id UUID,
  p_post_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_deleted BOOLEAN;
BEGIN
  DELETE FROM journal_entries
  WHERE journal_id = p_journal_id AND post_id = p_post_id;
  
  v_deleted := FOUND;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get journals that a post belongs to directly
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
    j.id AS journal_id,
    j.name AS journal_name,
    j.slug AS journal_slug,
    j.icon_emoji AS journal_icon_emoji,
    j.icon_type AS journal_icon_type,
    j.icon_image_url AS journal_icon_image_url,
    j.status AS journal_status,
    je.display_order
  FROM journal_entries je
  JOIN journals j ON j.id = je.journal_id
  WHERE je.post_id = p_post_id
  ORDER BY j.display_order, je.display_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get all available journals for picker (in Entry Editor)
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
    j.id AS journal_id,
    j.name AS journal_name,
    j.slug AS journal_slug,
    j.icon_emoji AS journal_icon_emoji,
    j.icon_type AS journal_icon_type,
    j.icon_image_url AS journal_icon_image_url,
    j.status AS journal_status,
    COALESCE(je.entry_count, 0::BIGINT) AS entry_count,
    COALESCE(c.collection_count, 0::BIGINT) AS collection_count
  FROM journals j
  LEFT JOIN (
    SELECT journal_id, COUNT(*)::BIGINT AS entry_count
    FROM journal_entries
    GROUP BY journal_id
  ) je ON je.journal_id = j.id
  LEFT JOIN (
    SELECT journal_id, COUNT(*)::BIGINT AS collection_count
    FROM collections
    GROUP BY journal_id
  ) c ON c.journal_id = j.id
  WHERE j.owner_id = auth.uid() OR is_admin()
  ORDER BY j.display_order, j.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- UPDATE EXISTING FUNCTIONS
-- ============================================================================

-- Update get_all_collections_for_picker to NOT restrict by journal
-- (Collections can hold entries from any journal)
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

GRANT SELECT, INSERT, UPDATE, DELETE ON journal_entries TO authenticated;
GRANT SELECT ON journal_entries TO anon;

GRANT EXECUTE ON FUNCTION add_post_to_journal(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_post_from_journal(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_post_journals(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_journals_for_picker() TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE journal_entries IS 'Direct assignment of posts to journals (entries can be in multiple journals)';
COMMENT ON FUNCTION add_post_to_journal IS 'Add a post directly to a journal';
COMMENT ON FUNCTION remove_post_from_journal IS 'Remove a post from a journal';
COMMENT ON FUNCTION get_post_journals IS 'Get all journals a post is directly assigned to';
COMMENT ON FUNCTION get_all_journals_for_picker IS 'Get all journals available for the Entry Editor picker';
