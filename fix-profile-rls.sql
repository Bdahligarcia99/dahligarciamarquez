-- Fix Profile RLS Policy - Remove Circular Dependency
-- This fixes the issue where profiles can't be fetched due to circular RLS policy

-- Drop the problematic policy
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON profiles;

-- Create a simpler policy that allows users to read their own profile
-- and we'll handle admin checks in application code
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (
    id = auth.uid()
  );

-- Also ensure the insert policy is correct
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (
    id = auth.uid()
  );

-- Update policy allows users to update their own profile
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (
    id = auth.uid()
  );

-- We'll handle admin-level access through the backend API with service role
-- This avoids the circular dependency issue
