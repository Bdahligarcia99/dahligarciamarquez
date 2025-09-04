// client/src/components/AdminTokenModal.jsx
import { useState } from "react";
import { apiAdminGet } from "../lib/api";
import { setAdminToken, clearAdminToken } from "../lib/adminAuth";
import { useAdmin } from "../features/admin/AdminProvider";
import { useNavigate } from "react-router-dom";

export default function AdminTokenModal({ open, onClose, redirectToDashboard = true }) {
  const [val, setVal] = useState("");
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const { refreshAdmin } = useAdmin();
  const nav = useNavigate();

  if (!open) return null;

  async function submit() {
    setErr(null);
    setLoading(true);
    
    setAdminToken(val.trim());
    
    try {
      const response = await apiAdminGet("/api/admin/health");
      if (response?.ok) {
        refreshAdmin();
        if (redirectToDashboard) nav("/dashboard");
        onClose();
        return;
      }
      throw new Error("Invalid");
    } catch {
      clearAdminToken();
      setErr("Invalid token.");
    } finally {
      setLoading(false);
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      submit();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-gray-900 mb-4">Enter Admin Token</h3>
        
        <input 
          type="password" 
          value={val} 
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Admin token"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
          disabled={loading}
          autoFocus
        />
        
        {err && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {err}
          </div>
        )}
        
        <div className="flex justify-end space-x-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            disabled={loading}
          >
            Cancel
          </button>
          <button 
            onClick={submit}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Verifying...' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
