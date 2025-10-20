// Simple test to check if Supabase is working
// Open browser console and run this in the console

import { getSupabaseClient, isSupabaseConfigured } from './lib/supabase'

console.log('🧪 Testing Supabase Configuration...')
console.log('Is Supabase configured?', isSupabaseConfigured)

const client = getSupabaseClient()
console.log('Supabase client:', client)

if (client) {
  console.log('✅ Supabase client created successfully')
  
  // Test a simple query
  client.from('profiles').select('count').limit(1)
    .then(({ data, error }) => {
      if (error) {
        console.log('❌ Database connection failed:', error)
      } else {
        console.log('✅ Database connection successful')
      }
    })
    .catch(err => {
      console.log('❌ Error testing database:', err)
    })
} else {
  console.log('❌ Failed to create Supabase client')
}
