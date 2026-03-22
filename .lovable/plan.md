

# Public Emergency Profile + Guardian Health Card + Settings Consent

## Overview
Three interconnected features: (1) a public emergency profile page accessible via QR code without login, (2) the Emergency Health Card visible on the Guardian Dashboard, and (3) opt-in consent toggles in Settings.

## Database Changes

### New table: `emergency_share_tokens`
```sql
CREATE TABLE public.emergency_share_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.emergency_share_tokens ENABLE ROW LEVEL SECURITY;

-- Owner CRUD
CREATE POLICY "Users can manage own token" ON public.emergency_share_tokens
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Public read for active tokens (used by the public page)
CREATE POLICY "Anyone can read active tokens" ON public.emergency_share_tokens
  FOR SELECT TO anon USING (is_active = true);
```

### Add settings fields to `UserSettings` interface
- `shareEmergencyWithGuardians: boolean` (default `true`) — consent for guardians to see the Emergency Health Card
- `publicEmergencyProfile: boolean` (default `false`) — opt-in for public QR page

### RLS for public profile data access
Create a `SELECT` policy on `health_profile`, `profiles`, `guardians`, and `medications` for `anon` role, scoped via a join to `emergency_share_tokens` where `is_active = true`. This ensures only opted-in users' critical data is publicly readable.

## New Files

### 1. `src/pages/EmergencyProfile.tsx` — Public page at `/e/:token`
- No login required. Fetches token from `emergency_share_tokens`, then loads limited data:
  - Name, blood group, DOB, gender, phone
  - Allergies, medical conditions
  - Current medications (name + dosage only)
  - Emergency contacts (name, phone, relation)
  - Family doctor
- Renders a clean, mobile-friendly card with `<meta name="robots" content="noindex">` to prevent indexing
- Shows "Profile not found or sharing disabled" for invalid/inactive tokens
- Styled to match the existing Emergency Health Card HTML

### 2. Edge function: `get-emergency-profile` (alternative approach — not needed)
Actually, since we can use anon RLS policies, the public page can query directly via the Supabase client with the anon key. No edge function needed.

## Modified Files

### `src/hooks/useUserSettings.ts`
- Add `shareEmergencyWithGuardians: boolean` and `publicEmergencyProfile: boolean` to `UserSettings` interface
- Add defaults: `shareEmergencyWithGuardians: true`, `publicEmergencyProfile: false`

### `src/pages/Settings.tsx` — Privacy/Access tab additions
Add two new toggles in the **Privacy tab** (or Access tab):

1. **"Share Emergency Health Card with Guardians"** — Switch bound to `settings.shareEmergencyWithGuardians`, default ON
   - Description: "Allow your guardians to view your Emergency Health Card on their dashboard"

2. **"Public Emergency Profile (QR Code)"** — Switch bound to `settings.publicEmergencyProfile`, default OFF
   - When toggled ON: create/activate token in `emergency_share_tokens`
   - When toggled OFF: deactivate token (set `is_active = false`)
   - Show a "Regenerate Link" button that creates a new token (invalidates old one)
   - Show the current public URL when active

### `src/pages/MedicalVault.tsx` — Fix QR code URL
- Change QR code URL from `${window.location.origin}/medical-vault` to `${window.location.origin}/e/${token}`
- Fetch the user's active token from `emergency_share_tokens` when building the card
- If no active token, show QR pointing to a "sharing disabled" message or omit QR section

### `src/pages/GuardianDashboard.tsx` — Add Emergency Health Card
- After the existing `WardHealthPassport` component, add a new section that:
  - Checks if the ward's `shareEmergencyWithGuardians` setting is `true` (already readable via existing RLS)
  - If consented, fetches ward's `health_profile`, `medications`, `guardians`, `profiles` data
  - Renders the Emergency Health Card inline (reusable card component or inline render)
  - Includes Print/Share buttons (same pattern as MedicalVault)

### `src/App.tsx` — Add public route
```tsx
<Route path="/e/:token" element={<EmergencyProfile />} />
```
This route is outside `ProtectedRoute` — no auth required.

## Security Safeguards
- 48-character random hex tokens (not guessable)
- `noindex` meta tag on public page
- Only critical health data exposed (no encrypted vault docs, no activity logs)
- User can revoke/regenerate at any time
- Guardian access gated by explicit consent toggle
- Anon RLS policies scoped strictly to active tokens

## Implementation Order
1. Database migration (new table + anon RLS policies)
2. Update `useUserSettings` with new fields
3. Create `EmergencyProfile.tsx` public page
4. Add route in `App.tsx`
5. Update Settings with consent toggles + token management
6. Fix QR code URL in `MedicalVault.tsx`
7. Add Emergency Health Card to `GuardianDashboard.tsx`

