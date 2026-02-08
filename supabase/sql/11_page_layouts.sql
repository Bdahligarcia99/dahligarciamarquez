-- ============================================
-- Page Layouts Table
-- Stores card layouts for the UI Builder
-- ============================================

-- Create table for storing page layouts
CREATE TABLE IF NOT EXISTS public.page_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id TEXT NOT NULL UNIQUE, -- 'home', 'journals', 'about', 'contact'
  cards JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of card objects with points
  settings JSONB NOT NULL DEFAULT '{}'::jsonb, -- Layout settings (scrollRatio, scrollSpeed, etc.)
  is_published BOOLEAN NOT NULL DEFAULT false, -- Whether this layout is live
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for faster lookups by page_id
CREATE INDEX IF NOT EXISTS idx_page_layouts_page_id ON public.page_layouts(page_id);

-- Enable RLS
ALTER TABLE public.page_layouts ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read published layouts (for the public site)
CREATE POLICY "Anyone can read published layouts"
  ON public.page_layouts
  FOR SELECT
  USING (is_published = true);

-- Policy: Authenticated users can read all layouts (for the editor)
CREATE POLICY "Authenticated users can read all layouts"
  ON public.page_layouts
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can insert layouts
CREATE POLICY "Authenticated users can insert layouts"
  ON public.page_layouts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Authenticated users can update layouts
CREATE POLICY "Authenticated users can update layouts"
  ON public.page_layouts
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can delete layouts
CREATE POLICY "Authenticated users can delete layouts"
  ON public.page_layouts
  FOR DELETE
  TO authenticated
  USING (true);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_page_layouts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_page_layouts_updated_at ON public.page_layouts;
CREATE TRIGGER trigger_page_layouts_updated_at
  BEFORE UPDATE ON public.page_layouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_page_layouts_updated_at();

-- Upsert function for saving layouts (insert or update)
CREATE OR REPLACE FUNCTION public.upsert_page_layout(
  p_page_id TEXT,
  p_cards JSONB,
  p_settings JSONB DEFAULT '{}'::jsonb
)
RETURNS public.page_layouts AS $$
DECLARE
  result public.page_layouts;
BEGIN
  INSERT INTO public.page_layouts (page_id, cards, settings)
  VALUES (p_page_id, p_cards, p_settings)
  ON CONFLICT (page_id)
  DO UPDATE SET
    cards = EXCLUDED.cards,
    settings = EXCLUDED.settings,
    updated_at = now()
  RETURNING * INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to publish a layout (copy draft to published)
CREATE OR REPLACE FUNCTION public.publish_page_layout(p_page_id TEXT)
RETURNS public.page_layouts AS $$
DECLARE
  result public.page_layouts;
BEGIN
  UPDATE public.page_layouts
  SET is_published = true,
      updated_at = now()
  WHERE page_id = p_page_id
  RETURNING * INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get a layout by page_id
CREATE OR REPLACE FUNCTION public.get_page_layout(p_page_id TEXT)
RETURNS public.page_layouts AS $$
  SELECT * FROM public.page_layouts WHERE page_id = p_page_id LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.upsert_page_layout(TEXT, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_page_layout(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_page_layout(TEXT) TO authenticated, anon;

-- Insert default empty layouts for each page
INSERT INTO public.page_layouts (page_id, cards, settings)
VALUES 
  ('home', '[]'::jsonb, '{"scrollRatio": 2, "scrollSpeed": 1, "wallpaperPosition": 0, "alignmentMargin": 1}'::jsonb),
  ('journals', '[]'::jsonb, '{"scrollRatio": 2, "scrollSpeed": 1, "wallpaperPosition": 0, "alignmentMargin": 1}'::jsonb),
  ('about', '[]'::jsonb, '{"scrollRatio": 2, "scrollSpeed": 1, "wallpaperPosition": 0, "alignmentMargin": 1}'::jsonb),
  ('contact', '[]'::jsonb, '{"scrollRatio": 2, "scrollSpeed": 1, "wallpaperPosition": 0, "alignmentMargin": 1}'::jsonb)
ON CONFLICT (page_id) DO NOTHING;
