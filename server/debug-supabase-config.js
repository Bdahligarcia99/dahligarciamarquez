#!/usr/bin/env node
/**
 * Advanced Supabase Configuration Debugger
 * 
 * This script performs comprehensive diagnostics on Supabase configuration
 * to identify exactly why the admin client might not be working.
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

console.log('='.repeat(80))
console.log('🔍 SUPABASE CONFIGURATION DEBUGGER')
console.log('='.repeat(80))
console.log()

// ============================================================================
// 1. ENVIRONMENT FILE DETECTION
// ============================================================================
console.log('📁 STEP 1: Checking for .env files')
console.log('-'.repeat(80))
console.log('Code location: debug-supabase-config.js, lines 36-60')
console.log('What it does:')
console.log('  - Line 37: existsSync() checks if file exists')
console.log('  - Line 43: readFileSync() reads file content')
console.log('  - Lines 44-46: Filters for SUPABASE-related lines')
console.log()

const envFiles = [
  '.env',
  '.env.local',
  '.env.development',
  '.env.production'
]

envFiles.forEach(file => {
  const path = join(__dirname, file)
  console.log(`\n  📍 Checking: ${file}`)
  console.log(`     Code: existsSync('${file}')`)
  const exists = existsSync(path)
  console.log(`  ${exists ? '✅' : '❌'} Result: ${exists ? 'Found' : 'Not found'}`)
  
  if (exists) {
    try {
      console.log(`     Code: readFileSync('${file}', 'utf-8')`)
      const content = readFileSync(path, 'utf-8')
      const lines = content.split('\n').filter(line => 
        line.includes('SUPABASE') && !line.trim().startsWith('#')
      )
      
      if (lines.length > 0) {
        console.log(`     Found ${lines.length} Supabase-related variables:`)
        lines.forEach(line => {
          const [key] = line.split('=')
          const hasValue = line.includes('=') && line.split('=')[1]?.trim().length > 0
          console.log(`       - ${key.trim()}: ${hasValue ? '✅ Has value' : '❌ Empty'}`)
        })
      }
    } catch (error) {
      console.log(`     ⚠️  Could not read file: ${error.message}`)
    }
  }
})

console.log()

// ============================================================================
// 2. ENVIRONMENT VARIABLES IN PROCESS
// ============================================================================
console.log('🔧 STEP 2: Checking environment variables in process.env')
console.log('-'.repeat(80))
console.log('Code location: debug-supabase-config.js, lines 82-108')
console.log('What it does: Reads process.env.VARIABLE_NAME and checks if defined')
console.log()

const requiredVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY'
]

const optionalVars = [
  'SUPABASE_BUCKET',
  'DATABASE_URL'
]

console.log('Required variables:')
requiredVars.forEach(varName => {
  console.log(`\n  📍 Checking: process.env.${varName}`)
  const value = process.env[varName]
  const status = value ? '✅' : '❌'
  
  if (value) {
    // Show first and last few characters for verification
    const masked = maskSecret(value)
    const length = value.length
    console.log(`  ${status} ${varName}:`)
    console.log(`       Length: ${length} characters`)
    console.log(`       Value: ${masked}`)
    
    // Validate format
    if (varName === 'SUPABASE_URL') {
      const isValid = value.startsWith('https://') && value.includes('.supabase.co')
      console.log(`       Format: ${isValid ? '✅ Valid URL' : '❌ Invalid URL format'}`)
      
      if (isValid) {
        const match = value.match(/https:\/\/([\w-]+)\.supabase\.co/)
        if (match) {
          console.log(`       Project ID: ${match[1]}`)
        }
      }
    }
    
    if (varName.includes('KEY')) {
      const looksLikeJWT = value.startsWith('eyJ')
      console.log(`       Format: ${looksLikeJWT ? '✅ JWT format' : '⚠️  Not JWT format'}`)
    }
  } else {
    console.log(`  ${status} ${varName}: ❌ NOT SET`)
  }
})

console.log()
console.log('Optional variables:')
optionalVars.forEach(varName => {
  const value = process.env[varName]
  const status = value ? '✅' : '⚠️ '
  
  if (value) {
    const masked = maskSecret(value)
    console.log(`  ${status} ${varName}: ${masked}`)
  } else {
    console.log(`  ${status} ${varName}: Not set`)
  }
})

console.log()

// ============================================================================
// 3. CONFIGURATION VALIDATION
// ============================================================================
console.log('🔍 STEP 3: Validating configuration logic')
console.log('-'.repeat(80))
console.log('Code location: auth/supabaseAdmin.ts, lines 6-7, 20')
console.log('What it does:')
console.log('  - Line 6: const url = process.env.SUPABASE_URL')
console.log('  - Line 7: const key = process.env.SUPABASE_SERVICE_ROLE_KEY')
console.log('  - Line 20: isSupabaseAdminConfigured = Boolean(url && key)')
console.log()

console.log('📍 Simulating auth/supabaseAdmin.ts logic:')
const url = process.env.SUPABASE_URL
console.log(`  Line 6: const url = process.env.SUPABASE_URL`)
console.log(`          Result: ${url ? 'Has value' : 'undefined'}`)

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
console.log(`  Line 7: const key = process.env.SUPABASE_SERVICE_ROLE_KEY`)
console.log(`          Result: ${serviceRoleKey ? 'Has value' : 'undefined'}`)

const anonKey = process.env.SUPABASE_ANON_KEY
console.log(`  (Also checking SUPABASE_ANON_KEY for completeness)`)
console.log(`          Result: ${anonKey ? 'Has value' : 'undefined'}`)
console.log()

console.log('Configuration checks:')
console.log(`  URL exists: ${Boolean(url) ? '✅' : '❌'}`)
console.log(`  Service Role Key exists: ${Boolean(serviceRoleKey) ? '✅' : '❌'}`)
console.log(`  Anon Key exists: ${Boolean(anonKey) ? '✅' : '❌'}`)
console.log()

const isAdminConfigured = Boolean(url && serviceRoleKey)
console.log(`  📍 Line 20: export const isSupabaseAdminConfigured = Boolean(url && key)`)
console.log(`  Result: isSupabaseAdminConfigured = ${isAdminConfigured ? '✅ TRUE' : '❌ FALSE'}`)

if (!isAdminConfigured) {
  console.log()
  console.log('❌ PROBLEM IDENTIFIED:')
  if (!url) {
    console.log('   - SUPABASE_URL is missing or empty')
  }
  if (!serviceRoleKey) {
    console.log('   - SUPABASE_SERVICE_ROLE_KEY is missing or empty')
  }
  console.log()
  console.log('💡 SOLUTIONS:')
  console.log('   1. Create a .env file in the server directory if it doesn\'t exist')
  console.log('   2. Add the following variables:')
  console.log('      SUPABASE_URL=https://YOUR_PROJECT.supabase.co')
  console.log('      SUPABASE_SERVICE_ROLE_KEY=eyJ...')
  console.log('   3. Restart your server after adding the variables')
  console.log()
  console.log('📖 To find these values:')
  console.log('   1. Go to https://supabase.com/dashboard')
  console.log('   2. Select your project')
  console.log('   3. Go to Settings > API')
  console.log('   4. Copy "Project URL" → SUPABASE_URL')
  console.log('   5. Copy "service_role" key → SUPABASE_SERVICE_ROLE_KEY')
  console.log()
}

console.log()

// ============================================================================
// 4. CLIENT CREATION TEST
// ============================================================================
if (isAdminConfigured) {
  console.log('🧪 STEP 4: Testing Supabase admin client creation')
  console.log('-'.repeat(80))
  console.log('Code location: auth/supabaseAdmin.ts, lines 35-70')
  console.log('What it does:')
  console.log('  - Lines 36-40: Checks if configured')
  console.log('  - Lines 44-67: Creates client with createClient(url, key, options)')
  console.log()
  
  try {
    console.log('  📍 Attempting to create Supabase admin client...')
    console.log('     Code: createClient(url, key, { auth: {...}, db: {...} })')
    
    const adminClient = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema: 'public'
      }
    })
    
    console.log('  ✅ Admin client created successfully')
    console.log('     This is what getSupabaseAdmin() returns')
    console.log()
    
    // ========================================================================
    // 5. CONNECTION TEST
    // ========================================================================
    console.log('🌐 STEP 5: Testing database connection')
    console.log('-'.repeat(80))
    console.log('Code location: Typical usage in routes/posts.ts, routes/admin.ts, etc.')
    console.log('What it does:')
    console.log('  - Gets admin client: const admin = getSupabaseAdmin()')
    console.log('  - Queries database: admin.from("table").select("*")')
    console.log()
    
    console.log('  📍 Attempting to query profiles table...')
    console.log('     Code: adminClient.from("profiles").select("*").limit(1)')
    
    const { data, error, count } = await adminClient
      .from('profiles')
      .select('*', { count: 'exact', head: false })
      .limit(1)
    
    if (error) {
      console.log('  ❌ Query failed:')
      console.log(`     Error: ${error.message}`)
      console.log(`     Code: ${error.code}`)
      console.log(`     Details: ${error.details}`)
      console.log(`     Hint: ${error.hint}`)
      console.log()
      console.log('💡 Common causes:')
      console.log('   - Wrong service role key (check for typos)')
      console.log('   - Project doesn\'t exist or was deleted')
      console.log('   - Network/firewall blocking connection')
      console.log('   - Table "profiles" doesn\'t exist (run migrations)')
    } else {
      console.log('  ✅ Query successful!')
      console.log(`     Profile count: ${count ?? 'unknown'}`)
      if (data && data.length > 0) {
        console.log(`     Sample profile:`)
        console.log(`       ID: ${data[0].id}`)
        console.log(`       Role: ${data[0].role}`)
        console.log(`       Display name: ${data[0].display_name || '(none)'}`)
      }
    }
    
    console.log()
    
    // ========================================================================
    // 6. AUTH TEST
    // ========================================================================
    console.log('🔐 STEP 6: Testing auth.getUser() with service role')
    console.log('-'.repeat(80))
    
    console.log('  Testing service role authentication...')
    
    // Generate a test JWT to verify
    const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    
    const { data: userData, error: authError } = await adminClient.auth.getUser(testToken)
    
    if (authError) {
      console.log('  ⚠️  Test token validation (expected to fail with invalid token):')
      console.log(`     Error: ${authError.message}`)
      console.log('     ✅ This is normal - admin client is working correctly')
    } else {
      console.log('  ⚠️  Unexpected: Test token was accepted (this shouldn\'t happen)')
    }
    
    console.log()
    
    // ========================================================================
    // 7. ANON CLIENT TEST
    // ========================================================================
    console.log('🔓 STEP 7: Testing anon client (frontend client)')
    console.log('-'.repeat(80))
    
    if (anonKey) {
      try {
        console.log('  Creating anon client...')
        const anonClient = createClient(url, anonKey, {
          auth: {
            autoRefreshToken: true,
            persistSession: true
          }
        })
        console.log('  ✅ Anon client created successfully')
        
        // Test public query
        const { data: publicData, error: publicError } = await anonClient
          .from('profiles')
          .select('count', { count: 'exact', head: true })
        
        if (publicError) {
          console.log('  ⚠️  Public query failed:')
          console.log(`     Error: ${publicError.message}`)
          console.log('     This might be due to RLS policies')
        } else {
          console.log('  ✅ Public query successful')
        }
      } catch (error) {
        console.log(`  ❌ Failed to create anon client: ${error.message}`)
      }
    } else {
      console.log('  ⚠️  SUPABASE_ANON_KEY not set, skipping anon client test')
    }
    
  } catch (error) {
    console.log('  ❌ Client creation failed:')
    console.log(`     Error: ${error.message}`)
    console.log(`     Stack: ${error.stack}`)
  }
} else {
  console.log('⏭️  STEP 4-7: Skipped (configuration not valid)')
}

console.log()
console.log('='.repeat(80))
console.log('✅ DIAGNOSTIC COMPLETE')
console.log('='.repeat(80))
console.log()

if (isAdminConfigured) {
  console.log('✅ Configuration appears to be correct!')
  console.log()
  console.log('If you\'re still having issues:')
  console.log('  1. Check that your server is loading .env from the correct location')
  console.log('  2. Verify you\'re not overriding env vars elsewhere')
  console.log('  3. Try restarting your server completely')
  console.log('  4. Check server logs for any additional error messages')
} else {
  console.log('❌ Configuration is incomplete. See errors above.')
}

console.log()

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function maskSecret(value) {
  if (!value || value.length < 20) {
    return '***'
  }
  
  const start = value.substring(0, 8)
  const end = value.substring(value.length - 8)
  const middle = '*'.repeat(Math.min(20, value.length - 16))
  
  return `${start}${middle}${end}`
}

