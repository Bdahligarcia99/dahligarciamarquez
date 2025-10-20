# 🔄 Environment Variables Loading Flow

## The Complete Chain

Here's exactly how your server loads environment variables from the `.env` file:

```
┌─────────────────────────────────────────────────────────────────────┐
│  START: You run "npm run dev" or "node server.js"                  │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 1: Node.js starts executing server.js                        │
│  File: server/server.js (line 1)                                   │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  Line 1 runs: │
                    │               │
                    │  import { config } from './src/config.ts' │
                    └───────┬───────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 2: Node.js loads config.ts to execute the import            │
│  File: server/src/config.ts (entire file)                         │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  Line 1 runs: │
                    │               │
                    │  import 'dotenv/config' │
                    └───────┬───────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 3: dotenv package is executed                                │
│  Package: node_modules/dotenv                                      │
│                                                                     │
│  What it does:                                                      │
│  1. Looks for .env file in current directory                       │
│  2. Reads server/.env file                                         │
│  3. Parses each line (KEY=value)                                   │
│  4. Adds to process.env object                                     │
│                                                                     │
│  Example:                                                           │
│    .env file has: SUPABASE_URL=https://...                         │
│    → process.env.SUPABASE_URL = "https://..."                      │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 4: Rest of config.ts executes                                │
│  File: server/src/config.ts (lines 17-54)                         │
│                                                                     │
│  Now process.env has all variables from .env!                      │
│                                                                     │
│  const config = {                                                   │
│    supabase: {                                                      │
│      url: process.env.SUPABASE_URL,        ← Gets from process.env │
│      anonKey: process.env.SUPABASE_ANON_KEY ← Gets from process.env│
│    },                                                               │
│    ...                                                              │
│  }                                                                  │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 5: config object is returned to server.js                   │
│  Now server.js can use: config.supabase.url                        │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 6: Other files import supabaseAdmin.ts                      │
│  File: server/auth/supabaseAdmin.ts (line 6-7)                    │
│                                                                     │
│  const url = process.env.SUPABASE_URL          ← Already loaded!   │
│  const key = process.env.SUPABASE_SERVICE_ROLE_KEY                 │
│                                                                     │
│  These work because dotenv already loaded them in step 3           │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Files Involved

### 1. **server.js** (Entry Point)
**Line 1:**
```javascript
import { config } from './src/config.ts'
```
- This is the FIRST line that runs
- Triggers the loading of config.ts
- Which triggers dotenv

### 2. **server/src/config.ts** (Environment Loader) ⭐
**Line 1:**
```javascript
import 'dotenv/config'
```
- **THIS IS WHERE THE MAGIC HAPPENS**
- Loads the `dotenv` package
- `dotenv` automatically:
  - Looks for `.env` file
  - Reads it
  - Parses KEY=value pairs
  - Adds them to `process.env`

**Lines 17-42:**
```javascript
export const config: Config = {
  database: {
    url: getRequiredEnvVar('DATABASE_URL')
  },
  supabase: {
    url: getRequiredEnvVar('SUPABASE_URL'),
    anonKey: getRequiredEnvVar('SUPABASE_ANON_KEY')
  },
  server: {
    port: parseInt(getOptionalEnvVar('PORT', '8080'), 10),
    nodeEnv: getOptionalEnvVar('NODE_ENV', 'development')
  }
}
```
- Reads from `process.env` (already loaded by dotenv)
- Creates structured config object
- Validates required variables exist

### 3. **server/auth/supabaseAdmin.ts** (Uses Variables)
**Lines 6-7:**
```javascript
const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
```
- Reads directly from `process.env`
- These variables are already loaded (from step 2)
- No need to load dotenv again

### 4. **package.json** (dotenv Package)
```json
{
  "dependencies": {
    "dotenv": "^16.3.1"
  }
}
```
- The `dotenv` package is installed
- Provides the functionality to read `.env` files

## Important Notes

### ✅ Single Loading Point
```
server.js → imports config.ts → loads 'dotenv/config'
                                      ↓
                              All env vars loaded ONCE
                                      ↓
                    Every other file can use process.env
