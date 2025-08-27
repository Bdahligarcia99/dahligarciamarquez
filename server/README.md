# Express.js Backend Server

A production-ready Express.js backend server designed for deployment on Render.

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm

### Local Development

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables** (optional)
   ```bash
   cp .env.example .env
   ```

3. **Run the development server**
   ```bash
   npm run dev
   ```

4. **Test the API**
   
   Visit the following endpoints:
   - Health check: `http://localhost:8080/healthz`
   - Test endpoint: `http://localhost:8080/api/hello`

## 📡 API Endpoints

- `GET /healthz` - Health check endpoint returning `{ ok: true, uptime: <number> }`
- `GET /api/hello` - Test endpoint returning a welcome message

## 🔧 Environment Variables

- `CORS_ORIGIN` - Custom domain for CORS (optional, defaults to localhost:5173)
- `PORT` - Server port (automatically set by Render, defaults to 8080 locally)

## 🌐 CORS Configuration

The server is configured to accept requests from:
- Custom domain specified in `CORS_ORIGIN` environment variable
- `http://localhost:5173` (Vite development server)
- Any `*.vercel.app` domain (for Vercel preview deployments)

## 🚢 Deployment on Render

1. **Connect your repository** to Render
2. **Create a new Web Service**
3. **Set the following configuration:**
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment Variables**: 
     - `CORS_ORIGIN` (your frontend domain)

Note: Render automatically sets the `PORT` environment variable, so no hardcoding is needed.

## 📝 Scripts

- `npm start` - Start the production server
- `npm run dev` - Start the development server

## ✨ Features

- ✅ Production-ready Express.js server
- ✅ CORS configured with domain allowlist
- ✅ Health check endpoint for monitoring
- ✅ Clean, minimal codebase
- ✅ Environment variable support
- ✅ Ready for Render deployment
