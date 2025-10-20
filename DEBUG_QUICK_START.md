# 🚀 Quick Start: Debug Supabase Configuration

Getting "Supabase admin not configured" errors? Follow these steps:

## Step 1: Run the Diagnostic (30 seconds)

```bash
cd server
npm run debug:supabase
```

This will show you **exactly** what's wrong. Look for ❌ marks.

## Step 2: Fix Missing Variables

If you see:
```
❌ SUPABASE_URL: NOT SET
❌ SUPABASE_SERVICE_ROLE_KEY: NOT SET
```

### Option A: Create .env file (if it doesn't exist)

```bash
cd server
cp env.example .env
```

Then edit `server/.env` and add your Supabase credentials.

### Option B: Add to existing .env file

Edit `server/.env` and make sure these lines exist:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Where to Get These Values:

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **Settings** (gear icon in sidebar)
4. Click **API**
5. Copy these values:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** (secret key) → `SUPABASE_SERVICE_ROLE_KEY`
   - **anon** (public key) → `SUPABASE_ANON_KEY`

## Step 3: Restart Server

```bash
# Stop the server (Ctrl+C)
npm run dev
```

## Step 4: Run Diagnostic Again

```bash
# In another terminal
cd server
npm run debug:supabase
```

You should now see ✅ marks!

## Enable Detailed Logging (Optional)

If issues persist, run with debug mode:

```bash
cd server
npm run dev:debug
```

This shows detailed logs for every authentication attempt.

## Common Issues

### "Variables look correct but still not working"

**Solution:** Completely stop and restart the server. Environment variables are only loaded on startup.

```bash
# Stop server (Ctrl+C)
# Start again
npm run dev
```

### ".env file exists but variables show as NOT SET"

**Check:**
1. File location: Should be at `server/.env` (NOT in root directory)
2. No spaces: `SUPABASE_URL=value` (NOT `SUPABASE_URL = value`)
3. No quotes: `SUPABASE_URL=https://...` (NOT `SUPABASE_URL="https://..."`)

### "Invalid or expired token" when making requests

**Check:**
1. You copied the **service_role** key (NOT the anon key)
2. The key is all on one line (no line breaks)
3. The key starts with `eyJ`

## Need More Help?

See the full guide: [DEBUGGING_SUPABASE.md](./DEBUGGING_SUPABASE.md)

## Quick Commands

```bash
# Diagnose configuration
npm run debug:supabase

# Run with debug logging
npm run dev:debug

# Check if .env exists
ls -la server/.env

# Test database connection
curl http://localhost:5000/api/auth/db-ping
```

