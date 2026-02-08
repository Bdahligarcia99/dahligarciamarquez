-- ============================================
-- Page Wallpapers Migration
-- Adds wallpaper support to page_layouts table
-- ============================================

-- Add wallpaper column to page_layouts table
ALTER TABLE public.page_layouts 
ADD COLUMN IF NOT EXISTS wallpaper JSONB DEFAULT NULL;

-- Add is_universal_wallpaper column (only one page can be universal at a time)
ALTER TABLE public.page_layouts 
ADD COLUMN IF NOT EXISTS is_universal_wallpaper BOOLEAN DEFAULT FALSE;

-- Comment explaining the structure
COMMENT ON COLUMN public.page_layouts.wallpaper IS 'Wallpaper config: { "url": "https://...", "alt": "description" }';
COMMENT ON COLUMN public.page_layouts.is_universal_wallpaper IS 'If true, this page wallpaper is used as fallback for pages without wallpaper';

-- Drop existing functions if they exist (needed when changing return types)
DROP FUNCTION IF EXISTS public.set_page_wallpaper(TEXT, JSONB);
DROP FUNCTION IF EXISTS public.remove_page_wallpaper(TEXT);
DROP FUNCTION IF EXISTS public.set_universal_wallpaper(TEXT);
DROP FUNCTION IF EXISTS public.get_universal_wallpaper();
DROP FUNCTION IF EXISTS public.get_all_page_wallpapers();
DROP FUNCTION IF EXISTS public.clear_universal_wallpaper();

-- Function to get wallpaper for a page
CREATE OR REPLACE FUNCTION public.get_page_wallpaper(p_page_id TEXT)
RETURNS JSONB AS $$
  SELECT wallpaper FROM public.page_layouts WHERE page_id = p_page_id LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Function to set wallpaper for a page
-- Updates wallpaper on ALL slots for this page (wallpaper is shared across slots)
CREATE OR REPLACE FUNCTION public.set_page_wallpaper(
  p_page_id TEXT,
  p_wallpaper JSONB
)
RETURNS JSONB AS $$
BEGIN
  -- Update wallpaper on all existing slots for this page
  UPDATE public.page_layouts
  SET wallpaper = p_wallpaper,
      updated_at = now()
  WHERE page_id = p_page_id;
  
  -- If no rows exist yet, create slot 1 with the wallpaper
  IF NOT FOUND THEN
    INSERT INTO public.page_layouts (page_id, slot_number, name, cards, settings, wallpaper)
    VALUES (p_page_id, 1, 'Layout 1', '[]'::jsonb, '{}'::jsonb, p_wallpaper);
  END IF;
  
  RETURN p_wallpaper;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove wallpaper from a page
-- Removes wallpaper from ALL slots for this page
CREATE OR REPLACE FUNCTION public.remove_page_wallpaper(p_page_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.page_layouts
  SET wallpaper = NULL,
      updated_at = now()
  WHERE page_id = p_page_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to set a page as the universal wallpaper source
-- Clears universal flag from all other pages first
CREATE OR REPLACE FUNCTION public.set_universal_wallpaper(p_page_id TEXT)
RETURNS TEXT AS $$
DECLARE
  previous_universal TEXT;
BEGIN
  -- Get current universal page (if any)
  SELECT page_id INTO previous_universal
  FROM public.page_layouts
  WHERE is_universal_wallpaper = true
  LIMIT 1;
  
  -- Clear universal flag from all pages
  UPDATE public.page_layouts
  SET is_universal_wallpaper = false
  WHERE is_universal_wallpaper = true;
  
  -- Set the new universal page
  UPDATE public.page_layouts
  SET is_universal_wallpaper = true,
      updated_at = now()
  WHERE page_id = p_page_id;
  
  RETURN previous_universal;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clear universal wallpaper (no page is universal)
CREATE OR REPLACE FUNCTION public.clear_universal_wallpaper()
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.page_layouts
  SET is_universal_wallpaper = false
  WHERE is_universal_wallpaper = true;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get the universal wallpaper
CREATE OR REPLACE FUNCTION public.get_universal_wallpaper()
RETURNS TABLE(page_id TEXT, wallpaper JSONB) AS $$
  SELECT page_id, wallpaper 
  FROM public.page_layouts 
  WHERE is_universal_wallpaper = true AND wallpaper IS NOT NULL
  LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Function to get all page wallpapers with universal flag
CREATE OR REPLACE FUNCTION public.get_all_page_wallpapers()
RETURNS TABLE(page_id TEXT, wallpaper JSONB, is_universal_wallpaper BOOLEAN) AS $$
  SELECT DISTINCT ON (page_id) page_id, wallpaper, is_universal_wallpaper 
  FROM public.page_layouts
  ORDER BY page_id, slot_number;
$$ LANGUAGE sql STABLE;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_page_wallpaper(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.set_page_wallpaper(TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_page_wallpaper(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_page_wallpapers() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.set_universal_wallpaper(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_universal_wallpaper() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_universal_wallpaper() TO authenticated, anon;
