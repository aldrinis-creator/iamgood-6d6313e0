

## End-to-End Testing and Bug Fixing

### What We Will Test

Since all 5 hardening features were just built, we need to verify they work in practice. The user is currently on `/login`, which is the natural starting point.

### Test Plan (in order)

**1. Login and Onboarding Wizard**
- Sign in (email or Google)
- Verify the OnboardingWizard appears for first-time users (checks `localStorage` for `onboarding_complete`)
- Walk through all 4 steps: Welcome, Guardian, Check-in Times, Emergency Profile
- Verify data persists to database after completion
- Verify wizard does not re-appear on subsequent visits

**2. Freemium Gating**
- Navigate to My Health and verify lock icons appear on Pro features (Symptom Checker, Document Analyzer, etc.)
- Tap a locked feature and verify the UpgradeDialog shows with correct tier badge and description
- Verify "View Plans" navigates to `/subscription`
- Check that Free tier column shows on Subscription page
- Navigate to Settings → Guardians and verify the guardian limit enforces (1 for free users)

**3. Offline Indicator**
- Verify the offline banner appears in AppLayout when connectivity drops
- Verify the SOS button is still accessible while offline

**4. Guardian Invitation Flow**
- Add a guardian in Settings
- Verify "Re-send Invite" button appears for pending guardians
- Check that re-send rate limiting works (< 1 hour blocks)

**5. Push Notification Edge Functions**
- Test `send-medication-push` edge function with curl to verify it handles non-hour schedules (e.g., 08:30)
- Test `send-checkin-push` edge function to verify it finds pending check-ins
- Verify service worker registration and push subscription flow

### Approach

- Use browser tools to test UI flows (login, onboarding, gating, guardian)
- Use `supabase--curl_edge_functions` to test edge functions directly
- Use `supabase--read_query` to verify database state after actions
- Fix any bugs found during testing before moving on

### Expected Fixes

Based on common patterns in recently-built features, likely fixes include:
- Missing error handling in edge cases (empty states, network timeouts)
- UI polish (spacing, loading states, toast messages)
- Edge function deployment verification

