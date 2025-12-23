# Production Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the Car Bidding Platform to production. The application consists of:

1. **PostgreSQL Database** - Direct connection, no Supabase
2. **Express.js API Backend** - Node.js server on port 3001
3. **React Frontend** - Static files served by web server

## Prerequisites

- Linux server (Ubuntu 20.04+ recommended)
- PostgreSQL 14 or higher
- Node.js 20 or higher
- Nginx (or Apache)
- Domain name with SSL certificate
- At least 2GB RAM, 2 CPU cores, 20GB storage

## Step 1: Server Setup

### Install Required Software

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Nginx
sudo apt install -y nginx

# Install PM2 (process manager)
sudo npm install -g pm2

# Install build tools
sudo apt install -y build-essential
```

## Step 2: Database Setup

### Create Database and User

```bash
# Switch to postgres user
sudo -i -u postgres

# Create database and user
psql << EOF
CREATE DATABASE carbidding;
CREATE USER carbidding_user WITH PASSWORD 'STRONG_PASSWORD_HERE';
GRANT ALL PRIVILEGES ON DATABASE carbidding TO carbidding_user;
ALTER DATABASE carbidding OWNER TO carbidding_user;
\q
EOF

exit
```

### Configure PostgreSQL for Remote Connections (if needed)

```bash
# Edit postgresql.conf
sudo nano /etc/postgresql/14/main/postgresql.conf

# Change:
listen_addresses = 'localhost'  # to '*' if remote access needed

# Edit pg_hba.conf
sudo nano /etc/postgresql/14/main/pg_hba.conf

# Add for remote access:
host    carbidding    carbidding_user    0.0.0.0/0    scram-sha-256

# Restart PostgreSQL
sudo systemctl restart postgresql
```

## Step 3: Application Setup

### Clone and Install

```bash
# Create application directory
sudo mkdir -p /var/www/carbidding
sudo chown $USER:$USER /var/www/carbidding
cd /var/www/carbidding

# Copy your application files here
# (via git clone, scp, or rsync)

# Install dependencies
npm ci --production=false
```

### Configure Environment Variables

```bash
# Create production .env file
nano .env
```

**Production `.env` contents:**

```bash
# ==============================================
# PRODUCTION ENVIRONMENT VARIABLES
# ==============================================

# API Configuration
VITE_API_URL=https://api.yourdomain.com/api

# Database Configuration
DATABASE_URL=postgresql://carbidding_user:STRONG_PASSWORD_HERE@localhost:5432/carbidding?schema=public

# JWT Secret (MUST be different from development)
# Generate with: openssl rand -base64 64
JWT_SECRET=<YOUR_64_CHAR_SECURE_RANDOM_STRING>

# Server Configuration
PORT=3001
FRONTEND_URL=https://yourdomain.com
```

### Generate JWT Secret

```bash
# Generate secure JWT secret
openssl rand -base64 64

# Copy the output to JWT_SECRET in .env
```

## Step 4: Database Migration

```bash
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Create initial admin user
npm run create:admin
# Follow the prompts to create admin@yourdomain.com
```

## Step 5: Build Application

```bash
# Build backend
npm run build:server

# Build frontend
npm run build

# Verify builds exist
ls -la dist/
ls -la dist/server/
```

## Step 6: Start Backend with PM2

```bash
# Start backend API
pm2 start dist/server/index.js --name carbidding-api

# Save PM2 configuration
pm2 save

# Set PM2 to start on boot
pm2 startup
# Follow the instructions output by the command

# Check status
pm2 status

# View logs
pm2 logs carbidding-api
```

### PM2 Management Commands

```bash
# Restart
pm2 restart carbidding-api

# Stop
pm2 stop carbidding-api

# View logs
pm2 logs carbidding-api

# Monitor
pm2 monit
```

## Step 7: Configure Nginx

### Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/carbidding
```

**Nginx configuration:**

```nginx
# API Backend
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Frontend
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    root /var/www/carbidding/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Cache static assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

### Enable Site

```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/carbidding /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

## Step 8: SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificates
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com

# Certbot will:
# 1. Obtain SSL certificates
# 2. Automatically configure Nginx
# 3. Set up auto-renewal

# Test renewal
sudo certbot renew --dry-run
```

## Step 9: Firewall Configuration

```bash
# Enable UFW firewall
sudo ufw enable

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Check status
sudo ufw status
```

## Step 10: Final Verification

### Check Backend API

```bash
# Health check
curl https://api.yourdomain.com/api/health

# Should return:
{"status":"ok","message":"Server is running"}
```

### Check Frontend

```bash
# Open in browser
https://yourdomain.com

# Should load the application
```

### Check Database Connection

```bash
# Check Prisma
npx prisma db pull

