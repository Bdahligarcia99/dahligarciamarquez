-- Create a trigger to automatically create a profile when a user signs up
-- Run this in Supabase SQL Editor

-- Create the function that will be triggered
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, role, created_at, updated_at)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'display_name', new.email, 'User'),
    'user',
    now(),
    now()
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Optionally: Create profiles for existing users who don't have one
INSERT INTO public.profiles (id, display_name, role, created_at, updated_at)
SELECT 
  id,
  COALESCE(raw_user_meta_data->>'display_name', email, 'User'),
  'user',
  created_at,
  updated_at
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

