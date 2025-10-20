# Authentication System Overview

This document provides a comprehensive overview of the authentication and authorization system in the storytelling website.

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Account Creation (Sign Up)](#account-creation-sign-up)
3. [Signing In](#signing-in)
4. [User Roles & Permissions](#user-roles--permissions)
5. [Frontend Authentication](#frontend-authentication)
6. [Backend Authorization](#backend-authorization)
7. [Database Schema](#database-schema)
8. [Row Level Security (RLS)](#row-level-security-rls)
9. [Current Issues & Workarounds](#current-issues--workarounds)

---

## System Architecture

The authentication system is built on **Supabase** (PostgreSQL + Auth) and uses:
- **JWT tokens** for session management
- **Row Level Security (RLS)** for database access control
- **Role-based access control** (user vs admin)
- **Client-side routing protection** with React Router
- **Server-side middleware** for API endpoint protection

### Technology Stack
- **Frontend**: React, React Router, Supabase JS Client
- **Backend**: Node.js/Express with TypeScript
- **Database**: PostgreSQL (via Supabase)
- **Auth Provider**: Supabase Auth

---

## Account Creation (Sign Up)

### Frontend Flow (`client/src/components/auth/SignUp.tsx`)

1. **User Input Collection**:
   - Email address (required)
   - Password (min 6 characters)
   - Confirm password (must match)
   - Display name (optional)

2. **Validation**:
   ```javascript
   // Password confirmation check
   if (password !== confirmPassword) {
     setError('Passwords do not match')
     return
   }
   
   // Password strength check
   if (password.length < 6) {
     setError('Password must be at least 6 characters long')
     return
   }
   ```

3. **Sign Up Request**:
   ```javascript
   const { error } = await signUp(email, password, displayName)
   ```

### Authentication Hook (`client/src/hooks/useAuth.tsx`)

The `signUp` function calls Supabase:
```javascript
const signUp = async (email: string, password: string, displayName?: string) => {
  const client = getSupabaseClient()
  
  const { error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName
      }
    }
  })
  return { error }
}
```

### Profile Creation

After signup, a profile is automatically created via the auth state change listener:

```javascript
// Listen for auth changes
client.auth.onAuthStateChange(async (event, session) => {
  if (session?.user) {
    let userProfile = await fetchProfile(session.user.id)
    if (!userProfile) {
      // Create profile for new user
      userProfile = await createProfile(session.user)
    }
  }
})
```

Profile creation inserts into the `profiles` table:
```javascript
const createProfile = async (user: User) => {
  const { data, error } = await client
    .from('profiles')
    .insert({
      id: user.id,
      display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User',
      role: 'user'  // Default role
    })
    .select()
    .single()
}
```

**Note**: New users are assigned the `'user'` role by default. Admin status must be granted manually in the database.

---

## Signing In

### Frontend Flow (`client/src/components/auth/SignIn.tsx`)

1. **User Input**:
   - Email address
   - Password

2. **Sign In Request**:
   ```javascript
   const result = await signIn(email, password)
   ```

3. **Auth State Change**:
   - On success, the auth state listener detects the new session
   - User is redirected to the intended page (or home)
   - Loading overlay shows "Signing you in..."

### Authentication Process

```javascript
const signIn = async (email: string, password: string) => {
  const client = getSupabaseClient()
  
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password
  })
  
  return { error }
}
```

### Session Management

- **Storage**: Sessions are stored in browser localStorage with keys starting with `sb-`
- **Token**: JWT access token is stored in the session object
- **Auto-refresh**: Supabase client automatically refreshes tokens
- **Persistence**: Sessions persist across browser sessions

---

## User Roles & Permissions

### Role Types

The system supports two roles defined in the `profiles` table:

1. **`user`** (default)
   - Can create and manage their own posts
   - Can upload and manage their own images
   - Can view their own profile
   - **Cannot** access admin dashboard
   - **Cannot** manage other users' content

2. **`admin`**
   - Full access to admin dashboard (`/dashboard/*`)
   - Can create, edit, and delete any post
   - Can manage labels/tags
   - Can view and manage all images
   - Can manage compression settings
   - Can view all user profiles

### Role Assignment

**Default**: All new signups receive the `'user'` role

**Promoting to Admin**: Currently requires manual database update:
```sql
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'user@example.com';
```

### Temporary Workaround

There's a hardcoded admin check for development:
```javascript
// TEMPORARY WORKAROUND in useAuth.tsx (lines 140-152)
if (session.user.email === 'dagama02@gmail.com') {
  const hardcodedProfile = {
    id: session.user.id,
    display_name: 'dagama02',
    role: 'admin',
    // ...
  }
  setProfile(hardcodedProfile)
}
```

---

## Frontend Authentication

### Auth Provider (`client/src/hooks/useAuth.tsx`)

The `AuthProvider` wraps the application and provides:
- `user`: Current authenticated Supabase user object
- `profile`: User profile from database (includes role)
- `session`: Current session with JWT token
- `loading`: Loading state during auth checks
- Functions: `signIn`, `signUp`, `signOut`, `resetPassword`, `refreshProfile`

### Protected Routes (`client/src/components/auth/ProtectedRoute.tsx`)

Routes can be protected with role requirements:

```jsx
// Require authentication
<ProtectedRoute>
  <ProfileSettings />
</ProtectedRoute>

// Require admin role
<ProtectedRoute requireRole="admin">
  <Dashboard />
</ProtectedRoute>
```

**Behavior**:
- Shows loading spinner while checking auth
- Redirects to `/auth/signin` if not authenticated
- Shows "Access Denied" if user lacks required role
- Renders children if authorized

### Conditional Auth Provider (`client/src/components/ConditionalAuthProvider.jsx`)

Wraps the app and only provides authentication if Supabase is configured:
```javascript
if (!isSupabaseConfigured) {
  return <>{children}</>  // Skip auth provider
}
return <AuthProvider>{children}</AuthProvider>
```

### Route Structure (`client/src/App.jsx`)

```
/                           - Home (public)
/blog                       - Blog list (public)
/blog/:slug                 - Blog post (public)
/stories                    - Stories list (public)
/stories/:slug              - Story detail (public)
/auth/signin                - Sign in page
/auth/signup                - Sign up page
/auth/forgot-password       - Password reset
/profile/settings           - Profile settings (requires: user)
/dashboard/*                - Admin dashboard (requires: admin)
/posts/:id/preview          - Post preview (requires: admin)
```

---

## Backend Authorization

### Middleware Overview

The server has multiple middleware layers for different auth scenarios:

1. **`requireUser`** - Verify any authenticated user
2. **`requireAdmin`** - Verify admin role via Supabase
3. **`requireSupabaseAdmin`** - Verify admin role (Supabase-based)
4. **`requireAdminOrUser`** - Accept either admin token or user JWT
5. **Token-based admin** - Legacy admin token system

### 1. Require User (`server/middleware/requireUser.ts`)

Verifies JWT and fetches user profile:

```typescript
export async function requireUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' })
  }
  
  const token = authHeader.slice(7)
  
  // Verify JWT token with Supabase
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  
  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
  
  // Get user profile from database
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  
  // Attach user info to request
  req.user = {
    id: user.id,
    email: user.email,
    role: profile?.role || 'user'
  }
  
  next()
}
```

### 2. Require Admin (`server/middleware/requireAdmin.ts`)

Verifies admin role after user authentication:

```typescript
export async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // First ensure user is authenticated
  requireUser(req, res, (error) => {
    if (error) return next(error)
    
    // Check if user has admin role
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }
    
    next()
  })
}
```

### 3. Require Supabase Admin (`server/src/middleware/requireSupabaseAdmin.ts`)

Similar to `requireAdmin` but with complete inline implementation:
- Verifies JWT token
- Fetches profile
- Checks for admin role
- Returns 403 if not admin

### 4. Admin or User (`server/src/middleware/requireAdminOrUser.ts`)

Supports both authentication methods:
```typescript
export function requireAdminOrUser(req: AdminOrUserRequest, res: Response, next: NextFunction) {
  // First try admin token (legacy)
  if (SERVER_ADMIN_TOKEN) {
    const token = extractToken(req)
    if (token === SERVER_ADMIN_TOKEN) {
      req.isAdmin = true
      return next()
    }
  }
  
  // Fall back to Supabase JWT verification
  // (same as requireUser logic)
}
```

### API Client (`client/src/lib/api.js`)

Automatically attaches JWT token to API requests:

```javascript
async function getSupabaseAuthHeaders() {
  const client = getSupabaseClient()
  if (!client) return {}
  
  try {
    const { data: { session } } = await client.auth.getSession()
    if (session?.access_token) {
      return {
        'Authorization': `Bearer ${session.access_token}`
      }
    }
  } catch (error) {
    console.warn('Failed to get auth headers:', error)
  }
  return {}
}

export async function api(path, init) {
  const authHeaders = await getSupabaseAuthHeaders()
  const headers = {
    'Content-Type': 'application/json',
    ...authHeaders,
    ...init?.headers
  }
  // ... fetch logic
}
```

---

## Database Schema

### Profiles Table (`supabase/sql/01_schema.sql`)

```sql
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Key Points**:
- `id` references Supabase `auth.users` table (automatic by Supabase)
- `role` constrained to `'user'` or `'admin'`
- Cascade delete if auth user is deleted
- Timestamps auto-managed by triggers

### Related Tables

1. **`posts`** - Blog posts with `author_id` → `profiles(id)`
2. **`images`** - Uploaded images with `owner_id` → `profiles(id)`
3. **`labels`** - Tags/categories (admin-managed)
4. **`post_labels`** - Junction table for post-label relationships

All tables have RLS policies enforcing role-based access.

---

## Row Level Security (RLS)

### Overview (`supabase/sql/03_policies.sql`)

RLS policies enforce fine-grained access control at the database level.

### Helper Function

```sql
CREATE OR REPLACE FUNCTION is_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Profiles Policies

```sql
-- Users can view and update their own profile; admins can view/update all
CREATE POLICY "profiles_select_own_or_admin" ON profiles
  FOR SELECT USING (
    id = auth.uid() OR is_admin()
  );

CREATE POLICY "profiles_update_own_or_admin" ON profiles
  FOR UPDATE USING (
    id = auth.uid() OR is_admin()
  );

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (
    id = auth.uid()
  );
```

### Posts Policies

```sql
-- Published posts are public; drafts only visible to author/admin
CREATE POLICY "posts_select_published_or_own" ON posts
  FOR SELECT USING (
    status = 'published' OR 
    author_id = auth.uid() OR 
    is_admin()
  );

-- Only author or admin can edit
CREATE POLICY "posts_update_own_or_admin" ON posts
  FOR UPDATE USING (
    author_id = auth.uid() OR is_admin()
  );
```

### Labels Policies

```sql
-- Public read access; only admins can modify
CREATE POLICY "labels_select_all" ON labels
  FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "labels_insert_admin" ON labels
  FOR INSERT WITH CHECK (is_admin());
```

### Images Policies

```sql
-- Public images visible to all; private images only to owner/admin
CREATE POLICY "images_select_public_or_own" ON images
  FOR SELECT USING (
    is_public = true OR 
    owner_id = auth.uid() OR 
    is_admin()
  );

CREATE POLICY "images_update_own_or_admin" ON images
  FOR UPDATE USING (
    owner_id = auth.uid() OR is_admin()
  );
```

---

## Current Issues & Workarounds

### 1. Environment Variable Loading

**Issue**: React app environment variables aren't loading properly from `.env` files.

**Workaround** (`client/src/lib/supabase.ts`):
```javascript
// Force correct values since env loading has wrong placeholder values
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL === 'https://your-project.supabase.co' 
  ? 'https://evlifkevmsstofbyvgjh.supabase.co' 
  : import.meta.env.VITE_SUPABASE_URL

const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY?.length < 100)
  ? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' 
  : import.meta.env.VITE_SUPABASE_ANON_KEY
```

### 2. Hardcoded Admin User

**Issue**: Profile creation may fail due to RLS policies.

**Workaround** (`client/src/hooks/useAuth.tsx`):
```javascript
// TEMPORARY WORKAROUND: Hardcode admin for dagama02@gmail.com
if (session.user.email === 'dagama02@gmail.com') {
  const hardcodedProfile = {
    id: session.user.id,
    display_name: 'dagama02',
    role: 'admin',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
  setProfile(hardcodedProfile)
  return
}
```

### 3. Sign Out Timeout

**Issue**: Sign out API calls may hang.

**Workaround** (`client/src/hooks/useAuth.tsx`):
```javascript
const signOut = async () => {
  try {
    // Add timeout to prevent hanging
    const signOutPromise = client.auth.signOut()
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Sign out timeout')), 2000)
    )
    
    await Promise.race([signOutPromise, timeoutPromise])
  } catch (error) {
    console.warn('Supabase sign out failed, clearing local state:', error.message)
  }
  
  // Always clear local state
  setUser(null)
  setSession(null)
  setProfile(null)
  // Clear localStorage...
}
```

### 4. Initial Session Check Hang

**Issue**: `getSession()` may hang on initial load.

**Solution** (`client/src/hooks/useAuth.tsx`):
```javascript
// Skip initial session check - rely on auth state change listener
console.log('🔄 Skipping initial session check, relying on auth state listener')

// Set a backup timer to ensure loading doesn't hang forever
setTimeout(() => {
  if (!initialCheckDone) {
    console.log('⏰ No auth state change received, assuming no session')
    setLoading(false)
    setInitialCheckDone(true)
  }
}, 3000)
```

---

## Authentication Flow Diagrams

### Sign Up Flow
```
User fills form → SignUp component → useAuth.signUp() 
  → Supabase auth.signUp() → User created in auth.users
  → Auth state change listener triggered → fetchProfile() 
  → Profile not found → createProfile() → Insert into profiles table 
  → Profile created with role='user' → State updated → User authenticated
```

### Sign In Flow
```
User fills form → SignIn component → useAuth.signIn() 
  → Supabase auth.signInWithPassword() → Session created
  → Auth state change listener triggered → fetchProfile() 
  → Profile fetched → State updated → User redirected to intended page
```

### API Request Flow
```
Frontend component → api() function → getSupabaseAuthHeaders() 
  → Get session from Supabase → Extract access_token 
  → Add Authorization: Bearer <token> header → Fetch API endpoint
  
Backend receives request → requireUser/requireAdmin middleware 
  → Extract Bearer token → Verify with Supabase admin 
  → Fetch profile from database → Check role → Attach req.user 
  → Continue to route handler
```

### Role Check Flow
```
Database Query → RLS Policy Evaluated → Check auth.uid() 
  → Look up role in profiles table → Run is_admin() function 
  → Compare with policy conditions → Allow/Deny query
```

---

## Key Files Reference

### Frontend
- `client/src/lib/supabase.ts` - Supabase client configuration
- `client/src/hooks/useAuth.tsx` - Auth provider and hook
- `client/src/components/auth/SignIn.tsx` - Sign in component
- `client/src/components/auth/SignUp.tsx` - Sign up component
- `client/src/components/auth/ProtectedRoute.tsx` - Route protection
- `client/src/lib/api.js` - API client with auth headers
- `client/src/App.jsx` - Route definitions

### Backend
- `server/middleware/requireUser.ts` - User authentication middleware
- `server/middleware/requireAdmin.ts` - Admin authorization middleware
- `server/src/middleware/requireSupabaseAdmin.ts` - Supabase admin middleware
- `server/src/middleware/requireAdminOrUser.ts` - Flexible auth middleware
- `server/auth/supabaseAdmin.ts` - Supabase admin client

### Database
- `supabase/sql/01_schema.sql` - Table definitions
- `supabase/sql/02_routines.sql` - Functions and triggers
- `supabase/sql/03_policies.sql` - RLS policies
- `supabase/sql/06_user_management.sql` - User management

---

## Summary

The authentication system is **Supabase-based** with:
- ✅ JWT token authentication
- ✅ Role-based access control (user/admin)
- ✅ Row Level Security at database level
- ✅ Protected routes on frontend
- ✅ Middleware protection on backend
- ✅ Automatic profile creation on signup
- ⚠️ Some workarounds for environment variables and profile creation
- ⚠️ Hardcoded admin for development purposes

The system is functional but has some rough edges that should be smoothed out for production use.

