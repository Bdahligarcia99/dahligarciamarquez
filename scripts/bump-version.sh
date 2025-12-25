#!/bin/bash
# Version bump script for dahligarciamarquez
# Usage: ./scripts/bump-version.sh [patch|minor|major]

set -e

TYPE=${1:-patch}
CLIENT_DIR="client"

echo "📦 Bumping version ($TYPE)..."

# Bump package.json version
cd "$CLIENT_DIR"
NEW_VERSION=$(npm version "$TYPE" --no-git-tag-version | tr -d 'v')
cd ..

echo "✅ package.json updated to v$NEW_VERSION"

# Update branding.ts with the same version
BRANDING_FILE="$CLIENT_DIR/src/config/branding.ts"
sed -i '' "s/SITE_VERSION = \"[^\"]*\"/SITE_VERSION = \"$NEW_VERSION\"/" "$BRANDING_FILE"

echo "✅ branding.ts updated to v$NEW_VERSION"

# Show the changes
echo ""
echo "📋 Changes made:"
git diff --stat

echo ""
echo "🎉 Version bumped to v$NEW_VERSION"
echo "   Run 'git add -A && git commit -m \"Bump version to v$NEW_VERSION\"' to commit"

