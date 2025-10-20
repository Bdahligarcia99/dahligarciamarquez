// Test Supabase Configuration
// Run with: node scripts/test-supabase-config.js

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: 'server/.env' })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('🧪 Testing Supabase Configuration...\n')

// Test 1: Environment Variables
console.log('1. Environment Variables:')
console.log(`   SUPABASE_URL: ${supabaseUrl ? '✅ Set' : '❌ Missing'}`)
console.log(`   SUPABASE_ANON_KEY: ${supabaseAnonKey ? '✅ Set' : '❌ Missing'}`)
console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceKey ? '✅ Set' : '❌ Missing'}`)

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.log('\n❌ Missing required environment variables. Please check your .env file.')
  process.exit(1)
}

// Test 2: Client Connection
console.log('\n2. Client Connection:')
try {
  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  console.log('   Client created: ✅')
  
  // Test 3: Database Connection
  console.log('\n3. Database Connection:')
  const { data, error } = await supabase.from('profiles').select('count').limit(1)
  
  if (error) {
    console.log(`   Database query: ❌ ${error.message}`)
  } else {
    console.log('   Database query: ✅ Connected')
  }
  
  // Test 4: Storage Bucket
  console.log('\n4. Storage Bucket:')
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets()
  
  if (bucketError) {
    console.log(`   Storage access: ❌ ${bucketError.message}`)
  } else {
    const postImagesBucket = buckets.find(bucket => bucket.id === 'post-images')
    if (postImagesBucket) {
      console.log('   post-images bucket: ✅ Found')
      console.log(`   Bucket is public: ${postImagesBucket.public ? '✅ Yes' : '❌ No'}`)
    } else {
      console.log('   post-images bucket: ❌ Not found')
    }
  }
  
  console.log('\n🎉 Configuration test complete!')
  
} catch (err) {
  console.log(`\n❌ Error: ${err.message}`)
  process.exit(1)
}
