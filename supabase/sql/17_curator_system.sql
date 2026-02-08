-- Migration: Curator System - Hierarchical Organization for Posts
-- 
-- The Curator provides a hierarchical labeling/organization system:
-- - Journals: Top-level categories (e.g., "Travel", "Personal", "Creative")
-- - Collections: Sub-categories within journals (e.g., "US", "Japan" within "Travel")
-- - Collection Entries: Posts assigned to collections (many-to-many)
--
-- This complements the existing flat `labels` system with hierarchical organization.

-- ============================================================================
-- JOURNALS TABLE
-- ============================================================================
-- Top-level organizational categories
CREATE TABLE IF NOT EXISTS journals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  
  -- Icon can be emoji or image
  icon_type TEXT NOT NULL DEFAULT 'emoji' CHECK (icon_type IN ('emoji', 'image')),
  icon_emoji TEXT DEFAULT '📚',
  icon_image_url TEXT,
  
  -- Visibility/status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'private', 'system', 'archived')),
  
  -- Optional wallpaper for journal pages
  wallpaper_url TEXT,
  wallpaper_blur INTEGER DEFAULT 0 CHECK (wallpaper_blur >= 0 AND wallpaper_blur <= 20),
  
  -- Display order for UI sorting
  display_order INTEGER NOT NULL DEFAULT 0,
  
  -- Description (optional)
  description TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- COLLECTIONS TABLE
-- ============================================================================
-- Sub-categories within journals
CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journal_id UUID NOT NULL REFERENCES journals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  
  -- Visibility/status (inherits concept from journal but can be independent)
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'private', 'system', 'archived')),
  
  -- Optional icon (defaults to folder)
  icon_emoji TEXT DEFAULT '📁',
  
  -- Display order for UI sorting within journal
  display_order INTEGER NOT NULL DEFAULT 0,
  
  -- Description (optional)
  description TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique slug within a journal
  UNIQUE(journal_id, slug)
);

-- ============================================================================
-- COLLECTION ENTRIES TABLE (Many-to-Many: Posts <-> Collections)
-- ============================================================================
-- Assigns posts to collections
CREATE TABLE IF NOT EXISTS collection_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  
  -- Display order within collection
  display_order INTEGER NOT NULL DEFAULT 0,
  
  -- When the entry was added to the collection
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Prevent duplicate assignments
  UNIQUE(collection_id, post_id)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS journals_owner_id_idx ON journals(owner_id);
CREATE INDEX IF NOT EXISTS journals_status_idx ON journals(status);
CREATE INDEX IF NOT EXISTS journals_slug_idx ON journals(slug);
CREATE INDEX IF NOT EXISTS journals_display_order_idx ON journals(display_order);

CREATE INDEX IF NOT EXISTS collections_journal_id_idx ON collections(journal_id);
CREATE INDEX IF NOT EXISTS collections_status_idx ON collections(status);
CREATE INDEX IF NOT EXISTS collections_display_order_idx ON collections(journal_id, display_order);

CREATE INDEX IF NOT EXISTS collection_entries_collection_id_idx ON collection_entries(collection_id);
CREATE INDEX IF NOT EXISTS collection_entries_post_id_idx ON collection_entries(post_id);
CREATE INDEX IF NOT EXISTS collection_entries_display_order_idx ON collection_entries(collection_id, display_order);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Generate slug from name (simple version)
CREATE OR REPLACE FUNCTION generate_slug(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN lower(regexp_replace(regexp_replace(input_text, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Auto-generate slug on journal insert if not provided
CREATE OR REPLACE FUNCTION journals_auto_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_slug(NEW.name) || '-' || substr(NEW.id::text, 1, 8);
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER journals_auto_slug_trigger
  BEFORE INSERT OR UPDATE ON journals
  FOR EACH ROW
  EXECUTE FUNCTION journals_auto_slug();

-- Auto-generate slug on collection insert if not provided
CREATE OR REPLACE FUNCTION collections_auto_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_slug(NEW.name) || '-' || substr(NEW.id::text, 1, 8);
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER collections_auto_slug_trigger
  BEFORE INSERT OR UPDATE ON collections
  FOR EACH ROW
  EXECUTE FUNCTION collections_auto_slug();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_entries ENABLE ROW LEVEL SECURITY;

-- JOURNALS POLICIES
-- Published journals visible to all; others only to owner/admin
DROP POLICY IF EXISTS "journals_select_published_or_own" ON journals;
CREATE POLICY "journals_select_published_or_own" ON journals
  FOR SELECT USING (
    status = 'published' OR 
    owner_id = auth.uid() OR 
    is_admin()
  );

DROP POLICY IF EXISTS "journals_insert_authenticated" ON journals;
CREATE POLICY "journals_insert_authenticated" ON journals
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND (
      owner_id = auth.uid() OR is_admin()
    )
  );

DROP POLICY IF EXISTS "journals_update_own_or_admin" ON journals;
CREATE POLICY "journals_update_own_or_admin" ON journals
  FOR UPDATE USING (
    owner_id = auth.uid() OR is_admin()
  );

DROP POLICY IF EXISTS "journals_delete_own_or_admin" ON journals;
CREATE POLICY "journals_delete_own_or_admin" ON journals
  FOR DELETE USING (
    owner_id = auth.uid() OR is_admin()
  );

-- COLLECTIONS POLICIES
-- Collections visible based on parent journal's visibility + own status
DROP POLICY IF EXISTS "collections_select_visible" ON collections;
CREATE POLICY "collections_select_visible" ON collections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM journals j
      WHERE j.id = journal_id AND (
        (j.status = 'published' AND status = 'published') OR
        j.owner_id = auth.uid() OR
        is_admin()
      )
    )
  );

DROP POLICY IF EXISTS "collections_insert_own_journal" ON collections;
CREATE POLICY "collections_insert_own_journal" ON collections
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM journals j
      WHERE j.id = journal_id AND (
        j.owner_id = auth.uid() OR is_admin()
      )
    )
  );

