#!/usr/bin/env node
/**
 * Development Doctor - Diagnoses common server issues
 * Run with: node --import tsx scripts/dev-doctor.ts
 */

// Safe fallback to load envs if script is run without --env-file
try { 
  await import('dotenv/config'); 
} catch {}

// Import fetch polyfill if needed
let fetchImplementation: typeof fetch;

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  details: string;
  required: boolean;
}

// Compute base URL and token
const port = Number(process.env.PORT || 8080);
const BASE_URL = `http://localhost:${port}`;
const adminToken = (process.env.SERVER_ADMIN_TOKEN || '').trim();

// Colors for console output
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 3000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetchImplementation(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeout);
    return response;
  } catch (error: any) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

async function checkHealthz(): Promise<CheckResult> {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/healthz`);
    
    if (response.status === 200) {
      return {
        name: 'Health Check',
        status: 'pass',
        details: 'Server is responding',
        required: true
      };
    } else {
      return {
        name: 'Health Check',
        status: 'fail',
        details: `Expected 200, got ${response.status}`,
        required: true
      };
    }
  } catch (error: any) {
    return {
      name: 'Health Check',
      status: 'fail',
      details: `Connection failed: ${error.message}`,
      required: true
    };
  }
}

async function checkCORSPreflight(): Promise<CheckResult> {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/api/admin/health`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:5173',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization'
      }
    });
    
    if (response.status === 204 || response.status === 200) {
      const allowOrigin = response.headers.get('Access-Control-Allow-Origin');
      if (allowOrigin === 'http://localhost:5173' || allowOrigin === '*') {
        return {
          name: 'CORS Preflight',
          status: 'pass',
          details: `Allow-Origin: ${allowOrigin}`,
          required: true
        };
      } else {
        return {
          name: 'CORS Preflight',
          status: 'fail',
          details: `Missing/invalid Allow-Origin header: ${allowOrigin}`,
          required: true
        };
      }
    } else {
      return {
        name: 'CORS Preflight',
        status: 'fail',
        details: `Expected 204/200, got ${response.status}`,
        required: true
      };
    }
  } catch (error: any) {
    return {
      name: 'CORS Preflight',
      status: 'fail',
      details: `Request failed: ${error.message}`,
      required: true
    };
  }
}

async function checkAdminHealth(): Promise<CheckResult> {
  // If no admin token, record SKIP and do not count as failure
  if (!adminToken) {
    return {
      name: 'Admin Health',
      status: 'skip',
      details: 'SERVER_ADMIN_TOKEN not set',
      required: false
    };
  }

  try {
    const response = await fetchWithTimeout(`${BASE_URL}/api/admin/health`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
    
    if (response.status === 200) {
      const data = await response.json();
      return {
        name: 'Admin Health',
        status: 'pass',
        details: `Admin API responding: ${data.status || 'OK'}`,
        required: true
      };
    } else if (response.status === 401) {
      return {
        name: 'Admin Health',
        status: 'fail',
        details: 'Invalid admin token',
        required: true
      };
    } else {
      return {
        name: 'Admin Health',
        status: 'fail',
        details: `Expected 200, got ${response.status}`,
        required: true
      };
    }
  } catch (error: any) {
    return {
      name: 'Admin Health',
      status: 'fail',
      details: `Request failed: ${error.message}`,
      required: true
    };
  }
}

async function checkPostsAuth(): Promise<CheckResult> {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/api/posts`);
    
    if (response.status === 401) {
      return {
        name: 'Posts Auth',
        status: 'pass',
        details: 'Correctly requires authentication',
        required: true
      };
    } else {
      return {
        name: 'Posts Auth',
        status: 'warn',
        details: `Expected 401, got ${response.status} (may be policy change)`,
        required: false
      };
    }
  } catch (error: any) {
    return {
      name: 'Posts Auth',
      status: 'fail',
      details: `Request failed: ${error.message}`,
      required: false
    };
  }
}

async function checkStorageHealth(): Promise<CheckResult> {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/api/storage/health`);
    
    if (response.status === 200) {
      const data = await response.json();
      const driver = data.driver || 'unknown';
      const ok = data.ok;
      
      if (ok) {
        return {
          name: 'Storage Health',
          status: 'pass',
          details: `Driver: ${driver}, Status: OK`,
          required: false
        };
      } else {
        return {
          name: 'Storage Health',
          status: 'warn',
          details: `Driver: ${driver}, Status: ${data.details || 'Not OK'}`,
          required: false
        };
      }
    } else if (response.status === 404) {
      return {
        name: 'Storage Health',
        status: 'fail',
        details: 'Endpoint not found - mount /api/storage routes in server.js',
        required: false
      };
    } else {
      return {
        name: 'Storage Health',
        status: 'fail',
        details: `Expected 200, got ${response.status}`,
        required: false
      };
    }
  } catch (error: any) {
    return {
      name: 'Storage Health',
      status: 'fail',
      details: `Request failed: ${error.message}`,
      required: false
    };
  }
}

