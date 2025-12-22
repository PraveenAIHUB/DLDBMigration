crea# Session Management Implementation

## Overview
Proper session management has been implemented for all user types (Admin, Business User, and Customer) with inactivity timeout, session expiration checks, and user warnings.

## Features Implemented

### 1. **Inactivity Timeout (30 minutes)**
- **Applies to**: All user types (Admin, Business User, Customer)
- **Timeout**: 30 minutes of inactivity
- **Behavior**: Automatically logs out user after 30 minutes of no activity
- **Activity Tracking**: Monitors mouse, keyboard, scroll, touch, and click events

### 2. **Session Expiration for Business Users**
- **Duration**: 4 hours from login
- **Storage**: sessionStorage with expiration timestamp
- **Behavior**: Business user sessions expire after 4 hours, even if tab is open
- **Check**: Validated every 5 minutes and on app load

### 3. **Session Validity Monitoring**
- **Frequency**: Every 5 minutes
- **Checks**:
  - Business Users: Validates expiration timestamp
  - Admin/Customer: Validates Supabase session validity
- **Action**: Auto-logout if session is invalid or expired

### 4. **Session Warning System**
- **Warning Time**: 5 minutes before timeout
- **Message**: "Your session will expire in 5 minutes due to inactivity."
- **User Action**: User can extend session by moving mouse or pressing any key
- **Display**: Toast notification at top of screen

### 5. **Session Timeout Notification**
- **Message**: "Your session has expired due to inactivity. Please log in again."
- **Display**: Toast notification after auto-logout

## Implementation Details

### Session Constants
```typescript
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const BUSINESS_USER_SESSION_DURATION = 4 * 60 * 60 * 1000; // 4 hours
const SESSION_WARNING_TIME = 5 * 60 * 1000; // 5 minutes before timeout
```

### Business User Session Structure
```typescript
{
  id: string,
  email: string,
  name: string,
  expiresAt: string, // ISO timestamp
  createdAt: string  // ISO timestamp
}
```

### Activity Events Monitored
- `mousedown`
- `keydown`
- `scroll`
- `touchstart`
- `click`
- `keypress`

## User Experience

### Session Warning Flow
1. User inactive for 25 minutes → Warning appears
2. User sees: "Your session will expire in 5 minutes due to inactivity."
3. User moves mouse or presses key → Timer resets
4. User continues inactivity → Auto-logout after 30 minutes total

### Session Expiration Flow
1. Business user logs in → Session created with 4-hour expiration
2. Every 5 minutes → System checks if session expired
3. If expired → Auto-logout
4. If not expired → Session continues

## Files Modified

### 1. `src/contexts/AuthContext.tsx`
- Added session timeout constants
- Added inactivity timeout monitoring
- Added session validity checks
- Added business user session expiration
- Added session warning and timeout events

### 2. `src/components/common/SessionWarning.tsx` (NEW)
- Component to display session warnings
- Listens to `session-warning` and `session-timeout` events
- Shows amber warning 5 minutes before timeout
- Shows red notification on timeout

### 3. `src/App.tsx`
- Added `SessionWarning` component to all routes
- Ensures warnings show on all pages

## Session Behavior Summary

| User Type | Storage | Inactivity Timeout | Session Duration | Auto-Refresh |
|-----------|---------|-------------------|------------------|--------------|
| **Admin** | localStorage | 30 minutes | Up to 30 days (refresh token) | Yes |
| **Customer** | localStorage | 30 minutes | Up to 30 days (refresh token) | Yes |
| **Business User** | sessionStorage | 30 minutes | 4 hours | No |

## Security Improvements

1. **Inactivity Protection**: Prevents unauthorized access on shared devices
2. **Session Expiration**: Business users can't stay logged in indefinitely
3. **Session Validation**: Regular checks ensure sessions are still valid
4. **User Warnings**: Users are notified before timeout, allowing them to extend session

## Testing

### Test Inactivity Timeout
1. Log in as any user type
2. Wait 25 minutes without activity
3. Verify warning appears
4. Wait 5 more minutes without activity
5. Verify auto-logout occurs

### Test Business User Session Expiration
1. Log in as business user
2. Wait 4 hours (or manually set expiration in sessionStorage)
3. Refresh page or wait for periodic check
4. Verify auto-logout occurs

### Test Session Extension
1. Log in as any user
2. Wait for warning (25 minutes)
3. Move mouse or press key
4. Verify warning disappears and timer resets

## Configuration

To adjust timeout values, modify constants in `src/contexts/AuthContext.tsx`:

```typescript
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // Change to desired timeout
const BUSINESS_USER_SESSION_DURATION = 4 * 60 * 60 * 1000; // Change to desired duration
const SESSION_WARNING_TIME = 5 * 60 * 1000; // Change warning time
```

## Notes

- Inactivity timeout applies to ALL user types
- Business user sessions expire after 4 hours regardless of activity
- Admin/Customer sessions can last up to 30 days (Supabase refresh token) but will timeout after 30 minutes of inactivity
- Session warnings are dismissible but will reappear if user remains inactive
- All session events are logged to console for debugging

