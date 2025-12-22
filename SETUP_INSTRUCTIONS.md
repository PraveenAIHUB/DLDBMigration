# Setup Instructions

## Initial Setup (5 Minutes)

### Step 1: Environment Configuration ✅
Your environment variables are already configured in `.env`:
```
VITE_SUPABASE_URL=https://umjsrbxerbttukpjbsaj.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 2: Database Setup ✅
Your database is fully configured with:
- ✅ 4 tables created (admin_users, users, cars, bids)
- ✅ Row Level Security enabled
- ✅ Indexes created
- ✅ Triggers configured
- ✅ Default admin user created

### Step 3: Admin Account Setup ⚠️

**IMPORTANT**: The default admin credentials are:
```
Email: admin@carbidding.com
Password: admin123
```

**You MUST create a proper admin account in Supabase Auth:**

1. Go to your Supabase Dashboard
2. Navigate to Authentication → Users
3. Click "Add User" → "Create new user"
4. Enter:
   - Email: admin@carbidding.com
   - Password: [Your secure password]
   - Auto-confirm user: YES
5. Click "Create User"

This creates the authentication record. The admin_users table entry already exists.

### Step 4: Install & Run

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

---

## Testing the Setup

### Test Admin Access
1. Navigate to `http://localhost:5173/admin`
2. Login with: admin@carbidding.com / [your password]
3. You should see the admin dashboard

### Test User Access
1. Navigate to `http://localhost:5173`
2. Click "Sign Up"
3. Create a test user account
4. You should see the user dashboard (no cars will show until admin enables bidding)

---

## Quick Test Workflow

### As Admin:
1. Login to `/admin`
2. Click "Import Excel"
3. Upload the provided sample Excel (or create one)
4. Select imported cars
5. Use bulk actions:
   - Set start date (now)
   - Set end date (1 day from now)
   - Click "Enable"
6. Cars should now show status "Active"

### As User:
1. Open new incognito window
2. Go to main page
3. Register new account
4. You should now see the cars you enabled
5. Click on a car
6. Place a bid
7. Confirm bid was placed

### Verify:
1. Go back to admin
2. Click "View Bids" icon on the car
3. You should see the user's bid

---

## Production Deployment Checklist

### Before Deploying:

- [ ] Change admin password in Supabase Auth
- [ ] Set up email confirmation (optional)
- [ ] Configure custom domain
- [ ] Set up SSL certificate
- [ ] Update environment variables for production
- [ ] Test all features on staging
- [ ] Set up monitoring/logging
- [ ] Create admin user backups
- [ ] Document admin procedures
- [ ] Train admin users

### Security Hardening:

- [ ] Enable email verification in Supabase
- [ ] Set up rate limiting
- [ ] Configure CORS properly
- [ ] Enable 2FA for admin (if available)
- [ ] Regular security audits
- [ ] Monitor suspicious activity
- [ ] Keep dependencies updated
- [ ] Regular database backups

---

## Troubleshooting Setup

### "Can't login as admin"
**Solution**: Make sure you created the admin user in Supabase Auth (Step 3 above)

### "Users can't see any cars"
**Solution**:
1. Login as admin
2. Check cars have bidding enabled
3. Verify dates are set correctly
4. Ensure status shows "Active"

### "Import Excel not working"
**Solution**: Check Excel file format matches the template

### "Build errors"
**Solution**:
```bash
rm -rf node_modules
npm install
npm run build
```

---

## File Structure

```
/src
  /components
    /admin          # Admin-only components
      AdminDashboard.tsx
      AdminLogin.tsx
      CarList.tsx
      BulkActionsPanel.tsx
      CarTable.tsx
      CarEditModal.tsx
      BiddingDetailsModal.tsx
      ExcelUploadModal.tsx
      ExportModal.tsx
    /user           # User-facing components
      UserAuth.tsx
      UserDashboard.tsx
      CarGrid.tsx
      CarDetailModal.tsx
  /contexts
    AuthContext.tsx # Authentication state
  /lib
    supabase.ts     # Supabase client
  App.tsx           # Main app component
  main.tsx          # Entry point
```

---

## Database Schema Reference

### admin_users
```sql
id: uuid (PK)
email: text (unique)
password_hash: text
name: text
created_at: timestamptz
```

### users
```sql
id: uuid (PK, links to auth.users)
name: text
email: text (unique)
phone: text
created_at: timestamptz
```

### cars
```sql
id: uuid (PK)
sr_number: text
fleet_no: text
reg_no: text
make_model: text (required)
year: integer
km: integer
price: numeric
location: text
bidding_start_date: timestamptz
bidding_end_date: timestamptz
bidding_enabled: boolean
status: text (Disabled/Upcoming/Active/Closed/Reopened)
created_at: timestamptz
updated_at: timestamptz
```

### bids
```sql
id: uuid (PK)
car_id: uuid (FK → cars)
user_id: uuid (FK → users)
amount: numeric
created_at: timestamptz
```

---

## API Testing (Optional)

Use these curl commands to test the API:

### Get Active Cars (Public)
```bash
curl 'https://umjsrbxerbttukpjbsaj.supabase.co/rest/v1/cars?select=*&bidding_enabled=eq.true&status=eq.Active' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### Place Bid (Authenticated)
```bash
curl -X POST 'https://umjsrbxerbttukpjbsaj.supabase.co/rest/v1/bids' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"car_id":"CAR_UUID","user_id":"USER_UUID","amount":25000}'
```

---

## Support Resources

- **Platform Guide**: PLATFORM_GUIDE.md
- **Admin Quick Start**: ADMIN_QUICK_START.md
- **README**: README.md
- **Supabase Docs**: https://supabase.com/docs
- **React Docs**: https://react.dev

---

## Next Steps

1. ✅ Setup complete - You're ready to go!
2. 📚 Read ADMIN_QUICK_START.md for admin training
3. 🧪 Test the workflow end-to-end
4. 🚀 Deploy to production when ready
5. 📊 Monitor usage and performance

---

## Getting Help

If you encounter issues:
1. Check this guide
2. Review error messages in browser console
3. Check Supabase logs (Dashboard → Logs)
4. Review code comments
5. Check documentation files

---

**You're all set! Start by accessing `/admin` and importing your first cars.** 🚀

*Last Updated: November 2025*
