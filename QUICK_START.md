# Quick Start Guide - PostgreSQL + Prisma Setup

## Prerequisites
- PostgreSQL installed and running
- Node.js 18+ installed
- Database `carbidding` created

## Step 1: Install Dependencies
```bash
npm install
```

## Step 2: Set Up Database

### Option A: Using Prisma (Recommended)
```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations (creates tables)
npm run prisma:migrate
```

### Option B: Using SQL Script
```bash
# Run the migration SQL script
psql -U postgres -d carbidding < PRISMA_MIGRATION.sql
```

## Step 3: Verify Database
```bash
# Open Prisma Studio to view tables
npm run prisma:studio
```

This opens a browser at `http://localhost:5555` where you can see all tables.

## Step 4: Start the Application

### Start Backend Only
```bash
npm run dev:server
```
Backend runs on: `http://localhost:3001`

### Start Frontend Only
```bash
npm run dev
```
Frontend runs on: `http://localhost:5173`

### Start Both Together
```bash
npm run dev:all
```

## Step 5: Test the Application

1. **Open browser**: `http://localhost:5173`

2. **Login as Admin**:
   - Email: `admin@carbidding.com`
   - Password: `admin123`

3. **Create a test lot and car**

4. **Create a business user** from admin panel

5. **Register as a bidder** and test bidding

## Common Issues

### Issue: Database connection failed
**Solution**: Check PostgreSQL is running and credentials in `.env` are correct:
```env
DATABASE_URL=postgresql://postgres:Praveen0910!@@localhost:5432/carbidding
```

### Issue: Backend port 3001 in use
**Solution**: Change PORT in `.env`:
```env
PORT=3002
```
And update `VITE_API_URL` accordingly.

### Issue: Prisma Client not found
**Solution**: Generate Prisma Client:
```bash
npm run prisma:generate
```

### Issue: Tables not created
**Solution**: Run migrations again:
```bash
npm run prisma:migrate
# or
psql -U postgres -d carbidding < PRISMA_MIGRATION.sql
```

## Environment Variables

Update `.env` if needed:

```env
# API Configuration
VITE_API_URL=http://localhost:3001/api

# Database Configuration
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/carbidding

# JWT Secret (change in production!)
JWT_SECRET=your-secret-key-here

# Server Configuration
PORT=3001
FRONTEND_URL=http://localhost:5173
```

## Verify Everything Works

### 1. Check Backend Health
```bash
curl http://localhost:3001/api/health
```
Should return: `{"status":"ok","message":"Server is running"}`

### 2. Check Database Tables
```bash
npm run prisma:studio
```
Should see 9 tables with data.

### 3. Check Frontend
Open `http://localhost:5173` - should see login page.

### 4. Test Login
Login with admin credentials - should see admin dashboard.

## Production Deployment

See `MIGRATION_GUIDE.md` for detailed production deployment instructions.

## Need Help?

- Full guide: See `MIGRATION_GUIDE.md`
- Summary: See `MIGRATION_SUMMARY.md`
- API docs: See comments in `server/routes/*.ts`
- Database schema: See `prisma/schema.prisma`

## Useful Commands

```bash
# Install dependencies
npm install

# Generate Prisma Client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Open database GUI
npm run prisma:studio

# Start backend server
npm run dev:server

# Start frontend
npm run dev

# Start both
npm run dev:all

# Build for production
npm run build
npm run build:server

# Start production server
npm run start:server
```
