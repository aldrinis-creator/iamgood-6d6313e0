import { useState, useCallback } from "react";
import { useSubscription } from "./useSubscription";
import { canAccessFeature, FEATURE_TIERS, FEATURE_DESCRIPTIONS, PlanTier } from "@/lib/featureGating";

export function useFeatureGate() {
  const { plan } = useSubscription();
  const [upgradeFeature, setUpgradeFeature] = useState<string | null>(null);

  const canAccess = useCallback(
    (feature: string) => canAccessFeature(plan, feature),
    [plan]
  );

  const gate = useCallback(
    (feature: string, callback: () => void) => {
      if (canAccessFeature(plan, feature)) {
        callback();
      } else {
        setUpgradeFeature(feature);
      }
    },
    [plan]
  );

  const upgradeDialogOpen = !!upgradeFeature;
  const requiredPlan = upgradeFeature
    ? (FEATURE_TIERS[upgradeFeature] ?? "pro") as PlanTier
    : "pro" as PlanTier;
  const upgradeDescription = upgradeFeature
    ? FEATURE_DESCRIPTIONS[upgradeFeature] ?? ""
    : "";

  const closeUpgradeDialog = useCallback(() => setUpgradeFeature(null), []);

  return {
    canAccess,
    gate,
    upgradeDialogOpen,
    upgradeFeature,
    requiredPlan,
    upgradeDescription,
    closeUpgradeDialog,
  };
}
