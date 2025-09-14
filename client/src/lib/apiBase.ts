// client/src/lib/apiBase.ts

/**
 * Get the API base URL with proper priority and normalization
 * Priority: VITE_API_BASE_URL → existing UI API host → '' (same-origin)
 */
export function getApiBase(): string {
  // 1. Check explicit environment variable
  if (import.meta.env.VITE_API_BASE_URL) {
    return normalizeApiBase(import.meta.env.VITE_API_BASE_URL);
  }

  // 2. Check existing VITE_API_URL for backward compatibility
  if (import.meta.env.VITE_API_URL) {
    return normalizeApiBase(import.meta.env.VITE_API_URL);
  }

  // 3. Default to same-origin (empty string)
  return '';
}

/**
 * Normalize API base URL to ensure proper slash handling
 */
function normalizeApiBase(base: string): string {
  if (!base) return '';
  
  // Remove trailing slash to prevent double slashes
  return base.replace(/\/$/, '');
}

/**
 * Build a full API URL with proper slash normalization
 */
export function buildApiUrl(path: string): string {
  const base = getApiBase();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  return `${base}${normalizedPath}`;
}

/**
 * Check if API is misconfigured (for backward compatibility)
 */
export const API_MISCONFIGURED = !import.meta.env.VITE_API_BASE_URL && !import.meta.env.VITE_API_URL;

/**
 * Get misconfiguration error
 */
export const getMisconfigError = () => 
  new Error('VITE_API_BASE_URL or VITE_API_URL is not set. Check environment variables.');
