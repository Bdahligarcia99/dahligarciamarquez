-- Supabase Seed Data
-- Creates initial data for development and testing

-- Create admin profile (placeholder UUID - will be updated after admin user creation)
-- NOTE: Replace 'ADMIN_USER_UUID_HERE' with actual admin user UUID after creating admin user
INSERT INTO profiles (id, display_name, role) 
VALUES (
  'ADMIN_USER_UUID_HERE'::UUID, 
  'Admin User', 
  'admin'
) ON CONFLICT (id) DO UPDATE SET 
  role = 'admin',
  display_name = COALESCE(EXCLUDED.display_name, profiles.display_name);

-- Create default labels
INSERT INTO labels (name) VALUES 
  ('stories'),
  ('reflections'), 
  ('accessibility-in-tech'),
  ('personal'),
  ('insight'),
  ('community'),
  ('news')
ON CONFLICT (name) DO NOTHING;

-- Note: Posts will be created via the ingestion script
-- This ensures proper author_id assignment and content formatting

-- Verify seed data
DO $$
DECLARE
  label_count INTEGER;
  profile_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO label_count FROM labels;
  SELECT COUNT(*) INTO profile_count FROM profiles;
  
  RAISE NOTICE 'Seed data summary:';
  RAISE NOTICE '- Labels created: %', label_count;
  RAISE NOTICE '- Profiles created: %', profile_count;
  RAISE NOTICE '- Admin profile UUID placeholder: ADMIN_USER_UUID_HERE (update this after creating admin user)';
END $$;
