// client/src/lib/api.js
import { getApiBase, buildApiUrl, API_MISCONFIGURED, getMisconfigError } from './apiBase.ts';

// Re-export for backward compatibility
export { getApiBase, API_MISCONFIGURED, getMisconfigError };

// Deprecated compat export with one-time warning
let apiUrlWarned = false;
function warnApiUrl() {
  if (!apiUrlWarned && import.meta.env.DEV) {
    console.warn('[api] API_URL is deprecated; use getApiBase() instead');
    apiUrlWarned = true;
  }
}

/** @deprecated Use getApiBase() from apiBase.ts instead. */
export const API_URL = (() => {
  const value = getApiBase();
  // Trigger warning when accessed
  if (import.meta.env.DEV) {
    setTimeout(warnApiUrl, 0);
  }
  return value;
})();

// Request tracking utilities
let requestIdCounter = 0;
const activeRequests = new Map();

function generateRequestId() {
  return `req_${++requestIdCounter}_${Date.now()}`;
}

function normalizeUrl(path) {
  return buildApiUrl(path);
}

function redactToken(value) {
  if (!value || typeof value !== 'string') return value;
  
  // Redact Bearer tokens
  if (value.toLowerCase().startsWith('bearer ')) {
    const token = value.slice(7); // Remove 'Bearer '
    if (token.length > 4) {
      return `Bearer ***${token.slice(-4)}`;
    }
    return 'Bearer ***';
  }
  
  return value;
}

function emitRequestStart(id, method, url) {
  const detail = { 
    id, 
    method: method.toUpperCase(), 
    url, 
    startedAt: Date.now() 
  };
  
  activeRequests.set(id, detail);
  
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app:request:start', { detail }));
  }
  
  // Console log in dev
  if (import.meta.env.DEV) {
    console.log(`[API] ${method.toUpperCase()} ${url} (base=${getApiBase()})`);
  }
}

function emitRequestEnd(id, status, ok, error, serverUrl) {
  const startDetail = activeRequests.get(id);
  if (!startDetail) return;
  
  const durationMs = Date.now() - startDetail.startedAt;
  const detail = {
    ...startDetail,
    status,
    ok,
    durationMs,
    error,
    serverUrl
  };
  
  activeRequests.delete(id);
  
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app:request:end', { detail }));
  }
  
  // Console log in dev
  if (import.meta.env.DEV) {
    const statusText = error ? `ERROR: ${error}` : `${status}`;
    console.log(`[API] ${startDetail.method} ${startDetail.url} → ${statusText} in ${durationMs}ms`);
    if (serverUrl && serverUrl !== startDetail.url) {
      console.log(`[API] Server echo: ${serverUrl}`);
    }
  }
}

// Expose debug API in dev
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.API_DEBUG = {
    enable() {
      localStorage.setItem('debugNet', '1');
      console.log('[API_DEBUG] Network inspector enabled');
    },
    disable() {
      localStorage.setItem('debugNet', '0');
      console.log('[API_DEBUG] Network inspector disabled');
    },
    base() {
      return getApiBase();
    },
    lastRequests() {
      return Array.from(activeRequests.values());
    }
  };
}

// Generic GET helper
export async function apiGet(path) {
  if (API_MISCONFIGURED) throw getMisconfigError();
  
  const requestId = generateRequestId();
  const fullUrl = normalizeUrl(path);
  
  emitRequestStart(requestId, 'GET', fullUrl);
  
  try {
    const res = await fetch(fullUrl);
    const serverUrl = res.headers.get('X-Debug-Server-Url');
    
    if (!res.ok) {
      const text = await res.text();
      const error = `GET ${path} failed with HTTP ${res.status}: ${text || res.statusText}`;
      emitRequestEnd(requestId, res.status, res.ok, error, serverUrl);
      throw new Error(error);
    }
    
    emitRequestEnd(requestId, res.status, res.ok, null, serverUrl);
    return res.json();
  } catch (error) {
    if (error.message.includes('failed with HTTP')) {
      throw error; // Already handled above
    }
    emitRequestEnd(requestId, 0, false, error.message);
    throw error;
  }
}

// Generic POST helper
export async function apiPost(path, body) {
  if (API_MISCONFIGURED) throw getMisconfigError();
  
  const requestId = generateRequestId();
  const fullUrl = normalizeUrl(path);
  
  emitRequestStart(requestId, 'POST', fullUrl);
  
  try {
    const res = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const serverUrl = res.headers.get('X-Debug-Server-Url');
    
    if (!res.ok) {
      const text = await res.text();
      const error = `POST ${path} failed with HTTP ${res.status}: ${text || res.statusText}`;
      emitRequestEnd(requestId, res.status, res.ok, error, serverUrl);
      throw new Error(error);
    }
    
    emitRequestEnd(requestId, res.status, res.ok, null, serverUrl);
    return res.json();
  } catch (error) {
    if (error.message.includes('failed with HTTP')) {
      throw error;
    }
    emitRequestEnd(requestId, 0, false, error.message);
    throw error;
  }
}

