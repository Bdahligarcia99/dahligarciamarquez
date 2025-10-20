# Debugging Supabase Configuration

This guide helps you diagnose and fix Supabase configuration issues, especially the "Supabase admin not configured" error.

## Quick Diagnosis

### Step 1: Run the Debug Script

```bash
cd server
node debug-supabase-config.js
```

This comprehensive script will:
- ✅ Check for .env files
- ✅ Validate environment variables
- ✅ Test URL and key formats
- ✅ Attempt to create Supabase client
- ✅ Test database connection
- ✅ Verify authentication works
- ✅ Provide specific error messages and solutions

### Step 2: Enable Debug Mode

Add this to your server `.env` file:

```bash
DEBUG_SUPABASE=true
```

Then restart your server. You'll see detailed logs like:

```
🔍 [SUPABASE ADMIN DEBUG]
  URL: ✅ Set (https://evlifkevmsstofbyv...)
  Service Key: ✅ Set (eyJhbGciOiJIUzI1NiI...)
  Key length: 284 characters
  Key format: ✅ JWT format
✅ Supabase Admin is configured
```

## Common Issues & Solutions

### Issue 1: "Supabase admin not configured"

**Symptoms:**
```
⚠️  Supabase Admin NOT configured!
   Missing: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

**Solution:**

1. **Check if .env file exists:**
   ```bash
   cd server
   ls -la .env
   ```

2. **If missing, create it:**
   ```bash
   cd server
   cp env.example .env
   ```

3. **Add your Supabase credentials:**
   Edit `server/.env` and add:
   ```bash
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
   SUPABASE_ANON_KEY=eyJhbGc...
   ```

4. **Find your credentials:**
   - Go to https://supabase.com/dashboard
   - Select your project
   - Click **Settings** → **API**
   - Copy **Project URL** → `SUPABASE_URL`
   - Copy **service_role** secret key → `SUPABASE_SERVICE_ROLE_KEY`
   - Copy **anon** public key → `SUPABASE_ANON_KEY`

5. **Restart your server:**
   ```bash
   # Stop the server (Ctrl+C)
   # Start it again
   npm run dev
   ```

### Issue 2: Variables Set But Still Not Working

**Symptoms:**
- .env file has values
- Debug script shows "NOT SET"
- Server logs show missing variables

**Possible Causes:**

1. **Wrong .env location:**
   - Server .env should be at: `server/.env`
   - Client .env should be at: `client/.env`
   - Make sure they're not in the root directory

2. **Environment not loaded:**
   - Check if server imports 'dotenv/config'
   - Verify it's imported at the top of the entry file

3. **Cached environment:**
   - Completely stop and restart the server
   - Don't use hot reload for env changes

4. **Whitespace issues:**
   - Remove any spaces around the `=` sign
   - Wrong: `SUPABASE_URL = https://...`
   - Correct: `SUPABASE_URL=https://...`

5. **Comments in wrong place:**
   ```bash
   # Wrong - comment after value
   SUPABASE_URL=https://... # My URL
   
   # Correct - comment on separate line
   # My URL
   SUPABASE_URL=https://...
   ```

### Issue 3: "Invalid or expired token"

**Symptoms:**
```
❌ [requireSupabaseAdmin] JWT verification failed
   Error: Invalid JWT
```

**Solutions:**

1. **Check service role key:**
   - Make sure you copied the **service_role** key, not the **anon** key
   - Service role key is longer (usually 200+ characters)

2. **Verify key format:**
   - Should start with `eyJ`
   - Should be all one line (no line breaks)

3. **Check for typos:**
   - Copy-paste the key again from Supabase dashboard
   - Don't manually type it

### Issue 4: "User profile not found"

**Symptoms:**
```
❌ [requireSupabaseAdmin] Profile fetch failed
   Error: relation "profiles" does not exist
```

**Solutions:**

1. **Run database migrations:**
   ```bash
   # Apply all Supabase SQL files
   psql DATABASE_URL < supabase/sql/01_schema.sql
   psql DATABASE_URL < supabase/sql/02_routines.sql
   psql DATABASE_URL < supabase/sql/03_policies.sql
   ```

2. **Or use Supabase Dashboard:**
   - Go to SQL Editor in Supabase dashboard
   - Run each .sql file in order

3. **Check if profile exists:**
   ```sql
   SELECT * FROM profiles WHERE id = 'your-user-id';
   ```

### Issue 5: "Admin access required"

**Symptoms:**
```
❌ [requireSupabaseAdmin] User is not admin
   Email: user@example.com
   Role: user
```

**Solution:**

The user exists but doesn't have admin role. Update it:

```sql
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'user@example.com';
```

Or using Supabase Dashboard:
1. Go to **Table Editor**
2. Open **profiles** table
3. Find your user
4. Edit the **role** column to `admin`

## Debugging Tools Reference

### 1. Diagnostic Script

