// client/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Force environment variable reload
  envDir: './',
  server: {
    port: 5173,
    proxy: {
      // Proxy API calls to backend when VITE_API_BASE_URL isn't set
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: 'dist',
  },
})