// client/src/lib/adminAuth.js

export function getAdminToken() {
  return localStorage.getItem("ADMIN_TOKEN");
}

export function setAdminToken(token) {
  localStorage.setItem("ADMIN_TOKEN", token);
}

export function clearAdminToken() {
  localStorage.removeItem("ADMIN_TOKEN");
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
