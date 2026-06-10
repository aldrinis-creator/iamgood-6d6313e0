# Gate Financial Healthcare as Premium Plus

## Changes

1. **`src/lib/featureGating.ts`**
   - Add `"Financial Healthcare": "premium-plus"` to `FEATURE_TIERS`.
   - Add a matching entry in `FEATURE_DESCRIPTIONS`: "Track healthcare expenses with voice notes, AI bill scanning, and shareable PDF reports."

2. **`src/pages/MyHealth.tsx`**
   - Wrap the Financial Healthcare tile's tap handler with `useFeatureGate().gate("Financial Healthcare", () => navigate("/financial-health"))`.
   - Show a small "Premium Plus" lock badge on the tile (consistent with how other gated tiles are rendered there).
   - Render `<UpgradeDialog />` bound to the hook state if not already present.

3. **`src/pages/FinancialHealth.tsx`** (defense in depth)
   - On mount, if `!canAccessFeature(plan, "Financial Healthcare")`, redirect to `/subscription` and show an upgrade toast. Prevents direct URL access by non-Premium-Plus users.

## Out of scope
- No DB/RLS changes — guardian view and storage stay as-is.
- No pricing-page copy changes (Subscription page already lists tier features dynamically from descriptions).
