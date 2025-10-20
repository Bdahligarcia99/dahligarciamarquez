import pg from 'pg'
import { config } from './config.ts'

const { Pool } = pg

// Singleton PostgreSQL pool
let pool: pg.Pool | null = null

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: config.database.url,
      // Connection pool configuration
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // How long a client is allowed to remain idle
      connectionTimeoutMillis: 2000, // How long to wait when connecting a new client
    })

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('❌ Unexpected error on idle database client:', err)
    })
  }
  
  return pool
}

// Query helper function
export async function query(text: string, params?: any[]): Promise<pg.QueryResult> {
  const client = getPool()
  try {
    const result = await client.query(text, params)
    return result
  } catch (error) {
    console.error('❌ Database query error:', error)
    throw error
  }
}

// Startup connection test
export async function testConnection(): Promise<boolean> {
  try {
    console.log('🔍 Testing database connection...')
    const result = await query('SELECT NOW() as current_time, version() as postgres_version')
    
    if (result.rows.length > 0) {
      const { current_time, postgres_version } = result.rows[0]
      console.log('✅ Database connection successful!')
      console.log(`📅 Server time: ${current_time}`)
      console.log(`🐘 PostgreSQL version: ${postgres_version.split(' ')[0]}`)
      return true
    }
    
    console.log('⚠️ Database connection test returned no results')
    return false
  } catch (error) {
    console.error('❌ Database connection failed:', error instanceof Error ? error.message : error)
    console.log('💡 Please check your DATABASE_URL environment variable')
    return false
  }
}

// Graceful shutdown
export async function closePool(): Promise<void> {
  if (pool) {
    try {
      await pool.end()
      console.log('🔒 Database pool closed successfully')
    } catch (error) {
      console.error('❌ Error closing database pool:', error)
    }
    pool = null
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, closing database connections...')
  await closePool()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, closing database connections...')
  await closePool()
  process.exit(0)
})
