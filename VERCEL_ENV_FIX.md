# Fix Vercel Environment Variable

## Problem
The blog page is getting a 404 error when trying to fetch posts because the API URL is missing `/api` at the end.

**Current (incorrect):** `https://api.dahligarciamarquez.com/posts` → 404  
**Should be:** `https://api.dahligarciamarquez.com/api/posts` → 200

## Solution
Update the Vercel environment variable:

### Steps:
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project: **dahligarciamarquez**
3. Go to **Settings** → **Environment Variables**
4. Find `VITE_API_URL` or add it if it doesn't exist
5. Set the value to: `https://api.dahligarciamarquez.com/api`
   - ⚠️ **Important:** Must end with `/api`
6. Save
7. Go to **Deployments** tab
8. Click the **...** menu on the latest deployment
9. Select **Redeploy** → Check "Use existing Build Cache" → Click **Redeploy**

### Environment Variable to Set:
```
VITE_API_URL=https://api.dahligarciamarquez.com/api
```

## Verification
After redeployment, visit:
- https://dahligarciamarquez.vercel.app/blog

You should see:
- ✅ Blog page loads successfully
- ✅ Your published post appears as a tile
- ✅ No 404 errors in console

