# 🔧 Quick Database Fix - Get Admin Login Working

## Problem
- Backend server is trying to connect to PostgreSQL at `localhost:5432`
- PostgreSQL is not running
- Cannot login as admin

## ✅ Quick Solution (5 minutes)

### Step 1: Install PostgreSQL

**macOS:**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
Download from: https://www.postgresql.org/download/windows/

---

### Step 2: Create Database

```bash
# Login to PostgreSQL
psql postgres

# In PostgreSQL terminal:
CREATE DATABASE carbidding;
CREATE USER postgres WITH PASSWORD 'Praveen0910!@';
GRANT ALL PRIVILEGES ON DATABASE carbidding TO postgres;
\q
```

---

### Step 3: Run Migrations

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations to create tables
npx prisma migrate deploy
```

---

### Step 4: Create Admin User

```bash
# Use Prisma Studio to create admin
npx prisma studio
```

Then in the browser:
1. Go to `admin_users` table
2. Click "Add record"
3. Fill in:
   - **email**: `admin@carbidding.com`
   - **name**: `Admin`
   - **passwordHash**: (we'll add via script)

**OR use this direct SQL:**

```sql
-- Connect to database
psql postgresql://postgres:Praveen0910!@@localhost:5432/carbidding

-- Insert admin user (password: admin123)
INSERT INTO admin_users (id, email, password_hash, name, created_at)
VALUES (
  gen_random_uuid(),
  'admin@carbidding.com',
  '$2a$10$YourHashedPasswordHere',
  'Admin',
  NOW()
);
```

---

### Step 5: Start the App

```bash
npm run dev:all
```

---

## ⚡ Even Faster: Use Docker

If you have Docker installed:

```bash
# Start PostgreSQL in Docker
docker run -d \
  --name carbidding-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD='Praveen0910!@' \
  -e POSTGRES_DB=carbidding \
  -p 5432:5432 \
  postgres:14

# Wait 5 seconds for it to start
sleep 5

# Run migrations
npx prisma migrate deploy

# Create admin (see script below)
```

---

## 🚀 Complete Setup Script

Save this as `setup-database.sh`:

```bash
#!/bin/bash

echo "🚀 Setting up Car Bidding Database..."

# Check if PostgreSQL is running
if ! pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
  echo "❌ PostgreSQL is not running!"
  echo "Start it with: brew services start postgresql@14"
  exit 1
fi

# Generate Prisma client
echo "📦 Generating Prisma client..."
npm run prisma:generate

# Run migrations
echo "🗄️  Running database migrations..."
npx prisma migrate deploy

# Create admin user
echo "👤 Creating admin user..."
npx tsx scripts/create-admin-direct.ts

echo "✅ Setup complete!"
echo ""
echo "🎯 Login at: http://localhost:5173/admin"
echo "📧 Email: admin@carbidding.com"
echo "🔑 Password: admin123"
echo ""
echo "Start the app: npm run dev:all"
```

Make it executable:
```bash
chmod +x setup-database.sh
./setup-database.sh
```

---

## 🔍 Troubleshooting

### Issue: "Can't reach database server"
**Solution**: PostgreSQL isn't running. Start it:
```bash
# macOS
brew services start postgresql@14

# Linux
sudo systemctl start postgresql

# Check status
pg_isready
```

### Issue: "Password authentication failed"
**Solution**: Update .env with correct password:
```bash
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/carbidding?schema=public
```

### Issue: "Database does not exist"
**Solution**: Create it:
```bash
createdb carbidding
```

---

## 📋 Current Status

Your `.env` file has:
```
DATABASE_URL=postgresql://postgres:Praveen0910!@@localhost:5432/carbidding?schema=public
```

This means the app expects:
- Host: `localhost`
- Port: `5432`
- User: `postgres`
- Password: `Praveen0910!@`
- Database: `carbidding`

**Make sure PostgreSQL is running and this database exists!**
