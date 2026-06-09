export type ExpenseCategory =
  | "medication"
  | "doctor_fees"
  | "insurance"
  | "diagnostics"
  | "equipment_caregiving"
  | "other";

export const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  medication: "Medications",
  doctor_fees: "Doctor Fees",
  insurance: "Insurance",
  diagnostics: "Diagnostics",
  equipment_caregiving: "Equipment / Caregiving",
  other: "Other",
};

// Tailwind classes — use HSL tokens from design system
export const CATEGORY_COLOR: Record<ExpenseCategory, string> = {
  medication: "bg-primary/15 text-primary",
  doctor_fees: "bg-success/15 text-success",
  insurance: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  diagnostics: "bg-sos/15 text-sos",
  equipment_caregiving: "bg-muted text-foreground",
  other: "bg-muted text-muted-foreground",
};

export const CATEGORY_BAR_HSL: Record<ExpenseCategory, string> = {
  medication: "hsl(var(--primary))",
  doctor_fees: "hsl(var(--success))",
  insurance: "hsl(38 92% 50%)",
  diagnostics: "hsl(var(--sos))",
  equipment_caregiving: "hsl(var(--muted-foreground))",
  other: "hsl(var(--muted-foreground) / 0.6)",
};

export const ALL_CATEGORIES: ExpenseCategory[] = [
  "medication",
  "doctor_fees",
  "insurance",
  "diagnostics",
  "equipment_caregiving",
  "other",
];

export function formatMoney(amount: number, currency = "INR") {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount)}`;
  }
}

export const COMMON_CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD"];
