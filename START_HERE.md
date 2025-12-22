# ⚠️ IMPORTANT: Backend Server Required

The application has been migrated from Supabase to PostgreSQL + Prisma. **You must start the backend server** for the app to work.

## Quick Start

### Option 1: Start Both (Recommended)
```bash
npm install
npm run dev:all
```

This starts:
- Frontend on `http://localhost:5173`
- Backend API on `http://localhost:3001`

### Option 2: Start Separately

**Terminal 1 - Backend:**
```bash
npm run dev:server
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

## First Time Setup

If this is your first time running the migrated app:

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Ensure PostgreSQL is running** with database `carbidding`

3. **Run database migrations:**
   ```bash
   # Option A: Using Prisma
   npm run prisma:generate
   npm run prisma:migrate

   # Option B: Using SQL script
   psql -U postgres -d carbidding < PRISMA_MIGRATION.sql
   ```

4. **Start the application:**
   ```bash
   npm run dev:all
   ```

5. **Login with default admin:**
   - Email: `admin@carbidding.com`
   - Password: `admin123`

## Troubleshooting

### Error: "Cannot connect to backend"
- Make sure backend server is running on port 3001
- Check that DATABASE_URL in `.env` is correct

### Error: "Table does not exist"
- Run database migrations (see step 3 above)

### Error: "Port 3001 already in use"
- Change PORT in `.env` and update `VITE_API_URL` accordingly

## What Changed?

- **Before:** Supabase handled auth + database
- **After:** Express API + PostgreSQL + Prisma

The frontend UI is **exactly the same** - only the backend changed!

## Documentation

- **Complete Guide:** See `MIGRATION_GUIDE.md`
- **Quick Summary:** See `MIGRATION_SUMMARY.md`
- **Database Schema:** See `prisma/schema.prisma`

---

**Need help?** Check the migration documentation or run `npm run prisma:studio` to view the database.
