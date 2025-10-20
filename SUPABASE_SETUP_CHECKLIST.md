# ☑️ Supabase Setup Checklist

## The Problem

Having a Supabase project is **NOT enough**! Your local code might be perfect, but if Supabase itself isn't properly configured, the admin client will fail.

Common symptoms:
- ❌ "Supabase admin not configured" (even with correct env vars)
- ❌ "Table does not exist" errors
- ❌ "Permission denied" errors
- ❌ Profile creation fails
- ❌ Authentication works but queries fail

## What Needs to Be Set Up in Supabase

### ✅ Checklist

Use this checklist to verify your Supabase project is fully configured:

#### 1. Project Created ✓
- [ ] Project exists at https://supabase.com/dashboard
- [ ] Project is **not paused** (free tier projects pause after inactivity)
- [ ] You can access the dashboard

#### 2. API Keys Obtained ✓
- [ ] **Project URL** copied (Settings → API)
- [ ] **anon** (public) key copied (Settings → API)
- [ ] **service_role** (secret) key copied (Settings → API)
- [ ] Keys added to `server/.env` file

#### 3. Database Extensions Enabled ✓
Required extensions:
- [ ] `uuid-ossp` extension enabled
- [ ] `pgcrypto` extension enabled

**How to check:**
```sql
-- In Supabase SQL Editor, run:
SELECT * FROM pg_extension WHERE extname IN ('uuid-ossp', 'pgcrypto');
```

Should return 2 rows.

#### 4. Database Schema Created ✓
Required tables:
- [ ] `profiles` table exists
- [ ] `labels` table exists
- [ ] `posts` table exists
- [ ] `post_labels` table exists
- [ ] `images` table exists

**How to check:**
```sql
-- In Supabase SQL Editor, run:
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'labels', 'posts', 'post_labels', 'images');
```

Should return 5 rows.

#### 5. Database Functions Created ✓
Required functions:
- [ ] `is_admin()` function exists
- [ ] `update_updated_at()` function exists
- [ ] `generate_post_slug()` function exists
- [ ] `generate_label_slug()` function exists

**How to check:**
```sql
-- In Supabase SQL Editor, run:
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('is_admin', 'update_updated_at', 'generate_post_slug');
```

Should return 3+ rows.

#### 6. Row Level Security (RLS) Policies Created ✓
- [ ] RLS enabled on all tables
- [ ] Policies created for `profiles` table
- [ ] Policies created for `labels` table
- [ ] Policies created for `posts` table
- [ ] Policies created for `post_labels` table
- [ ] Policies created for `images` table

**How to check:**
```sql
-- In Supabase SQL Editor, run:
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public';
```

Should return 15+ policies.

#### 7. Storage Bucket Created ✓
- [ ] `post-images` bucket exists
- [ ] Bucket is set to **public**
- [ ] File size limit configured (10 MB recommended)
- [ ] Allowed MIME types configured (image/jpeg, image/png, image/webp, image/gif)

**How to check:**
- Go to **Storage** in Supabase Dashboard
- Look for `post-images` bucket
- Click on it and verify settings

#### 8. Storage Policies Created ✓
- [ ] Public read access policy exists
- [ ] Authenticated upload policy exists
- [ ] User update policy exists
- [ ] User delete policy exists

**How to check:**
```sql
-- In Supabase SQL Editor, run:
SELECT policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects';
```

Should return 4+ policies for the `post-images` bucket.

#### 9. Auth Configuration ✓
- [ ] Email confirmation enabled/disabled (as per your preference)
- [ ] Email templates configured (optional)
- [ ] Auth providers enabled (Email + Password at minimum)

**How to check:**
- Go to **Authentication** → **Providers**
- Verify Email provider is enabled

#### 10. At Least One User Exists ✓
- [ ] Test user created in Authentication → Users
- [ ] User's email is confirmed (if email confirmation enabled)
- [ ] User has a profile in the `profiles` table

