

# Multi-Ward Guardian Support (up to 3 Users per Guardian)

## Overview
Allow a single guardian account to monitor up to 3 different users. Add a ward selector to the Guardian Dashboard and enforce the 3-ward limit during registration/nomination.

## Current State
- DB: No constraint on guardian-to-user ratio — already supports multiple wards
- UI: Guardian Dashboard uses `.limit(1)` and always picks the first ward — only shows one user
- All guardian pages (Dashboard, Messages, Reports, Services, Alerts) assume a single ward

## Changes

### 1. Ward Selector Context
Create a `GuardianWardContext` that:
- Fetches all accepted guardian entries for the current user
- Stores the selected ward (`wardUserId`, `wardName`)
- Provides a `setSelectedWard` function
- Persists last-selected ward in `localStorage`

**File**: `src/contexts/GuardianWardContext.tsx` (new)

### 2. Ward Picker Component
A compact dropdown at the top of the Guardian Dashboard showing ward names with a colored dot indicator. Appears only when guardian has 2+ wards.

**File**: `src/components/WardPicker.tsx` (new)

### 3. Update Guardian Dashboard
- Remove the inline ward-fetching logic (lines 138-156)
- Consume `GuardianWardContext` for `wardUserId` and `wardName`
- All data fetching keyed off the context's `wardUserId`

**File**: `src/pages/GuardianDashboard.tsx`

### 4. Update Guardian Sub-Pages
Pass `wardUserId` from context instead of re-querying:
- `src/pages/GuardianMessages.tsx`
- `src/pages/GuardianReports.tsx`
- `src/pages/GuardianServices.tsx`
- `src/pages/GuardianAlerts.tsx`

### 5. Enforce 3-Ward Limit
- In `Register.tsx` (guardian nomination step) and `Settings.tsx` (add guardian): before inserting into `guardians`, check if the nominated guardian already has 3 accepted entries. Show a toast if limit reached.
- Add a DB function `guardian_ward_count(guardian_email text)` that returns the count of accepted guardian entries for that email, usable in validation.

### 6. Wrap Guardian Routes
In `App.tsx`, wrap all `/guardian/*` routes with `GuardianWardProvider`.

## Files Changed

| File | Change |
|------|--------|
| `src/contexts/GuardianWardContext.tsx` | **New** — multi-ward state management |
| `src/components/WardPicker.tsx` | **New** — ward selector dropdown |
| `src/pages/GuardianDashboard.tsx` | Use ward context instead of inline fetch |
| `src/pages/GuardianMessages.tsx` | Use ward context |
| `src/pages/GuardianReports.tsx` | Use ward context |
| `src/pages/GuardianServices.tsx` | Use ward context |
| `src/pages/GuardianAlerts.tsx` | Use ward context |
| `src/App.tsx` | Wrap guardian routes with `GuardianWardProvider` |
| `src/pages/Register.tsx` | Add 3-ward limit check on guardian nomination |
| `src/pages/Settings.tsx` | Add 3-ward limit check on guardian add |
| New migration | `guardian_ward_count()` DB function for validation |

## No Breaking Changes
- Single-ward guardians see no UI difference (picker hidden)
- Existing data works as-is

