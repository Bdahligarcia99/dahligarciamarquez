# Storytelling Server

Express.js backend with PostgreSQL and Supabase integration.

## 🚀 Quick Start

1. **Copy and configure environment**
   ```bash
   cp .env.example .env
   ```
   Fill in the three required variables: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run database migrations**
   ```bash
   npm run migrate
   ```

4. **Start the server**
   ```bash
   npm start
   ```

## 📝 Scripts

- `npm start` - Start the server
- `npm run migrate` - Run database migrations
- `npm run dev` - Development server
