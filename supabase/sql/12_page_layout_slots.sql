-- ============================================
-- Page Layout Slots Migration
-- Adds support for multiple layout slots per page
-- ============================================

-- Step 1: Drop existing constraints and functions that depend on old schema
DROP FUNCTION IF EXISTS public.upsert_page_layout(TEXT, JSONB, JSONB);
DROP FUNCTION IF EXISTS public.publish_page_layout(TEXT);
DROP FUNCTION IF EXISTS public.get_page_layout(TEXT);

-- Step 2: Add new columns to support slots
ALTER TABLE public.page_layouts 
  DROP CONSTRAINT IF EXISTS page_layouts_page_id_key;

ALTER TABLE public.page_layouts
  ADD COLUMN IF NOT EXISTS slot_number INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Layout 1';

-- Step 3: Create unique constraint on page_id + slot_number
ALTER TABLE public.page_layouts
  ADD CONSTRAINT page_layouts_page_slot_unique UNIQUE (page_id, slot_number);

-- Step 4: Create index for faster lookups
DROP INDEX IF EXISTS idx_page_layouts_page_id;
CREATE INDEX IF NOT EXISTS idx_page_layouts_page_slot ON public.page_layouts(page_id, slot_number);

-- Step 5: New function to save a layout to a specific slot
CREATE OR REPLACE FUNCTION public.save_layout_slot(
  p_page_id TEXT,
  p_slot_number INTEGER,
  p_name TEXT,
  p_cards JSONB,
  p_settings JSONB DEFAULT '{}'::jsonb
)
RETURNS public.page_layouts AS $$
DECLARE
  result public.page_layouts;
  slot_count INTEGER;
BEGIN
  -- Check max slots (10)
  SELECT COUNT(*) INTO slot_count 
  FROM public.page_layouts 
  WHERE page_id = p_page_id;
  
  -- If this is a new slot, check limit
  IF NOT EXISTS (SELECT 1 FROM public.page_layouts WHERE page_id = p_page_id AND slot_number = p_slot_number) THEN
    IF slot_count >= 10 THEN
      RAISE EXCEPTION 'Maximum of 10 layout slots per page';
    END IF;
  END IF;

  INSERT INTO public.page_layouts (page_id, slot_number, name, cards, settings)
  VALUES (p_page_id, p_slot_number, p_name, p_cards, p_settings)
  ON CONFLICT (page_id, slot_number)
  DO UPDATE SET
    name = EXCLUDED.name,
    cards = EXCLUDED.cards,
    settings = EXCLUDED.settings,
    updated_at = now()
  RETURNING * INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Function to get all layout slots for a page
CREATE OR REPLACE FUNCTION public.get_page_layout_slots(p_page_id TEXT)
RETURNS SETOF public.page_layouts AS $$
  SELECT * FROM public.page_layouts 
  WHERE page_id = p_page_id 
  ORDER BY slot_number;
$$ LANGUAGE sql STABLE;

-- Step 7: Function to get a specific slot
CREATE OR REPLACE FUNCTION public.get_layout_slot(p_page_id TEXT, p_slot_number INTEGER)
RETURNS public.page_layouts AS $$
  SELECT * FROM public.page_layouts 
  WHERE page_id = p_page_id AND slot_number = p_slot_number 
  LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Step 8: Function to publish a specific slot
CREATE OR REPLACE FUNCTION public.publish_layout_slot(p_page_id TEXT, p_slot_number INTEGER)
RETURNS public.page_layouts AS $$
DECLARE
  result public.page_layouts;
BEGIN
  -- First, unpublish all slots for this page
  UPDATE public.page_layouts
  SET is_published = false
  WHERE page_id = p_page_id;
  
  -- Then publish the specified slot
  UPDATE public.page_layouts
  SET is_published = true,
      updated_at = now()
  WHERE page_id = p_page_id AND slot_number = p_slot_number
  RETURNING * INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 9: Function to delete a layout slot
CREATE OR REPLACE FUNCTION public.delete_layout_slot(p_page_id TEXT, p_slot_number INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  DELETE FROM public.page_layouts 
  WHERE page_id = p_page_id AND slot_number = p_slot_number;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 10: Function to rename a layout slot
CREATE OR REPLACE FUNCTION public.rename_layout_slot(p_page_id TEXT, p_slot_number INTEGER, p_new_name TEXT)
RETURNS public.page_layouts AS $$
DECLARE
  result public.page_layouts;
BEGIN
  UPDATE public.page_layouts
  SET name = p_new_name,
      updated_at = now()
  WHERE page_id = p_page_id AND slot_number = p_slot_number
  RETURNING * INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 11: Function to get the next available slot number
CREATE OR REPLACE FUNCTION public.get_next_slot_number(p_page_id TEXT)
RETURNS INTEGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(slot_number), 0) + 1 INTO next_num
  FROM public.page_layouts
  WHERE page_id = p_page_id;
  
  RETURN next_num;
END;
$$ LANGUAGE plpgsql STABLE;

-- Step 12: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.save_layout_slot(TEXT, INTEGER, TEXT, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_page_layout_slots(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_layout_slot(TEXT, INTEGER) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.publish_layout_slot(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_layout_slot(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rename_layout_slot(TEXT, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_slot_number(TEXT) TO authenticated;

-- Step 13: Update existing rows to have proper slot data
UPDATE public.page_layouts 
SET slot_number = 1, name = 'Layout 1' 
WHERE slot_number IS NULL OR name IS NULL;
