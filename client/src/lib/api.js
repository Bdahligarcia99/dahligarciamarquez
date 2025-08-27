// client/src/lib/api.js
const API_URL = import.meta.env.VITE_API_URL;

export function getApiBase() { 
  return API_URL; 
}

export async function api(path, init) {
  const res = await fetch(`${API_URL}${path}`, { ...init });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}