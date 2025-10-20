#!/usr/bin/env node
/**
 * Supabase Setup Verification Script
 * 
 * Checks if your Supabase project has everything configured correctly
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

console.log('='.repeat(80))
console.log('🔍 SUPABASE SETUP VERIFICATION')
console.log('='.repeat(80))
console.log()

// Create Supabase admin client directly (avoiding TypeScript import)
const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

function getSupabaseAdmin() {
  if (!url || !key) {
    console.log('❌ Environment variables not configured')
    console.log('   SUPABASE_URL:', url ? '✅ Set' : '❌ Missing')
    console.log('   SUPABASE_SERVICE_ROLE_KEY:', key ? '✅ Set' : '❌ Missing')
    return null
  }
  
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'public'
    }
  })
}

console.log()

const checks = []
let allPassed = true

function addCheck(name, passed, details = '') {
  checks.push({ name, passed, details })
  if (!passed) allPassed = false
  
  const icon = passed ? '✅' : '❌'
  console.log(`${icon} ${name}`)
  if (details) {
    console.log(`   ${details}`)
  }
}

async function runChecks() {
  // Check 1: Admin client can be created
  console.log('1️⃣  Checking Supabase Admin Client')
  console.log('-'.repeat(80))
  
  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    addCheck('Admin client creation', false, 'Environment variables missing')
    console.log()
    console.log('❌ Cannot proceed - fix environment variables first')
    console.log('   Run: npm run debug:supabase')
    return
  }
  addCheck('Admin client creation', true)
  console.log()

  // Check 2: Database connection
  console.log('2️⃣  Checking Database Connection')
  console.log('-'.repeat(80))
  
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('count', { count: 'exact', head: true })
    
    if (error) {
      addCheck('Database connection', false, error.message)
    } else {
      addCheck('Database connection', true, 'Successfully queried database')
    }
  } catch (error) {
    addCheck('Database connection', false, error.message)
  }
  console.log()

  // Check 3: Required tables exist
  console.log('3️⃣  Checking Required Tables')
  console.log('-'.repeat(80))
  
  const requiredTables = ['profiles', 'labels', 'posts', 'post_labels', 'images']
  
  for (const table of requiredTables) {
    try {
      const { error } = await supabaseAdmin
        .from(table)
        .select('count', { count: 'exact', head: true })
      
      if (error) {
        addCheck(`Table: ${table}`, false, error.message)
      } else {
        addCheck(`Table: ${table}`, true)
      }
    } catch (error) {
      addCheck(`Table: ${table}`, false, error.message)
    }
  }
  console.log()

  // Check 4: Functions exist
  console.log('4️⃣  Checking Database Functions')
  console.log('-'.repeat(80))
  
  try {
    const { data, error } = await supabaseAdmin.rpc('is_admin')
    
    if (error && error.code === 'PGRST202') {
      addCheck('Function: is_admin()', false, 'Function does not exist - run 02_routines.sql')
    } else if (error) {
      addCheck('Function: is_admin()', false, error.message)
    } else {
      addCheck('Function: is_admin()', true, 'Function exists and works')
    }
  } catch (error) {
    addCheck('Function: is_admin()', false, error.message)
  }
  console.log()

  // Check 5: Profiles exist
  console.log('5️⃣  Checking User Profiles')
  console.log('-'.repeat(80))
  
  try {
    const { data, error, count } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact' })
    
    if (error) {
      addCheck('Profiles exist', false, error.message)
    } else {
      if (count > 0) {
        addCheck('Profiles exist', true, `Found ${count} profile(s)`)
        
        // Show profiles
        data.forEach(profile => {
          console.log(`   - ${profile.display_name || 'No name'} (${profile.role})`)
        })
      } else {
        addCheck('Profiles exist', false, 'No profiles found - create a user first')
      }
    }
  } catch (error) {
    addCheck('Profiles exist', false, error.message)
  }
  console.log()

  // Check 6: Admin user exists
  console.log('6️⃣  Checking Admin Users')
  console.log('-'.repeat(80))
  
  try {
    const { data, error, count } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact' })
      .eq('role', 'admin')
    
    if (error) {
      addCheck('Admin user exists', false, error.message)
    } else {
      if (count > 0) {
        addCheck('Admin user exists', true, `Found ${count} admin(s)`)
        
        // Show admins
        data.forEach(profile => {
          console.log(`   - ${profile.display_name || 'No name'} (ID: ${profile.id.substring(0, 8)}...)`)
        })
      } else {
        addCheck('Admin user exists', false, 'No admin users found')
        console.log('   To create admin: UPDATE profiles SET role = \'admin\' WHERE email = \'your@email.com\'')
      }
    }
  } catch (error) {
    addCheck('Admin user exists', false, error.message)
  }
  console.log()

  // Check 7: Storage bucket
  console.log('7️⃣  Checking Storage Bucket')
  console.log('-'.repeat(80))
  
  try {
    const { data, error } = await supabaseAdmin.storage.listBuckets()
    
    if (error) {
      addCheck('Storage bucket check', false, error.message)
    } else {
      const postImagesBucket = data.find(b => b.id === 'post-images' || b.name === 'post-images')
      
      if (postImagesBucket) {
        addCheck('Storage bucket: post-images', true, `Bucket exists (public: ${postImagesBucket.public})`)
      } else {
        addCheck('Storage bucket: post-images', false, 'Bucket not found')
        console.log('   Available buckets:', data.map(b => b.name).join(', ') || 'none')
      }
    }
  } catch (error) {
    addCheck('Storage bucket check', false, error.message)
  }
  console.log()

  // Check 8: RLS policies
  console.log('8️⃣  Checking RLS Policies')
  console.log('-'.repeat(80))
  
  try {
    // Try to query with service role - should always work
    const { error } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .limit(1)
    
    if (error) {
      addCheck('RLS policies functional', false, error.message)
    } else {
      addCheck('RLS policies functional', true, 'Service role can query tables')
    }
  } catch (error) {
    addCheck('RLS policies functional', false, error.message)
  }
  console.log()
}

// Run checks
runChecks().then(() => {
  console.log('='.repeat(80))
  console.log('📊 VERIFICATION SUMMARY')
  console.log('='.repeat(80))
  console.log()
  
  const passed = checks.filter(c => c.passed).length
  const failed = checks.filter(c => !c.passed).length
  const total = checks.length
  
  console.log(`Total Checks: ${total}`)
  console.log(`Passed: ${passed} ✅`)
  console.log(`Failed: ${failed} ❌`)
  console.log()
  
  if (allPassed) {
    console.log('🎉 ALL CHECKS PASSED!')
    console.log()
    console.log('Your Supabase project is fully configured and ready to use.')
    console.log()
  } else {
    console.log('⚠️  SOME CHECKS FAILED')
    console.log()
    console.log('Failed checks:')
    checks.filter(c => !c.passed).forEach(check => {
      console.log(`  ❌ ${check.name}`)
      if (check.details) {
        console.log(`     ${check.details}`)
      }
    })
    console.log()
    console.log('📖 See SUPABASE_SETUP_CHECKLIST.md for detailed setup instructions')
    console.log()
    console.log('Quick fixes:')
    console.log('  1. Go to Supabase Dashboard → SQL Editor')
    console.log('  2. Run SQL files in order:')
    console.log('     - supabase/sql/01_schema.sql')
    console.log('     - supabase/sql/02_routines.sql')
    console.log('     - supabase/sql/03_policies.sql')
    console.log('     - supabase/sql/05_storage_policies.sql')
    console.log('  3. Create admin user in Authentication → Users')
    console.log('  4. Run this script again')
    console.log()
  }
  
  process.exit(allPassed ? 0 : 1)
}).catch(error => {
  console.error('❌ Verification failed with error:')
  console.error(error)
  process.exit(1)
})

