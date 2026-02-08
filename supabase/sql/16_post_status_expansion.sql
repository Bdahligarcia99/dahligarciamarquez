-- Migration: Add 'private' and 'system' status options to posts
-- 
-- New status types:
-- - private: Entries viewable only by specific people or through specific access (hidden from public)
-- - system: Entries used by the web application (Terms of Service, Bio, etc.) - hidden from public listings
--
-- Both 'private' and 'system' behave similarly to 'archived' in that they are not visible to the public.

-- Step 1: Drop the existing CHECK constraint on the status column
-- PostgreSQL names CHECK constraints automatically as tablename_columnname_check
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_status_check;

-- Step 2: Add the new CHECK constraint with expanded status options
ALTER TABLE posts ADD CONSTRAINT posts_status_check 
  CHECK (status IN ('draft', 'published', 'private', 'system', 'archived'));

-- Note: No data migration needed since existing posts have valid statuses
