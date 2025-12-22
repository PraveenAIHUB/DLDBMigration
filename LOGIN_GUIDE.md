# 🔑 Login Guide - Where to Login?

## Issue: "I'm trying to login but getting errors!"

The application has **THREE different login pages** for different user types. Make sure you're on the correct page!

---

## 👤 User Types & Login URLs

### 1. 👨‍💼 **ADMIN** (You!)
**Login URL:** http://localhost:5173/admin

**Credentials:**
- Email: `admin@carbidding.com`
- Password: `admin123`

**Access:**
- ✅ Manage cars, lots, bids
- ✅ Approve users
- ✅ View all data
- ✅ Excel import/export

---

### 2. 🏢 **BUSINESS USER** (Sellers)
**Login URL:** http://localhost:5173/business

**Example:**
- Email: (created by admin)
- Password: (set by business user)

**Access:**
- ✅ View their own lots
- ✅ See bidding results
- ✅ View winner announcements

---

### 3. 🙋 **REGULAR USER** (Bidders)
**Login URL:** http://localhost:5173/ (main page)

**Example:**
- Email: (sign up on main page)
- Password: (choose during signup)

**Access:**
- ✅ Browse cars
- ✅ Place bids
- ✅ View their bids

---

## ⚠️ Common Mistakes

### ❌ Wrong Page Error
**Symptom:** "401 Unauthorized" or "Authentication error"

**Cause:** Trying to login as admin on the main page (http://localhost:5173/)

**Solution:**
1. Go to **http://localhost:5173/admin**
2. Enter admin credentials
3. Login

### ❌ Backend Not Running
**Symptom:** Red banner saying "Backend Server Not Running"

**Solution:**
```bash
npm run dev:all
```

Or separately:
```bash
# Terminal 1
npm run dev:server

# Terminal 2
npm run dev
```

---

## 🎯 Quick Start for Admin

1. **Start the application:**
   ```bash
   npm run dev:all
   ```

2. **Open admin page:**
   ```
   http://localhost:5173/admin
   ```

3. **Login:**
   - Email: `admin@carbidding.com`
   - Password: `admin123`

4. **Done!** You should see the admin dashboard.

---

## 🔍 How to Know Which Page You're On?

Look at the URL in your browser:

| URL | User Type |
|-----|-----------|
| `http://localhost:5173/` | Regular User (Bidders) |
| `http://localhost:5173/admin` | Admin |
| `http://localhost:5173/business` | Business User |

---

## 📝 Summary

**FOR ADMIN LOGIN (YOU):**
1. ✅ Go to: `http://localhost:5173/admin`
2. ✅ Use: `admin@carbidding.com` / `admin123`
3. ✅ Make sure backend is running (`npm run dev:all`)

**NOT:**
- ❌ Don't use the main page (http://localhost:5173/)
- ❌ That's for regular users/bidders only

---

## ✅ Fixed Issues

1. ✅ Removed unauthenticated API call that caused 401 error
2. ✅ UserAuth now tries regular login first, then business login
3. ✅ Build completes without errors
4. ✅ Clear error messages for wrong credentials

---

**TIP:** Bookmark the admin URL for quick access!
