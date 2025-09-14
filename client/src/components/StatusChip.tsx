import React, { useState, useEffect, useCallback } from 'react';
import { buildApiUrl } from '../lib/apiBase.ts';
import { adminGet } from '../lib/api.js';

interface HealthCheck {
  name: string;
  url: string;
  status: number | null;
  text: string;
  error?: string;
}

interface SystemStatus {
  overall: 'green' | 'yellow' | 'red';
  checks: HealthCheck[];
  lastCheck: string;
}

const StatusChip: React.FC = () => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Only render in development
  if (!import.meta.env.DEV) {
    return null;
  }

  // Get admin token to watch for changes
  const adminToken = typeof window !== 'undefined' ? localStorage.getItem('adminToken') || '' : '';
  const apiBase = buildApiUrl('');

  const checkHealth = useCallback(async (): Promise<SystemStatus> => {
    const checks: HealthCheck[] = [];
    
    // Check admin health (requires auth)
    const adminUrl = buildApiUrl('/api/admin/health');
    try {
      const adminResponse = await adminGet('/api/admin/health');
      const adminText = adminResponse.status === 200 ? 'OK' : await adminResponse.text();
      checks.push({
        name: 'Admin',
        url: adminUrl,
        status: adminResponse.status,
        text: adminText
      });
    } catch (error: any) {
      checks.push({
        name: 'Admin',
        url: adminUrl,
        status: null,
        text: 'Network/CORS Error',
        error: error.message || 'Unknown error'
      });
    }

    // Check DB health (no auth required)
    const dbUrl = buildApiUrl('/api/db/health');
    try {
      const dbResponse = await fetch(dbUrl, { mode: 'cors' });
      const dbText = dbResponse.status === 200 ? 'OK' : await dbResponse.text();
      checks.push({
        name: 'DB',
        url: dbUrl,
        status: dbResponse.status,
        text: dbText
      });
    } catch (error: any) {
      checks.push({
        name: 'DB',
        url: dbUrl,
        status: null,
        text: 'Network/CORS Error',
        error: error.message || 'Unknown error'
      });
    }

    // Check storage health (no auth required)
    const storageUrl = buildApiUrl('/api/storage/health');
    try {
      const storageResponse = await fetch(storageUrl, { mode: 'cors' });
      let storageText = 'Unknown';
      let storageOk = false;
      
      if (storageResponse.status === 200) {
        try {
          const storageData = await storageResponse.json();
          storageOk = storageData.ok === true;
          const driver = storageData.driver || 'unknown';
          storageText = storageOk ? `OK (driver=${driver})` : `Not OK (driver=${driver})`;
        } catch (parseError) {
          storageText = 'Invalid JSON';
        }
      } else {
        storageText = await storageResponse.text();
      }
      
      checks.push({
        name: 'Storage',
        url: storageUrl,
        status: storageResponse.status,
        text: storageText
      });
    } catch (error: any) {
      checks.push({
        name: 'Storage',
        url: storageUrl,
        status: null,
        text: 'Network/CORS Error',
        error: error.message || 'Unknown error'
      });
    }

    // Determine overall status based on requirements:
    // - Green: Admin=200 AND DB=200 AND Storage JSON has ok === true
    // - Yellow: Any 401 or 404
    // - Red: Any network/CORS error or 5xx/parse error
    let overall: 'green' | 'yellow' | 'red' = 'green';

    // Check for yellow conditions (401/404)
    const hasAuth401or404 = checks.some(check => check.status === 401 || check.status === 404);
    if (hasAuth401or404) {
      overall = 'yellow';
    }

    // Check for red conditions (network errors, 5xx, or parse errors)
    const hasNetworkError = checks.some(check => check.status === null);
    const has5xxError = checks.some(check => check.status !== null && check.status >= 500);
    const hasParseError = checks.some(check => check.text === 'Invalid JSON');
    if (hasNetworkError || has5xxError || hasParseError) {
      overall = 'red';
    }

    // Check for green conditions (all must be true)
    const adminCheck = checks.find(c => c.name === 'Admin');
    const dbCheck = checks.find(c => c.name === 'DB');
    const storageCheck = checks.find(c => c.name === 'Storage');
    
    const adminOk = adminCheck?.status === 200;
    const dbOk = dbCheck?.status === 200;
    const storageOk = storageCheck?.status === 200 && storageCheck.text.includes('OK (driver=');
    
    if (!(adminOk && dbOk && storageOk)) {
      // If not all green conditions are met, but no yellow/red conditions, default to red
      if (overall === 'green') {
        overall = 'red';
      }
    }

    return {
      overall,
      checks,
      lastCheck: new Date().toLocaleTimeString()
    };
  }, [adminToken, apiBase]);

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

  // Run checks when component mounts or when admin token/API base changes
  useEffect(() => {
    handleRefresh();
  }, [handleRefresh]);

  if (!status) {
    return (
      <div className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
        <div className="w-2 h-2 bg-gray-400 rounded-full mr-1 animate-pulse"></div>
        System: Checking...
      </div>
    );
  }

  const getStatusColor = () => {
    switch (status.overall) {
      case 'green': return 'bg-green-100 text-green-800';
      case 'yellow': return 'bg-yellow-100 text-yellow-800';
      case 'red': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusDot = () => {
    switch (status.overall) {
      case 'green': return 'bg-green-500';
      case 'yellow': return 'bg-yellow-500';
      case 'red': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusText = () => {
    switch (status.overall) {
      case 'green': return 'Green';
      case 'yellow': return 'Yellow';
      case 'red': return 'Red';
      default: return 'Unknown';
    }
  };

  return (
    <div className="relative inline-block">
      <button
        className={`inline-flex items-center px-2 py-1 text-xs rounded-full transition-colors hover:opacity-80 ${getStatusColor()}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={handleRefresh}
        disabled={isRefreshing}
        title="Click to refresh status"
      >
        <div className={`w-2 h-2 rounded-full mr-1 ${getStatusDot()} ${isRefreshing ? 'animate-pulse' : ''}`}></div>
        System: {getStatusText()}
      </button>

      {showTooltip && (
        <div className="absolute top-full left-0 mt-1 w-96 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-gray-900">System Status</div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          
          <div className="space-y-2 mb-3">
            {status.checks.map((check, index) => (
              <div key={index} className="text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{check.name}:</span>
                  <div className="flex items-center">
                    <div className={`w-1.5 h-1.5 rounded-full mr-1 ${
                      check.status === 200 ? 'bg-green-500' :
                      check.status === 401 || check.status === 404 ? 'bg-yellow-500' : 
                      'bg-red-500'
                    }`}></div>
                    <span className="text-gray-600">
                      {check.status !== null ? `${check.status} ${check.text}` : check.text}
                    </span>
                  </div>
                </div>
                <div className="text-gray-500 text-xs mt-1 break-all">
                  {check.url}
                </div>
                {check.error && (
                  <div className="text-red-500 text-xs mt-1">
                    Error: {check.error}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 pt-2 text-xs text-gray-500">
            <div>Last check: {status.lastCheck}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusChip;