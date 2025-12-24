// client/src/components/SystemStatusCard.tsx
// System health status card for the dashboard overview
import React, { useState, useEffect, useCallback } from 'react';
import { buildApiUrl } from '../lib/apiBase.ts';
import { supabaseAdminGet } from '../lib/api.js';

interface HealthCheck {
  name: string;
  url: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  error?: string;
}

interface SystemStatus {
  overall: 'green' | 'yellow' | 'red';
  checks: HealthCheck[];
  lastCheck: string;
}

const SystemStatusCard: React.FC = () => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const checkHealth = useCallback(async (): Promise<SystemStatus> => {
    const checks: HealthCheck[] = [];
    
    // Check server health (basic uptime)
    const serverUrl = buildApiUrl('/healthz');
    try {
      const serverResponse = await fetch(serverUrl, { mode: 'cors' });
      if (serverResponse.ok) {
        const serverData = await serverResponse.json();
        checks.push({
          name: 'Server',
          url: serverUrl,
          status: serverData.ok ? 'ok' : 'warning',
          message: serverData.ok ? 'Online' : 'Issue detected'
        });
      } else {
        checks.push({
          name: 'Server',
          url: serverUrl,
          status: 'error',
          message: `HTTP ${serverResponse.status}`
        });
      }
    } catch (error: any) {
      checks.push({
        name: 'Server',
        url: serverUrl,
        status: 'error',
        message: 'Unreachable',
        error: error.message || 'Unknown error'
      });
    }

    // Check database health via Supabase (POST /api/auth/db-ping)
    const dbUrl = buildApiUrl('/api/auth/db-ping');
    try {
      const dbResponse = await fetch(dbUrl, { 
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' }
      });
      if (dbResponse.ok) {
        const dbData = await dbResponse.json();
        checks.push({
          name: 'Database',
          url: dbUrl,
          status: dbData.ok ? 'ok' : 'warning',
          message: dbData.ok ? 'Connected' : 'Issue detected'
        });
      } else {
        checks.push({
          name: 'Database',
          url: dbUrl,
          status: 'error',
          message: `HTTP ${dbResponse.status}`
        });
      }
    } catch (error: any) {
      checks.push({
        name: 'Database',
        url: dbUrl,
        status: 'error',
        message: 'Connection failed',
        error: error.message || 'Unknown error'
      });
    }

    // Check storage health
    const storageUrl = buildApiUrl('/api/storage/health');
    try {
      const storageResponse = await fetch(storageUrl, { mode: 'cors' });
      if (storageResponse.ok) {
        const storageData = await storageResponse.json();
        const driver = storageData.driver || 'unknown';
        checks.push({
          name: 'Storage',
          url: storageUrl,
          status: storageData.ok ? 'ok' : 'warning',
          message: storageData.ok ? `OK (${driver})` : `Issue (${driver})`
        });
      } else {
        checks.push({
          name: 'Storage',
          url: storageUrl,
          status: 'error',
          message: `HTTP ${storageResponse.status}`
        });
      }
    } catch (error: any) {
      checks.push({
        name: 'Storage',
        url: storageUrl,
        status: 'error',
        message: 'Connection failed',
        error: error.message || 'Unknown error'
      });
    }

    // Check admin API health (requires Supabase auth)
    const adminUrl = buildApiUrl('/api/admin/health');
    try {
      const adminData = await supabaseAdminGet('/api/admin/health');
      checks.push({
        name: 'Admin API',
        url: adminUrl,
        status: adminData.ok ? 'ok' : 'warning',
        message: adminData.ok ? `OK (v${adminData.version || 'unknown'})` : 'Not OK'
      });
    } catch (error: any) {
      const isAuthError = error.message?.includes('Authentication') || error.message?.includes('401');
      checks.push({
        name: 'Admin API',
        url: adminUrl,
        status: isAuthError ? 'warning' : 'error',
        message: isAuthError ? 'Auth Required' : 'Error',
        error: error.message || 'Unknown error'
      });
    }

    // Determine overall status
    const hasError = checks.some(c => c.status === 'error');
    const hasWarning = checks.some(c => c.status === 'warning');
    
    let overall: 'green' | 'yellow' | 'red' = 'green';
    if (hasError) overall = 'red';
    else if (hasWarning) overall = 'yellow';

    return {
      overall,
      checks,
      lastCheck: new Date().toLocaleTimeString()
    };
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const newStatus = await checkHealth();
      setStatus(newStatus);
    } catch (error) {
      console.error('Failed to refresh status:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [checkHealth]);

  useEffect(() => {
    handleRefresh();
  }, [handleRefresh]);

  const getOverallColor = () => {
    if (!status) return 'bg-gray-100 text-gray-600';
    switch (status.overall) {
      case 'green': return 'bg-green-100 text-green-800';
      case 'yellow': return 'bg-yellow-100 text-yellow-800';
      case 'red': return 'bg-red-100 text-red-800';
    }
  };

  const getOverallText = () => {
    if (!status) return 'Checking...';
    switch (status.overall) {
      case 'green': return 'All Systems Operational';
      case 'yellow': return 'Some Issues Detected';
      case 'red': return 'System Issues';
    }
  };

  const getStatusIcon = (checkStatus: 'ok' | 'warning' | 'error') => {
    switch (checkStatus) {
      case 'ok':
        return (
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className={`px-4 py-3 flex items-center justify-between ${getOverallColor()}`}>
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="font-medium">{getOverallText()}</span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-1 rounded hover:bg-black hover:bg-opacity-10 transition-colors disabled:opacity-50"
          title="Refresh status"
        >
          <svg className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Status List */}
      <div className="divide-y divide-gray-100">
        {status?.checks.map((check, index) => (
          <div key={index} className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon(check.status)}
              <div>
                <div className="font-medium text-gray-900 text-sm">{check.name}</div>
                {check.error && (
                  <div className="text-xs text-red-500 mt-0.5">{check.error}</div>
                )}
              </div>
            </div>
            <span className={`text-sm ${
              check.status === 'ok' ? 'text-green-600' :
              check.status === 'warning' ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {check.message}
            </span>
          </div>
        ))}
        
        {!status && (
          <div className="px-4 py-6 text-center text-gray-400 text-sm">
            Checking system status...
          </div>
        )}
      </div>

      {/* Footer */}
      {status && (
        <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 border-t border-gray-100">
          Last checked: {status.lastCheck}
        </div>
      )}
    </div>
  );
};

export default SystemStatusCard;

