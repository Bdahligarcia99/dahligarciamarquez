# React Frontend Client

A React + Vite frontend application designed for deployment on Vercel.

## 🚀 Local Development

### Prerequisites

- Node.js (v16 or higher)
- npm

### Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Update `.env.local` with your API URL:
   ```
   VITE_API_URL=http://localhost:8080
   ```

3. **Run the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   
   Visit `http://localhost:5173` (default Vite port)
   
   To change the port, update `vite.config.js`:
   ```js
   server: {
     port: 3000, // Your preferred port
   }
   ```

## 📡 API Configuration

The app uses `VITE_API_URL` environment variable for API calls:

- **Local Development**: Set to your local backend (e.g., `http://localhost:8080`)
- **Production**: Set to your deployed backend (e.g., `https://your-api.onrender.com`)

### Testing API Connection

The app includes a built-in API test section on the home page that:
- Displays the current `VITE_API_URL` value
- Provides a "Test API Connection" button
- Shows API response or error messages

## 🌐 Deployment on Vercel

### Manual Deployment Steps

1. **Connect your repository** to Vercel
2. **Configure the project settings:**
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

3. **Set environment variables** in Vercel dashboard:
   - Go to Project Settings → Environment Variables
   - Add `VITE_API_URL` for both **Preview** and **Production**
   - Example: `https://your-backend.onrender.com`

4. **Deploy**
   - Vercel will automatically build and deploy your app
   - The `vercel.json` file ensures SPA routing works correctly

### Environment Variables in Vercel

| Variable | Preview | Production | Example |
|----------|---------|------------|---------|
| `VITE_API_URL` | `https://your-backend.onrender.com` | `https://your-backend.onrender.com` | Backend API URL |

## 🔧 SPA Routing

The app uses React Router for client-side routing. The `vercel.json` file includes:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ]
}
```

This ensures that all routes (like `/blog/my-post`) serve the main `index.html` file, allowing React Router to handle routing client-side.

## 📝 Scripts

- `npm run dev` - Start development server (port 5173)
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint

## 🛠️ Project Structure

```
client/
├── src/
│   ├── components/     # Reusable UI components
│   ├── pages/         # Route components
│   ├── lib/           # Utility functions (API helper)
│   └── utils/         # Legacy utilities (being migrated to lib/)
├── public/            # Static assets
├── dist/              # Build output (generated)
├── .env.example       # Environment variable template
├── vercel.json        # Vercel SPA routing config
└── vite.config.js     # Vite configuration
```

## ⚠️ Common Gotchas

### 1. CORS Issues
- Ensure your backend allows requests from your Vercel domain
- Check that your backend CORS configuration includes your frontend URL

### 2. Environment Variables
- **Must** be prefixed with `VITE_` to be accessible in the browser
- Set in both Preview and Production environments in Vercel
- Don't commit real secrets to `.env.local`

### 3. API URLs
- Use relative paths if your API is on the same domain
- Include the full URL (with protocol) for external APIs
- Don't hardcode `localhost` in production builds

### 4. Build Errors
- Check that all imports are correct and files exist
- Ensure all dependencies are listed in `package.json`
- Verify that environment variables are set correctly

## 🔍 Troubleshooting

### API Connection Issues
1. Check the API test section on the home page
2. Verify `VITE_API_URL` is set correctly
3. Check browser Network tab for failed requests
4. Ensure backend is running and accessible

### Routing Issues
1. Verify `vercel.json` is in the client root directory
2. Check that React Router routes are configured correctly
3. Test deep links after deployment

### Build Issues
1. Run `npm run build` locally to test
2. Check for TypeScript errors (if using TS)
3. Verify all environment variables are available during build

## 📚 Dependencies

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **React Router DOM** - Client-side routing
- **TailwindCSS** - Styling framework
- **Axios** - HTTP client (legacy, migrating to fetch)

## 🎯 Next Steps

- [ ] Migrate from Axios to the new `api()` helper in `src/lib/api.js`
- [ ] Add error boundaries for better error handling
- [ ] Implement loading states for better UX
- [ ] Add unit tests with Vitest
- [ ] Set up automated testing in CI/CD
