// client/src/lib/api.js
export const API_URL = import.meta.env.VITE_API_URL;

// Throw helpful error if API_URL is missing
if (!API_URL) {
  throw new Error('VITE_API_URL environment variable is required but not set. Please set it in your .env.local file or Vercel environment variables.');
}

export function getApiBase() { 
  return API_URL; 
}

// Generic GET helper
export async function apiGet(path) {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${path} failed with HTTP ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

// Generic POST helper
export async function apiPost(path, body) {
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
  const res = await fetch(`${API_URL}${path}`, {
    method: 'DELETE',
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