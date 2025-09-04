// client/src/features/dashboard/components/AdminTokenControls.jsx
import { ensureAdminToken, clearAdminToken } from "../../../lib/adminAuth";
import { useAdmin } from "../../admin/AdminProvider";

export default function AdminTokenControls({ onAfter }) {
  const { refreshAdmin } = useAdmin();
  
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
      <button 
        onClick={() => { 
          ensureAdminToken(); 
          refreshAdmin(); 
          onAfter?.(); 
        }}
        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Enter Token
      </button>
      <button 
        onClick={() => { 
          clearAdminToken(); 
          refreshAdmin(); 
          onAfter?.(); 
          // Reload page to ensure complete logout
          window.location.reload();
        }}
        className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
      >
        Log Out
      </button>
    </div>
  );
}