async function checkDbHealth(): Promise<CheckResult> {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/api/db/health`);
    
    if (response.status === 200) {
      const data = await response.json();
      if (data.ok === true) {
        return {
          name: 'Database Health',
          status: 'pass',
          details: 'Database connection OK',
          required: true
        };
      } else {
        return {
          name: 'Database Health',
          status: 'fail',
          details: `Database not OK: ${JSON.stringify(data)}`,
          required: true
        };
      }
    } else {
      return {
        name: 'Database Health',
        status: 'fail',
        details: `Expected 200, got ${response.status}`,
        required: true
      };
    }
  } catch (error: any) {
    return {
      name: 'Database Health',
      status: 'fail',
      details: `Request failed: ${error.message}`,
      required: true
    };
  }
}

function printResults(results: CheckResult[]): void {
  console.log(colorize('\n🩺 Development Doctor Report', 'bold'));
  console.log(colorize(`📍 Base URL: ${BASE_URL}`, 'reset'));
  console.log(''.padEnd(60, '─'));
  
  // Print table header
  console.log(
    'Status'.padEnd(8) + 
    'Check'.padEnd(20) + 
    'Details'
  );
  console.log(''.padEnd(60, '─'));
  
  // Print results
  results.forEach(result => {
    const statusIcon = result.status === 'pass' ? '✅' : 
                       result.status === 'warn' ? '⚠️' : 
                       result.status === 'skip' ? '⏭️' : '❌';
    const statusColor = result.status === 'pass' ? 'green' : 
                        result.status === 'warn' ? 'yellow' : 
                        result.status === 'skip' ? 'yellow' : 'red';
    
    const status = colorize(statusIcon, statusColor);
    const name = result.name.padEnd(19);
    const details = result.details;
    
    console.log(`${status}      ${name} ${details}`);
  });
  
  console.log(''.padEnd(60, '─'));
  
  // Summary
  const passed = results.filter(r => r.status === 'pass').length;
  const warned = results.filter(r => r.status === 'warn').length;
  const skipped = results.filter(r => r.status === 'skip').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const requiredFailed = results.filter(r => r.status === 'fail' && r.required).length;
  
  console.log(`📊 Summary: ${colorize(`${passed} passed`, 'green')}, ${colorize(`${warned} warned`, 'yellow')}, ${colorize(`${skipped} skipped`, 'yellow')}, ${colorize(`${failed} failed`, 'red')}`);
  
  if (requiredFailed > 0) {
    console.log(colorize(`\n❌ ${requiredFailed} critical checks failed`, 'red'));
    console.log(colorize('\n💡 Common fixes:', 'bold'));
    
    results.forEach(result => {
      if (result.status === 'fail' && result.required) {
        console.log(`   • ${result.name}: ${getFixHint(result)}`);
      }
    });
  } else {
    console.log(colorize('\n✅ All critical checks passed!', 'green'));
  }
  
  console.log(); // Empty line at end
}

function getFixHint(result: CheckResult): string {
  switch (result.name) {
    case 'Health Check':
      return 'Ensure server is running on the correct port';
    case 'CORS Preflight':
      return 'Check CORS configuration in server.js';
    case 'Admin Health':
      return 'Set SERVER_ADMIN_TOKEN (optional in dev; currently skipped)';
    case 'Database Health':
      return 'Check database connection and /api/db/health endpoint';
    case 'Storage Health':
      if (result.details.includes('mount /api/storage')) {
        return 'Add app.use(\'/api/storage\', storageRoutes) to server.js';
      }
      return 'Check storage configuration and health endpoint';
    default:
      return 'Check server logs for more details';
  }
}

async function main(): Promise<void> {
  // Initialize fetch
  if (typeof fetch !== 'undefined') {
    fetchImplementation = fetch;
  } else {
    try {
      // Try to import node-fetch
      const nodeFetch = await import('node-fetch');
      // @ts-ignore
      fetchImplementation = nodeFetch.default;
    } catch (error) {
      console.error('❌ fetch not available and node-fetch not installed');
      console.log('💡 Install node-fetch: npm install node-fetch');
      process.exit(1);
    }
  }

  console.log(colorize('🔍 Running development diagnostics...', 'bold'));
  console.log(`📍 Target: ${BASE_URL}`);
  console.log(`🔑 Admin token: ${adminToken ? 'Set' : 'Not set'}`);
  
  try {
    // Run all checks in parallel
    const checks = await Promise.all([
      checkHealthz(),
      checkCORSPreflight(),
      checkAdminHealth(),
      checkPostsAuth(),
      checkStorageHealth(),
      checkDbHealth()
    ]);
    
    printResults(checks);
    
    // Exit with non-zero code if any required checks failed
    const hasRequiredFailures = checks.some(check => check.status === 'fail' && check.required);
    process.exit(hasRequiredFailures ? 1 : 0);
  } catch (error) {
    console.error(colorize('💥 Error running diagnostics:', 'red'), error);
    process.exit(1);
  }
}

// Run the doctor if this file is executed directly
main().catch(error => {
  console.error(colorize('💥 Doctor crashed:', 'red'), error);
  process.exit(1);
});
