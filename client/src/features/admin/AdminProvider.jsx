// client/src/features/admin/AdminProvider.jsx
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { apiAdminGet } from "../../lib/api";

const AdminContext = createContext({ isAdmin: false, loading: true, refreshAdmin: () => {} });

export function AdminProvider({ children }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiAdminGet("/api/admin/health");
      setIsAdmin(!!res?.ok);
    } catch {
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    check(); 
  }, [check]);

  return (
    <AdminContext.Provider value={{ isAdmin, loading, refreshAdmin: check }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  return useContext(AdminContext);
}
