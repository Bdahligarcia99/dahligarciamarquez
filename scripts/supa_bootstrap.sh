#!/bin/bash
set -euo pipefail

# Supabase Bootstrap Script
# Creates schema, policies, and storage bucket for storytelling website

echo "🚀 Starting Supabase bootstrap..."

# Check if .env.supabase exists in server folder
if [[ ! -f "server/.env.supabase" ]]; then
  echo "❌ Error: server/.env.supabase file not found"
  echo "Please create server/.env.supabase with:"
  echo "SUPABASE_URL=https://your-project.supabase.co"
  echo "SUPABASE_ANON_KEY=your-anon-key"
  echo "SUPABASE_SERVICE_ROLE_KEY=your-service-role-key"
  echo "SUPABASE_DB_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres"
  exit 1
fi

# Load environment variables from server folder
source server/.env.supabase

# Validate required variables
if [[ -z "${SUPABASE_URL:-}" || -z "${SUPABASE_ANON_KEY:-}" || -z "${SUPABASE_SERVICE_ROLE_KEY:-}" || -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "❌ Error: Missing required environment variables in .env.supabase"
  exit 1
fi

echo "✅ Environment variables loaded"

# Create Storage bucket using REST API
echo "📦 Creating Storage bucket 'post-images'..."
curl -X POST "${SUPABASE_URL}/storage/v1/bucket" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "post-images",
    "name": "post-images",
    "public": true,
    "file_size_limit": 10485760,
    "allowed_mime_types": ["image/jpeg", "image/png", "image/webp", "image/gif"]
  }' || echo "⚠️  Bucket may already exist"

echo "✅ Storage bucket created/verified"

# Apply SQL files in order
echo "🗄️  Applying SQL schema files..."

for sql_file in supabase/sql/*.sql; do
  if [[ -f "$sql_file" ]]; then
    echo "  📄 Applying $(basename "$sql_file")..."
    psql "${SUPABASE_DB_URL}" -f "$sql_file"
  fi
done

echo "✅ SQL files applied successfully"

# Verify setup
echo "🔍 Verifying setup..."
psql "${SUPABASE_DB_URL}" -c "SELECT 'profiles' as table_name, count(*) as row_count FROM profiles 
UNION ALL SELECT 'labels', count(*) FROM labels 
UNION ALL SELECT 'posts', count(*) FROM posts;" || echo "⚠️  Some tables may be empty"

echo "🎉 Supabase bootstrap completed successfully!"
echo ""
echo "Next steps:"
echo "1. Create an admin user via Supabase Auth"
echo "2. Update the admin profile UUID in the database"
echo "3. Set environment variables on your hosting platforms"
echo "4. Deploy and test the application"
