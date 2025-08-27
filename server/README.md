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

- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins (supports wildcards like `*.vercel.app`)
- `PORT` - Server port (automatically set by Render, defaults to 8080 locally)

## 🌐 CORS Configuration

The server uses environment-driven CORS configuration with wildcard support.

### Setting ALLOWED_ORIGINS

**Format**: Comma-separated list of origins
**Wildcard Support**: Use `*.domain.com` for subdomain matching

**Example**:
```bash
ALLOWED_ORIGINS=https://dahligarciamarquez.com,*.vercel.app,http://localhost:5173
```

### Typical Production Values

- **Custom Domain**: `https://dahligarciamarquez.com`
- **Vercel Previews**: `*.vercel.app` (matches all Vercel preview deployments)
- **Local Development**: `http://localhost:5173`

### Default Values

If `ALLOWED_ORIGINS` is not set, the server defaults to:
- `https://dahligarciamarquez.com`
- `*.vercel.app`
- `http://localhost:5173`

### CORS Middleware Location

The CORS middleware is configured early in the middleware stack (before JSON parsing) and logs allowed origins on server startup. Check the console output to verify your origins are loaded correctly.

## 🚢 Deployment on Render

1. **Connect your repository** to Render
2. **Create a new Web Service**
3. **Set the following configuration:**
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment Variables**: 
     - `ALLOWED_ORIGINS` (comma-separated list of allowed origins)

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
