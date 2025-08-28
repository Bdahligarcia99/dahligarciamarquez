// client/src/features/dashboard/components/AdminTokenControls.jsx
import { ensureAdminToken, clearAdminToken } from "../../../lib/adminAuth";

export default function AdminTokenControls({ onAfter }) {
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
      <button 
        onClick={() => { 
          ensureAdminToken(); 
          onAfter?.(); 
        }}
        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Enter Token
      </button>
      <button 
        onClick={() => { 
          clearAdminToken(); 
          onAfter?.(); 
        }}
        className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
      >
        Reset Token
      </button>
    </div>
  );
}
