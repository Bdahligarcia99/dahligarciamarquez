# Personal Storytelling Website

A full-stack web application for sharing personal stories and blog posts, built with React, Express, and PostgreSQL.

## 🛠️ Tech Stack

- **Frontend**: React + Vite, TailwindCSS, React Router DOM
- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **Deployment**: Render

## 📁 Project Structure

```
storytelling-website/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Route components
│   │   └── utils/         # API calls and utilities
│   └── package.json
├── server/                # Express backend
│   ├── db/               # Database connection and schema
│   ├── routes/           # API endpoints
│   ├── controllers/      # Business logic
│   └── package.json
└── package.json          # Root package.json for scripts
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd storytelling-website
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies
   npm install
   
   # Install client and server dependencies
   npm run install-all
   ```

3. **Set up the database**
   
   Create a PostgreSQL database:
   ```sql
   CREATE DATABASE storytelling_db;
   ```

4. **Configure environment variables**
   
   Copy the example environment file:
   ```bash
   cp server/env.example server/.env
   ```
   
   Update `server/.env` with your database credentials:
   ```
   DATABASE_URL=postgresql://username:password@localhost:5432/storytelling_db
   PORT=5000
   NODE_ENV=development
   ```

5. **Set up the database schema**
   
   Connect to your PostgreSQL database and run the schema:
   ```bash
   psql -d storytelling_db -f server/db/schema.sql
   ```

6. **Seed the database with sample data**
   ```bash
   cd server
   npm run db:seed
   ```

### Development

Run both frontend and backend in development mode:

```bash
npm run dev
```

This will start:
- Frontend at `http://localhost:3000`
- Backend at `http://localhost:5000`

### Individual Commands

```bash
# Frontend only
npm run client

# Backend only  
npm run server

# Build frontend for production
npm run build
```

## 📡 API Endpoints

- `GET /api/posts` - Get all posts
- `GET /api/posts/:slug` - Get single post by slug
- `GET /api/posts/tag/:tag` - Get posts by tag
- `GET /health` - Health check

## 🌐 Pages

- `/` - Home page
- `/blog` - Blog posts list
- `/blog/:slug` - Individual blog post
- `*` - 404 Not Found

## 🚢 Deployment

### Render Deployment

1. **Connect your GitHub repository to Render**

2. **Create a new PostgreSQL database**
   - Go to Render Dashboard
   - Create new PostgreSQL database
   - Note the connection details

3. **Deploy using render.yaml**
   - The `render.yaml` file contains all deployment configuration
   - Render will automatically detect and deploy both services

4. **Set up database schema**
   ```bash
   # Connect to your Render PostgreSQL instance
   psql $DATABASE_URL -f server/db/schema.sql
   
   # Seed with sample data
   cd server && npm run db:seed
   ```

### Manual Deployment Steps

If not using `render.yaml`:

1. **Create Web Service for Backend**
   - Build Command: `cd server && npm install`
   - Start Command: `cd server && npm start`
   - Add environment variable: `DATABASE_URL`

2. **Create Static Site for Frontend**
   - Build Command: `cd client && npm install && npm run build`
   - Publish Directory: `client/dist`

## 🔧 Environment Variables

### Server (.env)
```
DATABASE_URL=postgresql://...
PORT=5000
NODE_ENV=production
```

### Client
Create `client/.env` for any frontend environment variables:
```
VITE_API_URL=https://your-api-domain.onrender.com/api
```

## 📝 Features

- ✅ Responsive design with TailwindCSS
- ✅ Server-side rendering ready
- ✅ SEO-friendly URLs with slugs
- ✅ Tag-based categorization
- ✅ Image support for posts
- ✅ Loading states and error handling
- ✅ PostgreSQL with proper indexing
- ✅ Production-ready deployment config

## 🎯 Next Steps

- [ ] Add admin dashboard for creating posts
- [ ] Implement rich text editor
- [ ] Add image upload functionality
- [ ] Add search functionality
- [ ] Add pagination for blog posts
- [ ] Add comments system
- [ ] Add social sharing

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

