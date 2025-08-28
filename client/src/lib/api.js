// client/src/lib/api.js

// Safe API configuration - don't crash on import if missing
export const API_MISCONFIGURED = !import.meta.env.VITE_API_URL;
export const API_URL = import.meta.env.VITE_API_URL || '';

const getMisconfigError = () => 
  new Error('VITE_API_URL is not set. Check Vercel env vars.');

export function getApiBase() { 
  return API_URL; 
}

// Generic GET helper
export async function apiGet(path) {
  if (API_MISCONFIGURED) throw getMisconfigError();
  
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${path} failed with HTTP ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

// Generic POST helper
export async function apiPost(path, body) {
  if (API_MISCONFIGURED) throw getMisconfigError();
  
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} failed with HTTP ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

// Generic PATCH helper
export async function apiPatch(path, body) {
  if (API_MISCONFIGURED) throw getMisconfigError();
  
  const res = await fetch(`${API_URL}${path}`, {
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
  
  const res = await fetch(`${API_URL}${path}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DELETE ${path} failed with HTTP ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

// Admin API helpers
import { adminHeaders } from './adminAuth';

export async function apiAdminGet(path) {
  if (API_MISCONFIGURED) throw getMisconfigError();
  
  const res = await fetch(`${API_URL}${path}`, {
    headers: { ...adminHeaders() }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${path} failed with HTTP ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

export async function apiAdminPost(path, body) {
  if (API_MISCONFIGURED) throw getMisconfigError();
  
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...adminHeaders()
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} failed with HTTP ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

export async function apiAdminPatch(path, body) {
  if (API_MISCONFIGURED) throw getMisconfigError();
  
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...adminHeaders()
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PATCH ${path} failed with HTTP ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

export async function apiAdminDelete(path) {
  if (API_MISCONFIGURED) throw getMisconfigError();
  
  const res = await fetch(`${API_URL}${path}`, {
    method: 'DELETE',
    headers: { ...adminHeaders() }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DELETE ${path} failed with HTTP ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

// Legacy API helper (keep for backward compatibility)
export async function api(path, init) {
  const res = await fetch(`${API_URL}${path}`, { ...init });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}