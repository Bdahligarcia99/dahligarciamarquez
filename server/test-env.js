// Quick test to check if server can read environment variables
import 'dotenv/config'

console.log('🔍 Environment Variable Test:')
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing')
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing')
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing')
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ Missing')
console.log('PORT:', process.env.PORT || 'Using default')

// Test Supabase admin creation
import { getSupabaseAdmin, isSupabaseAdminConfigured } from './auth/supabaseAdmin.js'
console.log('🔑 Supabase Admin Configured:', isSupabaseAdminConfigured)

if (isSupabaseAdminConfigured) {
  const admin = getSupabaseAdmin()
  console.log('✅ Supabase admin client created successfully')
} else {
  console.log('❌ Supabase admin client could not be created')
}

