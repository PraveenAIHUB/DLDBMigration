# Admin Login Setup Guide

## Quick Answer: How to Login as Admin

### Step 1: Create Auth User in Supabase Dashboard

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard
2. **Select Your Project**: Click on your project
3. **Navigate to Authentication**:
   - Click "Authentication" in left sidebar
   - Click "Users" tab
4. **Add Admin User**:
   - Click **"Add User"** button (green button top right)
   - Select **"Create new user"**
   - Fill in:
     ```
     Email: admin@carbidding.com
     Password: [Choose a secure password]
     ```
   - **IMPORTANT**: Check ✅ "Auto Confirm User"
   - Click **"Create User"**

5. **Done!** Now you can login at `/admin`

### Step 2: Login to Your App

1. Navigate to: `http://localhost:5173/admin` (or your deployed URL + `/admin`)
2. Enter:
   - **Email**: `admin@carbidding.com`
   - **Password**: [The password you just set]
3. Click **"Sign In"**

---

## Alternative: Create Admin User Programmatically

If you prefer to create the admin user via code, here's a one-time setup script:

### Create `scripts/create-admin.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://umjsrbxerbttukpjbsaj.supabase.co';
const supabaseServiceKey = 'YOUR_SERVICE_ROLE_KEY'; // Get from Supabase Dashboard → Settings → API

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createAdminUser() {
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'admin@carbidding.com',
    password: 'Admin@2024!', // Change this!
    email_confirm: true,
  });

  if (error) {
    console.error('Error creating admin:', error);
  } else {
    console.log('Admin user created successfully!', data);
  }
}

createAdminUser();
```

**Run with:**
```bash
npx tsx scripts/create-admin.ts
```

---

## Troubleshooting

### Issue: "Invalid login credentials"

**Cause**: The Supabase Auth user doesn't exist yet.

**Solution**: Follow Step 1 above to create the auth user in Supabase Dashboard.

---

### Issue: "User already exists"

**Good News**: Auth user is already created!

**Solution**: Just login with the existing password.

**Forgot Password?**
1. Go to Supabase Dashboard → Authentication → Users
2. Find admin@carbidding.com
3. Click the three dots (⋮) → "Reset Password"
4. OR delete the user and create a new one

---

### Issue: Can't access `/admin` page

**Cause**: Might be a routing issue.

**Solution**:
1. Make sure dev server is running: `npm run dev`
2. Navigate to: `http://localhost:5173/admin` (note the `/admin`)
3. You should see the admin login page

---

## Security Best Practices

### ⚠️ Important for Production:

1. **Change Default Email**: Use your own admin email
   ```sql
   -- Update in database
   UPDATE admin_users
   SET email = 'your.email@company.com', name = 'Your Name'
   WHERE email = 'admin@carbidding.com';
   ```

2. **Use Strong Password**:
   - Minimum 12 characters
   - Mix of uppercase, lowercase, numbers, symbols
   - Example: `Adm1n$ecure2024!`

3. **Enable 2FA**: If Supabase offers it for your plan

4. **Limit Admin Access**: Only create admin accounts for authorized users

---

## Current Admin Credentials

**Default** (Change these immediately):
```
Email: admin@carbidding.com
Password: [You need to set this in Supabase Auth]
```

**After Setup**:
```
Email: admin@carbidding.com
Password: [Your chosen password]
```

---

## Quick Test

1. **Create Auth User** (Supabase Dashboard)
2. **Start Dev Server**: `npm run dev`
3. **Navigate**: `http://localhost:5173/admin`
4. **Login**: Use admin@carbidding.com + your password
5. **Success**: You should see the admin dashboard!

---

## Video Tutorial (Steps)

### In Supabase Dashboard:
```
1. Click "Authentication" (left sidebar)
2. Click "Users" tab
3. Click "Add User" button (green, top right)
4. Click "Create new user"
5. Type: admin@carbidding.com
6. Type: [your password]
7. Check: "Auto Confirm User" ✅
8. Click: "Create User"
```

### In Your App:
```
1. Go to: http://localhost:5173/admin
2. Type: admin@carbidding.com
3. Type: [your password]
4. Click: "Sign In"
5. See: Admin Dashboard 🎉
```

---

## Need More Help?

### Check These:
1. Supabase Auth users list - Is the user there?
2. Browser console - Any error messages?
3. Network tab - Check API responses
4. `.env` file - Are Supabase credentials correct?

### Common Solutions:
- Clear browser cache/cookies
- Try incognito/private window
- Restart dev server
- Check Supabase project is active
- Verify environment variables

---

## Summary

**TL;DR**:
1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add User" → "Create new user"
3. Email: `admin@carbidding.com`, Password: [yours], Auto-confirm: ✅
4. Navigate to `/admin` in your app
5. Login with those credentials
6. Done! 🚀

---

**Once logged in, you'll see the admin dashboard and can start managing cars!**
