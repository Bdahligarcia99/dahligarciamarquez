# Supabase Keys: Why Two Different Systems?

## The Two Keys

Your project uses **two different Supabase keys** for different purposes:

### 1. SUPABASE_ANON_KEY (Public Key) 🔓
- **Location in code**: `config.ts` → exported in `config.supabase.anonKey`
- **Used by**: Client-facing code, public API endpoints
- **Permissions**: Limited (read public data, user operations)
- **Safe to expose**: Yes (it's called "anon" for a reason)
- **Purpose**: Regular application usage

### 2. SUPABASE_SERVICE_ROLE_KEY (Admin Key) 🔐
- **Location in code**: `auth/supabaseAdmin.ts` → used by `getSupabaseAdmin()`
- **Used by**: Server middleware, admin operations
- **Permissions**: Full (bypass RLS, admin operations, user management)
- **Safe to expose**: NO! Keep secret!
- **Purpose**: Backend privileged operations

## Why config.ts Doesn't Include SERVICE_ROLE_KEY

### Security by Separation

```javascript
// ❌ BAD: If config.ts included service_role_key
export const config = {
  supabase: {
    url: '...',
    anonKey: '...',
    serviceRoleKey: '...'  // Too accessible!
  }
}

// Anyone importing config could access admin key:
import { config } from './config.ts'
console.log(config.supabase.serviceRoleKey)  // Dangerous!
```

```javascript
// ✅ GOOD: Current design
// config.ts only has public keys
export const config = {
  supabase: {
    url: '...',
    anonKey: '...'  // Safe to export
  }
}

// Service role key is isolated in supabaseAdmin.ts
const key = process.env.SUPABASE_SERVICE_ROLE_KEY  // Only accessible here
```

### Principle of Least Privilege

```
┌─────────────────────────────────────────────┐
│  config.ts                                  │
│  ↓                                          │
│  Exports config object                      │
│  ↓                                          │
│  Used by many files                         │
│  → Widely accessible                        │
│  → Only include safe values                 │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  auth/supabaseAdmin.ts                      │
│  ↓                                          │
│  Reads service_role_key directly            │
│  ↓                                          │
│  Creates admin client                       │
│  ↓                                          │
│  Used only by auth middleware               │
│  → Tightly controlled access                │
│  → Full admin permissions                   │
└─────────────────────────────────────────────┘
```

## How They Work Together

### Step 1: dotenv Loads BOTH Keys

When `config.ts` runs `import 'dotenv/config'`:

```javascript
// After dotenv runs, process.env has BOTH:
process.env.SUPABASE_URL = "https://..."
process.env.SUPABASE_ANON_KEY = "eyJ..."       // Public key
process.env.SUPABASE_SERVICE_ROLE_KEY = "eyJ..." // Admin key
```

### Step 2: config.ts Exports Only Public Key

```javascript
// config.ts
export const config = {
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY  // ← Only this one
  }
}
// SERVICE_ROLE_KEY is NOT exported!
```

### Step 3: supabaseAdmin.ts Reads Admin Key Directly

```javascript
// auth/supabaseAdmin.ts
// Doesn't import from config - reads directly from process.env
const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY  // ← Gets admin key

export function getSupabaseAdmin() {
  return createClient(url, key, { /* admin settings */ })
}
```

## Usage Patterns

### Public/Client Usage

```javascript
// Uses config.ts (anon key)
import { supabase } from './src/supabase.ts'

const { data } = await supabase
  .from('posts')
  .select('*')
  .eq('status', 'published')  // RLS policies apply
```

### Admin/Server Usage

```javascript
// Uses supabaseAdmin.ts (service role key)
import { getSupabaseAdmin } from './auth/supabaseAdmin.ts'

const admin = getSupabaseAdmin()
const { data } = await admin
  .from('posts')
  .select('*')  // Can see ALL posts, RLS bypassed
```

## The Flow Diagram

```
.env file contains BOTH keys
        ↓
  dotenv loads both
        ↓
  process.env has both
        ↓
    ┌───┴────────────────┐
    ↓                    ↓
config.ts          supabaseAdmin.ts
    ↓                    ↓
Exports           Exports
anon key          admin client
    ↓                    ↓
Used by           Used by
public code       middleware
    ↓                    ↓
Limited           Full
permissions       permissions
```

## Why This Design is Good

### 1. Security
- Admin key is only accessible in one file
- Can't accidentally use admin key in wrong place
- Reduces attack surface

### 2. Clarity
```javascript
// Clear intent:
import { config } from './config.ts'       // Public operations
import { getSupabaseAdmin } from './auth/supabaseAdmin.ts'  // Admin operations
```

### 3. Fail-Safe
```javascript
// If you try to use config for admin operations:
const client = createClient(config.supabase.url, config.supabase.anonKey)
// This will have LIMITED permissions - you won't accidentally expose admin powers
```

## Your .env File Should Have BOTH

```bash
# server/.env

# Public key (safe, used by config.ts)
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2bGlma2V2bXNzdG9mYnl2Z2poIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1MjY1NTksImV4cCI6MjA3MjEwMjU1OX0...

# Admin key (secret, used by supabaseAdmin.ts)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2bGlma2V2bXNzdG9mYnl2Z2poIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjUyNjU1OSwiZXhwIjoyMDcyMTAyNTU5fQ...

# URL (used by both)
SUPABASE_URL=https://evlifkevmsstofbyvgjh.supabase.co
```

## How to Verify Both Are Loaded

```bash
cd server
npm run debug:supabase
```

You should see:
```
✅ SUPABASE_URL: Set
✅ SUPABASE_ANON_KEY: Set (200+ characters)
✅ SUPABASE_SERVICE_ROLE_KEY: Set (280+ characters)
```

## Key Differences Between the Keys

| Aspect | ANON_KEY | SERVICE_ROLE_KEY |
|--------|----------|------------------|
| **Role** | `anon` | `service_role` |
| **Permissions** | Limited by RLS | Bypasses RLS |
| **Length** | ~200 chars | ~280 chars |
| **Safe to expose** | Yes (public) | No (secret) |
| **Used for** | Client operations | Admin operations |
| **In config.ts** | Yes ✅ | No ❌ |
| **In supabaseAdmin.ts** | No ❌ | Yes ✅ |

## JWT Token Comparison

If you decode both tokens (use jwt.io):

### ANON_KEY
```json
{
  "role": "anon",
  "iss": "supabase",
  ...
}
```
→ Limited permissions, respects RLS policies

### SERVICE_ROLE_KEY
```json
{
  "role": "service_role",
  "iss": "supabase",
  ...
}
```
→ Full admin permissions, bypasses RLS policies

## Summary

**Yes, this is exactly how it's supposed to work!**

- `config.ts` only handles **public/safe** configuration
- `supabaseAdmin.ts` handles **admin/secret** configuration
- Both read from `process.env` (loaded by dotenv)
- They're intentionally separate for security

The `SUPABASE_SERVICE_ROLE_KEY` is still loaded into `process.env` by dotenv on line 1 of `config.ts`, but it's **not exported** in the config object. Instead, it's accessed directly in `supabaseAdmin.ts` where it's needed for admin operations.

This is a **security best practice** - keeping sensitive credentials isolated and only accessible where absolutely necessary!

