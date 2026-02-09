# Development Setup Notes

## Understanding Local vs Production

Your app has two main parts:
- **Frontend** (React/Vite) - runs on `localhost:5173`
- **Backend** (Node/Express) - can run locally OR on Render

---

## Current Setup Options

### Option A: Local Frontend + Production Backend (Render)
- Frontend runs locally at `localhost:5173`
- API calls go to `dahligarciamarquez.onrender.com`
- **Pros**: Don't need to run backend locally
- **Cons**: Must deploy to Render to test server code changes (takes a few minutes)

### Option B: Fully Local Development
- Frontend runs locally at `localhost:5173`
- Backend runs locally at `localhost:5000`
- **Pros**: Instant testing of both frontend and backend changes
- **Cons**: Need to run both servers

---

## How to Switch Between Options

### To use Production Backend (Render):
In `client/.env`:
```
VITE_API_URL=https://dahligarciamarquez.onrender.com/api
```

### To use Local Backend:
In `client/.env`:
```
VITE_API_URL=http://localhost:5000/api
```

Then start the local backend:
```bash
cd server
npm run dev
```

---

## When to Deploy to Render

If you're using Option A (production backend), you must deploy whenever you change:
- Anything in `server/` folder
- API routes, middleware, validation, etc.

To deploy:
```bash
git checkout main
git merge dev
git push origin main
```
Render auto-deploys when `main` is pushed.

---

## Quick Reference

| Change Type | Option A (Render) | Option B (Local) |
|-------------|-------------------|------------------|
| Frontend code | Instant | Instant |
| Backend code | Deploy required | Instant |
| Database schema | Run SQL in Supabase | Run SQL in Supabase |

---

## Recommended Workflow

For active development with frequent backend changes:
1. Use Option B (fully local)
2. When ready, merge to `main` and deploy

For frontend-only work or quick testing:
1. Option A works fine
2. Just remember backend changes need deployment
