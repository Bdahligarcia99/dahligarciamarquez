// client/src/lib/adminAuth.js

export function getAdminToken() {
  return localStorage.getItem("adminToken");
}

export function setAdminToken(token) {
  localStorage.setItem("adminToken", token);
}

export function clearAdminToken() {
  localStorage.removeItem("adminToken");
}

export function ensureAdminToken() {
  let token = getAdminToken();
  if (!token) {
    const t = window.prompt("Admin access token?");
    if (t) {
      token = t.trim();
      setAdminToken(token);
    }
  }
  return token;
}

export function adminHeaders() {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Lightweight adminApi export - delegates to existing admin helpers
import { buildApiUrl } from './apiBase.ts';
import {
  apiAdminGet as _apiAdminGet,
  apiAdminPost as _apiAdminPost,
  apiAdminPatch as _apiAdminPatch,
  apiAdminDelete as _apiAdminDelete,
} from './api.js';

function _authHeader() {
  const t = localStorage.getItem('adminToken') || '';
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function _fallbackFetch(path, init = {}) {
  const url = buildApiUrl(path);
  const headers = { ...init.headers, ..._authHeader() };
  const res = await fetch(url, { ...init, headers, mode: 'cors' });
  return res;
}

const _get    = _apiAdminGet    || ((path, opts) => _fallbackFetch(path, { method: 'GET',    ...opts }));
const _post   = _apiAdminPost   || ((path, body, opts) => _fallbackFetch(path, { method: 'POST',  headers: { 'Content-Type': 'application/json', ...(opts?.headers||{}) }, body: JSON.stringify(body), ...opts }));
const _patch  = _apiAdminPatch  || ((path, body, opts) => _fallbackFetch(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(opts?.headers||{}) }, body: JSON.stringify(body), ...opts }));
const _delete = _apiAdminDelete || ((path, opts) => _fallbackFetch(path, { method: 'DELETE', ...opts }));

export const adminApi = {
  get: _get,
  post: _post,
  patch: _patch,
  delete: _delete,
  async health(opts) {
    const res = await _get('/api/admin/health', opts);
    // return JSON if OK; otherwise bubble up the Response for callers that inspect status
    if (res.ok) return res.json();
    return res;
  },
};

// Debug helper for clearing admin token
if (typeof window !== 'undefined') {
  window.Admin = {
    clear() {
      clearAdminToken();
      console.log('Admin token cleared');
    }
  };
}
