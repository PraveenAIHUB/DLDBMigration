# Production Architecture - PostgreSQL Backend

## Overview

This application is **fully running on PostgreSQL with an Express.js API backend**. There are NO Supabase dependencies in the production codebase.

## Architecture Stack

```
┌─────────────────┐
│  React Frontend │ (Vite + TypeScript)
│  (Port 5173)    │
└────────┬────────┘
         │
         │ HTTP/REST API
         ↓
┌─────────────────┐
│  Express API    │ (Node.js + Express)
│  (Port 3001)    │
└────────┬────────┘
         │
         │ Prisma ORM
         ↓
┌─────────────────┐
│  PostgreSQL DB  │ (Direct Connection)
│  (Port 5432)    │
└─────────────────┘
```

## Technology Stack

### Backend
- **Database**: PostgreSQL 14+
- **ORM**: Prisma (v5.22.0)
- **API Framework**: Express.js
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcrypt
- **Language**: TypeScript

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Routing**: Client-side (no router library)
- **State Management**: React Context
- **HTTP Client**: Native Fetch API
- **Language**: TypeScript

## Key Components

### Backend (`/server`)

```
server/
├── index.ts              # Express server entry point
├── prisma.ts            # Prisma client instance
├── middleware/
│   └── auth.ts          # JWT authentication middleware
└── routes/
    ├── auth.ts          # Login/signup/password reset
    ├── admin.ts         # Admin-specific routes
    ├── business.ts      # Business user routes
    ├── cars.ts          # Car CRUD operations
    ├── bids.ts          # Bidding operations
    ├── lots.ts          # Lot management
    ├── questions.ts     # Q&A system
    ├── terms.ts         # Terms and conditions
    ├── otp.ts           # OTP verification
    └── user.ts          # User management
```

### Frontend (`/src`)

```
src/
├── lib/
│   ├── api-client.ts    # Main API client (wraps fetch)
│   └── supabase.ts      # Compatibility layer (NO actual Supabase)
├── contexts/
│   ├── AuthContext.tsx  # Authentication state
│   ├── NotificationContext.tsx
│   └── ConfirmContext.tsx
└── components/
    ├── admin/           # Admin dashboard components
    ├── business/        # Business user components
    ├── user/            # Bidder/customer components
    └── common/          # Shared components
```

## Important Notes

### 1. No Supabase Dependencies

Despite some files being named "supabase.ts", **this application does NOT use Supabase**:

- `src/lib/supabase.ts` is a **compatibility layer** that provides a Supabase-like API interface
- All operations are routed through the Express API backend
- The `supabase` object in this file is just a wrapper around `apiClient`
- This design allows components to use a familiar Supabase-like syntax without actual Supabase dependencies

### 2. API Client Architecture

The frontend uses a custom `ApiClient` class that:
- Stores JWT tokens in localStorage
- Automatically adds Authorization headers
- Provides type-safe API methods
- Handles errors uniformly
- Works with the Express backend

### 3. Authentication Flow

```
1. User enters credentials → Frontend
2. Frontend POST /api/auth/{role}/login → Backend
3. Backend validates credentials in PostgreSQL
4. Backend generates JWT token
5. Backend returns user + token
6. Frontend stores token in localStorage
7. Frontend includes token in all subsequent requests
```

### 4. Database Schema

Managed by Prisma:
- Schema defined in `prisma/schema.prisma`
- Migrations in `prisma/migrations/`
- Generated client provides type-safe database access

## Environment Variables

### Required for Production

```bash
# API Endpoint (frontend uses this to connect to backend)
VITE_API_URL=https://your-api-domain.com/api

# PostgreSQL Database URL
DATABASE_URL=postgresql://user:password@host:5432/database?schema=public

# JWT Secret (MUST be different in production)
JWT_SECRET=<generate-with-openssl-rand-base64-64>

# Server Configuration
PORT=3001
FRONTEND_URL=https://your-frontend-domain.com
```

### NOT Required

These are **NOT** used in production:
- ~~VITE_SUPABASE_URL~~ (removed)
- ~~VITE_SUPABASE_ANON_KEY~~ (removed)
- ~~SUPABASE_SERVICE_ROLE_KEY~~ (removed)

## Deployment Checklist

### 1. Database Setup

```bash
# Install PostgreSQL
# Create database
createdb carbidding

# Run migrations
npx prisma generate
npx prisma migrate deploy

# Create admin user
npm run create:admin
```

### 2. Backend Deployment

```bash
# Build backend
npm run build:server

# Start server
npm run start:server
```

Or use process manager:
```bash
pm2 start dist/server/index.js --name carbidding-api
```

### 3. Frontend Deployment

```bash
# Build frontend
npm run build

# Serve static files (dist/ directory)
# Use nginx, Apache, or static hosting service
```

### 4. Environment Configuration

**Production `.env`:**
```bash
DATABASE_URL=postgresql://prod_user:prod_pass@db-server:5432/carbidding
JWT_SECRET=<64-char-random-string>
VITE_API_URL=https://api.yourdomain.com/api
PORT=3001
FRONTEND_URL=https://yourdomain.com
```

## File Structure Notes

### Files to Deploy

**Backend:**
- `dist/server/` (compiled TypeScript)
- `prisma/schema.prisma`
- `prisma/migrations/`
- `node_modules/`
- `.env`

