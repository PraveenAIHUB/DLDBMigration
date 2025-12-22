# Supabase to PostgreSQL + Prisma Migration Guide

This guide outlines the complete migration from Supabase to on-premise PostgreSQL using Prisma ORM.

## Overview

The application has been migrated from Supabase (hosted PostgreSQL with built-in auth and RLS) to a custom backend using:
- **PostgreSQL** (on-premise database)
- **Prisma ORM** (database management and queries)
- **Express.js** (REST API backend)
- **JWT** (authentication)

The frontend remains unchanged - all UI and behavior work exactly as before.

## Architecture Changes

### Before (Supabase)
```
Frontend (React) → Supabase Client → Supabase Cloud (Auth + DB + RLS)
```

### After (PostgreSQL + Prisma)
```
Frontend (React) → API Client → Express API → Prisma → PostgreSQL (on-premise)
```

## Database Configuration

The database connection details are in `.env`:

```env
DATABASE_URL=postgresql://postgres:Praveen0910!@@localhost:5432/carbidding?schema=public
```

## Migration Steps

### 1. Install Dependencies

```bash
npm install
```

This installs:
- Prisma & Prisma Client
- Express.js
- bcryptjs (password hashing)
- jsonwebtoken (JWT auth)
- cors (CORS handling)

### 2. Set Up Database

Ensure PostgreSQL is running on `localhost:5432` with:
- Database: `carbidding`
- User: `postgres`
- Password: `Praveen0910!@`

### 3. Run Prisma Migrations

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations to create all tables
npm run prisma:migrate
```

This creates all tables matching the existing Supabase schema:
- `admin_users`
- `business_users`
- `users`
- `lots`
- `cars`
- `bids`
- `terms_and_conditions`
- `questions`
- `otp_storage`

### 4. Migrate Existing Data (Optional)

If you have existing data in Supabase, export it and import into PostgreSQL:

```bash
# Export from Supabase
pg_dump -h <supabase-host> -U postgres -d postgres > supabase_dump.sql

# Import to local PostgreSQL
psql -U postgres -d carbidding < supabase_dump.sql
```

### 5. Create Admin User

Create an initial admin user:

```bash
npm run prisma:studio
```

Then manually add an admin user or use SQL:

```sql
INSERT INTO admin_users (id, email, password_hash, name, created_at)
VALUES (
  gen_random_uuid(),
  'admin@carbidding.com',
  '$2a$10$rQ5xZJKm3oQ5xZJKm3oQ5u9Y3YH5YH5YH5YH5YH5YH5YH5YH5YH5Y',
  'System Admin',
  NOW()
);
```

Default password: `admin123` (change in production!)

### 6. Start the Backend Server

```bash
npm run dev:server
```

The API server runs on `http://localhost:3001`

### 7. Start the Frontend

```bash
npm run dev
```

The frontend runs on `http://localhost:5173`

### 8. Run Both Together

```bash
npm run dev:all
```

This starts both frontend and backend concurrently.

## API Endpoints

All API endpoints are prefixed with `/api`:

### Authentication
- `POST /api/auth/admin/login` - Admin login
- `POST /api/auth/business/login` - Business user login
- `POST /api/auth/user/login` - User login
- `POST /api/auth/user/signup` - User registration
- `POST /api/auth/user/reset-password` - Password reset

### Cars
- `GET /api/cars` - List cars
- `GET /api/cars/:id` - Get car details
- `POST /api/cars` - Create car (admin only)
- `PUT /api/cars/:id` - Update car (admin only)
- `DELETE /api/cars/:id` - Delete car (admin only)
- `POST /api/cars/bulk` - Bulk create cars (admin only)

### Bids
- `GET /api/bids` - List bids
- `POST /api/bids` - Create/update bid
- `PUT /api/bids/:id` - Update bid
- `DELETE /api/bids/:id` - Delete bid
- `PUT /api/bids/:id/winner` - Mark bid as winner

### Lots
- `GET /api/lots` - List lots
- `GET /api/lots/:id` - Get lot details
- `POST /api/lots` - Create lot (admin only)
- `PUT /api/lots/:id` - Update lot (admin only)
- `PUT /api/lots/:id/approve` - Approve lot (admin only)
- `PUT /api/lots/:id/close` - Close lot (admin only)
- `DELETE /api/lots/:id` - Delete lot (admin only)

