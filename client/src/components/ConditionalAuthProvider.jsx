// Conditional AuthProvider that provides auth globally when Supabase is configured
import { AuthProvider } from '../hooks/useAuth'
import { isSupabaseConfigured } from '../lib/supabase'

export default function ConditionalAuthProvider({ children }) {
  // Always provide auth context since we've migrated to Supabase-only auth
  // The AuthProvider will handle the case when Supabase is not configured
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  )
}
