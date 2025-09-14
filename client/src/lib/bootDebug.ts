// Boot debug helper - logs key info when localStorage.debugBoot === '1'

function getApiBase(): string {
  return import.meta.env.VITE_API_URL || '/api';
}

function getCurrentRoute(): string {
  return window.location.pathname + window.location.search;
}

function hasAdminToken(): boolean {
  try {
    const token = localStorage.getItem('adminToken');
    return Boolean(token && token.trim());
  } catch {
    return false;
  }
}

export function logBootInfo(): void {
  // Only run in development and when debug flag is set
  if (!import.meta.env.DEV) return;
  
  try {
    const debugBoot = localStorage.getItem('debugBoot');
    if (debugBoot !== '1') return;

    console.group('🚀 Boot Debug Info');
    console.log('📡 API Base:', getApiBase());
    console.log('📍 Current Route:', getCurrentRoute());
    console.log('🔧 Mode:', import.meta.env.MODE);
    console.log('🔑 Admin Token:', hasAdminToken() ? 'Present' : 'Not set');
    console.groupEnd();
  } catch (error) {
    console.warn('Boot debug failed:', error);
  }
}
