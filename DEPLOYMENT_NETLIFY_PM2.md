# Deployment Guide: Netlify Frontend + Node/PM2 Backend

This guide explains how to deploy the Herdlist application with the frontend on Netlify and the backend on a Node.js server with PM2.

## Architecture

- **Frontend**: React app deployed on Netlify (CDN)
- **Backend**: Node.js/Express API with PostgreSQL, managed by PM2
- **Authentication**: Email/password with sessions stored in PostgreSQL

## Prerequisites

- Node.js 20+ on your backend server
- PostgreSQL database (local or hosted like Neon, Supabase)
- Netlify account
- Domain name (optional but recommended)

---

## Part 1: Backend Deployment (Node.js + PM2)

### 1. Prepare Your Server

SSH into your server:
```bash
ssh user@your-server.com
```

Install Node.js 20+ and PM2:
```bash
# Install Node.js (using nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# Install PM2 globally
npm install -g pm2
```

### 2. Upload Your Code

Clone or upload your repository:
```bash
cd /var/www  # or your preferred directory
git clone <your-repo-url> herdlist
cd herdlist
```

Or use rsync:
```bash
# From your local machine
rsync -avz --exclude 'node_modules' --exclude '.git' ./ user@your-server.com:/var/www/herdlist/
```

### 3. Install Dependencies

```bash
cd /var/www/herdlist
npm install
```

### 4. Configure Environment Variables

Create a `.env` file:
```bash
nano .env
```

Add your configuration:
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/herdlist
PGDATABASE=herdlist
PGHOST=localhost
PGPASSWORD=your_password
PGPORT=5432
PGUSER=your_username

# Session Secret (generate with: openssl rand -base64 32)
SESSION_SECRET=your-random-secret-here

