## Plan — Admin bypasses all feature gating

Give admin accounts unrestricted access to every plan-gated feature (Premium, Premium Plus, guardian limits, AI tools, PDF export, etc.) without changing their actual subscription record.

### Approach

Treat `role === 'admin'` as an implicit "premium-plus" tier inside the gating layer. No UI changes, no upgrade dialogs for admins, no per-feature edits.

### Changes

**1. `src/hooks/useSubscription.ts**`

After loading the subscription, check the user's role via `user_roles` table (or reuse the existing `useAuth` profile if role is already exposed). If the user is an admin, override the returned `plan` to `"premium-plus"` and `status` to `"active"`. Keep the underlying DB row untouched — this is a runtime override only.

**2. `src/lib/featureGating.ts**`

Add an early-return in `canAccessFeature`: if the caller passes a sentinel plan or we expose a small helper `isAdminPlan`, skip tier comparison. Simpler: since step 1 already forces admins to `"premium-plus"`, `canAccessFeature` works unchanged. Same for `getGuardianLimit` — admins get the premium-plus limit (10) automatically.

**3. Verification points (no code changes needed, but confirm flow)**

- `useFeatureGate` → reads `plan` from `useSubscription` → admin sees `premium-plus` → `canAccess` returns true for everything → `UpgradeDialog` never opens.
- `GuardianTab` guardian-limit check → uses `getGuardianLimit(plan)` → admin gets 10.
- `Subscription.tsx` page → will show admin as "Premium Plus active" (cosmetic, acceptable; admins rarely visit this page).

### Detection of admin role

Two options for reading the role inside `useSubscription`:

- **Option A (preferred)**: Add a quick `supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle()` query alongside the subscription fetch. Cache it in the hook's state.
- **Option B**: If `AuthContext.profile.role` already reflects admin status, read it from `useAuth()` directly — zero extra query.

Will use Option B if `profiles.role` carries `'admin'` for admin accounts; otherwise fall back to Option A. Quick check during implementation. 

ok with Option B with fall back to option A. 

### Out of scope

- Changing the actual `subscriptions` table for admin users.
- Hiding the Subscription page from admins.
- Backend RLS changes (gating is purely client-side feature surfacing; backend already trusts admin role where it matters).

### Files

**Edit**

- `src/hooks/useSubscription.ts` — admin role check + plan override.