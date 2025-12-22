# Session Management Details

## Overview
This document explains the session management logic for Admin, Business User, and Customer (Bidder) logins in the application.

## Current Implementation

### 1. Admin & Customer (Regular Users) - Supabase Auth

**Location**: `src/lib/supabase.ts` and `src/contexts/AuthContext.tsx`

**Configuration**:
```typescript
{
  auth: {
    storage: window.localStorage,           // Sessions stored in localStorage
    autoRefreshToken: true,                 // Tokens automatically refresh
    persistSession: true,                   // Sessions persist across browser restarts
    detectSessionInUrl: true,
    flowType: 'pkce',
  }
}
```

**Session Behavior**:
- **Storage**: Sessions are stored in `localStorage` (persists across browser restarts)
- **Token Refresh**: Access tokens are automatically refreshed before expiration
- **Expiration**: 
  - **Access Token**: Default Supabase expiration is **1 hour**
  - **Refresh Token**: Default Supabase expiration is **30 days** (can be configured in Supabase Dashboard)
  - **Session**: Effectively **NEVER EXPIRES** as long as:
    1. User visits the site within 30 days (refresh token valid)
    2. Browser doesn't clear localStorage
    3. User doesn't explicitly sign out

**Session Flow**:
1. User logs in → Supabase creates access token (1 hour) + refresh token (30 days)
2. Access token expires → Supabase automatically refreshes using refresh token
3. Refresh token expires → User must log in again
4. Session persists in localStorage → User stays logged in even after closing browser

**Code Reference**:
- Session initialization: `src/contexts/AuthContext.tsx` lines 75-99
- Auth state listener: `src/contexts/AuthContext.tsx` lines 111-130
- Sign in: `src/contexts/AuthContext.tsx` lines 270-369 (customer) and 371-389 (admin)

---

### 2. Business Users - Custom Session Management

**Location**: `src/contexts/AuthContext.tsx` (lines 391-483)

**Configuration**:
```typescript
// Business users use sessionStorage (NOT localStorage)
sessionStorage.setItem('business_user', JSON.stringify({
  id: businessData.id,
  email: businessData.email,
  name: businessData.name,
}));
```

**Session Behavior**:
- **Storage**: Sessions stored in `sessionStorage` (cleared when browser tab closes)
- **Token Refresh**: **NONE** - No token system
- **Expiration**: 
  - **No explicit expiration** - Session persists until:
    1. Browser tab is closed
    2. User explicitly signs out
    3. Browser clears sessionStorage
  - **Effectively NEVER EXPIRES** while tab is open (even for days/weeks)

**Session Flow**:
1. User logs in → Business user data stored in `sessionStorage`
2. Session checked on app load → If `sessionStorage` has data, user is logged in
3. No expiration check → Session remains valid indefinitely while tab is open
4. Tab closes → `sessionStorage` cleared → User must log in again

**Code Reference**:
- Business user login: `src/contexts/AuthContext.tsx` lines 391-483
- Session check: `src/contexts/AuthContext.tsx` lines 54-71
- Sign out: `src/contexts/AuthContext.tsx` lines 485-520

---

## Issues Identified

### 1. **No Session Timeout for Any User Type**

**Problem**: 
- Admin/Customer sessions can last up to 30 days (refresh token lifetime)
- Business user sessions never expire while tab is open
- No inactivity timeout implemented

**Impact**:
- Security risk: Stolen sessions remain valid for extended periods
- No automatic logout after inactivity
- Users may remain logged in on shared/public computers

### 2. **Business User Sessions in sessionStorage**

**Problem**:
- Business users use `sessionStorage` which clears on tab close
- However, if tab stays open, session never expires
- No token-based authentication (uses plain password comparison)

**Impact**:
- Sessions can persist indefinitely if tab remains open
- Less secure than token-based authentication
- No way to invalidate sessions server-side

### 3. **No Explicit Session Expiration Configuration**

**Problem**:
- No code-level session timeout configuration
- Relies entirely on Supabase defaults (30-day refresh token)
- No way to configure shorter session lifetimes

**Impact**:
- Cannot enforce shorter session lifetimes
- Cannot implement inactivity timeouts
- Difficult to meet security compliance requirements

---

## Supabase Default Session Settings

