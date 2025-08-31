import { createClient } from '@supabase/supabase-js'
import { config } from './config.js'

// Create and configure Supabase client
export const supabase = createClient(
  config.supabase.url,
  config.supabase.anonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: false, // Server-side doesn't need session persistence
    },
    // Optional: Configure additional settings
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        'X-Client-Info': 'storytelling-server@1.0.0',
      },
    },
  }
)

// Log successful client initialization (without exposing sensitive data)
console.log('✅ Supabase client initialized')
console.log(`🔗 Connected to: ${config.supabase.url.replace(/\/\/.*@/, '//***@')}`)

// Export the client as default as well for convenience
export default supabase
