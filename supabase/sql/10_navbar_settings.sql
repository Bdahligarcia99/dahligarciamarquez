-- Navbar Settings
-- Stores navbar item configuration for the website
-- Uses the existing system_settings table for persistence

-- Insert default navbar settings
-- Each nav item has: id, label, path, hidden (boolean), order (for sorting)
INSERT INTO system_settings (key, value, description)
VALUES (
  'navbar_items',
  '[
    {"id": "home", "label": "Home", "path": "/", "hidden": false, "order": 1},
    {"id": "journals", "label": "Journals", "path": "/blog", "hidden": false, "order": 2},
    {"id": "about", "label": "About", "path": "/about", "hidden": false, "order": 3},
    {"id": "contact", "label": "Contact", "path": "/contact", "hidden": false, "order": 4}
  ]'::jsonb,
  'Navbar items configuration - controls which items appear in site navigation'
)
ON CONFLICT (key) DO NOTHING;

-- Helper function to update a single navbar item's visibility
CREATE OR REPLACE FUNCTION toggle_navbar_item_visibility(item_id TEXT)
RETURNS JSONB AS $$
DECLARE
  current_items JSONB;
  updated_items JSONB;
  visible_count INT;
BEGIN
  -- Get current navbar items
  SELECT value INTO current_items 
  FROM system_settings 
  WHERE key = 'navbar_items';
  
  -- Count currently visible items
  SELECT COUNT(*) INTO visible_count
  FROM jsonb_array_elements(current_items) AS item
  WHERE (item->>'hidden')::boolean = false;
  
  -- Check if this is the last visible item (prevent hiding)
  IF visible_count = 1 AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(current_items) AS item
    WHERE item->>'id' = item_id AND (item->>'hidden')::boolean = false
  ) THEN
    RAISE EXCEPTION 'Cannot hide the last visible navbar item';
  END IF;
  
  -- Toggle the hidden status for the specified item
  SELECT jsonb_agg(
    CASE 
      WHEN item->>'id' = item_id 
      THEN jsonb_set(item, '{hidden}', to_jsonb(NOT (item->>'hidden')::boolean))
      ELSE item
    END
  ) INTO updated_items
  FROM jsonb_array_elements(current_items) AS item;
  
  -- Update the setting
  UPDATE system_settings 
  SET value = updated_items
  WHERE key = 'navbar_items';
  
  RETURN updated_items;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get navbar items (for easier querying)
CREATE OR REPLACE FUNCTION get_navbar_items()
RETURNS JSONB AS $$
BEGIN
  RETURN (SELECT value FROM system_settings WHERE key = 'navbar_items');
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to update a navbar item's label
CREATE OR REPLACE FUNCTION update_navbar_item_label(item_id TEXT, new_label TEXT)
RETURNS JSONB AS $$
DECLARE
  current_items JSONB;
  updated_items JSONB;
BEGIN
  SELECT value INTO current_items 
  FROM system_settings 
  WHERE key = 'navbar_items';
  
  SELECT jsonb_agg(
    CASE 
      WHEN item->>'id' = item_id 
      THEN jsonb_set(item, '{label}', to_jsonb(new_label))
      ELSE item
    END
  ) INTO updated_items
  FROM jsonb_array_elements(current_items) AS item;
  
  UPDATE system_settings 
  SET value = updated_items
  WHERE key = 'navbar_items';
  
  RETURN updated_items;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users (RLS on system_settings handles write protection)
GRANT EXECUTE ON FUNCTION get_navbar_items() TO authenticated;
GRANT EXECUTE ON FUNCTION get_navbar_items() TO anon;

-- Only admins should be able to toggle visibility and update labels
-- The SECURITY DEFINER allows the function to run with elevated privileges,
-- but we add an explicit admin check inside for safety
CREATE OR REPLACE FUNCTION toggle_navbar_item_visibility(item_id TEXT)
RETURNS JSONB AS $$
DECLARE
  current_items JSONB;
  updated_items JSONB;
  visible_count INT;
  user_role TEXT;
BEGIN
  -- Check if user is admin
  SELECT role INTO user_role FROM profiles WHERE id = auth.uid();
  IF user_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can modify navbar settings';
  END IF;

  -- Get current navbar items
  SELECT value INTO current_items 
  FROM system_settings 
  WHERE key = 'navbar_items';
  
  -- Count currently visible items
  SELECT COUNT(*) INTO visible_count
  FROM jsonb_array_elements(current_items) AS item
  WHERE (item->>'hidden')::boolean = false;
  
  -- Check if this is the last visible item (prevent hiding)
  IF visible_count = 1 AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(current_items) AS item
    WHERE item->>'id' = item_id AND (item->>'hidden')::boolean = false
  ) THEN
    RAISE EXCEPTION 'Cannot hide the last visible navbar item';
  END IF;
  
  -- Toggle the hidden status for the specified item
  SELECT jsonb_agg(
    CASE 
      WHEN item->>'id' = item_id 
      THEN jsonb_set(item, '{hidden}', to_jsonb(NOT (item->>'hidden')::boolean))
      ELSE item
    END
  ) INTO updated_items
  FROM jsonb_array_elements(current_items) AS item;
  
  -- Update the setting
  UPDATE system_settings 
  SET value = updated_items
  WHERE key = 'navbar_items';
  
  RETURN updated_items;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_navbar_item_label(item_id TEXT, new_label TEXT)
RETURNS JSONB AS $$
DECLARE
  current_items JSONB;
  updated_items JSONB;
  user_role TEXT;
BEGIN
  -- Check if user is admin
  SELECT role INTO user_role FROM profiles WHERE id = auth.uid();
  IF user_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can modify navbar settings';
  END IF;

  SELECT value INTO current_items 
  FROM system_settings 
  WHERE key = 'navbar_items';
  
  SELECT jsonb_agg(
    CASE 
      WHEN item->>'id' = item_id 
      THEN jsonb_set(item, '{label}', to_jsonb(new_label))
      ELSE item
    END
  ) INTO updated_items
  FROM jsonb_array_elements(current_items) AS item;
  
  UPDATE system_settings 
  SET value = updated_items
  WHERE key = 'navbar_items';
  
  RETURN updated_items;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION toggle_navbar_item_visibility IS 'Toggle visibility of a navbar item (admin only)';
COMMENT ON FUNCTION update_navbar_item_label IS 'Update the display label of a navbar item (admin only)';
COMMENT ON FUNCTION get_navbar_items IS 'Get all navbar items configuration';
