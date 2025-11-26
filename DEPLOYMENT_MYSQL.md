# Herd Management System - MySQL Deployment Guide

This guide covers deploying the Herd Management System with MySQL database for production use.

## Prerequisites

- Node.js 18+ installed
- MySQL 8.0+ database server
- Git for version control

## Database Setup

### 1. Create MySQL Database

Connect to your MySQL server and create a database:

```sql
CREATE DATABASE herdlist CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'herdlist_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON herdlist.* TO 'herdlist_user'@'localhost';
FLUSH PRIVILEGES;
```

### 2. Import Database Schema

Import the schema using the provided SQL file:

```bash
mysql -u herdlist_user -p herdlist < database-schema.sql
```

Or import using MySQL Workbench/phpMyAdmin by uploading the `database-schema.sql` file.

### 3. Seed Initial Admin User

After importing the schema, create an admin user:

```sql
USE herdlist;

INSERT INTO users (id, email, password_hash, first_name, last_name, is_admin)
VALUES (
  UUID(),
  'admin@yourdomain.com',
  -- Generate password hash using bcrypt (10 rounds) for 'your_password'
  '$2b$10$YourBcryptHashHere',
  'Admin',
  'User',
  'yes'
);
```

To generate a bcrypt hash for your password, run:

```bash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('your_password', 10).then(hash => console.log(hash));"
```

## Environment Configuration

### 1. Create .env File

Copy the example and configure for your environment:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
DATABASE_URL=mysql://herdlist_user:your_secure_password@localhost:3306/herdlist
SESSION_SECRET=generate_random_32_char_string_here
NODE_ENV=production
PORT=5000
```

Generate a secure session secret:

```bash
openssl rand -base64 32
```

## Installation & Build

### Option 1: Full Stack Deployment (Monorepo)

```bash
# Install dependencies
npm install

# Build the application
npm run build

# Start the server
npm start
```

The application will serve both frontend and backend on port 5000.

### Option 2: Separate Frontend/Backend Deployment

#### Backend Deployment

```bash
# Install production dependencies
npm install --production

# Start backend server
NODE_ENV=production node dist/index.js
```

Backend will run on the port specified in `.env` (default: 5000).

#### Frontend Deployment

Build the frontend for static hosting (Netlify, Vercel, etc.):

```bash
npm run build
```

The frontend build output will be in `dist/public/`. Deploy this directory to:

- **Netlify**: Drag & drop `dist/public` folder
- **Vercel**: Connect Git repo and set build output to `dist/public`
- **S3/CloudFront**: Upload `dist/public` contents to S3 bucket

**Important**: Configure your static host to proxy API requests to your backend server:

For Netlify, create `netlify.toml`:

```toml
[[redirects]]
  from = "/api/*"
  to = "https://your-backend-server.com/api/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

For Vercel, create `vercel.json`:

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "https://your-backend-server.com/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

## Production Deployment Options

### 1. Traditional VPS (DigitalOcean, Linode, AWS EC2)

```bash
# SSH into server
ssh user@your-server.com

# Clone repository
git clone https://github.com/yourusername/herdlist.git
cd herdlist

# Install dependencies
npm install --production

# Build application
npm run build

# Install PM2 for process management
npm install -g pm2

# Start with PM2
pm2 start dist/index.js --name herdlist

# Save PM2 config
pm2 save
pm2 startup
```

### 2. MySQL Hosting Options

**Managed MySQL Services:**
- **AWS RDS MySQL**: Fully managed, automated backups
- **Google Cloud SQL**: Managed MySQL with high availability
- **DigitalOcean Managed Database**: Simple pricing, good performance
- **PlanetScale**: Serverless MySQL with branching
- **Azure Database for MySQL**: Enterprise-grade managed service

**Self-Hosted:**
- Install MySQL on your VPS
- Configure regular backups
- Set up SSL/TLS encryption
- Enable binary logging for point-in-time recovery

### 3. Frontend Hosting Options

