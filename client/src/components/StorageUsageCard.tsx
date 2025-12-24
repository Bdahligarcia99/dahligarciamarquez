import React, { useState, useEffect, useCallback } from 'react';
import { supabaseAdminGet } from '../lib/api';

interface StorageStats {
  database?: {
    size_bytes: number;
    size_formatted: string;
  };
  storage?: {
    size_bytes: number;
    size_formatted: string;
    file_count: number;
  };
}

export default function StorageUsageCard() {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await supabaseAdminGet('/api/admin/storage-stats');
      if (response.ok) {
        setStats(response.stats);
      } else {
        setError(response.error || 'Failed to fetch stats');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch storage stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Progress bar component
  const UsageBar = ({ 
    used, 
    limit, 
    label 
  }: { 
    used: number; 
    limit: number; 
    label: string;
  }) => {
    const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
    const barColor = percentage > 80 ? 'bg-red-500' : percentage > 60 ? 'bg-amber-500' : 'bg-emerald-500';
    
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-gray-600">{label}</span>
          <span className="text-gray-500">{percentage.toFixed(1)}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full ${barColor} transition-all duration-300`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-8 bg-gray-200 rounded" />
          <div className="h-8 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Storage Usage</h3>
        <div className="text-sm text-red-600">{error}</div>
        <button 
          onClick={fetchStats}
          className="mt-2 text-xs text-blue-600 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  // Supabase free tier limits (approximate)
  const DB_LIMIT = 500 * 1024 * 1024; // 500 MB
  const STORAGE_LIMIT = 1 * 1024 * 1024 * 1024; // 1 GB

  return (
    <div className="bg-white rounded-xl border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-900">Storage Usage</h3>
        <button 
          onClick={fetchStats}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          title="Refresh"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <div className="space-y-5">
        {/* Database Usage */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
            <span className="text-sm font-medium text-gray-700">Database</span>
          </div>
          {stats?.database ? (
            <>
              <div className="text-xl font-semibold text-gray-900 mb-2">
                {stats.database.size_formatted}
              </div>
              <UsageBar 
                used={stats.database.size_bytes} 
                limit={DB_LIMIT} 
                label={`of 500 MB (free tier)`}
              />
            </>
          ) : (
            <div className="text-sm text-gray-500">
              Unable to fetch database size
              <div className="text-xs text-gray-400 mt-1">
                Run the SQL function in Supabase
              </div>
            </div>
          )}
        </div>

        {/* Storage Bucket Usage */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-medium text-gray-700">Image Storage</span>
          </div>
          {stats?.storage ? (
            <>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-xl font-semibold text-gray-900">
                  {stats.storage.size_formatted}
                </span>
                <span className="text-xs text-gray-500">
                  ({stats.storage.file_count} files)
                </span>
              </div>
              <UsageBar 
                used={stats.storage.size_bytes} 
                limit={STORAGE_LIMIT} 
                label={`of 1 GB (free tier)`}
              />
            </>
          ) : (
            <div className="text-sm text-gray-500">
              Unable to fetch storage size
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t text-xs text-gray-400">
        Limits shown are for Supabase free tier
      </div>
    </div>
  );
}

