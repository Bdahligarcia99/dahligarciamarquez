-- User Management Functions
-- Functions for user account management including deletion

-- Function to delete user profile and related data
-- This function deletes the user's profile data but NOT the auth user
-- The auth user deletion must be handled by the frontend using Supabase client methods
CREATE OR REPLACE FUNCTION delete_user_data()
RETURNS VOID AS $$
DECLARE
  user_id UUID;
BEGIN
  -- Get the current authenticated user ID
  user_id := auth.uid();
  
  -- Check if user is authenticated
  IF user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Delete user's profile (this will cascade to delete posts, images, etc. due to foreign key constraints)
  DELETE FROM profiles WHERE id = user_id;
  
  -- Note: Auth user deletion must be handled separately via Supabase Admin API
  -- or frontend client methods, as regular users cannot delete from auth.users
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_user_data() TO authenticated;

COMMENT ON FUNCTION delete_user_data() IS 'Deletes the current authenticated user profile and all associated data (posts, images, etc.)';
