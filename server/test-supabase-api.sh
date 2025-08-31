#!/bin/bash
# Supabase API Test Suite
# Tests all endpoints with proper JWT authentication

set -e

# Configuration
API_BASE="${API_BASE:-http://localhost:8080}"
JWT_TOKEN="${JWT_TOKEN:-}"

echo "🧪 Testing Supabase API at $API_BASE"
echo "📋 JWT Token: ${JWT_TOKEN:0:20}..."

# Helper function to make authenticated requests
auth_curl() {
  if [ -n "$JWT_TOKEN" ]; then
    curl -H "Authorization: Bearer $JWT_TOKEN" "$@"
  else
    echo "⚠️  No JWT token provided, making unauthenticated request"
    curl "$@"
  fi
}

echo ""
echo "1️⃣ Testing basic connectivity..."

# Health check
echo "GET /healthz"
curl -s "$API_BASE/healthz" | jq .
echo ""

# Root endpoint
echo "GET /"
curl -s "$API_BASE/" | jq .
echo ""

echo "2️⃣ Testing database connectivity..."

# Database ping (requires auth)
echo "POST /api/auth/db-ping"
auth_curl -s -X POST "$API_BASE/api/auth/db-ping" | jq .
echo ""

echo "3️⃣ Testing labels API..."

# Get all labels (public)
echo "GET /api/labels"
curl -s "$API_BASE/api/labels" | jq .
echo ""

# Create label (admin only)
echo "POST /api/labels"
auth_curl -s -X POST "$API_BASE/api/labels" \
  -H "Content-Type: application/json" \
  -d '{"name":"test-label"}' | jq .
echo ""

echo "4️⃣ Testing posts API..."

# Get published posts (public)
echo "GET /api/posts"
curl -s "$API_BASE/api/posts" | jq .
echo ""

# Get admin posts view (admin only)
echo "GET /api/posts/admin"
auth_curl -s "$API_BASE/api/posts/admin" | jq .
echo ""

# Create post (authenticated)
echo "POST /api/posts"
auth_curl -s -X POST "$API_BASE/api/posts" \
  -H "Content-Type: application/json" \
  -d '{
    "title":"Test Post via API",
    "content_rich":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"This is a test post created via the API."}]}]},
    "excerpt":"A test post",
    "status":"draft"
  }' | jq .
echo ""

echo "5️⃣ Testing images API..."

# Get user images (authenticated)
echo "GET /api/images"
auth_curl -s "$API_BASE/api/images" | jq .
echo ""

# Store image metadata (authenticated)
echo "POST /api/images/metadata"
auth_curl -s -X POST "$API_BASE/api/images/metadata" \
  -H "Content-Type: application/json" \
  -d '{
    "path":"test-user/20241201/test-image.jpg",
    "mime_type":"image/jpeg",
    "file_size_bytes":102400,
    "width":800,
    "height":600,
    "is_public":true
  }' | jq .
echo ""

echo "6️⃣ Testing error cases..."

# Unauthenticated admin request
echo "POST /api/labels (without auth)"
curl -s -X POST "$API_BASE/api/labels" \
  -H "Content-Type: application/json" \
  -d '{"name":"should-fail"}' | jq .
echo ""

# Invalid post data
echo "POST /api/posts (invalid data)"
auth_curl -s -X POST "$API_BASE/api/posts" \
  -H "Content-Type: application/json" \
  -d '{"invalid":"data"}' | jq .
echo ""

echo "✅ API test suite completed!"
echo ""
echo "Usage tips:"
echo "- Set JWT_TOKEN environment variable for authenticated requests"
echo "- Set API_BASE to test different environments"
echo "- Example: JWT_TOKEN='your-jwt-token' ./test-supabase-api.sh"
