

## Issues Identified

1. **No mobile-optimized sign-up**: The current register page uses `max-w-md` and standard web layout but lacks mobile-first design patterns (bottom-sheet style, sticky CTAs, compact spacing for small screens).

2. **No separate User vs Guardian sign-up**: There's a single registration flow that always creates a "user" role and asks for guardian nominations. Guardians currently have no dedicated sign-up — they're expected to already have accounts matched by phone number.

## Proposed Changes

### 1. Add Role Selection Step to Registration
- Add a role selector at the top of the register page: **"I need protection"** (User) vs **"I'm a Guardian"** (Guardian)
- **User sign-up**: Current flow — personal details + nominate guardians
- **Guardian sign-up**: Simplified form — name, email, phone, password. No guardian nomination section. Sets `role = 'guardian'` in the profile on creation.
- Store role in the `profiles.role` column (already supports `'user'` | `'guardian'`)

### 2. Mobile-Optimized Registration UI
- Full-screen layout with sticky bottom CTA button
- Larger touch targets (min 48px height inputs)
- Collapsible card sections to reduce scroll
- Progress indicator for multi-step feel (Step 1: Role → Step 2: Details → Step 3: Guardians for users)
- Safe-area padding for mobile browsers

### Files to Modify
- **`src/pages/Login.tsx`** — Refactor `Register` component with role selection step, conditional guardian section, mobile-friendly layout, and guardian-specific sign-up flow
- **Database**: No migration needed — `profiles.role` already supports `'guardian'` enum value

### Technical Details
- Role selection stored in local state, passed to `signUp` metadata
- After sign-up, update `profiles.role` to `'guardian'` if guardian path chosen
- Guardian sign-up skips the "Nominate Guardians" card entirely
- Mobile layout: `min-h-[100dvh]` for dynamic viewport, `pb-safe` for bottom safe area, sticky submit button

