# User Dashboard Cars Not Showing - Diagnostic Guide

## Problem
User dashboard sometimes shows 0 cars even though admin dashboard shows active cars.

## Root Causes

### 1. **Strict Filtering Criteria**
The user dashboard has **5 strict requirements** that ALL must be met for cars to show:

#### Requirement 1: Lot Must Be Approved
```sql
lots.approved = true
lots.status IN ('Approved', 'Active')
```
**Location**: `UserDashboard.tsx` lines 262-266

#### Requirement 2: Car Status Must Be Active
```sql
cars.status = 'Active'
```
**Location**: `UserDashboard.tsx` line 308

#### Requirement 3: Bidding Must Be Enabled
```sql
cars.bidding_enabled = true
```
**Location**: `UserDashboard.tsx` line 309

#### Requirement 4: Bidding Dates Must Be Set
```sql
cars.bidding_start_date IS NOT NULL
cars.bidding_end_date IS NOT NULL
```
**Location**: `UserDashboard.tsx` lines 310-311

#### Requirement 5: Current Time Must Be Within Bidding Period
```sql
NOW() >= cars.bidding_start_date
NOW() <= cars.bidding_end_date
```
**Location**: `UserDashboard.tsx` lines 310-311

### 2. **RLS Policy Mismatch**
The RLS policy (from migration `20250104000000_update_car_rls_for_approved_lots.sql`) does NOT require `bidding_enabled = true`, but the query does. This creates a mismatch.

**RLS Policy**:
```sql
-- Does NOT check bidding_enabled
AND status = 'Active'
AND bidding_start_date IS NOT NULL
AND bidding_end_date IS NOT NULL
AND now() >= bidding_start_date 
AND now() <= bidding_end_date
```

**Query Filter**:
```typescript
.eq('bidding_enabled', true)  // This is required but RLS doesn't check it
```

### 3. **Potential Issues**

#### Issue A: Cars Have `bidding_enabled = false`
- **Symptom**: Cars exist in approved lots but don't show
- **Check**: Run in Supabase SQL Editor:
  ```sql
  SELECT id, make_model, status, bidding_enabled, bidding_start_date, bidding_end_date, lot_id
  FROM cars
  WHERE lot_id IN (SELECT id FROM lots WHERE approved = true AND status IN ('Approved', 'Active'));
  ```
- **Fix**: Set `bidding_enabled = true` for cars that should be visible

#### Issue B: Bidding Dates Not Set or Invalid
- **Symptom**: Cars exist but dates are NULL or outside current time
- **Check**: 
  ```sql
  SELECT id, make_model, bidding_start_date, bidding_end_date,
         CASE 
           WHEN bidding_start_date IS NULL THEN 'Missing start date'
           WHEN bidding_end_date IS NULL THEN 'Missing end date'
           WHEN bidding_start_date > NOW() THEN 'Start date in future'
           WHEN bidding_end_date < NOW() THEN 'End date in past'
           ELSE 'OK'
         END as date_status
  FROM cars
  WHERE lot_id IN (SELECT id FROM lots WHERE approved = true);
  ```
- **Fix**: Set proper bidding dates that include current time

#### Issue C: Lot Not Approved or Wrong Status
- **Symptom**: Cars exist but lot is not approved
- **Check**:
  ```sql
  SELECT l.id, l.lot_number, l.approved, l.status, COUNT(c.id) as car_count
  FROM lots l
  LEFT JOIN cars c ON c.lot_id = l.id
  GROUP BY l.id, l.lot_number, l.approved, l.status;
  ```
- **Fix**: Set `approved = true` and `status IN ('Approved', 'Active')`

#### Issue D: Car Status Not 'Active'
- **Symptom**: Cars exist but status is not 'Active'
- **Check**:
  ```sql
  SELECT status, COUNT(*) as count
  FROM cars
  WHERE lot_id IN (SELECT id FROM lots WHERE approved = true)
  GROUP BY status;
  ```
- **Fix**: Set `status = 'Active'` for cars that should be visible

#### Issue E: Race Condition with `refresh_car_statuses` RPC
- **Symptom**: Cars show sometimes but not always
- **Cause**: The `refresh_car_statuses` RPC might be changing car statuses
- **Check**: Monitor car status changes:
  ```sql
  SELECT id, make_model, status, updated_at
  FROM cars
  ORDER BY updated_at DESC
  LIMIT 10;
  ```

## Diagnostic Steps

### Step 1: Check Browser Console
Open browser console (F12) and look for these log messages:
- `"Approved lots: X Lot IDs: [...]"`
- `"All cars in approved lots (before filtering): X"`
- `"Cars meeting ALL criteria: X"`
- `"Cars returned by query (after RLS): X"`

### Step 2: Run Diagnostic Query
Run this in Supabase SQL Editor to see what's blocking:

