// client/src/features/dashboard/DevToolsPage.jsx
// Dev Tools - "Pop the hood" view of the site's technical architecture

const DevToolsPage = () => {
  return (
    <div className="p-8 max-w-6xl w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dev Tools</h1>
        <p className="text-gray-500 mt-1">Pop the hood and see the mechanics of the site</p>
      </div>

      {/* Engine Schematic Placeholder */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl shadow-lg p-8 mb-8">
        <div className="flex items-center justify-center">
          {/* ASCII-style Engine Schematic */}
          <div className="font-mono text-xs sm:text-sm text-green-400 whitespace-pre leading-relaxed">
{`
    ╔═══════════════════════════════════════════════════════════════╗
    ║                    SYSTEM ARCHITECTURE                         ║
    ╠═══════════════════════════════════════════════════════════════╣
    ║                                                                ║
    ║   ┌─────────────┐       ┌─────────────┐       ┌─────────────┐ ║
    ║   │   CLIENT    │       │   SERVER    │       │  DATABASE   │ ║
    ║   │  (React)    │◄─────►│  (Express)  │◄─────►│ (Supabase)  │ ║
    ║   │  Vite + TS  │  API  │  Node.js    │  SQL  │ PostgreSQL  │ ║
    ║   └──────┬──────┘       └──────┬──────┘       └──────┬──────┘ ║
    ║          │                     │                     │        ║
    ║          ▼                     ▼                     ▼        ║
    ║   ┌─────────────┐       ┌─────────────┐       ┌─────────────┐ ║
    ║   │   ROUTES    │       │  ENDPOINTS  │       │   TABLES    │ ║
    ║   │ /dashboard  │       │ /api/posts  │       │  profiles   │ ║
    ║   │ /stories    │       │ /api/images │       │  posts      │ ║
    ║   │ /auth/*     │       │ /api/upload │       │  journals   │ ║
    ║   │ /web-ui     │       │ /api/health │       │  images     │ ║
    ║   └─────────────┘       └─────────────┘       └─────────────┘ ║
    ║                                                                ║
    ║   ┌───────────────────────────────────────────────────────┐   ║
    ║   │                    SERVICES LAYER                      │   ║
    ║   │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │   ║
    ║   │  │   Auth   │  │  Image   │  │  Posts   │  │ Layout │ │   ║
    ║   │  │ Service  │  │ Service  │  │ Service  │  │ Engine │ │   ║
    ║   │  └──────────┘  └──────────┘  └──────────┘  └────────┘ │   ║
    ║   └───────────────────────────────────────────────────────┘   ║
    ║                                                                ║
    ╚═══════════════════════════════════════════════════════════════╝
`}
          </div>
        </div>
      </div>

      {/* Status Cards - Coming Soon */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Frontend Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Frontend</h3>
              <p className="text-xs text-gray-500">React + Vite</p>
            </div>
          </div>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Framework</span>
              <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">React 18</span>
            </div>
            <div className="flex justify-between">
              <span>Bundler</span>
              <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">Vite</span>
            </div>
            <div className="flex justify-between">
              <span>Styling</span>
              <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">Tailwind</span>
            </div>
          </div>
        </div>

        {/* Backend Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Backend</h3>
              <p className="text-xs text-gray-500">Node.js + Express</p>
            </div>
          </div>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Runtime</span>
              <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">Node.js</span>
            </div>
            <div className="flex justify-between">
              <span>Framework</span>
              <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">Express</span>
            </div>
            <div className="flex justify-between">
              <span>Language</span>
              <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">TypeScript</span>
            </div>
          </div>
        </div>

        {/* Database Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Database</h3>
              <p className="text-xs text-gray-500">Supabase</p>
            </div>
          </div>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Engine</span>
              <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">PostgreSQL</span>
            </div>
            <div className="flex justify-between">
              <span>Auth</span>
              <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">Supabase Auth</span>
            </div>
            <div className="flex justify-between">
              <span>Storage</span>
              <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">Supabase Storage</span>
            </div>
          </div>
        </div>

        {/* API Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">API</h3>
              <p className="text-xs text-gray-500">REST + RPC</p>
            </div>
          </div>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Protocol</span>
              <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">REST</span>
            </div>
            <div className="flex justify-between">
              <span>Format</span>
              <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">JSON</span>
            </div>
            <div className="flex justify-between">
              <span>Auth</span>
              <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">JWT Bearer</span>
            </div>
          </div>
        </div>
      </div>

      {/* Coming Soon Banner */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-xl p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-600 rounded-full mb-4">
          <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Full Dev Tools Coming Soon</h2>
        <p className="text-gray-300 max-w-md mx-auto">
          Interactive API explorer, live endpoint testing, database schema viewer, 
          performance metrics, and real-time logs will be available here.
        </p>
      </div>
    </div>
  )
}

export default DevToolsPage
