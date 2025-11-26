# Herdlist - Deployment Guide

## Exporting from Replit

### 1. Export Code
- Download this project as a ZIP file from Replit, or
- Clone via Git if you have a repository set up

### 2. Export Database
Run this command in the Replit shell to export your database:
```bash
pg_dump "$DATABASE_URL" --no-owner --no-acl > herdlist_backup.sql
```

Then download the `herdlist_backup.sql` file.

## Architecture Overview

### Backend (Node.js + Express)
- **Runtime**: Node.js 20+
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: OpenID Connect (Replit Auth with Google)
- **Session Storage**: PostgreSQL-backed sessions

**Key Backend Files**:
- `server/index.ts` - Main server entry point
- `server/routes.ts` - API endpoints
- `server/storage.ts` - Database operations
- `server/replitAuth.ts` - Authentication setup
- `server/vite.ts` - Vite integration for development
- `shared/schema.ts` - Shared database schema and types

### Frontend (React + Vite)
- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack Query (React Query)
- **UI Components**: shadcn/ui + Radix UI
- **Styling**: Tailwind CSS

**Key Frontend Files**:
- `client/src/App.tsx` - Main app component with routing
- `client/src/pages/` - Page components
- `client/src/components/` - Reusable components
- `client/src/lib/queryClient.ts` - API client setup

### Database Schema
PostgreSQL with these main tables:
- `animals` - Core animal records with tracking
- `properties` - Farm properties and leases
- `fields` - Field locations within properties
- `movements` - Animal movement history
- `vaccinations` - Vaccination records
- `events` - General animal events
- `calving_records` - Birth records
- `slaughter_records` - Processing records
- `users` - User accounts
- `sessions` - Session storage
- `email_whitelist` - Authorized email addresses

## Deploying to Another System

### Prerequisites
- Node.js 20+ installed
- PostgreSQL database (local or hosted)
- Environment variables configured

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Set Up Environment Variables
Create a `.env` file:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/herdlist

# Session Secret (generate a random string)
SESSION_SECRET=your-random-secret-here

# For Replit Auth (if continuing to use Replit Auth)
REPL_ID=your-repl-id
ISSUER_URL=https://replit.com/oidc
REPLIT_DOMAINS=yourdomain.com
```

### Step 3: Set Up Database
```bash
# Import your database backup
psql $DATABASE_URL < herdlist_backup.sql

# Or run migrations to create fresh tables
npm run db:push
```

### Step 4: Build for Production
```bash
npm run build
```

This creates:
- `dist/` - Server bundle
- `dist/public/` - Frontend static files

### Step 5: Run in Production
```bash
NODE_ENV=production node dist/index.js
```

The server will:
- Serve the frontend from `dist/public`
- Handle API requests on `/api/*`
- Run on port 5000 by default

## Alternative Deployment Options

### Option 1: Deploy Both Together (Current Setup)
- Single Express server serves both frontend and API
- Simple deployment, one process to manage
- Works well on platforms like: Render, Railway, Fly.io, DigitalOcean

### Option 2: Split Frontend and Backend
If you want to deploy separately:

**Frontend** (Static hosting):
```bash
cd client
npm run build
# Deploy dist/public to: Vercel, Netlify, Cloudflare Pages
```

**Backend** (API server):
```bash
# Remove Vite integration, serve only API
# Deploy to: Heroku, AWS, Google Cloud, any Node.js host
```

You'll need to update API URLs and handle CORS.

### Option 3: Use Docker
Create a `Dockerfile`:
```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build
CMD ["node", "dist/index.js"]
```

## Authentication Considerations

### Current: Replit Auth (OpenID Connect)
- Uses Replit's OAuth provider with Google sign-in
- Requires Replit environment variables
- **Only works on Replit platform**

### Alternative: Migrate to Google OAuth Directly
To use outside Replit, you'll need to:
1. Set up Google OAuth credentials in Google Cloud Console
2. Replace Replit Auth in `server/replitAuth.ts` with `passport-google-oauth20`
3. Update environment variables

### Alternative: Use Different Auth
You could replace with:
- **Email/Password**: Add `bcrypt` + local authentication
- **Auth0, Clerk, or Supabase**: Third-party auth services
- **Other OAuth providers**: GitHub, Microsoft, etc.

## Common Hosting Platforms

### Render.com
```yaml
# render.yaml
services:
  - type: web
    name: herdlist
    env: node
    buildCommand: npm install && npm run build
    startCommand: node dist/index.js
    envVars:
      - key: DATABASE_URL
        sync: false
      - key: SESSION_SECRET
        generateValue: true
```

### Railway.app
- Connect your GitHub repo
- Set environment variables
- Railway auto-detects Node.js and builds

### Fly.io
```bash
fly launch
fly secrets set DATABASE_URL=your-database-url
fly secrets set SESSION_SECRET=your-secret
fly deploy
```

## Database Hosting Options

- **Neon** (serverless PostgreSQL) - Similar to what Replit uses
- **Supabase** (PostgreSQL + extra features)
- **Railway** (includes PostgreSQL)
- **AWS RDS** (managed PostgreSQL)
- **Self-hosted** (Docker + PostgreSQL)

## File Structure Summary

```
herdlist/
├── client/                 # Frontend React app
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── pages/         # Route pages
│   │   ├── lib/           # Utilities
│   │   └── App.tsx        # Main app
│   └── index.html
├── server/                # Backend Express app
│   ├── index.ts          # Server entry
│   ├── routes.ts         # API routes
│   ├── storage.ts        # Database layer
│   ├── replitAuth.ts     # Auth setup
│   └── vite.ts           # Dev server
├── shared/               # Shared types/schemas
│   └── schema.ts
├── migrations/           # Database migrations
├── package.json
├── tsconfig.json
└── vite.config.ts

Production build output:
dist/
├── index.js             # Server bundle
├── public/              # Frontend static files
│   ├── index.html
│   └── assets/
```

## Support & Maintenance

After exporting:
1. Set up monitoring (e.g., Sentry for errors)
2. Configure backups for your database
3. Set up CI/CD for deployments
4. Update authentication system if needed
5. Configure domain and SSL certificate

## Quick Start Commands

```bash
# Development
npm run dev

# Build for production
npm run build

# Run production
NODE_ENV=production node dist/index.js

# Database operations
npm run db:push          # Sync schema to database
npm run db:studio        # Open Drizzle Studio GUI

# Export database
pg_dump $DATABASE_URL > backup.sql

# Import database
psql $DATABASE_URL < backup.sql
```
