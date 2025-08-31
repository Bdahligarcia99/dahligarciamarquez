import 'dotenv/config'

export interface Config {
  database: {
    url: string
  }
  supabase: {
    url: string
    anonKey: string
  }
  server: {
    port: number
    nodeEnv: string
  }
}

function getRequiredEnvVar(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function getOptionalEnvVar(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue
}

// Validate and load configuration
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

// Export SERVER_ADMIN_TOKEN
export const SERVER_ADMIN_TOKEN: string | undefined = process.env.SERVER_ADMIN_TOKEN

// Log successful configuration load (without sensitive data)
console.log('✅ Configuration loaded successfully')
console.log(`📊 Environment: ${config.server.nodeEnv}`)
console.log(`🚀 Port: ${config.server.port}`)
console.log(`🔗 Database: ${config.database.url ? 'Connected' : 'Not configured'}`)
console.log(`🔑 Supabase: ${config.supabase.url ? 'Configured' : 'Not configured'}`)
console.log('🔐 Admin token configured:', Boolean(process.env.SERVER_ADMIN_TOKEN))