# Check PostgreSQL
psql -h localhost -U carbidding_user -d carbidding -c "SELECT COUNT(*) FROM admin_users;"
```

## Deployment Checklist

- [ ] PostgreSQL installed and running
- [ ] Database created with secure password
- [ ] Application files deployed to `/var/www/carbidding`
- [ ] `.env` file configured with production values
- [ ] JWT secret generated and set
- [ ] Database migrations applied
- [ ] Admin user created
- [ ] Backend built (`npm run build:server`)
- [ ] Frontend built (`npm run build`)
- [ ] PM2 configured and backend running
- [ ] Nginx configured for frontend and API
- [ ] SSL certificates installed
- [ ] Firewall configured
- [ ] Health check passes
- [ ] Admin login works
- [ ] User registration works
- [ ] Bidding functionality works

## Monitoring and Maintenance

### Application Logs

```bash
# PM2 logs
pm2 logs carbidding-api

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log

# PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

### Backup Database

```bash
# Create backup script
nano /home/$USER/backup-db.sh
```

**Backup script:**

```bash
#!/bin/bash
BACKUP_DIR="/home/$USER/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

pg_dump -h localhost -U carbidding_user carbidding > $BACKUP_DIR/carbidding_$DATE.sql

# Keep only last 7 days
find $BACKUP_DIR -name "carbidding_*.sql" -mtime +7 -delete

echo "Backup completed: carbidding_$DATE.sql"
```

```bash
# Make executable
chmod +x /home/$USER/backup-db.sh

# Add to crontab (daily at 2 AM)
crontab -e

# Add line:
0 2 * * * /home/$USER/backup-db.sh >> /home/$USER/backup.log 2>&1
```

### Update Application

```bash
# Navigate to app directory
cd /var/www/carbidding

# Pull latest code (if using git)
git pull origin main

# Install dependencies
npm ci

# Run migrations
npx prisma generate
npx prisma migrate deploy

# Build
npm run build:server
npm run build

# Restart backend
pm2 restart carbidding-api

# Check status
pm2 status
pm2 logs carbidding-api --lines 50
```

## Troubleshooting

### Backend Not Starting

```bash
# Check logs
pm2 logs carbidding-api

# Check database connection
psql -h localhost -U carbidding_user -d carbidding

# Check environment variables
cat .env

# Manual start for debugging
node dist/server/index.js
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check connection
psql -h localhost -U carbidding_user -d carbidding

# Check pg_hba.conf
sudo nano /etc/postgresql/14/main/pg_hba.conf
```

### Frontend Not Loading

```bash
# Check Nginx configuration
sudo nginx -t

# Check Nginx status
sudo systemctl status nginx

# Check file permissions
ls -la /var/www/carbidding/dist/

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

### API Returning 502 Bad Gateway

```bash
# Check backend is running
pm2 status

# Check backend logs
pm2 logs carbidding-api

# Check if port 3001 is listening
sudo netstat -tulpn | grep 3001

# Restart backend
pm2 restart carbidding-api
```

### SSL Certificate Issues

```bash
# Check certificate status
sudo certbot certificates

# Renew manually
sudo certbot renew

# Check Nginx SSL configuration
sudo nginx -t
```

## Performance Optimization

### PostgreSQL Tuning

```bash
sudo nano /etc/postgresql/14/main/postgresql.conf
```

**Recommended settings for 2GB RAM:**

```
shared_buffers = 512MB
effective_cache_size = 1536MB
maintenance_work_mem = 128MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 5242kB
min_wal_size = 1GB
max_wal_size = 4GB
max_connections = 100
```

```bash
sudo systemctl restart postgresql
```

### Nginx Caching

Add to Nginx config:

```nginx
# Cache configuration
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=100m inactive=60m use_temp_path=off;

server {
    # ... existing config ...

    location /api/ {
        proxy_cache api_cache;
        proxy_cache_valid 200 5m;
        proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
        proxy_cache_bypass $http_pragma $http_authorization;
        add_header X-Cache-Status $upstream_cache_status;

        # ... existing proxy settings ...
    }
}
```

### PM2 Clustering

```bash
# Stop current instance
pm2 delete carbidding-api

# Start in cluster mode
pm2 start dist/server/index.js --name carbidding-api -i max

# Save
pm2 save
```

## Security Best Practices

1. **Change Default Ports**: Consider using non-standard ports
2. **Firewall**: Only open necessary ports
3. **Database**: Use strong passwords, disable remote access if not needed
4. **JWT Secret**: Use a strong, random secret, rotate periodically
5. **Regular Updates**: Keep system and dependencies updated
6. **Backups**: Automated daily backups
7. **Monitoring**: Set up monitoring and alerts
8. **SSL**: Always use HTTPS in production
9. **Rate Limiting**: Implement rate limiting on API endpoints
10. **Input Validation**: Already implemented, verify it's working

## Support

For issues or questions:
- Check logs: `pm2 logs carbidding-api`
- Review documentation: `PRODUCTION_ARCHITECTURE.md`
- Check health endpoint: `https://api.yourdomain.com/api/health`

---

**Application Version**: 1.0.0
**Last Updated**: December 2024
**Architecture**: PostgreSQL + Express + React