**Frontend:**
- `dist/` (built static files)

### Files NOT Needed in Production

These are development/migration files only:
- `supabase/` directory (old Supabase migrations - not used)
- `scripts/create-admin.ts` (old Supabase script)
- `scripts/delete-auth-user.ts` (old Supabase script)
- `scripts/fix-orphaned-user.ts` (old Supabase script)
- `apply-otp-migration.js` (old migration)
- `*.md` documentation files

## API Endpoints

### Authentication
- `POST /api/auth/admin/login`
- `POST /api/auth/business/login`
- `POST /api/auth/user/login`
- `POST /api/auth/user/signup`
- `POST /api/auth/user/reset-password`

### Admin
- `GET /api/admin/me`
- `POST /api/admin/create`

### Users
- `GET /api/users`
- `GET /api/users/me`
- `PUT /api/users/me`
- `PUT /api/users/:id/approve`
- `PUT /api/users/:id/reject`
- `DELETE /api/users/:id`

### Business Users
- `GET /api/business`
- `GET /api/business/me`
- `POST /api/business`
- `PUT /api/business/:id`
- `DELETE /api/business/:id`

### Cars
- `GET /api/cars`
- `GET /api/cars/:id`
- `POST /api/cars`
- `PUT /api/cars/:id`
- `DELETE /api/cars/:id`
- `POST /api/cars/bulk`

### Lots
- `GET /api/lots`
- `GET /api/lots/:id`
- `POST /api/lots`
- `PUT /api/lots/:id`
- `PUT /api/lots/:id/approve`
- `PUT /api/lots/:id/close`
- `DELETE /api/lots/:id`

### Bids
- `GET /api/bids`
- `POST /api/bids`
- `PUT /api/bids/:id`
- `DELETE /api/bids/:id`
- `PUT /api/bids/:id/winner`

### Questions
- `GET /api/questions`
- `POST /api/questions`
- `PUT /api/questions/:id/answer`
- `DELETE /api/questions/:id`

### Terms
- `GET /api/terms`
- `GET /api/terms/latest`
- `POST /api/terms`

### OTP
- `POST /api/otp/send`
- `POST /api/otp/verify`

## Security Considerations

### JWT Tokens
- Tokens expire after 24 hours
- Stored in localStorage (client-side)
- Validated on every protected route

### Password Security
- Passwords hashed with bcrypt (10 rounds)
- Minimum 8 characters required
- Validation includes strength checks

### Database Access
- All queries through Prisma ORM (prevents SQL injection)
- Role-based access control in API middleware
- User-specific data filtering at API level

### CORS Configuration
- Only allows requests from `FRONTEND_URL`
- Credentials allowed for cookie-based sessions

## Performance Optimizations

### Database
- Indexes on frequently queried columns
- Foreign key constraints for data integrity
- Connection pooling (Prisma default: 10 connections)

### Frontend
- Lazy loading of UserDashboard component
- React.memo for expensive components
- Debounced search inputs
- Optimistic UI updates

### API
- Efficient query selection (only fetch needed columns)
- Batch operations for bulk creates
- Response caching where appropriate

## Monitoring and Logs

### Backend Logs
- Console logs for debugging (use proper logging in production)
- Error logs include stack traces
- Authentication events logged

### Frontend Errors
- Console errors for debugging
- User-friendly error messages
- Session timeout warnings

## Backup and Recovery

### Database Backups
```bash
# Backup database
pg_dump -h localhost -U postgres carbidding > backup.sql

# Restore database
psql -h localhost -U postgres carbidding < backup.sql
```

### Migration History
- All migrations stored in `prisma/migrations/`
- Can revert using Prisma migrate commands
- Always test migrations on staging first

## Support and Troubleshooting

### Common Issues

**"Can't reach database server"**
- Check PostgreSQL is running
- Verify DATABASE_URL credentials
- Ensure port 5432 is accessible

**"401 Unauthorized"**
- Token expired (login again)
- Invalid credentials
- User not approved

**"500 Internal Server Error"**
- Check backend logs
- Verify database connection
- Check Prisma schema matches database

### Health Check
```bash
# Check backend is running
curl http://localhost:3001/api/health

# Should return:
{"status":"ok","message":"Server is running"}
```

## Migration from Supabase

This application was originally using Supabase but has been fully migrated to direct PostgreSQL:

### What Changed
1. ✅ Removed `@supabase/supabase-js` dependency
2. ✅ Created custom Express API backend
3. ✅ Implemented JWT authentication
4. ✅ Created Prisma schema matching Supabase tables
5. ✅ Built compatibility layer in `src/lib/supabase.ts`
6. ✅ Updated all authentication flows
7. ✅ Removed Supabase environment variables

### What Stayed the Same
1. ✅ PostgreSQL database (Supabase IS PostgreSQL)
2. ✅ Database schema (same tables and columns)
3. ✅ Component interfaces (Supabase-like API)
4. ✅ User experience (no UI changes)

## Conclusion

This is a **production-ready**, **self-hosted** application with:
- ✅ No external service dependencies (except PostgreSQL)
- ✅ Full control over infrastructure
- ✅ Type-safe database access with Prisma
- ✅ Secure JWT authentication
- ✅ RESTful API architecture
- ✅ Modern React frontend

**Ready for deployment on any cloud provider or self-hosted infrastructure.**