DROP POLICY IF EXISTS "collections_update_own_journal" ON collections;
CREATE POLICY "collections_update_own_journal" ON collections
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM journals j
      WHERE j.id = journal_id AND (
        j.owner_id = auth.uid() OR is_admin()
      )
    )
  );

DROP POLICY IF EXISTS "collections_delete_own_journal" ON collections;
CREATE POLICY "collections_delete_own_journal" ON collections
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM journals j
      WHERE j.id = journal_id AND (
        j.owner_id = auth.uid() OR is_admin()
      )
    )
  );

-- COLLECTION ENTRIES POLICIES
-- Entries visible if collection is visible
DROP POLICY IF EXISTS "collection_entries_select_visible" ON collection_entries;
CREATE POLICY "collection_entries_select_visible" ON collection_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM collections c
      JOIN journals j ON j.id = c.journal_id
      WHERE c.id = collection_id AND (
        (j.status = 'published' AND c.status = 'published') OR
        j.owner_id = auth.uid() OR
        is_admin()
      )
    )
  );

DROP POLICY IF EXISTS "collection_entries_insert_own_collection" ON collection_entries;
CREATE POLICY "collection_entries_insert_own_collection" ON collection_entries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections c
      JOIN journals j ON j.id = c.journal_id
      WHERE c.id = collection_id AND (
        j.owner_id = auth.uid() OR is_admin()
      )
    )
  );

DROP POLICY IF EXISTS "collection_entries_update_own_collection" ON collection_entries;
CREATE POLICY "collection_entries_update_own_collection" ON collection_entries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM collections c
      JOIN journals j ON j.id = c.journal_id
      WHERE c.id = collection_id AND (
        j.owner_id = auth.uid() OR is_admin()
      )
    )
  );

DROP POLICY IF EXISTS "collection_entries_delete_own_collection" ON collection_entries;
CREATE POLICY "collection_entries_delete_own_collection" ON collection_entries
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM collections c
      JOIN journals j ON j.id = c.journal_id
      WHERE c.id = collection_id AND (
        j.owner_id = auth.uid() OR is_admin()
      )
    )
  );

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON journals TO authenticated;
GRANT SELECT ON journals TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON collections TO authenticated;
GRANT SELECT ON collections TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON collection_entries TO authenticated;
GRANT SELECT ON collection_entries TO anon;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE journals IS 'Top-level organizational categories for the Curator system';
COMMENT ON TABLE collections IS 'Sub-categories within journals for organizing posts';
COMMENT ON TABLE collection_entries IS 'Many-to-many relationship assigning posts to collections';

COMMENT ON COLUMN journals.icon_type IS 'Type of icon: emoji or image';
COMMENT ON COLUMN journals.icon_emoji IS 'Emoji character when icon_type is emoji';
COMMENT ON COLUMN journals.icon_image_url IS 'Image URL when icon_type is image';
COMMENT ON COLUMN journals.wallpaper_url IS 'Optional background image for journal-related pages';
COMMENT ON COLUMN journals.wallpaper_blur IS 'Blur amount for wallpaper (0-20px)';
COMMENT ON COLUMN journals.display_order IS 'Order for displaying journals in UI';

COMMENT ON COLUMN collections.display_order IS 'Order for displaying collections within a journal';
COMMENT ON COLUMN collection_entries.display_order IS 'Order for displaying entries within a collection';
