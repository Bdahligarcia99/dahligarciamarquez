-- Function to get database size (callable via RPC)
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION get_database_size()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  db_size BIGINT;
BEGIN
  SELECT pg_database_size(current_database()) INTO db_size;
  RETURN json_build_object('size_bytes', db_size);
END;
$$;

-- Grant execute permission to authenticated users (admin check happens in middleware)
GRANT EXECUTE ON FUNCTION get_database_size() TO authenticated;
GRANT EXECUTE ON FUNCTION get_database_size() TO service_role;

