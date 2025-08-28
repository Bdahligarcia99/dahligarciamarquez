// client/src/features/dashboard/RequireAdmin.jsx
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { ensureAdminToken } from "../../lib/adminAuth";

export default function RequireAdmin({ children }) {
  const [ok, setOk] = useState(null);
  
  useEffect(() => { 
    setOk(!!ensureAdminToken()); 
  }, []);
  
  if (ok === null) return <div style={{padding:16}}>Checking admin…</div>;
  return ok ? <>{children}</> : <Navigate to="/" replace />;
}