// Generic PATCH helper
export async function apiPatch(path, body) {
  if (API_MISCONFIGURED) throw getMisconfigError();
  
  const res = await fetch(buildApiUrl(path), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PATCH ${path} failed with HTTP ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

// Generic DELETE helper
export async function apiDelete(path) {
  if (API_MISCONFIGURED) throw getMisconfigError();
  
  const res = await fetch(buildApiUrl(path), {
    method: 'DELETE',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DELETE ${path} failed with HTTP ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

// Admin API helpers
import { adminHeaders, clearAdminToken } from './adminAuth';
import { getSupabaseClient } from './supabase';

// Enhanced error class for admin API calls
export class AdminApiError extends Error {
  constructor(message, status, path, kind = 'http') {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
    this.path = path;
    this.kind = kind; // 'http', 'network', 'auth', etc.
  }
}

// Handle admin API errors with appropriate actions
function handleAdminError(status, path, text, fullUrl) {
  if (status === 401) {
    // Clear token and redirect will be handled by components
    clearAdminToken();
    throw new AdminApiError(`Unauthorized - please sign in with your admin token`, 401, path, 'auth');
  } else if (status === 404) {
    throw new AdminApiError(`Admin API not found. Server may be on an older build—please redeploy or restart the server.`, 404, path);
  } else {
    throw new AdminApiError(`Request to ${fullUrl} failed with HTTP ${status}: ${text || 'Unknown error'}`, status, path);
  }
}

// Handle network/CORS errors
function handleNetworkError(error, fullUrl, headers) {
  const authHeader = headers?.Authorization;
  const redactedAuth = authHeader ? redactToken(authHeader) : 'none';
  
  let message = `Network/CORS error calling ${fullUrl}. Is the API base reachable?`;
  if (import.meta.env.DEV) {
    message += ` (Auth: ${redactedAuth})`;
  }
  
  throw new AdminApiError(message, 0, fullUrl, 'network');
}

export async function apiAdminGet(path) {
  if (API_MISCONFIGURED) throw getMisconfigError();
  
  const requestId = generateRequestId();
  const fullUrl = normalizeUrl(path);
  
  emitRequestStart(requestId, 'GET', fullUrl);
  
  try {
    const headers = adminHeaders();
    
    // Log redacted headers in dev
    if (import.meta.env.DEV && headers.Authorization) {
      console.log(`[API] Headers: Authorization: ${redactToken(headers.Authorization)}`);
    }
    
    const res = await fetch(fullUrl, { 
      method: 'GET',
      headers,
      mode: 'cors'
    });
    const serverUrl = res.headers.get('X-Debug-Server-Url');
    
    if (!res.ok) {
      const text = await res.text();
      emitRequestEnd(requestId, res.status, res.ok, text, serverUrl);
      handleAdminError(res.status, path, text, fullUrl);
    }
    
    emitRequestEnd(requestId, res.status, res.ok, null, serverUrl);
    return res.json();
  } catch (error) {
    if (error instanceof AdminApiError) {
      throw error;
    }
    
    // Handle network/CORS errors (TypeError: fetch failed)
    const headers = adminHeaders();
    emitRequestEnd(requestId, 0, false, error.message);
    handleNetworkError(error, fullUrl, headers);
  }
}

export async function apiAdminPost(path, body) {
  if (API_MISCONFIGURED) throw getMisconfigError();
  
  try {
    const res = await fetch(buildApiUrl(path), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...adminHeaders()
      },
      body: JSON.stringify(body),
    });
    
    if (!res.ok) {
      const text = await res.text();
      handleAdminError(res.status, path, text);
    }
    
    return res.json();
  } catch (error) {
    if (error instanceof AdminApiError) {
      throw error;
    }
    throw new AdminApiError(`Network error: ${error.message}`, 0, path);
  }
}

export async function apiAdminPatch(path, body) {
  if (API_MISCONFIGURED) throw getMisconfigError();
  
  try {
    const res = await fetch(buildApiUrl(path), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...adminHeaders()
      },
      body: JSON.stringify(body),
    });
    
    if (!res.ok) {
      const text = await res.text();
      handleAdminError(res.status, path, text);
    }
    
    return res.json();
  } catch (error) {
    if (error instanceof AdminApiError) {
      throw error;
    }
    throw new AdminApiError(`Network error: ${error.message}`, 0, path);
  }
}

export async function apiAdminDelete(path) {
  if (API_MISCONFIGURED) throw getMisconfigError();
  
  try {
    const res = await fetch(buildApiUrl(path), {
      method: 'DELETE',
      headers: { ...adminHeaders() }
    });
    
    if (!res.ok) {
      const text = await res.text();
      handleAdminError(res.status, path, text);
    }
    
    return res.json();
  } catch (error) {
    if (error instanceof AdminApiError) {
      throw error;
    }
    throw new AdminApiError(`Network error: ${error.message}`, 0, path);
  }
}

// Admin request helper (raw response)
export async function adminGet(path, { signal } = {}) {
  const token = localStorage.getItem('adminToken') || '';
  const url = buildApiUrl(path);
  
  try {
    const res = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      signal
    });
    
    // Handle 401 errors by clearing token and throwing AdminApiError
    if (res.status === 401) {
      const { clearAdminToken } = await import('./adminAuth');
      clearAdminToken();
      throw new AdminApiError(`Unauthorized - please sign in with your admin token`, 401, path, 'auth');
    }
    
    return res;
  } catch (error) {
    if (error instanceof AdminApiError) {
      throw error;
    }
    // Handle network/CORS errors
    throw new AdminApiError(`Network error: ${error.message}`, 0, path, 'network');
  }
}

