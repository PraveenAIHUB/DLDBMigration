# Supabase Redirect URL Configuration for Password Reset

## Problem
When deploying to AWS (or any production environment), password reset emails redirect to `localhost:3000` instead of your production URL.

## Solution
You need to configure the allowed redirect URLs in your Supabase project settings.

## Steps to Fix

### 1. Go to Supabase Dashboard
1. Log in to [https://supabase.com](https://supabase.com)
2. Select your project

### 2. Navigate to Authentication Settings
1. Go to **Authentication** in the left sidebar
2. Click on **URL Configuration** (or **Redirect URLs**)

### 3. Add Your Production URLs
In the **Redirect URLs** section, add all the URLs where your app will be hosted:

```
# Production URL (replace with your actual AWS URL)
https://your-app-domain.com/reset-password
https://your-app-domain.com/*

# If using AWS Amplify, CloudFront, or similar
https://*.amplifyapp.com/reset-password
https://*.cloudfront.net/reset-password

# Development URL (keep for local testing)
http://localhost:5173/reset-password
http://localhost:3000/reset-password
```

### 4. Site URL Configuration
Also update the **Site URL** in the same settings:
- Set it to your production URL: `https://your-app-domain.com`

### 5. Save Changes
Click **Save** to apply the changes.

## Important Notes

1. **Wildcard Support**: Supabase supports wildcards (`*`) for subdomains, but be careful with security.

2. **Multiple Environments**: You can add multiple URLs for:
   - Production: `https://your-app.com/reset-password`
   - Staging: `https://staging.your-app.com/reset-password`
   - Development: `http://localhost:5173/reset-password`

3. **URL Format**: The redirect URL must include the full path:
   - ✅ Correct: `https://your-app.com/reset-password`
   - ❌ Wrong: `https://your-app.com`

4. **HTTPS Required**: Production URLs must use HTTPS (not HTTP).

## Verification

After updating the settings:
1. Request a password reset from your production site
2. Check the email - the link should point to your production URL
3. Click the link - it should redirect to your production site, not localhost

## Code Implementation

The code in `src/contexts/AuthContext.tsx` already uses `window.location.origin` which automatically detects the current domain:

```typescript
const redirectUrl = `${window.location.origin}/reset-password`;
```

This means:
- On `localhost:5173` → redirects to `http://localhost:5173/reset-password`
- On `your-app.com` → redirects to `https://your-app.com/reset-password`

No code changes are needed - just update the Supabase dashboard settings!