**File:** `server/debug-supabase-config.js`

**Run:**
```bash
cd server
node debug-supabase-config.js
```

**What it checks:**
- ✅ .env file existence
- ✅ Environment variable values
- ✅ URL and key formats
- ✅ Client creation
- ✅ Database connectivity
- ✅ Authentication functionality

### 2. Debug Mode

**Enable:**
Add to `server/.env`:
```bash
DEBUG_SUPABASE=true
```

**What it logs:**
- Configuration loading
- Client creation
- Every middleware call
- JWT verification steps
- Profile fetching
- Role checking
- All errors with stack traces

**Where to see logs:**
- Server console output
- Terminal where you ran `npm run dev`

### 3. Test Endpoints

**Check server health:**
```bash
curl http://localhost:5000/api/auth/db-ping
```

**Expected response:**
```json
{
  "ok": true,
  "message": "Database connection successful",
  "timestamp": "2024-..."
}
```

## Debugging Workflow

Follow this sequence to diagnose issues:

```
1. Run diagnostic script
   └─ Shows exactly what's missing
   
2. Fix any missing variables
   └─ Create/update .env file
   
3. Enable DEBUG_SUPABASE=true
   └─ Restart server
   
4. Try your operation again
   └─ Watch server logs
   
5. Look for first error in logs
   └─ Each step is logged
   
6. Fix that specific issue
   └─ Repeat from step 3
```

## Log Examples

### Good Configuration

```
🔍 [SUPABASE ADMIN DEBUG]
  URL: ✅ Set (https://evlifkevmsstofbyv...)
  Service Key: ✅ Set (eyJhbGciOiJIUzI1NiI...)
  Key length: 284 characters
  Key format: ✅ JWT format
✅ Supabase Admin is configured

🔒 [requireSupabaseAdmin] Processing request: POST /api/admin/posts
✅ [requireSupabaseAdmin] Supabase admin client available
🔍 [requireSupabaseAdmin] Verifying JWT with Supabase...
✅ [requireSupabaseAdmin] JWT verified, user: user@example.com
🔍 [requireSupabaseAdmin] Fetching user profile...
✅ [requireSupabaseAdmin] Profile found, role: admin
✅ [requireSupabaseAdmin] Authorization successful for: user@example.com
```

### Bad Configuration

```
⚠️  Supabase Admin NOT configured!
   Missing: SUPABASE_SERVICE_ROLE_KEY
   Run: node server/debug-supabase-config.js for detailed diagnostics

🔒 [requireSupabaseAdmin] Processing request: POST /api/admin/posts
❌ [requireSupabaseAdmin] Supabase admin client is NULL!
   This means SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set
   Check your .env file in the server directory
```

### Wrong Role

```
✅ [requireSupabaseAdmin] Profile found, role: user
❌ [requireSupabaseAdmin] User is not admin
   Email: user@example.com
   Role: user
```

## Environment Variable Checklist

Use this checklist to verify your setup:

### Server (.env in `server/` directory)

- [ ] `SUPABASE_URL` - Project URL from Supabase dashboard
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Service role key (starts with `eyJ`)
- [ ] `SUPABASE_ANON_KEY` - Anon key (optional but recommended)
- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] File is named exactly `.env` (not `.env.txt`)
- [ ] File is in `server/` directory (not root)
- [ ] No spaces around `=` signs
- [ ] No quotes around values (unless needed)

### Client (.env in `client/` directory)

- [ ] `VITE_SUPABASE_URL` - Same as server's SUPABASE_URL
- [ ] `VITE_SUPABASE_ANON_KEY` - Same as server's SUPABASE_ANON_KEY
- [ ] File is named exactly `.env` (not `.env.txt`)
- [ ] File is in `client/` directory (not root)

## Getting Help

If you're still stuck after trying these steps:

1. **Run the diagnostic script** and save the output:
   ```bash
   node server/debug-supabase-config.js > debug-output.txt
   ```

2. **Enable debug mode** and capture server logs:
   ```bash
   DEBUG_SUPABASE=true npm run dev 2>&1 | tee server-logs.txt
   ```

3. **Check the logs** for the first error that appears

4. **Search for the specific error message** in this document

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase API Settings](https://supabase.com/dashboard/project/_/settings/api)
- [Environment Variables Guide](https://vitejs.dev/guide/env-and-mode.html)
- [Node.js dotenv Package](https://github.com/motdotla/dotenv)

## Quick Commands Reference

```bash
# Check if .env exists
ls -la server/.env

# View .env (without showing secrets)
cat server/.env | sed 's/=.*/=***/'

# Run diagnostic
node server/debug-supabase-config.js

# Test database connection
curl http://localhost:5000/api/auth/db-ping

# Check server logs with debug
DEBUG_SUPABASE=true npm run dev

# Find Supabase mentions in logs
npm run dev 2>&1 | grep -i supabase
```

