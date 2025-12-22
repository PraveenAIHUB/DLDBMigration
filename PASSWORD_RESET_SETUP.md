# Password Reset Setup Guide

## Overview

The password reset functionality has been fixed to properly handle reset tokens from Supabase email links. This guide explains how it works and what needs to be configured.

## How It Works

1. **User Requests Reset**: User clicks "Forgot password?" and enters their email
2. **Email Sent**: Supabase sends a password reset email with a secure token
3. **User Clicks Link**: User clicks the link in the email, which redirects to `/reset-password`
4. **Token Validation**: The app validates the token from the URL hash
5. **Password Update**: User enters new password and it's updated

## Required Supabase Configuration

### 1. Configure Redirect URLs

In your Supabase Dashboard:

1. Go to **Authentication** → **URL Configuration**
2. Add your site URL(s) to **Redirect URLs**:
   - For development: `http://localhost:5173/reset-password`
   - For production: `https://yourdomain.com/reset-password`
   - For AWS Amplify: `https://*.amplifyapp.com/reset-password`

### 2. Configure Email Templates (Optional)

1. Go to **Authentication** → **Email Templates**
2. Select **Reset Password** template
3. Ensure the redirect link includes: `{{ .ConfirmationURL }}`
4. Customize the email content as needed

### 3. Verify Email Settings

1. Go to **Authentication** → **Settings**
2. Ensure **Enable email confirmations** is enabled (if required)
3. Check **Site URL** is set correctly

## Testing the Password Reset Flow

### Step 1: Request Password Reset

1. Navigate to the login page
2. Click "Forgot password?"
3. Enter a valid user email (must exist in Supabase Auth)
4. Click "Send Reset Link"
5. You should see: "Password reset email sent!"

### Step 2: Check Email

1. Check the email inbox for the reset email
2. The email should contain a link like:
   ```
   https://your-project.supabase.co/auth/v1/verify?token=...&type=recovery&redirect_to=http://localhost:5173/reset-password
   ```

### Step 3: Reset Password

1. Click the link in the email
2. You should be redirected to `/reset-password`
3. The page should show "Verifying Reset Link..." briefly
4. Then show the password reset form
5. Enter new password (min 6 characters)
6. Confirm password
7. Click "Update Password"
8. You should see "Password Reset Successful!"
9. You'll be redirected to the login page

## Troubleshooting

### Issue: "Invalid or missing reset token"

**Causes:**
- The reset link has expired (links expire after 1 hour by default)
- The URL hash was removed or modified
- The redirect URL doesn't match Supabase configuration

**Solutions:**
1. Request a new password reset link
2. Verify redirect URLs in Supabase Dashboard
3. Check browser console for errors
4. Ensure the full URL (including hash) is preserved

### Issue: "Session expired"

**Causes:**
- Too much time passed between clicking link and submitting form
- Browser cleared session storage
- Token expired

**Solutions:**
1. Request a new password reset link
2. Complete the reset process quickly (within a few minutes)
3. Don't close the browser tab

### Issue: "Failed to send password reset email"

**Causes:**
- Email doesn't exist in Supabase Auth
- Rate limiting (too many requests)
- Supabase email service issue

**Solutions:**
1. Verify the email exists in Supabase Auth (Authentication → Users)
2. Wait a few minutes before trying again
3. Check Supabase status page
4. Verify email configuration in Supabase

### Issue: Email not received

**Causes:**
- Email went to spam folder
- Email address is incorrect
- Supabase email service is down

**Solutions:**
1. Check spam/junk folder
2. Verify email address is correct
3. Check Supabase Dashboard → Authentication → Users to confirm user exists
4. Try a different email address

### Issue: Redirect URL mismatch

**Error:** "Invalid redirect URL" or similar

**Solutions:**
1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add your exact redirect URL to the allowed list
3. For development: `http://localhost:5173/reset-password`
4. For production: `https://yourdomain.com/reset-password`
5. Include protocol (http/https) and exact path

## Code Changes Made

### 1. ResetPassword Component (`src/components/auth/ResetPassword.tsx`)

- Added token validation from URL hash
- Added session verification
- Added loading states
- Added error handling for invalid/expired tokens
- Improved user feedback

### 2. AuthContext (`src/contexts/AuthContext.tsx`)

- Enhanced `resetPasswordForEmail` with better error messages
- Added validation for email format
- Improved error handling

## Security Notes

1. **Token Expiration**: Reset tokens expire after 1 hour (Supabase default)
2. **Single Use**: Tokens should be single-use (Supabase handles this)
3. **HTTPS Required**: In production, always use HTTPS
4. **Rate Limiting**: Supabase rate limits password reset requests

## Production Checklist

- [ ] Configure redirect URLs in Supabase Dashboard
- [ ] Test password reset flow end-to-end
- [ ] Verify email delivery
- [ ] Customize email template (optional)
- [ ] Set up email monitoring/alerts
- [ ] Document process for users
- [ ] Test with different email providers
- [ ] Verify HTTPS is working
- [ ] Check spam folder handling

## Support

If password reset still doesn't work:

1. Check browser console for errors
2. Check Supabase Dashboard → Logs for API errors
3. Verify Supabase project is active
4. Test with a fresh browser session
5. Verify environment variables are correct

