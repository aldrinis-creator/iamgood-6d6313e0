

## Add Missing Transactional Email Templates

### What We're Building

Three new branded app email templates that trigger automatically from existing app flows:

1. **Welcome Email** — sent after a user successfully signs in for the first time (post email verification)
2. **Appointment Confirmation** — sent when a user creates a new appointment
3. **Guardian Invitation** — migrate the existing `send-guardian-invite` edge function to use the branded transactional email system instead of raw Resend API calls

### Technical Plan

#### 1. Create three new React Email templates

All in `supabase/functions/_shared/transactional-email-templates/`:

- **`welcome.tsx`** — "Welcome to Check-iN" with navy `#1a365d` branding, C-iN badge, brief intro to the app
  - Props: `{ name?: string }`
  - Subject: "Welcome to Check-iN!"

- **`appointment-confirmation.tsx`** — Confirms appointment details
  - Props: `{ name?: string, title?: string, date?: string, time?: string, doctorName?: string }`
  - Subject: dynamic — `"Appointment confirmed: {title}"`

- **`guardian-invitation.tsx`** — Branded guardian nomination invite with accept/reject links
  - Props: `{ guardianName?: string, userName?: string, relation?: string, acceptLink?: string, rejectLink?: string }`
  - Subject: dynamic — `"You've been nominated as a guardian for {userName}"`

#### 2. Update registry.ts

Add all three templates to the `TEMPLATES` map.

#### 3. Wire up triggers in existing code

- **Welcome email**: In `AuthContext.tsx`, after the first successful sign-in (when `SIGNED_IN` event fires and profile exists), send once using idempotency key `welcome-{userId}`.

- **Appointment confirmation**: In `AddAppointmentDialog.tsx`, after successful insert, invoke `send-transactional-email` with appointment details. Need user's email from auth session.

- **Guardian invitation**: Update `send-guardian-invite/index.ts` to use the transactional email system internally (call `enqueue_email` with the branded template), OR update the client-side calls in `Register.tsx` and `Settings.tsx` to call `send-transactional-email` instead. The simpler approach: update the client calls to use `send-transactional-email` directly.

#### 4. Deploy edge functions

Redeploy `send-transactional-email` (picks up new templates from registry).

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/_shared/transactional-email-templates/welcome.tsx` | New template |
| `supabase/functions/_shared/transactional-email-templates/appointment-confirmation.tsx` | New template |
| `supabase/functions/_shared/transactional-email-templates/guardian-invitation.tsx` | New template |
| `supabase/functions/_shared/transactional-email-templates/registry.ts` | Register 3 new templates |
| `src/contexts/AuthContext.tsx` | Send welcome email on first sign-in |
| `src/components/appointments/AddAppointmentDialog.tsx` | Send appointment confirmation email |
| `src/pages/Register.tsx` | Switch guardian invite to transactional email |
| `src/pages/Settings.tsx` | Switch guardian invite to transactional email |