### Users
- `GET /api/users` - List users (admin only)
- `GET /api/users/me` - Get current user profile
- `PUT /api/users/me` - Update current user profile
- `PUT /api/users/:id/approve` - Approve user (admin only)
- `PUT /api/users/:id/reject` - Reject user (admin only)
- `DELETE /api/users/:id` - Delete user (admin only)

### Business Users
- `GET /api/business` - List business users (admin only)
- `GET /api/business/me` - Get current business user profile
- `POST /api/business` - Create business user (admin only)
- `PUT /api/business/:id` - Update business user (admin only)
- `DELETE /api/business/:id` - Delete business user (admin only)

### Questions
- `GET /api/questions` - List questions
- `POST /api/questions` - Create question
- `PUT /api/questions/:id/answer` - Answer question (admin only)
- `DELETE /api/questions/:id` - Delete question (admin only)

### Terms & Conditions
- `GET /api/terms` - List terms
- `GET /api/terms/latest` - Get latest terms
- `POST /api/terms` - Create new terms (admin only)

### OTP
- `POST /api/otp/send` - Send OTP
- `POST /api/otp/verify` - Verify OTP

## Authentication

JWT-based authentication with tokens stored in localStorage.

### Token Format
```json
{
  "userId": "uuid",
  "role": "admin" | "business" | "bidder",
  "exp": 1234567890
}
```

### Authorization Header
```
Authorization: Bearer <token>
```

## Frontend Changes

The frontend code remains the same - all changes are internal:

1. `src/lib/supabase.ts` now exports the `apiClient` instead of Supabase client
2. `src/lib/api-client.ts` provides the same interface as Supabase client
3. All existing components work without changes

## Security Features

### Implemented
- JWT authentication with 24-hour expiry
- Password hashing with bcrypt (cost factor 10)
- CORS protection
- Role-based access control (RBAC)
- Input validation

### Removed (from Supabase)
- Row Level Security (RLS) - now handled by API middleware
- Supabase Auth - replaced with JWT
- Real-time subscriptions - can be added later if needed

## Database Schema

The Prisma schema (`prisma/schema.prisma`) matches all Supabase tables:

```prisma
- AdminUser (admin_users)
- BusinessUser (business_users)
- User (users)
- Lot (lots)
- Car (cars)
- Bid (bids)
- TermsAndCondition (terms_and_conditions)
- Question (questions)
- OtpStorage (otp_storage)
```

All relationships, indexes, and constraints are preserved.

## Testing

### 1. Test Authentication
- Login as admin
- Login as business user
- Login as bidder
- Register new user

### 2. Test Admin Functions
- Create/edit/delete cars
- Create/edit/delete lots
- Approve/reject users
- View all bids

### 3. Test Business User Functions
- View lots
- View cars with bids
- View winner information

### 4. Test Bidder Functions
- View active cars
- Place/update/delete bids
- View own bids
- Ask questions

## Production Deployment

### Environment Variables

Update `.env` for production:

```env
DATABASE_URL=postgresql://user:password@prod-host:5432/carbidding
JWT_SECRET=<generate-secure-random-string>
PORT=3001
FRONTEND_URL=https://your-production-domain.com
VITE_API_URL=https://your-api-domain.com/api
```

### Build for Production

```bash
# Build frontend
npm run build

# Build backend
npm run build:server
```

### Run in Production

```bash
# Start backend server
npm run start:server

# Serve frontend with nginx or similar
```

## Rollback Plan

If you need to roll back to Supabase:

1. Restore the original `.env` with Supabase credentials
2. Revert `src/lib/supabase.ts` to use Supabase client
3. Remove `server/` directory
4. Run `npm install @supabase/supabase-js`
5. Restart the application

## Support

For issues or questions:
1. Check Prisma logs: `npm run prisma:studio`
2. Check API logs in the server console
3. Check browser console for frontend errors

## Notes

- All API responses maintain the same format as Supabase responses
- The `data` wrapper is preserved for compatibility
- Error handling matches Supabase error format
- Session management works the same way
- No UI changes required
