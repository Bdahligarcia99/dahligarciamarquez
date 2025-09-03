// Storage abstraction layer for handling file uploads
import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'

export interface StorageResult {
  url: string
  path: string
}

export interface StorageDriver {
  saveImage(buffer: Buffer, ext: string): Promise<StorageResult>
}

// Get directory paths
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.join(__dirname, '..', '..', '..')
const uploadsDir = path.join(projectRoot, 'uploads')

/**
 * Local filesystem storage driver
 */
class LocalStorageDriver implements StorageDriver {
  private uploadsPath: string

  constructor(uploadsPath: string = uploadsDir) {
    this.uploadsPath = uploadsPath
  }

  async saveImage(buffer: Buffer, ext: string): Promise<StorageResult> {
    // Ensure uploads directory exists
    await this.ensureUploadsDir()

    // Generate unique filename
    const filename = this.generateFilename(ext)
    const filePath = path.join(this.uploadsPath, filename)

    // Write file to disk
    await fs.writeFile(filePath, buffer)

    // Return URL and path
    return {
      url: `/uploads/${filename}`,
      path: filePath
    }
  }

  private async ensureUploadsDir(): Promise<void> {
    try {
      await fs.access(this.uploadsPath)
    } catch {
      // Directory doesn't exist, create it
      await fs.mkdir(this.uploadsPath, { recursive: true })
    }
  }

  private generateFilename(ext: string): string {
    const uuid = crypto.randomUUID()
    const cleanExt = ext.startsWith('.') ? ext : `.${ext}`
    return `${uuid}${cleanExt}`
  }
}

/**
 * Supabase storage driver (placeholder for future implementation)
 */
class SupabaseStorageDriver implements StorageDriver {
  async saveImage(buffer: Buffer, ext: string): Promise<StorageResult> {
    // TODO: Implement Supabase storage
    throw new Error('Supabase storage not implemented yet')
  }
}

/**
 * Factory function to get the appropriate storage driver
 */
function createStorageDriver(): StorageDriver {
  const storageDriver = process.env.STORAGE_DRIVER || 'local'

  switch (storageDriver.toLowerCase()) {
    case 'supabase':
      return new SupabaseStorageDriver()
    case 'local':
    default:
      return new LocalStorageDriver()
  }
}

// Export the main storage interface
export const storage = createStorageDriver()

// Export saveImage function for convenience
export async function saveImage(buffer: Buffer, ext: string): Promise<StorageResult> {
  return storage.saveImage(buffer, ext)
}
