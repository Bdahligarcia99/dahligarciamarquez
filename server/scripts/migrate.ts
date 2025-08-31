#!/usr/bin/env ts-node

import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { query, testConnection, closePool } from '../src/db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations')

// Create migrations tracking table if it doesn't exist
async function createMigrationsTable(): Promise<void> {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );
  `
  
  try {
    await query(createTableSQL)
    console.log('✅ Migrations table ready')
  } catch (error) {
    console.error('❌ Failed to create migrations table:', error)
    throw error
  }
}

// Get list of applied migrations
async function getAppliedMigrations(): Promise<Set<string>> {
  try {
    const result = await query('SELECT filename FROM _migrations ORDER BY filename')
    return new Set(result.rows.map(row => row.filename))
  } catch (error) {
    console.error('❌ Failed to get applied migrations:', error)
    throw error
  }
}

// Apply a single migration
async function applyMigration(filename: string, sql: string): Promise<void> {
  try {
    console.log(`🔄 Applying migration: ${filename}`)
    
    // Execute the migration SQL
    await query(sql)
    
    // Record the migration as applied
    await query('INSERT INTO _migrations (filename) VALUES ($1)', [filename])
    
    console.log(`✅ Applied migration: ${filename}`)
  } catch (error) {
    console.error(`❌ Failed to apply migration ${filename}:`, error)
    throw error
  }
}

// Main migration runner
async function runMigrations(): Promise<void> {
  try {
    console.log('🚀 Starting database migrations...')
    
    // Test database connection
    const connected = await testConnection()
    if (!connected) {
      console.error('❌ Cannot connect to database. Aborting migrations.')
      process.exit(1)
    }
    
    // Create migrations table
    await createMigrationsTable()
    
    // Get applied migrations
    const appliedMigrations = await getAppliedMigrations()
    console.log(`📋 Found ${appliedMigrations.size} previously applied migrations`)
    
    // Read migration files
    let migrationFiles: string[]
    try {
      migrationFiles = await readdir(MIGRATIONS_DIR)
    } catch (error) {
      console.log('📁 No migrations directory found, creating it...')
      await import('fs/promises').then(fs => fs.mkdir(MIGRATIONS_DIR, { recursive: true }))
      migrationFiles = []
    }
    
    // Filter and sort migration files
    const sqlFiles = migrationFiles
      .filter(file => file.endsWith('.sql'))
      .sort() // Lexicographic order
    
    console.log(`📄 Found ${sqlFiles.length} migration files`)
    
    if (sqlFiles.length === 0) {
      console.log('✨ No migrations to apply')
      return
    }
    
    // Apply pending migrations
    let appliedCount = 0
    for (const filename of sqlFiles) {
      if (appliedMigrations.has(filename)) {
        console.log(`⏭️  Skipping already applied: ${filename}`)
        continue
      }
      
      const filePath = join(MIGRATIONS_DIR, filename)
      const sql = await readFile(filePath, 'utf8')
      
      await applyMigration(filename, sql)
      appliedCount++
    }
    
    if (appliedCount === 0) {
      console.log('✨ All migrations already applied')
    } else {
      console.log(`🎉 Successfully applied ${appliedCount} migrations`)
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await closePool()
  }
}

// Run migrations if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
}
