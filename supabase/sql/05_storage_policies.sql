-- Storage Bucket Policies for post-images bucket
-- Allows authenticated users to upload images and public read access

-- Create policy for SELECT (read) operations - public access
DROP POLICY IF EXISTS "Public read access for post-images" ON storage.objects;
CREATE POLICY "Public read access for post-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'post-images');

-- Create policy for INSERT (upload) operations - authenticated users only
DROP POLICY IF EXISTS "Authenticated users can upload to post-images" ON storage.objects;
CREATE POLICY "Authenticated users can upload to post-images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'post-images' 
  AND auth.role() = 'authenticated'
);

-- Create policy for UPDATE operations - users can update their own files
DROP POLICY IF EXISTS "Users can update own files in post-images" ON storage.objects;
CREATE POLICY "Users can update own files in post-images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'post-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create policy for DELETE operations - users can delete their own files or admins can delete any
DROP POLICY IF EXISTS "Users can delete own files or admins can delete any in post-images" ON storage.objects;
CREATE POLICY "Users can delete own files or admins can delete any in post-images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'post-images' 
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR is_admin()
  )
);

-- Grant necessary permissions for storage operations
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
GRANT SELECT ON storage.objects TO anon;
