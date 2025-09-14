// client/src/features/admin/AdminProvider.jsx
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { apiAdminGet, AdminApiError } from "../../lib/api";

const AdminContext = createContext({ 
  isAdmin: false, 
  loading: true, 
  error: null, 
  refreshAdmin: () => {} 
});

export function AdminProvider({ children }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const check = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiAdminGet("/api/admin/health");
      setIsAdmin(!!res?.ok);
    } catch (err) {
      setIsAdmin(false);
      if (err instanceof AdminApiError) {
        setError({
          status: err.status,
          message: err.message,
          isAuthError: err.status === 401,
          isNotFoundError: err.status === 404,
          isNetworkError: err.kind === 'network'
        });
      } else {
        setError({
          status: 0,
          message: 'Network error occurred',
          isAuthError: false,
          isNotFoundError: false,
          isNetworkError: true
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    check(); 
  }, [check]);

  return (
    <AdminContext.Provider value={{ isAdmin, loading, error, refreshAdmin: check }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  return useContext(AdminContext);
}
