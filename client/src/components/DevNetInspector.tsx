// client/src/components/DevNetInspector.tsx
import { useState, useEffect, useCallback } from 'react';
import { getApiBase } from '../lib/api';

interface RequestDetail {
  id: string;
  method: string;
  url: string;
  startedAt: number;
  status?: number;
  ok?: boolean;
  durationMs?: number;
  error?: string;
  serverUrl?: string;
}

const DevNetInspector = () => {
  const [requests, setRequests] = useState<RequestDetail[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);
  const [lastActivity, setLastActivity] = useState(Date.now());
  
  // Only render in dev and when enabled
  if (!import.meta.env.DEV || localStorage.getItem('debugNet') !== '1') {
    return null;
  }

  const handleRequestStart = useCallback((event: CustomEvent) => {
    const detail = event.detail as RequestDetail;
    setRequests(prev => {
      const updated = [detail, ...prev.slice(0, 19)]; // Keep last 20
      return updated;
    });
    setLastActivity(Date.now());
  }, []);

  const handleRequestEnd = useCallback((event: CustomEvent) => {
    const detail = event.detail as RequestDetail;
    setRequests(prev => 
      prev.map(req => 
        req.id === detail.id 
          ? { ...req, ...detail }
          : req
      )
    );
    setLastActivity(Date.now());
  }, []);

  useEffect(() => {
    window.addEventListener('app:request:start', handleRequestStart as EventListener);
    window.addEventListener('app:request:end', handleRequestEnd as EventListener);
    
    return () => {
      window.removeEventListener('app:request:start', handleRequestStart as EventListener);
      window.removeEventListener('app:request:end', handleRequestEnd as EventListener);
    };
  }, [handleRequestStart, handleRequestEnd]);

  // Keyboard toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        const current = localStorage.getItem('debugNet') === '1';
        localStorage.setItem('debugNet', current ? '0' : '1');
        // Force re-render by dispatching storage event
        window.dispatchEvent(new Event('storage'));
        window.location.reload(); // Simple way to re-render
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      console.log('[DevNetInspector] Copied to clipboard:', text);
    });
  };

  const getStatusColor = (status?: number, error?: string) => {
    if (error) return 'text-red-500';
    if (!status) return 'text-gray-500';
    if (status >= 200 && status < 300) return 'text-green-500';
    if (status >= 400) return 'text-red-500';
    return 'text-yellow-500';
  };

  const isApiReachable = () => {
    const thirtySecondsAgo = Date.now() - 30000;
    return lastActivity > thirtySecondsAgo;
  };

  if (isMinimized) {
    return (
      <div 
        className="fixed bottom-4 left-4 z-50 bg-black text-white rounded px-2 py-1 text-xs cursor-pointer hover:bg-gray-800"
        onClick={() => setIsMinimized(false)}
        style={{ fontFamily: 'monospace' }}
      >
        API ({requests.length})
      </div>
    );
  }

  return (
    <div 
      className="fixed bottom-4 left-4 z-50 bg-black text-white rounded-lg shadow-lg border border-gray-600"
      style={{ width: '220px', fontFamily: 'monospace', fontSize: '11px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-gray-600">
        <div className="flex items-center gap-2">
          <div 
            className={`w-2 h-2 rounded-full ${isApiReachable() ? 'bg-green-500' : 'bg-red-500'}`}
            title={isApiReachable() ? 'API reachable (last 30s)' : 'No API activity (30s+)'}
          />
          <span className="text-xs">API Inspector</span>
        </div>
        <button 
          onClick={() => setIsMinimized(true)}
          className="text-gray-400 hover:text-white text-xs"
        >
          ─
        </button>
      </div>

      {/* API Base */}
      <div className="p-2 border-b border-gray-600 text-xs">
        <div className="text-gray-400">Base:</div>
        <div className="text-blue-300 break-all">{getApiBase()}</div>
      </div>

      {/* Requests */}
      <div className="max-h-60 overflow-y-auto">
        {requests.length === 0 ? (
          <div className="p-2 text-gray-500 text-center">No requests</div>
        ) : (
          requests.map((req) => (
            <div key={req.id} className="border-b border-gray-700 last:border-b-0">
              <div 
                className="p-2 cursor-pointer hover:bg-gray-800"
                onClick={() => setExpandedRequest(expandedRequest === req.id ? null : req.id)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs">
                    <span className="text-blue-300">{req.method}</span>
                    <span className="text-gray-300 ml-1">
                      {req.url.replace(getApiBase(), '')}
                    </span>
                  </span>
                  <span className={`text-xs ${getStatusColor(req.status, req.error)}`}>
                    {req.error ? 'ERR' : req.status || '...'}
                  </span>
                </div>
                {req.durationMs && (
                  <div className="text-gray-500 text-xs mt-1">
                    {req.durationMs}ms
                  </div>
                )}
              </div>
              
              {expandedRequest === req.id && (
                <div className="px-2 pb-2 bg-gray-900">
                  <div className="text-xs mb-1">
                    <span className="text-gray-400">Full URL:</span>
                  </div>
                  <div className="text-xs text-blue-300 break-all mb-2 font-mono">
                    {req.url}
                  </div>
                  {req.serverUrl && req.serverUrl !== req.url && (
                    <div className="text-xs mb-2">
                      <span className="text-gray-400">Server echo:</span>
                      <div className="text-yellow-300 break-all font-mono">{req.serverUrl}</div>
                    </div>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(req.url);
                    }}
                    className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded"
                    title="Copy URL to clipboard"
                  >
                    📋 Copy URL
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-gray-600 text-xs text-gray-400">
        <div>Ctrl+Alt+D to toggle</div>
        <div>{requests.length}/20 requests</div>
      </div>
    </div>
  );
};

export default DevNetInspector;
