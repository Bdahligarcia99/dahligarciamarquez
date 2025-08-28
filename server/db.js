// server/db.js
import pg from 'pg'

const { Pool } = pg

// SSL configuration: disabled for localhost, enabled for production
const isLocalhost = process.env.DATABASE_URL?.includes('localhost')
const ssl = isLocalhost ? false : { rejectUnauthorized: false }

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl,
  statement_timeout: 10000,
  query_timeout: 10000,
  idleTimeoutMillis: 30000,
})

// Query helper function
export async function q(text, params) {
  const client = await pool.connect()
  try {
    const result = await client.query(text, params)
    return result
  } finally {
    client.release()
  }
}

// Initialize database with posts table
export async function initDb() {
  try {
    await q(`
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    
    // Add status column if it doesn't exist
    await q(`
      ALTER TABLE posts 
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published'
    `)
    
    // Create index for performance if it doesn't exist
    await q(`
      CREATE INDEX IF NOT EXISTS posts_created_at_idx 
      ON posts (created_at DESC)
    `)
    
    console.log('✅ Database initialized')
  } catch (error) {
    console.error('❌ Database initialization failed:', error)
    throw error
  }
}

// Close database connection pool
export async function closeDb() {
  try {
    await pool.end()
    console.log('✅ Database connection closed')
  } catch (error) {
    console.error('❌ Error closing database:', error)
  }
}