# Environment
NODE_ENV=production
```

### 5. Set Up Database

If using a new database, run migrations:
```bash
npm run db:push -- --force
```

Import your data (if you have a backup):
```bash
psql $DATABASE_URL < herdlist_backup.sql
```

Or seed initial users:
```bash
tsx server/seedUsers.ts
```

### 6. Build the Backend

```bash
npm run build
```

This creates `dist/index.js` (backend bundle) and `dist/public/` (frontend static files).

### 7. Configure PM2

Create an ecosystem file:
```bash
nano ecosystem.config.js
```

Add this configuration:
```javascript
module.exports = {
  apps: [{
    name: 'herdlist-api',
    script: 'dist/index.js',
    instances: 2,  // or 'max' for all CPU cores
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: 'logs/error.log',
    out_file: 'logs/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
};
```

### 8. Start the Backend with PM2

```bash
# Create logs directory
mkdir -p logs

# Start the application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Set up PM2 to start on system boot
pm2 startup
# Follow the instructions printed by the command above
```

### 9. Configure Reverse Proxy (Nginx)

Install Nginx:
```bash
sudo apt update
sudo apt install nginx
```

Create Nginx configuration:
```bash
sudo nano /etc/nginx/sites-available/herdlist-api
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;  # Your API domain

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/herdlist-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 10. Set Up SSL (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

### 11. PM2 Management Commands

```bash
# View logs
pm2 logs herdlist-api

# Monitor
pm2 monit

# Restart
pm2 restart herdlist-api

# Stop
pm2 stop herdlist-api

# Reload (zero-downtime)
pm2 reload herdlist-api

# View status
pm2 status

# View detailed info
pm2 info herdlist-api
```

---

## Part 2: Frontend Deployment (Netlify)

### 1. Update API URL

Edit `client/src/lib/queryClient.ts` to point to your backend:

```typescript
// Replace the apiRequest function's base URL
export async function apiRequest(
  url: string,
  options: RequestInit = {}
): Promise<any> {
  const baseUrl = import.meta.env.VITE_API_URL || 'https://api.yourdomain.com';
  const fullUrl = `${baseUrl}${url}`;
  
  const response = await fetch(fullUrl, {
    ...options,
    credentials: 'include',  // Important for cookies/sessions
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || 'Request failed');
  }
  
  return response.json();
}
```

### 2. Configure CORS on Backend

Update `server/index.ts` to allow Netlify domain:

```typescript
import cors from 'cors';

app.use(cors({
  origin: [
    'https://yourdomain.netlify.app',
    'https://yourdomain.com',  // if using custom domain
    'http://localhost:5173'     // for local development
  ],
  credentials: true  // Important for sessions
}));
```

Install cors:
```bash
npm install cors @types/cors
```

### 3. Build Frontend Only

```bash
cd client
npm run build
```

This creates `dist/` with your frontend static files.

### 4. Deploy to Netlify

#### Option A: Netlify CLI

Install Netlify CLI:
```bash
npm install -g netlify-cli
```

Deploy:
```bash
cd client
netlify deploy --prod --dir=dist
```

#### Option B: Netlify UI

1. Go to [netlify.com](https://netlify.com) and sign in
2. Click "Add new site" → "Deploy manually"
3. Drag and drop the `client/dist` folder
4. Your site is live!

#### Option C: Git Integration (Recommended)

1. Push your code to GitHub/GitLab/Bitbucket
2. In Netlify, click "Add new site" → "Import an existing project"
3. Connect your repository
4. Configure build settings:
   - **Base directory**: `client`
   - **Build command**: `npm run build`
   - **Publish directory**: `client/dist`
5. Add environment variable:
   - `VITE_API_URL`: `https://api.yourdomain.com`
6. Deploy!

### 5. Configure Custom Domain (Optional)

In Netlify:
1. Go to Site settings → Domain management
2. Add custom domain
3. Update DNS records as instructed

### 6. Configure Redirects

Create `client/public/_redirects`:
```
/* /index.html 200
```

This ensures client-side routing works properly.

---

## Part 3: Database Hosting

### Option 1: Self-Hosted PostgreSQL

Already covered in Part 1.

### Option 2: Neon (Serverless PostgreSQL)

1. Go to [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string
4. Update your backend `.env` with the new `DATABASE_URL`
5. Restart PM2: `pm2 restart herdlist-api`

### Option 3: Supabase

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Get connection string from Settings → Database
4. Update your backend `.env`
5. Restart PM2

---

## Part 4: Update and Redeploy

### Update Backend

```bash
# SSH to server
ssh user@your-server.com
cd /var/www/herdlist

# Pull latest code
git pull origin main

# Install any new dependencies
npm install

# Rebuild
npm run build

# Reload PM2 (zero-downtime)
pm2 reload herdlist-api
```

### Update Frontend

If using Netlify Git integration, just push to your repository:
```bash
git push origin main
```

Netlify will automatically rebuild and deploy.

If deploying manually:
```bash
cd client
npm run build
netlify deploy --prod --dir=dist
```

---

## Part 5: Monitoring and Maintenance

### Backend Monitoring

```bash
# View logs
pm2 logs herdlist-api --lines 100

# Monitor resources
pm2 monit

# Check status
pm2 status
```

### Database Backups

Create a backup script `backup.sh`:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/herdlist"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

pg_dump $DATABASE_URL > $BACKUP_DIR/herdlist_$DATE.sql
gzip $BACKUP_DIR/herdlist_$DATE.sql

# Keep only last 7 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
```

Make it executable and add to crontab:
```bash
chmod +x backup.sh
crontab -e
# Add: 0 2 * * * /var/www/herdlist/backup.sh
```

### Security Checklist

- [ ] Firewall configured (allow only 22, 80, 443)
- [ ] SSL certificates installed
- [ ] Environment variables secured
- [ ] Database backups automated
- [ ] PM2 log rotation enabled
- [ ] Server updates scheduled
- [ ] Strong passwords set for initial users

---

## Troubleshooting

### Backend won't start

```bash
# Check logs
pm2 logs herdlist-api

# Check if port 5000 is available
sudo lsof -i :5000

# Try starting manually
cd /var/www/herdlist
NODE_ENV=production node dist/index.js
```

### Frontend can't connect to backend

1. Check CORS configuration on backend
2. Verify API_URL in frontend environment
3. Check browser console for errors
4. Ensure cookies are enabled

### Database connection fails

```bash
# Test connection
psql $DATABASE_URL -c "SELECT NOW();"

# Check environment variables
env | grep PG
```

### Session issues

- Ensure `SESSION_SECRET` is set on backend
- Check that `credentials: 'include'` is in frontend fetch calls
- Verify backend has `cors({ credentials: true })`

---

## Initial User Accounts

After deployment, two users are created:

1. **Admin Account**
   - Email: `jdeck88@gmail.com`
   - Password: `admin123`
   - Access: Full admin privileges

2. **Regular User Account**
   - Email: `deckfamilyfarm@gmail.com`
   - Password: `user123`
   - Access: Edit and import data

**⚠️ IMPORTANT**: Change these default passwords immediately after first login!

---

## Cost Estimates

### Netlify
- Free tier: 100GB bandwidth/month
- Paid: $19/month (Pro) for more bandwidth

### Backend Server (DigitalOcean/Linode)
- Basic Droplet: $6-12/month (1-2GB RAM)
- Better performance: $24/month (4GB RAM)

### Database
- Self-hosted: Included in server cost
- Neon: Free tier available, $19/month for prod
- Supabase: Free tier available, $25/month for prod

**Total**: $6-60/month depending on configuration
