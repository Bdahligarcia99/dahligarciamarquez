-- Supabase Routines and Triggers
-- Helper functions and triggers for automation

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to generate URL-safe slugs
CREATE OR REPLACE FUNCTION slugify(text_input TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(
    TRIM(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(text_input, '[^a-zA-Z0-9\s\-_]', '', 'g'),
          '\s+', '-', 'g'
        ),
        '-+', '-', 'g'
      ),
      '-'
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Function to generate unique slug for posts
CREATE OR REPLACE FUNCTION generate_post_slug()
RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Generate base slug from title
  base_slug := slugify(NEW.title);
  final_slug := base_slug;
  
  -- Check for existing slugs and append number if needed
  WHILE EXISTS (
    SELECT 1 FROM posts 
    WHERE slug = final_slug 
    AND id != COALESCE(NEW.id, uuid_generate_v4())
  ) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  NEW.slug := final_slug;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to generate unique slug for labels
CREATE OR REPLACE FUNCTION generate_label_slug()
RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Generate base slug from name
  base_slug := slugify(NEW.name);
  final_slug := base_slug;
  
  -- Check for existing slugs and append number if needed
  WHILE EXISTS (
    SELECT 1 FROM labels 
    WHERE slug = final_slug 
    AND id != COALESCE(NEW.id, uuid_generate_v4())
  ) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  NEW.slug := final_slug;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to set default author_id from auth context
CREATE OR REPLACE FUNCTION set_post_author()
RETURNS TRIGGER AS $$
BEGIN
  -- Set author_id to current user if not explicitly provided
  IF NEW.author_id IS NULL THEN
    NEW.author_id := auth.uid();
  END IF;
  
  -- Validate that author_id exists in profiles
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = NEW.author_id) THEN
    RAISE EXCEPTION 'Author profile does not exist: %', NEW.author_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to sync content_text from content_rich
CREATE OR REPLACE FUNCTION sync_post_content_text()
RETURNS TRIGGER AS $$
BEGIN
  -- Extract plain text from rich content JSON for search
  IF NEW.content_rich IS NOT NULL THEN
    -- Simple extraction - in practice you might want more sophisticated text extraction
    NEW.content_text := REGEXP_REPLACE(
      NEW.content_rich::TEXT, 
      '<[^>]*>', 
      '', 
      'g'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS labels_updated_at ON labels;
CREATE TRIGGER labels_updated_at
  BEFORE UPDATE ON labels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS posts_updated_at ON posts;
CREATE TRIGGER posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Create triggers for slug generation
DROP TRIGGER IF EXISTS posts_generate_slug ON posts;
CREATE TRIGGER posts_generate_slug
  BEFORE INSERT OR UPDATE OF title ON posts
  FOR EACH ROW EXECUTE FUNCTION generate_post_slug();

DROP TRIGGER IF EXISTS labels_generate_slug ON labels;
CREATE TRIGGER labels_generate_slug
  BEFORE INSERT OR UPDATE OF name ON labels
  FOR EACH ROW EXECUTE FUNCTION generate_label_slug();

-- Create trigger for author assignment
DROP TRIGGER IF EXISTS posts_set_author ON posts;
CREATE TRIGGER posts_set_author
  BEFORE INSERT ON posts
  FOR EACH ROW EXECUTE FUNCTION set_post_author();

-- Create trigger for content text sync
DROP TRIGGER IF EXISTS posts_sync_content_text ON posts;
CREATE TRIGGER posts_sync_content_text
  BEFORE INSERT OR UPDATE OF content_rich ON posts
  FOR EACH ROW EXECUTE FUNCTION sync_post_content_text();
