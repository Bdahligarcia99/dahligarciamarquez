# Apply System Settings Table Migration

This migration adds persistent storage for system settings like Coming Soon mode.

## Steps to Apply:

### 1. Run SQL in Supabase Dashboard

1. Go to https://supabase.com/dashboard/project/evlifkevmsstofbyvgjh/editor
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy and paste the contents of `supabase/sql/07_system_settings.sql`
5. Click **Run** (or press Cmd/Ctrl + Enter)

### 2. Verify the Migration

Run this query to verify the table was created:

```sql
SELECT * FROM system_settings;
```

You should see one row:
- `key`: "coming_soon_mode"
- `value`: false
- `description`: "Enable Coming Soon mode to block non-admin traffic"

### 3. Deploy Server Changes

The server code has been updated to use the database for Coming Soon mode persistence.

**If running locally:**
- Restart your server: `npm run dev` (in the server directory)

**If deployed on Render:**
- Render will auto-deploy when you push to GitHub
- Or manually trigger a deploy from the Render dashboard

### 4. Test the Feature

1. Sign in to your admin dashboard
2. Go to Settings page
3. Toggle Coming Soon mode ON
4. Open an incognito window and visit your site - should see Coming Soon page
5. Restart your server (or wait for Render to restart after 8 hours)
6. Visit Settings page again - Coming Soon mode should still be ON ✅

## What Changed:

### Database:
- ✅ New `system_settings` table stores configuration that persists across restarts
- ✅ Initial value set to `false` (site is public by default)

### Server:
- ✅ `runtimeConfig.ts` now reads/writes from database (with 5-second cache)
- ✅ `admin.ts` routes updated to async operations
- ✅ `comingSoon.ts` middleware updated to await database calls

### Client:
- ✅ UI toggle properly updates state after server response
- ✅ Status badge clarified ("Visitors Blocked" vs "Site Public")
- ✅ Description notes that setting persists across restarts

## Rollback (if needed):

```sql
DROP TABLE IF EXISTS system_settings CASCADE;
DROP FUNCTION IF EXISTS update_system_settings_timestamp CASCADE;
```

