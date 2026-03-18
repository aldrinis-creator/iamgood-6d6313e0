## Connect to Lovable Cloud + Set Up Auth with Profiles

### Step 1: Enable Lovable Cloud

Call the cloud-enable tool to provision a Supabase backend for the project.

### Step 2: Database Schema (migrations)

**Create `profiles` table:**

- `id` (uuid, FK to `auth.users(id)` ON DELETE CASCADE, PK)
- `full_name` (text)
- `phone` (text)
- `date_of_birth` (date, nullable)
- `role` (app_role enum: 'user' | 'guardian')
- `created_at`, `updated_at` timestamps
- RLS enabled: users can read/update their own profile

**Create `user_roles` table** (per security requirements):

- `id` (uuid PK), `user_id` (FK auth.users), `role` (app_role enum)
- `has_role()` security definer function for RLS checks

**Create `guardians` table:**

- `id` (uuid PK)
- `user_id` (FK profiles.id) -- the protected user
- `guardian_name`, `guardian_phone`, `relation` (text)
- `is_primary` (boolean)
- RLS: owner can CRUD their own guardians

**Auto-create profile trigger:** On `auth.users` insert, create a profile row with default role 'user'.

### Step 3: Supabase Client Setup

- Create `src/integrations/supabase/client.ts` with Supabase client initialization
- Create `src/integrations/supabase/types.ts` with generated types

### Step 4: Auth Context

- Create `src/contexts/AuthContext.tsx` with `onAuthStateChange` listener set up before `getSession()`
- Expose `session`, `user`, `profile`, `signIn`, `signUp`, `signOut`
- Fetch profile from `profiles` table on session change
- Wrap app in `AuthProvider` in `App.tsx`

### Step 5: Update Login Page

- Wire email+password sign-in to `supabase.auth.signInWithPassword()`
- Keep role selection UI; after login, read role from profile
- Add loading/error states with toast notifications

### Step 6: Update Register Page

- Wire to `supabase.auth.signUp()` with email+password
- After signup, update profile with `full_name`, `phone`, `date_of_birth`
- Insert guardian rows into `guardians` table
- Set `emailRedirectTo: window.location.origin`

### Step 7: Update AppContext

- Remove mock `isLoggedIn`/`userName` state
- Derive `isLoggedIn` from auth session, `userName` from profile, `role` from profile
- Keep `emergencyMode`, `triggerSOS`, `cancelSOS` as local state

### Step 8: Protected Routes

- Create a `ProtectedRoute` wrapper that redirects to `/login` if no session
- Wrap dashboard, health, vault, settings routes

### Step 9: Add Forgot Password + Reset Password

- Add "Forgot Password" flow calling `resetPasswordForEmail` with redirect to `/reset-password`
- `Add "Save Phone Number / Email-ID"`
- Create `/reset-password` page that calls `updateUser({ password })`

No visual design changes -- same UI, now backed by real auth and database.  