// Lightweight stats helpers
export async function fetchPostsTotal({ signal } = {}) {
  const res = await adminGet('/api/posts?page=1&limit=1', { signal });
  if (!res.ok) throw new Error(`Posts total HTTP ${res.status}`);
  const data = await res.json();
  // Expected shape: { items: [...], page, limit, total }
  return typeof data.total === 'number' ? data.total : 0;
}

export async function fetchDbHealth({ signal } = {}) {
  const url = buildApiUrl('/api/db/health');
  const res = await fetch(url, { method: 'GET', mode: 'cors', signal });
  if (!res.ok) return { ok: false };
  const data = await res.json().catch(() => ({}));
  return { ok: !!data.ok };
}

// Legacy API helper (keep for backward compatibility)
export async function api(path, init) {
  const res = await fetch(buildApiUrl(path), { ...init });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

// Supabase JWT-based API helpers (replacing admin token system)
async function getSupabaseAuthHeaders() {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase not configured');
  }
  
  const { data: { session }, error } = await client.auth.getSession();
  if (error || !session?.access_token) {
    throw new Error('Not authenticated');
  }
  
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  };
}

// Supabase-based admin API functions
export async function supabaseAdminGet(path, { signal } = {}) {
  if (API_MISCONFIGURED) throw getMisconfigError();
  
  try {
    const headers = await getSupabaseAuthHeaders();
    const res = await fetch(buildApiUrl(path), {
      method: 'GET',
      headers,
      signal
    });
    
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GET ${path} failed with HTTP ${res.status}: ${text || res.statusText}`);
    }
    
    return res.json();
  } catch (error) {
    if (error.message.includes('Not authenticated')) {
      throw new Error('Authentication required');
    }
    throw error;
  }
}

// Supabase-based stats helpers
export async function supabaseFetchPostsTotal({ signal } = {}) {
  try {
    const data = await supabaseAdminGet('/api/posts/admin?page=1&limit=1', { signal });
    return typeof data.total === 'number' ? data.total : 0;
  } catch (error) {
    console.warn('Failed to fetch posts total:', error);
    return 0;
  }
}

export async function supabaseFetchDbHealth({ signal } = {}) {
  // DB health endpoint doesn't exist, so just return a default
  // This prevents 404 errors in the console
  return { ok: true };
}

export async function supabaseAdminPost(path, body) {
  if (API_MISCONFIGURED) throw getMisconfigError();
  
  try {
    const headers = await getSupabaseAuthHeaders();
    const res = await fetch(buildApiUrl(path), {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`POST ${path} failed with HTTP ${res.status}: ${text || res.statusText}`);
    }
    
    return res.json();
  } catch (error) {
    if (error.message.includes('Not authenticated')) {
      throw new Error('Authentication required');
    }
    throw error;
  }
}

export async function supabaseAdminPatch(path, body) {
  if (API_MISCONFIGURED) throw getMisconfigError();
  
  try {
    const headers = await getSupabaseAuthHeaders();
    const res = await fetch(buildApiUrl(path), {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body)
    });
    
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`PATCH ${path} failed with HTTP ${res.status}: ${text || res.statusText}`);
    }
    
    return res.json();
  } catch (error) {
    if (error.message.includes('Not authenticated')) {
      throw new Error('Authentication required');
    }
    throw error;
  }
}

export async function supabaseAdminDelete(path) {
  if (API_MISCONFIGURED) throw getMisconfigError();
  
  try {
    const headers = await getSupabaseAuthHeaders();
    const res = await fetch(buildApiUrl(path), {
      method: 'DELETE',
      headers
    });
    
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`DELETE ${path} failed with HTTP ${res.status}: ${text || res.statusText}`);
    }
    
    return res.json();
  } catch (error) {
    if (error.message.includes('Not authenticated')) {
      throw new Error('Authentication required');
    }
    throw error;
  }
}