```sql
-- Check lots
SELECT 
  l.id as lot_id,
  l.lot_number,
  l.approved as lot_approved,
  l.status as lot_status,
  COUNT(c.id) as total_cars,
  COUNT(CASE WHEN c.status = 'Active' THEN 1 END) as active_cars,
  COUNT(CASE WHEN c.bidding_enabled = true THEN 1 END) as bidding_enabled_cars,
  COUNT(CASE 
    WHEN c.status = 'Active' 
    AND c.bidding_enabled = true
    AND c.bidding_start_date IS NOT NULL
    AND c.bidding_end_date IS NOT NULL
    AND NOW() >= c.bidding_start_date
    AND NOW() <= c.bidding_end_date
    THEN 1 
  END) as cars_meeting_all_criteria
FROM lots l
LEFT JOIN cars c ON c.lot_id = l.id
WHERE l.approved = true
GROUP BY l.id, l.lot_number, l.approved, l.status
ORDER BY l.lot_number;
```

### Step 3: Check Individual Cars
For a specific lot, check why cars aren't showing:

```sql
SELECT 
  c.id,
  c.make_model,
  c.status,
  c.bidding_enabled,
  c.bidding_start_date,
  c.bidding_end_date,
  CASE 
    WHEN c.status != 'Active' THEN '❌ Status not Active'
    WHEN c.bidding_enabled != true THEN '❌ Bidding not enabled'
    WHEN c.bidding_start_date IS NULL THEN '❌ Missing start date'
    WHEN c.bidding_end_date IS NULL THEN '❌ Missing end date'
    WHEN c.bidding_start_date > NOW() THEN '❌ Start date in future'
    WHEN c.bidding_end_date < NOW() THEN '❌ End date in past'
    ELSE '✅ Should be visible'
  END as visibility_status
FROM cars c
WHERE c.lot_id = 'YOUR_LOT_ID_HERE'
ORDER BY c.make_model;
```

## Quick Fixes

### Fix 1: Enable Bidding for All Active Cars
```sql
UPDATE cars
SET bidding_enabled = true
WHERE status = 'Active'
AND lot_id IN (SELECT id FROM lots WHERE approved = true);
```

### Fix 2: Set Bidding Dates for Cars Without Dates
```sql
-- Set dates to current time + 30 days if missing
UPDATE cars
SET 
  bidding_start_date = COALESCE(bidding_start_date, NOW()),
  bidding_end_date = COALESCE(bidding_end_date, NOW() + INTERVAL '30 days')
WHERE lot_id IN (SELECT id FROM lots WHERE approved = true)
AND (bidding_start_date IS NULL OR bidding_end_date IS NULL);
```

### Fix 3: Ensure Lots Are Approved
```sql
UPDATE lots
SET approved = true, status = 'Active'
WHERE status IN ('Approved', 'Active')
AND approved = false;
```

### Fix 4: Set Car Status to Active
```sql
UPDATE cars
SET status = 'Active'
WHERE lot_id IN (SELECT id FROM lots WHERE approved = true AND status IN ('Approved', 'Active'))
AND status != 'Active';
```

## Common Scenarios

### Scenario 1: Admin Creates Cars but They Don't Show
**Cause**: Cars created without proper settings
**Fix**: Ensure when creating cars:
- Set `status = 'Active'`
- Set `bidding_enabled = true`
- Set `bidding_start_date` and `bidding_end_date` to include current time
- Ensure lot has `approved = true` and `status IN ('Approved', 'Active')`

### Scenario 2: Cars Show Sometimes but Not Always
**Cause**: Race condition or timing issue
**Possible Issues**:
1. `refresh_car_statuses` RPC changing statuses
2. Date/timezone mismatch
3. Session/RLS policy caching

**Fix**: 
- Check if `refresh_car_statuses` is changing car statuses incorrectly
- Ensure server and client timezones match
- Clear browser cache and reload

### Scenario 3: Cars Show in Admin but Not User Dashboard
**Cause**: Admin can see all cars (bypasses RLS), but user dashboard has strict filters
**Check**: Compare what admin sees vs what user query returns
**Fix**: Ensure cars meet all 5 requirements listed above

## Prevention

### When Creating Cars in Admin:
1. ✅ Set `status = 'Active'`
2. ✅ Set `bidding_enabled = true`
3. ✅ Set `bidding_start_date` (must be <= NOW())
4. ✅ Set `bidding_end_date` (must be >= NOW())
5. ✅ Ensure lot is approved and active

### When Creating Lots:
1. ✅ Set `approved = true`
2. ✅ Set `status = 'Active'` or `'Approved'`

## Enhanced Logging

The code now includes enhanced logging. Check browser console for:
- Number of approved lots found
- Number of cars in those lots
- Number of cars meeting criteria
- Detailed reasons why cars don't meet criteria
- RLS query results

This will help identify exactly which requirement is failing.

