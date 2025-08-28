#!/bin/bash

# Test script for Express backend API endpoints
BASE_URL="https://api.dahligarciamarquez.com"

echo "🧪 Testing Express API endpoints at $BASE_URL"
echo "=================================================="

echo ""
echo "1️⃣ Testing root route (/) - expect 200 with service info"
echo "---"
curl -i "$BASE_URL/"
echo ""

echo "2️⃣ Testing health check (/healthz) - expect 200 with ok: true"
echo "---"
curl -i "$BASE_URL/healthz"
echo ""

echo "3️⃣ Testing hello endpoint (/api/hello) - expect 200 with message"
echo "---"
curl -i "$BASE_URL/api/hello"
echo ""

echo "4️⃣ Testing 404 route (/doesnotexist) - expect 404 with error"
echo "---"
curl -i "$BASE_URL/doesnotexist"
echo ""

echo "=================================================="
echo "✅ API testing complete!"
