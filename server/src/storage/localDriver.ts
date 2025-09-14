import { StorageDriver } from './driver.js';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export class LocalStorageDriver implements StorageDriver {
  private uploadsDir: string;

  constructor() {
    // Create uploads directory at server/uploads/
    // Handle both cases: running from project root or server directory
    const cwd = process.cwd();
    if (cwd.endsWith('server')) {
      this.uploadsDir = path.join(cwd, 'uploads');
    } else {
      this.uploadsDir = path.join(cwd, 'server', 'uploads');
    }
  }

  async putImage(params: { buffer: Buffer; mime: string; filenameHint?: string }): Promise<{ url: string, path: string }> {
    const { buffer, mime, filenameHint } = params;

    // Validate mime type
    const allowedTypes = ['image/png', 'image/jpg', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(mime)) {
      const error = new Error(`Unsupported media type. Allowed: ${allowedTypes.join(', ')}`) as any;
      error.statusCode = 415;
      throw error;
    }

    // Validate buffer size (5MB limit)
    const maxSize = 5 * 1024 * 1024;
    if (buffer.length > maxSize) {
      const error = new Error(`File too large. Maximum size: ${maxSize / 1024 / 1024}MB`) as any;
      error.statusCode = 413;
      throw error;
    }

    // Ensure uploads directory exists
    await this.ensureUploadsDir();

    // Generate filename with date-based structure
    const filename = this.generateFilename(mime, filenameHint);
    const datePath = this.getDatePath();
    const fullDir = path.join(this.uploadsDir, datePath);
    
    // Ensure date directory exists
    await fs.mkdir(fullDir, { recursive: true });
    
    const filePath = path.join(fullDir, filename);
    const relativePath = path.join(datePath, filename).replace(/\\/g, '/'); // Normalize path separators

    // Write file to disk
    await fs.writeFile(filePath, buffer);

    // Return public URL and path
    return {
      url: `/uploads/${relativePath}`,
      path: relativePath
    };
  }

  async health(): Promise<{ ok: boolean; details?: string }> {
    try {
      // Check if uploads directory exists and is writable
      await this.ensureUploadsDir();
      
      // Try to write a test file
      const testPath = path.join(this.uploadsDir, 'health-check.tmp');
      await fs.writeFile(testPath, 'test');
      await fs.unlink(testPath);
      
      return { ok: true, details: `Local storage at ${this.uploadsDir}` };
    } catch (error: any) {
      return { ok: false, details: `Local storage error: ${error.message}` };
    }
  }

  private async ensureUploadsDir(): Promise<void> {
    try {
      await fs.access(this.uploadsDir);
    } catch {
      // Directory doesn't exist, create it
      await fs.mkdir(this.uploadsDir, { recursive: true });
    }
  }

  private generateFilename(mime: string, filenameHint?: string): string {
    const uuid = crypto.randomUUID();
    const ext = this.getExtensionFromMime(mime);
    
    if (filenameHint) {
      // Sanitize filename hint
      const sanitized = this.sanitizeFilename(filenameHint);
      const baseName = path.parse(sanitized).name;
      if (baseName) {
        return `${uuid}-${baseName}.${ext}`;
      }
    }
    
    return `${uuid}.${ext}`;
  }

  private getExtensionFromMime(mime: string): string {
    switch (mime) {
      case 'image/png':
        return 'png';
      case 'image/jpg':
      case 'image/jpeg':
        return 'jpg';
      case 'image/webp':
        return 'webp';
      case 'image/gif':
        return 'gif';
      default:
        return 'jpg';
    }
  }

  private sanitizeFilename(filename: string): string {
    // Remove path separators and dangerous characters
    return filename
      .replace(/[\/\\:*?"<>|]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase();
  }

  private getDatePath(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  }
}