### Access Token
- **Default Lifetime**: 1 hour
- **Refresh**: Automatic (if refresh token valid)
- **Storage**: localStorage

### Refresh Token
- **Default Lifetime**: 30 days (configurable in Supabase Dashboard)
- **Location**: Supabase Dashboard → Authentication → Settings → JWT Settings
- **Refresh**: New refresh token issued on each refresh

### Session
- **Persistence**: localStorage (survives browser restart)
- **Validation**: Supabase validates tokens on each API call
- **Expiration**: Only when refresh token expires (30 days default)

---

## Recommendations

### 1. Implement Session Timeout

Add inactivity timeout for all user types:

```typescript
// Add to AuthContext.tsx
useEffect(() => {
  if (!user) return;
  
  const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  let timeoutId: NodeJS.Timeout;
  
  const resetTimeout = () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      signOut(); // Auto-logout after inactivity
    }, INACTIVITY_TIMEOUT);
  };
  
  // Reset on user activity
  const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
  events.forEach(event => {
    document.addEventListener(event, resetTimeout);
  });
  
  resetTimeout();
  
  return () => {
    clearTimeout(timeoutId);
    events.forEach(event => {
      document.removeEventListener(event, resetTimeout);
    });
  };
}, [user]);
```

### 2. Configure Supabase Refresh Token Lifetime

**In Supabase Dashboard**:
1. Go to **Authentication** → **Settings** → **JWT Settings**
2. Set **JWT expiry time** to desired value (e.g., 1 hour, 4 hours, 1 day)
3. Set **Refresh token rotation** if needed

### 3. Add Session Expiration Check for Business Users

```typescript
// Add expiration timestamp to business user session
sessionStorage.setItem('business_user', JSON.stringify({
  id: businessData.id,
  email: businessData.email,
  name: businessData.name,
  expiresAt: Date.now() + (4 * 60 * 60 * 1000), // 4 hours
}));

// Check expiration on app load
const businessUserStr = sessionStorage.getItem('business_user');
if (businessUserStr) {
  const businessUser = JSON.parse(businessUserStr);
  if (businessUser.expiresAt && businessUser.expiresAt < Date.now()) {
    sessionStorage.removeItem('business_user');
    // User must log in again
  }
}
```

### 4. Add Server-Side Session Validation

For business users, implement token-based authentication:
- Generate JWT tokens on login
- Store tokens in httpOnly cookies or secure storage
- Validate tokens on each request
- Implement token expiration

---

## Current Session Flow Diagrams

### Admin/Customer Login Flow
```
User Login
  ↓
Supabase Auth.signInWithPassword()
  ↓
Supabase Issues:
  - Access Token (1 hour)
  - Refresh Token (30 days)
  ↓
Tokens Stored in localStorage
  ↓
Session Persists:
  - Across browser restarts
  - Until refresh token expires (30 days)
  - Until explicit sign out
  ↓
Auto-Refresh:
  - Access token refreshes automatically
  - Refresh token rotates (if enabled)
  ↓
Session Valid Indefinitely (up to 30 days)
```

### Business User Login Flow
```
Business User Login
  ↓
Verify Password (plain text comparison)
  ↓
Store in sessionStorage:
  {
    id, email, name
  }
  ↓
Session Persists:
  - Until tab closes
  - Until explicit sign out
  - NO EXPIRATION while tab open
  ↓
Session Check on App Load:
  - Read from sessionStorage
  - If exists → logged in
  - If missing → logged out
  ↓
Session Valid Indefinitely (while tab open)
```

---

## Summary

| User Type | Storage | Expiration | Auto-Refresh | Inactivity Timeout |
|-----------|---------|------------|--------------|-------------------|
| **Admin** | localStorage | 30 days (refresh token) | Yes | No |
| **Customer** | localStorage | 30 days (refresh token) | Yes | No |
| **Business User** | sessionStorage | Never (while tab open) | No | No |

**Key Finding**: **Sessions do not expire** for any user type unless:
1. Refresh token expires (30 days for Admin/Customer)
2. Browser tab closes (Business Users)
3. User explicitly signs out
4. Browser clears storage

**Security Concern**: No inactivity timeout means users can remain logged in indefinitely, which is a security risk especially on shared devices.

