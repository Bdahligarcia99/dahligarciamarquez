// client/src/lib/adminAuth.js
let adminToken = sessionStorage.getItem("ADMIN_TOKEN") || null;

export function ensureAdminToken() {
  if (!adminToken) {
    const t = window.prompt("Admin access token?");
    if (t) {
      adminToken = t.trim();
      sessionStorage.setItem("ADMIN_TOKEN", adminToken);
    }
  }
  return adminToken;
}

export function adminHeaders() {
  const t = adminToken ?? sessionStorage.getItem("ADMIN_TOKEN");
  return t ? { Authorization: `Bearer ${t}` } : {};
}
