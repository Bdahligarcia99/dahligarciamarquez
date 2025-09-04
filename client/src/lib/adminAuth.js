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

// Debug helper for clearing admin token
if (typeof window !== 'undefined') {
  window.Admin = {
    clear() {
      clearAdminToken();
      console.log('Admin token cleared');
    }
  };
}
