# AWS Amplify Environment Variables Setup Guide

## Problem: "Missing Supabase environment variables" Error

If you're seeing this error after deploying to AWS Amplify, it means the environment variables are not being passed to the build process correctly.

## Solution: Properly Configure Environment Variables in AWS Amplify

### Step 1: Add Environment Variables in AWS Amplify Console

1. **Go to AWS Amplify Console:**
   - Navigate to your app in [AWS Amplify Console](https://console.aws.amazon.com/amplify)
   - Click on your app

2. **Navigate to Environment Variables:**
   - In the left sidebar, click **"Environment variables"**
   - Or go to **App settings** → **Environment variables**

3. **Add Required Variables:**
   Click **"Manage variables"** and add these two variables:

   | Variable Name | Value |
   |--------------|-------|
   | `VITE_SUPABASE_URL` | Your Supabase project URL (e.g., `https://xxxxx.supabase.co`) |
   | `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key |

   **Important Notes:**
   - ✅ Variable names MUST start with `VITE_` (this is required for Vite)
   - ✅ Variable names are case-sensitive
   - ✅ No spaces in variable names
   - ✅ Copy the exact values from Supabase Dashboard → Settings → API

4. **Save Changes:**
   - Click **"Save"** after adding both variables

### Step 2: Trigger a New Build

After adding environment variables, you need to trigger a new build:

1. **Option A: Redeploy from Console**
   - Go to your app in Amplify Console
   - Click on the branch (usually `main` or `master`)
   - Click **"Redeploy this version"** or **"Redeploy"**

2. **Option B: Push a New Commit**
   - Make a small change (like updating a comment)
   - Commit and push to your repository
   - Amplify will automatically trigger a new build

3. **Option C: Manual Build Trigger**
   - Go to your app → **"Build history"**
   - Click **"Redeploy"** on the latest build

### Step 3: Verify Environment Variables in Build Logs

1. **Check Build Logs:**
   - Go to your app → **"Build history"**
   - Click on the latest build
   - Look for the preBuild phase
   - You should see: `"Environment variables are set correctly"`

2. **If You See Errors:**
   - `ERROR: VITE_SUPABASE_URL is not set!` → Variable not added or wrong name
   - `ERROR: VITE_SUPABASE_ANON_KEY is not set!` → Variable not added or wrong name

### Step 4: Verify in Browser

After deployment:

1. **Open your deployed app**
2. **Open Browser Developer Tools** (F12)
3. **Go to Console tab**
4. **Check for errors:**
   - ✅ No "Missing Supabase environment variables" error = Success!
   - ❌ Still seeing the error = See troubleshooting below

---

## Common Issues and Solutions

### Issue 1: Variables Added But Still Getting Error

**Possible Causes:**
- Variables were added after the build
- Build cache is using old build
- Variable names are incorrect

**Solution:**
1. Double-check variable names:
   - Must be exactly: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   - Case-sensitive, no typos
2. Clear build cache:
   - Go to App settings → Build settings
   - Click "Clear cache" or disable cache temporarily
3. Trigger a fresh build (see Step 2 above)

### Issue 2: Variables Not Available in Build

**Check Build Logs:**
- Look for the preBuild phase output
- Should see: "Environment variables are set correctly"
- If you see errors, the variables aren't being passed

**Solution:**
1. Verify variables are saved in Amplify Console
2. Make sure you're editing the correct branch/environment
3. Try removing and re-adding the variables

### Issue 3: Wrong Variable Values

**Symptoms:**
- App loads but can't connect to Supabase
- API errors in console

**Solution:**
1. Get correct values from Supabase:
   - Go to Supabase Dashboard → Settings → API
   - Copy **Project URL** → Use for `VITE_SUPABASE_URL`
   - Copy **anon/public key** → Use for `VITE_SUPABASE_ANON_KEY`
2. Update variables in Amplify Console
3. Redeploy

### Issue 4: Variables Work Locally But Not in Amplify

**Cause:**
- Local `.env` file works, but Amplify needs variables set in console

**Solution:**
- Environment variables in Amplify Console are separate from local `.env` files
- You must add them in Amplify Console (see Step 1)

---

## Step-by-Step Checklist

Follow this checklist to ensure everything is set up correctly:

- [ ] Opened AWS Amplify Console
- [ ] Navigated to Environment Variables section
- [ ] Added `VITE_SUPABASE_URL` with correct value
- [ ] Added `VITE_SUPABASE_ANON_KEY` with correct value
- [ ] Verified variable names start with `VITE_`
- [ ] Saved the variables
- [ ] Triggered a new build/redeploy
- [ ] Checked build logs for "Environment variables are set correctly"
- [ ] Verified app works in browser (no console errors)

---

## Quick Test

After setting up, test if variables are working:

1. **Deploy your app**
2. **Open browser console** (F12)
3. **Run this in console:**
   ```javascript
   console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
   console.log('Supabase Key:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Set' : 'Missing');
   ```
4. **Expected Output:**
   - Should show your Supabase URL
   - Should show "Set" for the key
   - If either shows `undefined` or `Missing`, variables aren't configured correctly

---

## Alternative: Using amplify.yml for Environment Variables

If you prefer to set variables in the build file (not recommended for sensitive data, but useful for testing):

Edit `amplify.yml`:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - |
          export VITE_SUPABASE_URL="your-url-here"
          export VITE_SUPABASE_ANON_KEY="your-key-here"
        - npm run build
  artifacts:
    baseDirectory: dist
    files:
      - '**/*'
```

**⚠️ Warning:** Don't commit sensitive keys to your repository! Use Amplify Console for production.

---

## Still Having Issues?

1. **Check Build Logs:**
   - Look for any error messages
   - Verify preBuild phase completes successfully

2. **Verify Supabase Credentials:**
   - Test credentials locally first
   - Make sure Supabase project is active

3. **Clear Everything:**
   - Clear Amplify build cache
   - Remove and re-add environment variables
   - Trigger a fresh build

4. **Contact Support:**
   - AWS Amplify support
   - Check AWS Amplify documentation

---

## Summary

The key points to remember:

1. ✅ Variable names MUST start with `VITE_`
2. ✅ Add variables in Amplify Console (not just in code)
3. ✅ Trigger a new build after adding variables
4. ✅ Check build logs to verify variables are set
5. ✅ Test in browser to confirm everything works

---

*Last updated: December 2025*

