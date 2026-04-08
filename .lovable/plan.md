

## Build Freemium Gating System

### Overview

Create a reusable `UpgradeDialog` component and a feature-tier map. Free users see all features but premium ones show an upgrade prompt on tap. SOS and basic check-ins remain always free.

### Feature Tier Map

| Always Free | Basic | Pro Only |
|---|---|---|
| SOS button + alerts | 3 daily check-ins | Unlimited check-ins |
| 1 guardian link | Medical Vault (view) | Up to 5 guardians |
| Emergency profile | Basic activity tracking | AI Fall Detection |
| Emergency First Aid | Medication manager | AI Symptom Checker |
| Basic vitals (manual) | — | Document Analyzer |
| — | — | Doctor Visit Report |
| — | — | PDF export / sharing |
| — | — | Nutrition Advisor (AI) |
| — | — | Face Scan |
| — | — | Tele-Consult |
| — | — | Wellness AI insights |
| — | — | Priority Ambulance |
| — | — | Journey geofencing |

### Components

**1. `src/components/UpgradeDialog.tsx`** (new)
- Reusable dialog showing feature name, benefit description, and tier required (Basic/Pro)
- "View Plans" button navigates to `/subscription`
- Accepts props: `open`, `onOpenChange`, `featureName`, `requiredPlan` ("basic" | "pro"), `description`

**2. `src/lib/featureGating.ts`** (new)
- `FEATURE_TIERS` map: feature label → required plan ("free", "basic", "pro")
- `canAccessFeature(plan: string | null, feature: string): boolean` helper
- Centralizes all gating logic in one place

**3. `src/hooks/useFeatureGate.ts`** (new)
- Wraps `useSubscription` + `canAccessFeature`
- Returns `{ canAccess(feature): boolean, gate(feature, callback): void }` where `gate` either runs the callback or opens the upgrade dialog

### Integration Points

**`src/pages/MyHealth.tsx`** — Add lock icon overlay on gated tool cards. On click, show `UpgradeDialog` instead of opening the tool. Free tools open normally.

**`src/components/health-tools/SymptomChecker.tsx`**, **`DocumentAnalyzer.tsx`**, **`DoctorVisitReport.tsx`**, **`NutritionAdvisor.tsx`**, **`FaceScan.tsx`**, **`TeleConsult.tsx`** — No changes needed; gating happens at the MyHealth grid level before the component renders.

**`src/components/GuardianTab.tsx`** — Gate adding more than 1 guardian for free users.

**`src/pages/MapMyJourney.tsx`** — Gate geofencing features for non-Pro users.

**`src/components/AmbulanceBooking.tsx`** — Show "Priority" badge for Pro, standard booking for all.

### Files Changed/Created

| Action | File |
|---|---|
| Create | `src/components/UpgradeDialog.tsx` |
| Create | `src/lib/featureGating.ts` |
| Create | `src/hooks/useFeatureGate.ts` |
| Modify | `src/pages/MyHealth.tsx` (lock icons + gate) |
| Modify | `src/pages/Subscription.tsx` (add Free tier column) |

### UX Details

- Locked features show a small `Lock` icon on the card
- Tapping opens an upgrade dialog with: feature name, one-line benefit, required tier badge, and "View Plans" CTA
- Active subscribers see no locks
- Free tier column added to Subscription page so users understand what they get without paying

