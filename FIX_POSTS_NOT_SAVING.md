# Fix: Posts Not Saving to Supabase

## Problem
Posts are not saving because **user profiles don't exist** in the `profiles` table. When a user signs up through Supabase Auth, they get an account in `auth.users`, but no corresponding profile is created in `public.profiles`. 

When trying to create a post, the server requires the user's `author_id` to exist in the `profiles` table, causing the save to fail.

## Solution
Run the SQL script to create an automatic trigger that creates profiles whenever users sign up.

### Steps:

1. **Go to Supabase Dashboard**
   - Visit https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Run the Migration**
   - Copy the contents of `server/migrations/create_profile_trigger.sql`
   - Paste into the SQL editor
   - Click "Run" or press `Cmd+Enter`

4. **Verify**
   - The script will:
     - ✅ Create a function `handle_new_user()`
     - ✅ Create a trigger on `auth.users` that fires after INSERT
     - ✅ Create profiles for any existing users that don't have one

5. **Test**
   - Sign up a new user (or use existing user if profiles were created)
   - Try creating a post
   - It should save successfully! 🎉

## What the Trigger Does

```sql
-- When a new user is created in auth.users
INSERT INTO auth.users (...) 

-- This trigger automatically fires:
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user()

-- Which creates a profile:
INSERT INTO profiles (id, display_name, role, ...)
VALUES (user.id, user.email, 'user', ...)
```

## Alternative: Manual Profile Creation

If you don't want to use the trigger, you can manually create profiles for users via the Supabase dashboard:

1. Go to "Authentication" → "Users"
2. Copy the user's UUID
3. Go to "Table Editor" → "profiles"
4. Click "Insert row"
5. Add:
   - `id`: (paste the user UUID)
   - `display_name`: (user's name or email)
   - `role`: `user`
6. Save

## Verification

After running the script, check that profiles exist:

```sql
-- In Supabase SQL Editor:
SELECT 
  u.id,
  u.email,
  p.display_name,
  p.role
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id;
```

All users should have matching profiles!