- **Netlify**: Free tier available, automatic SSL, CDN
- **Vercel**: Free tier, edge network, automatic deployments
- **AWS S3 + CloudFront**: Low cost, highly scalable
- **Cloudflare Pages**: Free tier with unlimited bandwidth

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | MySQL connection string | `mysql://user:pass@host:3306/db` |
| `SESSION_SECRET` | Secret for session encryption | Random 32+ character string |
| `NODE_ENV` | Environment mode | `production` or `development` |
| `PORT` | Server port | `5000` |

## SSL/TLS Configuration

### For MySQL Connection

If your MySQL server requires SSL:

```env
DATABASE_URL=mysql://user:pass@host:3306/db?ssl={"rejectUnauthorized":true}
```

### For HTTPS Server

Use a reverse proxy like Nginx:

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Database Backup

### Automated Backup Script

Create `backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/path/to/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/herdlist_$TIMESTAMP.sql"

mysqldump -u herdlist_user -p herdlist > $BACKUP_FILE
gzip $BACKUP_FILE

# Keep only last 30 days of backups
find $BACKUP_DIR -name "herdlist_*.sql.gz" -mtime +30 -delete
```

Schedule with cron:

```bash
0 2 * * * /path/to/backup.sh
```

## Monitoring & Logs

### PM2 Monitoring

```bash
# View logs
pm2 logs herdlist

# Monitor processes
pm2 monit

# View status
pm2 status
```

### Application Logs

The application logs all API requests. Configure log rotation:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 100M
pm2 set pm2-logrotate:retain 7
```

## Troubleshooting

### Database Connection Issues

1. Verify MySQL is running: `systemctl status mysql`
2. Test connection: `mysql -u herdlist_user -p -h localhost herdlist`
3. Check firewall: `sudo ufw allow 3306/tcp`
4. Verify DATABASE_URL format in `.env`

### Session Issues

1. Ensure SESSION_SECRET is set in `.env`
2. Verify sessions table exists in database
3. Check session cookie settings in production (secure: true requires HTTPS)

### Performance Optimization

1. **Enable Query Caching** in MySQL config
2. **Add Database Indexes** (already included in schema.sql)
3. **Use Connection Pooling** (already configured in server/db.ts)
4. **Enable Gzip Compression** in Nginx/Apache
5. **Use CDN** for static assets

## Security Checklist

- [ ] Change default admin password after first login
- [ ] Use strong SESSION_SECRET (32+ random characters)
- [ ] Enable MySQL SSL/TLS connections
- [ ] Set secure cookie flags in production (secure: true, sameSite: 'lax')
- [ ] Keep Node.js and npm packages updated
- [ ] Configure firewall rules (only allow necessary ports)
- [ ] Enable MySQL binary logging for audit trail
- [ ] Implement rate limiting for API endpoints
- [ ] Regular database backups (daily recommended)
- [ ] Monitor logs for suspicious activity

## Support & Maintenance

### Update Application

```bash
# Pull latest code
git pull origin main

# Install new dependencies
npm install

# Rebuild application
npm run build

# Restart with PM2
pm2 restart herdlist
```

### Database Migrations

When schema changes are needed:

```bash
# Generate migration
npm run db:generate

# Apply migration
npm run db:migrate
```

## Branch Strategy

### Recommended Git Workflow

```
main (production)
├── backend (backend code)
├── frontend (frontend code)
└── develop (development/staging)
```

To create separate branches:

```bash
# Create frontend branch
git subtree split --prefix=client -b frontend

# Create backend branch
git subtree split --prefix=server -b backend

# Push to remote
git push origin frontend
git push origin backend
```

## Performance Benchmarks

Expected performance with proper configuration:

- **Database Queries**: < 50ms average
- **API Response Time**: < 200ms average
- **Frontend Load Time**: < 2s (first load)
- **Concurrent Users**: 100+ (single instance)

## Cost Estimates (Monthly)

**Budget Deployment:**
- DigitalOcean Droplet (2GB RAM): $18
- DigitalOcean Managed MySQL: $15
- Total: ~$33/month

**Production Deployment:**
- AWS EC2 t3.small: $17
- AWS RDS MySQL t3.micro: $16
- Netlify (Frontend): Free
- Total: ~$33/month

**Enterprise Deployment:**
- AWS EC2 t3.medium: $35
- AWS RDS MySQL t3.small: $32
- CloudFront CDN: ~$5
- Total: ~$72/month