**How to check:**
```sql
-- In Supabase SQL Editor, run:
SELECT p.id, p.display_name, p.role, u.email 
FROM profiles p 
JOIN auth.users u ON p.id = u.id;
```

Should return at least 1 row.

#### 11. Admin User Configured ✓
- [ ] At least one user has `role = 'admin'` in `profiles` table

**How to check:**
```sql
-- In Supabase SQL Editor, run:
SELECT id, display_name, role 
FROM profiles 
WHERE role = 'admin';
```

Should return at least 1 row.

**How to create admin:**
```sql
-- Update existing user to admin:
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'your@email.com';

-- Or if using user ID:
UPDATE profiles 
SET role = 'admin' 
WHERE id = 'user-uuid-here';
```

---

## Quick Setup Methods

### Method 1: Automated Setup (PowerShell - Recommended for Windows)

```powershell
cd storytelling-website
.\scripts\supa_bootstrap_simple.ps1
```

This will:
1. Create storage bucket
2. Show you which SQL files to run manually

Then go to **Supabase Dashboard → SQL Editor** and run:
1. `supabase/sql/01_schema.sql`
2. `supabase/sql/02_routines.sql`
3. `supabase/sql/03_policies.sql`
4. `supabase/sql/04_seed.sql` (optional - sample data)
5. `supabase/sql/05_storage_policies.sql`

### Method 2: Manual Setup (Copy-Paste SQL)

1. Go to your Supabase Dashboard
2. Click **SQL Editor**
3. Click **New Query**
4. Copy entire content of `supabase/sql/01_schema.sql` and paste
5. Click **RUN**
6. Repeat for files 02, 03, 04, 05 in order

### Method 3: Bash Script (Linux/Mac)

```bash
cd storytelling-website
./scripts/supa_bootstrap.sh
```

Requires `psql` installed.

---

## Verification Steps

### Step 1: Run Local Diagnostic

```bash
cd server
npm run debug:supabase
```

Look for:
```
✅ SUPABASE_URL: Set
✅ SUPABASE_SERVICE_ROLE_KEY: Set
✅ Admin client created successfully
✅ Query successful!
```

### Step 2: Test Database Connection

```bash
curl http://localhost:5000/api/auth/db-ping
```

Expected response:
```json
{
  "ok": true,
  "message": "Database connection successful",
  "timestamp": "2024-..."
}
```

### Step 3: Verify Tables in Supabase

Go to **Supabase Dashboard → Table Editor**

You should see:
- ✅ profiles
- ✅ labels
- ✅ posts
- ✅ post_labels
- ✅ images

### Step 4: Verify Storage Bucket

Go to **Supabase Dashboard → Storage**

You should see:
- ✅ post-images bucket (public)

### Step 5: Test Profile Creation

Try signing up a test user in your app. Then check:

```sql
SELECT * FROM profiles;
```

Should show the new user with `role = 'user'`.

---

## Common Issues

### Issue 1: "Table does not exist"

**Symptom:**
```
relation "profiles" does not exist
```

**Cause:** Database schema not applied

**Fix:**
1. Go to Supabase SQL Editor
2. Run `supabase/sql/01_schema.sql`
3. Verify tables exist in Table Editor

### Issue 2: "Permission denied for table"

**Symptom:**
```
permission denied for table profiles
```

**Cause:** RLS policies not applied or incorrect

**Fix:**
1. Run `supabase/sql/03_policies.sql` in SQL Editor
2. Verify policies exist:
   ```sql
   SELECT * FROM pg_policies WHERE schemaname = 'public';
   ```

### Issue 3: "Function is_admin does not exist"

**Symptom:**
```
function is_admin() does not exist
```

**Cause:** Database functions not created

**Fix:**
1. Run `supabase/sql/02_routines.sql` in SQL Editor
2. Verify function exists:
   ```sql
   SELECT routine_name FROM information_schema.routines WHERE routine_name = 'is_admin';
   ```

### Issue 4: Project is Paused

**Symptom:**
- Connection timeout
- 502 Bad Gateway errors

**Cause:** Free tier projects pause after 1 week of inactivity

