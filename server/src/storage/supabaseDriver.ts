import { StorageDriver } from './driver.js';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export class SupabaseStorageDriver implements StorageDriver {
  private supabaseUrl: string;
  private serviceRoleKey: string;
  private bucketName: string;
  private supabase: any;

  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL || '';
    this.serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    this.bucketName = process.env.SUPABASE_BUCKET || 'public-images';

    if (this.supabaseUrl && this.serviceRoleKey) {
      this.supabase = createClient(this.supabaseUrl, this.serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
    }
  }

  async putImage(params: { buffer: Buffer; mime: string; filenameHint?: string }): Promise<{ url: string, path: string }> {
    const { buffer, mime, filenameHint } = params;

    // Check configuration
    if (!this.supabaseUrl || !this.serviceRoleKey) {
      const error = new Error('Uploads not configured') as any;
      error.statusCode = 503;
      throw error;
    }

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

    // Generate filename and path
    const filename = this.generateFilename(mime, filenameHint);
    const datePath = this.getDatePath();
    const storagePath = `${datePath}/${filename}`;

    try {
      // Upload to Supabase Storage
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(storagePath, buffer, {
          contentType: mime,
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Supabase storage error:', this.redactError(error));
        throw new Error(`Storage upload failed: ${error.message}`);
      }

      // Generate public URL
      const { data: { publicUrl } } = this.supabase.storage
        .from(this.bucketName)
        .getPublicUrl(storagePath);

      return {
        url: publicUrl,
        path: storagePath
      };
    } catch (error: any) {
      if (error.statusCode) {
        throw error;
      }
      console.error('Supabase upload error:', this.redactError(error));
      throw new Error('Storage upload failed');
    }
  }

  async health(): Promise<{ ok: boolean; details?: string }> {
    try {
      // Check environment variables
      if (!this.supabaseUrl) {
        return { ok: false, details: 'SUPABASE_URL not configured' };
      }
      if (!this.serviceRoleKey) {
        return { ok: false, details: 'SUPABASE_SERVICE_ROLE_KEY not configured' };
      }

      // Check bucket exists
      const { data: buckets, error: listError } = await this.supabase.storage.listBuckets();
      
      if (listError) {
        return { ok: false, details: `Failed to list buckets: ${listError.message}` };
      }

      const bucketExists = buckets?.some((bucket: any) => bucket.name === this.bucketName);
      
      if (!bucketExists) {
        // Try to create the bucket
        const { error: createError } = await this.supabase.storage.createBucket(this.bucketName, {
          public: true,
          allowedMimeTypes: ['image/png', 'image/jpg', 'image/jpeg', 'image/webp', 'image/gif'],
          fileSizeLimit: 5242880 // 5MB
        });

        if (createError) {
          return { 
            ok: false, 
            details: `Bucket '${this.bucketName}' missing and could not be created: ${createError.message}. Please create it manually in Supabase Dashboard.` 
          };
        }
      }

      // Test upload with a tiny buffer
      const testPath = `health-check/${Date.now()}.txt`;
      const testBuffer = Buffer.from('health-check');
      
      const { error: uploadError } = await this.supabase.storage
        .from(this.bucketName)
        .upload(testPath, testBuffer, {
          contentType: 'text/plain',
          cacheControl: '3600'
        });

      if (uploadError) {
        return { ok: false, details: `Upload test failed: ${uploadError.message}` };
      }

      // Clean up test file
      await this.supabase.storage
        .from(this.bucketName)
        .remove([testPath]);

      const projectId = this.extractProjectId(this.supabaseUrl);
      return { 
        ok: true, 
        details: `Supabase storage (${projectId}/${this.bucketName})` 
      };
    } catch (error: any) {
      return { ok: false, details: `Supabase health check failed: ${this.redactError(error).message}` };
    }
  }

  private generateFilename(mime: string, filenameHint?: string): string {
    const uuid = crypto.randomUUID();
    const ext = this.getExtensionFromMime(mime);
    
    if (filenameHint) {
      // Sanitize filename hint
      const sanitized = this.sanitizeFilename(filenameHint);
      const baseName = sanitized.split('.')[0];
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

  private extractProjectId(url: string): string {
    try {
      const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
      return match ? match[1] : 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private redactError(error: any): any {
    if (typeof error === 'object' && error !== null) {
      const redacted = { ...error };
      // Redact any potential secrets from error messages
      if (redacted.message) {
        redacted.message = redacted.message.replace(/service_role_key=[^&\s]*/gi, 'service_role_key=***');
        redacted.message = redacted.message.replace(/Bearer [^&\s]*/gi, 'Bearer ***');
      }
      return redacted;
    }
    return error;
  }
}
