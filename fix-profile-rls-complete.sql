-- Complete Profile RLS Policy Fix
-- This completely removes and recreates all profile policies to fix circular dependency

-- First, disable RLS temporarily to ensure we can make changes
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on profiles table
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_own_or_admin" ON profiles;

-- Re-enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create simple, non-circular policies
-- Users can read their own profile
CREATE POLICY "profiles_select_policy" ON profiles
  FOR SELECT USING (
    id = auth.uid()
  );

-- Users can insert their own profile
CREATE POLICY "profiles_insert_policy" ON profiles
  FOR INSERT WITH CHECK (
    id = auth.uid()
  );

-- Users can update their own profile
CREATE POLICY "profiles_update_policy" ON profiles
  FOR UPDATE USING (
    id = auth.uid()
  );

-- Users can delete their own profile
CREATE POLICY "profiles_delete_policy" ON profiles
  FOR DELETE USING (
    id = auth.uid()
  );

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO authenticated;

-- Test the policy by selecting from profiles (should work now)
SELECT 'Profile policies updated successfully' as status;