**Fix:**
1. Go to Supabase Dashboard
2. Click **Restore** button if project is paused
3. Wait 2-3 minutes for project to wake up

### Issue 5: Storage Bucket Missing

**Symptom:**
```
Bucket not found: post-images
```

**Cause:** Storage bucket not created

**Fix:**
1. Go to **Storage** in dashboard
2. Click **New bucket**
3. Name: `post-images`
4. Public: ✓ (checked)
5. Save

### Issue 6: Service Role Key Incorrect

**Symptom:**
```
Invalid API key
```

**Cause:** Wrong key or typo

**Fix:**
1. Go to **Settings → API**
2. Copy **service_role** key (the longer one)
3. Make sure you're copying the **service_role** NOT the **anon** key
4. Update `SUPABASE_SERVICE_ROLE_KEY` in `.env`
5. Restart server

---

## SQL Scripts Execution Order

**IMPORTANT:** Run these in order!

1. **01_schema.sql** - Creates tables
   - Creates profiles, labels, posts, post_labels, images tables
   - Adds indexes for performance
   - Enables extensions

2. **02_routines.sql** - Creates functions and triggers
   - `is_admin()` function (required by policies)
   - `update_updated_at()` function
   - Slug generation functions
   - Auto-update triggers

3. **03_policies.sql** - Sets up RLS policies
   - Enables RLS on all tables
   - Creates access policies
   - **Requires `is_admin()` from step 2**

4. **04_seed.sql** (optional) - Sample data
   - Adds sample labels
   - Only run for development/testing

5. **05_storage_policies.sql** - Storage access policies
   - Sets up bucket access rules
   - **Requires `is_admin()` from step 2**

---

## Quick SQL Verification Script

Run this in Supabase SQL Editor to check everything at once:

```sql
-- Check tables exist
SELECT 'Tables' as check_type, COUNT(*) as count
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'labels', 'posts', 'post_labels', 'images')

UNION ALL

-- Check functions exist
SELECT 'Functions', COUNT(*)
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('is_admin', 'update_updated_at', 'generate_post_slug')

UNION ALL

-- Check RLS enabled
SELECT 'RLS Enabled', COUNT(*)
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = true

UNION ALL

-- Check policies exist
SELECT 'Policies', COUNT(*)
FROM pg_policies 
WHERE schemaname = 'public'

UNION ALL

-- Check profiles exist
SELECT 'Profiles', COUNT(*)
FROM profiles

UNION ALL

-- Check admin users exist
SELECT 'Admin Users', COUNT(*)
FROM profiles 
WHERE role = 'admin';
```

**Expected results:**
```
check_type     | count
---------------+-------
Tables         | 5
Functions      | 3+
RLS Enabled    | 5
Policies       | 15+
Profiles       | 1+
Admin Users    | 1+
```

---

## Next Steps After Setup

1. ✅ Run diagnostic script: `npm run debug:supabase`
2. ✅ Verify all checks pass
3. ✅ Create admin user or update existing user to admin
4. ✅ Test authentication in your app
5. ✅ Try creating a post

---

## Getting Help

If you've completed this checklist and still have issues:

1. **Run the verification SQL** (above) and share output
2. **Run diagnostic script**: `npm run debug:supabase` and share output
3. **Check project is not paused** in Supabase dashboard
4. **Try the test connection**: `curl http://localhost:5000/api/auth/db-ping`

## Summary

**Just having a Supabase project is NOT enough!**

You need:
1. ✅ Project active (not paused)
2. ✅ Database schema (tables, functions, indexes)
3. ✅ RLS policies (15+ policies)
4. ✅ Storage bucket (`post-images`)
5. ✅ Storage policies (4 policies)
6. ✅ At least one admin user

**Quickest setup:**
1. Run `.\scripts\supa_bootstrap_simple.ps1`
2. Copy-paste SQL files in Supabase SQL Editor (in order!)
3. Create admin user
4. Run `npm run debug:supabase` to verify

🎉 Then everything should work!

