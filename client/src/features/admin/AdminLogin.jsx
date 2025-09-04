// client/src/features/admin/AdminLogin.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiAdminGet } from "../../lib/api";
import { setAdminToken, clearAdminToken } from "../../lib/adminAuth";
import { useAdmin } from "./AdminProvider";

export default function AdminLogin() {
  const [val, setVal] = useState("");
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const { refreshAdmin } = useAdmin();

  async function onSubmit(e) {
    e?.preventDefault();
    setErr(null);
    setLoading(true);
    
    setAdminToken(val.trim());
    
    try {
      const response = await apiAdminGet("/api/admin/health");
      if (response?.ok) {
        refreshAdmin();
        nav("/dashboard");
        return;
      }
      throw new Error("Invalid");
    } catch {
      clearAdminToken();
      setErr("Invalid token. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Login</h1>
        
        <form onSubmit={onSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Admin Token
            </label>
            <input
              type="password"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              placeholder="Enter admin token"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
              required
            />
          </div>
          
          {err && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {err}
            </div>
          )}
          
          <button 
            type="submit"
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Verifying...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
