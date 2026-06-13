export type PlanTier = "free" | "basic" | "premium" | "premium-plus";

export const FEATURE_TIERS: Record<string, PlanTier> = {
  // Always free
  "SOS": "free",
  "Emergency First Aid": "free",
  "Emergency Profile": "free",
  "Basic Vitals": "free",
  "Ambulance": "free",

  // Basic tier
  "Tablets": "basic",
  "Activity": "basic",
  "Vault": "basic",
  "Services": "basic",
  "Guardian Limit": "basic",

  // Premium tier
  "Health Tools": "premium",
  "Symptom Checker": "premium",
  "Document Analyzer": "premium",
  "Doctor Visit Report": "premium",
  "Medication Info": "premium",
  "Tele-Consult": "premium",
  "Nutrition": "premium",
  "Face Scan": "premium",
  "Wellness": "premium",
  "Vitals": "premium",
  "Geofencing": "premium",
  "PDF Export": "premium",

  // Premium Plus tier
  "Financial Healthcare": "premium-plus",
};

export const FEATURE_DESCRIPTIONS: Record<string, string> = {
  "Health Tools": "Access AI-powered health tools including symptom checker, document analyzer, and more.",
  "Symptom Checker": "Get AI-powered symptom assessment and guidance.",
  "Document Analyzer": "Analyze medical documents with AI for quick insights.",
  "Doctor Visit Report": "Generate comprehensive health summaries for doctor visits.",
  "Medication Info": "Look up drug information and check banned medications.",
  "Tele-Consult": "Record consultations and access video consult features.",
  "Nutrition": "Get personalized AI nutrition advice and meal tracking.",
  "Face Scan": "Measure heart rate and stress levels using your camera.",
  "Wellness": "Track mood, sleep, and get AI wellness insights.",
  "Ambulance": "Ambulance booking available to all plans (pay-per-use tariff applies).",
  "Vitals": "Advanced vitals monitoring with trend analysis.",
  "Tablets": "Manage medications, schedules, and refill reminders.",
  "Activity": "Track daily activity, steps, and exercise.",
  "Vault": "Store and organize your medical records securely.",
  "Services": "Access nearby health services and facilities.",
  "Geofencing": "Set geofence alerts for route deviation monitoring during journeys.",
  "PDF Export": "Export and share health reports as PDF documents.",
  "Financial Healthcare": "Track healthcare expenses with voice notes, AI bill scanning, and shareable PDF reports.",
  "Guardian Limit": "Add more guardians to your safety network.",
};

const TIER_RANK: Record<PlanTier, number> = {
  free: 0,
  basic: 1,
  premium: 2,
  "premium-plus": 3,
};

/** Normalize legacy plan keys (e.g. 'pro' → 'premium') so old data keeps working. */
function normalizePlan(plan: string | null | undefined): PlanTier {
  if (!plan) return "free";
  if (plan === "pro") return "premium";
  if (plan in TIER_RANK) return plan as PlanTier;
  return "free";
}

export function canAccessFeature(
  userPlan: string | null,
  feature: string
): boolean {
  const requiredTier = FEATURE_TIERS[feature] ?? "free";
  const userTier = normalizePlan(userPlan);
  return TIER_RANK[userTier] >= TIER_RANK[requiredTier];
}

/** Returns the maximum number of guardians allowed for a given plan */
export function getGuardianLimit(plan: string | null): number {
  const tier = normalizePlan(plan);
  switch (tier) {
    case "free": return 1;
    case "basic": return 3;
    case "premium": return 5;
    case "premium-plus": return 10;
    default: return 1;
  }
}
