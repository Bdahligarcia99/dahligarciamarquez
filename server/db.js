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
        content_text TEXT,
        content_rich JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    
    // Add status column if it doesn't exist
    await q(`
      ALTER TABLE posts 
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published'
    `)
    
    // Add author_id column if it doesn't exist (for compatibility with Supabase schema)
    // Note: No default value - author_id should be explicitly provided
    await q(`
      ALTER TABLE posts 
      ADD COLUMN IF NOT EXISTS author_id TEXT
    `)
    
    // Add content_html column if it doesn't exist (for rich text support)
    await q(`
      ALTER TABLE posts 
      ADD COLUMN IF NOT EXISTS content_html TEXT
    `)
    
    // Add excerpt column if it doesn't exist
    await q(`
      ALTER TABLE posts 
      ADD COLUMN IF NOT EXISTS excerpt TEXT
    `)
    
    // Add cover_image_url column if it doesn't exist
    await q(`
      ALTER TABLE posts 
      ADD COLUMN IF NOT EXISTS cover_image_url TEXT
    `)
    
    // Migration logic removed - body column is no longer supported
    
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
