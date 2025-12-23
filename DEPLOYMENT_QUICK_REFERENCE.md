# 🚀 Deployment Quick Reference

## One-Page Production Deployment Guide

### Prerequisites
- Ubuntu 20.04+ server
- Domain with DNS pointing to server
- Root or sudo access

---

## 🔧 1. Install Software (5 minutes)

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs postgresql postgresql-contrib nginx build-essential

# PM2
sudo npm install -g pm2
```

---

## 🗄️ 2. Setup Database (2 minutes)

```bash
# Create database
sudo -u postgres psql << 'EOF'
CREATE DATABASE carbidding;
CREATE USER carbidding_user WITH PASSWORD 'CHANGE_THIS_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE carbidding TO carbidding_user;
ALTER DATABASE carbidding OWNER TO carbidding_user;
\q
EOF
```

---

## 📦 3. Deploy Application (5 minutes)

```bash
# Create directory
sudo mkdir -p /var/www/carbidding
sudo chown $USER:$USER /var/www/carbidding
cd /var/www/carbidding

# Upload your files here (git clone, scp, rsync, etc.)

# Install dependencies
npm ci
```

---

## ⚙️ 4. Configure Environment (2 minutes)

```bash
# Create .env file
cat > .env << 'EOF'
VITE_API_URL=https://api.yourdomain.com/api
DATABASE_URL=postgresql://carbidding_user:CHANGE_THIS_PASSWORD@localhost:5432/carbidding?schema=public
JWT_SECRET=$(openssl rand -base64 64)
PORT=3001
FRONTEND_URL=https://yourdomain.com
EOF

# Update domain names in .env
nano .env
```

---

## 🔨 5. Build & Migrate (3 minutes)

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Create admin user
npm run create:admin
# Email: admin@yourdomain.com
# Password: [choose secure password]

# Build application
npm run build:server
npm run build
```

---

## 🚀 6. Start Backend (1 minute)

```bash
# Start with PM2
pm2 start dist/server/index.js --name carbidding-api
pm2 save
pm2 startup  # Follow the command it outputs

# Verify
pm2 status
curl http://localhost:3001/api/health
```

---

## 🌐 7. Configure Nginx (3 minutes)

```bash
# Create config
sudo nano /etc/nginx/sites-available/carbidding
```

**Paste this configuration:**

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
    }
}

# Frontend
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    root /var/www/carbidding/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

**Enable and restart:**

```bash
sudo ln -s /etc/nginx/sites-available/carbidding /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🔒 8. Setup SSL (2 minutes)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificates
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com

# Follow prompts, select redirect to HTTPS
```

---

## 🔥 9. Configure Firewall (1 minute)

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## ✅ 10. Verify Deployment (1 minute)

```bash
# Check backend
curl https://api.yourdomain.com/api/health
# Should return: {"status":"ok","message":"Server is running"}

# Check frontend
curl https://yourdomain.com
# Should return HTML

# Test admin login
# Open: https://yourdomain.com/admin
# Login with credentials from step 5
```

---

## 📊 Management Commands

### PM2 Commands
```bash
pm2 status                    # Check status
pm2 logs carbidding-api       # View logs
pm2 restart carbidding-api    # Restart
pm2 stop carbidding-api       # Stop
pm2 monit                     # Monitor resources
```

### Database Commands
```bash
# Backup
pg_dump -h localhost -U carbidding_user carbidding > backup.sql

# Restore
psql -h localhost -U carbidding_user carbidding < backup.sql

# Connect
psql -h localhost -U carbidding_user carbidding
```

### Application Updates
```bash
cd /var/www/carbidding
git pull origin main          # If using git
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build:server
npm run build
pm2 restart carbidding-api
```

### View Logs
```bash
pm2 logs carbidding-api                    # Application logs
sudo tail -f /var/log/nginx/access.log     # Nginx access
sudo tail -f /var/log/nginx/error.log      # Nginx errors
```

---

## 🚨 Troubleshooting

### Backend won't start
```bash
pm2 logs carbidding-api --lines 100
# Check DATABASE_URL in .env
# Verify PostgreSQL is running: sudo systemctl status postgresql
```

### Database connection failed
```bash
psql -h localhost -U carbidding_user carbidding
# If fails, check password in DATABASE_URL
```

### Frontend shows white screen
```bash
# Check if files exist
ls -la /var/www/carbidding/dist/
# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
```

### API returns 502
```bash
pm2 status
# If stopped, restart: pm2 restart carbidding-api
# Check if port 3001 is listening: sudo netstat -tulpn | grep 3001
```

### SSL not working
```bash
sudo certbot certificates
sudo certbot renew --dry-run
sudo nginx -t
```

---

## 🔐 Security Checklist

- [ ] Changed default database password
- [ ] Generated new JWT secret
- [ ] SSL certificates installed
- [ ] Firewall configured (UFW)
- [ ] Admin password is strong
- [ ] Database backups scheduled
- [ ] Only necessary ports open (22, 80, 443)
- [ ] Nginx security headers configured
- [ ] PostgreSQL not exposed to internet

---

## 📋 Post-Deployment Tasks

1. **Test all features:**
   - Admin login
   - User registration
   - Car browsing
   - Bid placement
   - Business user login

2. **Setup monitoring:**
   ```bash
   # Add to crontab for health checks
   crontab -e
   # Add: */5 * * * * curl -s https://api.yourdomain.com/api/health || echo "API down"
   ```

3. **Schedule backups:**
   ```bash
   # Add to crontab
   0 2 * * * pg_dump -h localhost -U carbidding_user carbidding > /home/$USER/backup_$(date +\%Y\%m\%d).sql
   ```

4. **Setup log rotation:**
   ```bash
   pm2 install pm2-logrotate
   pm2 set pm2-logrotate:max_size 10M
   pm2 set pm2-logrotate:retain 7
   ```

---

## 🎯 Performance Tips

### Enable Nginx Gzip
Add to Nginx server block:
```nginx
gzip on;
gzip_vary on;
gzip_types text/plain text/css text/javascript application/javascript;
```

### PostgreSQL Tuning (for 2GB RAM)
```bash
sudo nano /etc/postgresql/14/main/postgresql.conf
```
Set:
```
shared_buffers = 512MB
effective_cache_size = 1536MB
```

### PM2 Cluster Mode
```bash
pm2 delete carbidding-api
pm2 start dist/server/index.js --name carbidding-api -i max
pm2 save
```

---

## 📞 Need Help?

- **Full Guide:** See `PRODUCTION_DEPLOYMENT.md`
- **Architecture:** See `PRODUCTION_ARCHITECTURE.md`
- **Readiness:** See `PRODUCTION_READY_SUMMARY.md`

---

**Deployment Time:** ~25 minutes total
**Difficulty:** Intermediate
**Cost:** $5-20/month (depending on hosting)
