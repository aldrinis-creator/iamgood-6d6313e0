export type PlanTier = "free" | "basic" | "pro";

export const FEATURE_TIERS: Record<string, PlanTier> = {
  // Always free
  "SOS": "free",
  "Emergency First Aid": "free",
  "Emergency Profile": "free",
  "Basic Vitals": "free",

  // Basic tier
  "Tablets": "basic",
  "Activity": "basic",
  "Vault": "basic",
  "Services": "basic",

  // Pro tier
  "Health Tools": "pro",
  "Symptom Checker": "pro",
  "Document Analyzer": "pro",
  "Doctor Visit Report": "pro",
  "Medication Info": "pro",
  "Tele-Consult": "pro",
  "Nutrition": "pro",
  "Face Scan": "pro",
  "Wellness": "pro",
  "Ambulance": "free",
  "Vitals": "pro",
  "Geofencing": "pro",
  "PDF Export": "pro",
  "Guardian Limit": "basic",
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
  "Guardian Limit": "Add more guardians to your safety network.",
};

const TIER_RANK: Record<PlanTier, number> = { free: 0, basic: 1, pro: 2 };

export function canAccessFeature(
  userPlan: string | null,
  feature: string
): boolean {
  const requiredTier = FEATURE_TIERS[feature] ?? "free";
  const userTier = (userPlan as PlanTier) ?? "free";
  return TIER_RANK[userTier] >= TIER_RANK[requiredTier];
}

/** Returns the maximum number of guardians allowed for a given plan */
export function getGuardianLimit(plan: string | null): number {
  const tier = (plan as PlanTier) ?? "free";
  switch (tier) {
    case "free": return 1;
    case "basic": return 3;
    case "pro": return 5;
    default: return 1;
  }
}