```

**You only need to import `'dotenv/config'` ONCE** in your entire application.
- It's done in `config.ts`
- All other files just use `process.env.VARIABLE_NAME`

### ⚠️ Timing is Critical
```javascript
// ❌ WRONG ORDER
const myVar = process.env.MY_VAR    // undefined! dotenv not loaded yet
import 'dotenv/config'              // Too late!

// ✅ CORRECT ORDER  
import 'dotenv/config'              // Load first
const myVar = process.env.MY_VAR    // Works!
```

Your project is correct because:
- `server.js` imports `config.ts` FIRST
- `config.ts` loads `dotenv/config` FIRST
- Everything else runs after

### 📁 File Location Matters
```
storytelling-website/
├── server/
│   ├── .env          ← dotenv looks HERE (working directory)
│   ├── server.js     ← Entry point
│   └── src/
│       └── config.ts ← Loads dotenv
```

When you run:
```bash
cd server
npm run dev
```

Working directory is `server/`, so dotenv looks for `.env` in `server/`.

### 🔄 Loading Happens Once
```javascript
// First import of config.ts
import { config } from './src/config.ts'  // dotenv runs, loads .env

// Later imports
import { config } from './src/config.ts'  // dotenv already ran, uses cache
```

Node.js caches imports, so:
- `dotenv/config` only runs once
- `process.env` is loaded once
- All subsequent uses read from memory

## What dotenv Actually Does

When `import 'dotenv/config'` runs:

```javascript
// 1. Reads server/.env file
const fileContent = fs.readFileSync('.env', 'utf8')

// Example content:
// SUPABASE_URL=https://example.supabase.co
// SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
// PORT=5000

// 2. Parses each line
const lines = fileContent.split('\n')
lines.forEach(line => {
  if (line.trim() && !line.startsWith('#')) {
    const [key, value] = line.split('=')
    process.env[key.trim()] = value.trim()
  }
})

// 3. Result:
process.env.SUPABASE_URL = "https://example.supabase.co"
process.env.SUPABASE_SERVICE_ROLE_KEY = "eyJhbGci..."
process.env.PORT = "5000"
```

## Debugging the Chain

### Check if .env is being loaded:

**Add this temporarily to `server/src/config.ts` after line 1:**
```javascript
import 'dotenv/config'
console.log('🔍 dotenv loaded, checking SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'NOT SET')
```

Run server and you'll see this log FIRST.

### Common Issues

#### Issue 1: Wrong working directory
```bash
# ❌ Running from root
cd storytelling-website
node server/server.js    # Looks for .env in storytelling-website/

# ✅ Running from server directory
cd server
node server.js           # Looks for .env in server/ ✓
```

#### Issue 2: .env in wrong location
```
❌ storytelling-website/.env        # Wrong!
✅ storytelling-website/server/.env  # Correct!
```

#### Issue 3: Import order
```javascript
// ❌ WRONG (other imports before config)
import express from 'express'
import { config } from './src/config.ts'  // Too late!

// ✅ CORRECT (config first)
import { config } from './src/config.ts'  // Load env vars first
import express from 'express'
```

Your `server.js` is correct - `config` is imported on line 1!

## Files That DON'T Need to Load dotenv

These files just use `process.env` directly:
- ✅ `server/auth/supabaseAdmin.ts` - Already loaded
- ✅ `server/src/middleware/*.ts` - Already loaded
- ✅ `server/routes/*.ts` - Already loaded
- ✅ Any file imported after `config.ts` - Already loaded

These files DO need to load dotenv (standalone scripts):
- ✅ `server/debug-supabase-config.js` - Entry point
- ✅ `server/test-env.js` - Entry point
- ✅ `server/scripts/dev-doctor.ts` - Entry point

## Summary

**Loading Chain:**
```
npm run dev
  → node server.js
    → import { config } from './src/config.ts'
      → import 'dotenv/config'
        → dotenv reads server/.env
          → dotenv adds to process.env
            → config.ts reads process.env
              → Everything else uses process.env ✓
```

**Key File: `server/src/config.ts`**
- Line 1: `import 'dotenv/config'` ← This loads your .env file
- This happens before ANY other code runs
- Every `process.env.VARIABLE` after this works

**To verify it's working:**
```bash
cd server
npm run debug:supabase
```

This will show you exactly what's in `process.env` for all Supabase variables!

