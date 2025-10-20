-- Fix Existing User Profile
-- Run this in your Supabase SQL Editor to create a profile for existing user

-- First, check if the user has a profile
SELECT 
  au.id,
  au.email,
  au.user_metadata,
  au.created_at,
  p.display_name,
  p.role
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
WHERE p.id IS NULL; -- Users without profiles

-- Create profile for existing user(s) without profiles
INSERT INTO profiles (id, display_name, role, created_at, updated_at)
SELECT 
  au.id,
  COALESCE(
    au.user_metadata->>'display_name',
    split_part(au.email, '@', 1),
    'User'
  ) as display_name,
  'user' as role,
  au.created_at,
  NOW() as updated_at
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Verify the profile was created
SELECT 
  au.id,
  au.email,
  p.display_name,
  p.role,
  p.created_at
FROM auth.users au
JOIN profiles p ON au.id = p.id;
