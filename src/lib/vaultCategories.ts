/**
 * Shared types and helpers for the categorised Medical Vault.
 * All payloads are JSON-stringified, then encrypted with the user's vault PIN
 * (AES-256-GCM via src/lib/encryption.ts) before being stored in the
 * `encrypted_documents` table. The `category` column groups entries; `label`
 * is a short, non-sensitive nickname shown in the unlocked list.
 */

export type VaultCategory = "identity" | "email" | "bank" | "investment" | "social" | "insurance" | "will";

export const VAULT_CATEGORIES: { key: VaultCategory; label: string; emptyHint: string }[] = [
  { key: "identity", label: "Identity Docs", emptyHint: "Aadhaar, PAN, Passport, Driving License" },
  { key: "email", label: "Email Accounts", emptyHint: "Email logins, recovery details" },
  { key: "bank", label: "Bank Accounts", emptyHint: "Account numbers, IFSC, nominee" },
  { key: "investment", label: "Investments", emptyHint: "Demat, broker logins, PAN linkage" },
  { key: "social", label: "Social Media", emptyHint: "WhatsApp, Email, Messaging Services" },
  { key: "insurance", label: "Insurance", emptyHint: "Life, Health, General — with reminders" },
  { key: "will", label: "Legal Will", emptyHint: "Will status, partner ref, quarterly review" },
];


// ---------- Per-category payload shapes ----------

/**
 * Optional encrypted photo / scan attached to any vault entry.
 * The file is AES-256-GCM encrypted client-side with the vault PIN and
 * uploaded to the private `vault-attachments` storage bucket. Because this
 * metadata lives inside the encrypted entry JSON, even storage admins
 * cannot decrypt the file without the PIN.
 */
export interface VaultAttachment {
  path: string;       // storage path within `vault-attachments`
  file_name: string;  // original filename
  mime_type: string;
  iv: string;         // base64
  salt: string;       // base64
  size: number;       // plaintext bytes
}

export interface EmailEntry {
  label: string;          // e.g. "Personal Gmail"
  email: string;
  password: string;
  recovery_email?: string;
  notes?: string;
  attachment?: VaultAttachment;
}

export interface BankEntry {
  label: string;          // e.g. "HDFC Salary"
  bank_name: string;
  account_number: string;
  ifsc: string;
  account_type: string;   // savings / current / fd / nps
  nominee_name: string;
  nominee_relation: string;
  nominee_phone: string;
  branch?: string;
  notes?: string;
  attachment?: VaultAttachment;
  // ---- Optional debit / credit card details (encrypted with the entry) ----
  card_number?: string;        // 16-digit, stored encrypted
  card_expiry?: string;        // MM/YY
  card_name?: string;          // name on card
  card_cvv?: string;           // 3-4 digit CVV
  card_type?: "visa" | "mastercard" | "rupay" | "amex" | "other";
  card_network_label?: string; // e.g. "VISA Debit", "RuPay Credit"
  card_attachment?: VaultAttachment; // encrypted photo of the card
}


export type InsuranceCategory = "life" | "health" | "general";

export interface InsuranceEntry {
  label: string;          // e.g. "HDFC Ergo Health"
  category: InsuranceCategory;
  company: string;
  policy_number: string;
  sum_assured?: string;
  nominee_name: string;
  nominee_relation: string;
  nominee_phone: string;
  premium_amount?: string;
  premium_frequency?: "monthly" | "quarterly" | "half-yearly" | "yearly";
  start_date?: string;    // YYYY-MM-DD
  renewal_date?: string;  // YYYY-MM-DD
  expiry_date?: string;   // YYYY-MM-DD
  notes?: string;
  attachment?: VaultAttachment;
}

export interface WillEntry {
  label: string;
  status: "none" | "draft" | "completed";
  partner: "willjini" | "ezeewill" | "self" | "lawyer" | "other";
  partner_will_id?: string;
  created_on?: string;    // YYYY-MM-DD
  last_reviewed?: string; // YYYY-MM-DD
  document_ref?: string;
  nominee_name?: string;
  nominee_phone?: string;
  notes?: string;
  attachment?: VaultAttachment;
}

// Identity is kept as a free-form string (unchanged from original DOC_TYPES flow),
// but new identity entries also use the {label, value, notes?} JSON shape so all
// categories share a single CRUD path going forward. Old plain-string identity
// rows continue to decrypt and display fine.
export interface IdentityEntry {
  label: string;
  value: string;
  notes?: string;
  attachment?: VaultAttachment;      // legacy single attachment
  attachments?: VaultAttachment[];   // up to 5 photos
}


// ---------- Reminder helpers ----------

export interface InsuranceReminderRow {
  doc_id: string;
  user_id: string;
  display_label: string;
  kind: "insurance_renewal" | "insurance_expiry";
  target_date: string;     // YYYY-MM-DD
}

export interface WillReminderRow {
  doc_id: string;
  user_id: string;
  display_label: string;
  kind: "will_review";
  last_reviewed: string;   // YYYY-MM-DD
}

/**
 * Compute the next reminder firing time for an insurance renewal/expiry,
 * using the 7d → 3d → 24h → due → done ladder.
 */
export function computeInsuranceReminderTier(targetDate: Date, now: Date = new Date()):
  | { tier: "7d" | "3d" | "24h" | "due"; fireAt: Date }
  | { tier: "done"; fireAt: Date } {
  const ms = targetDate.getTime() - now.getTime();
  const days = ms / (1000 * 60 * 60 * 24);
  if (days > 7) return { tier: "7d", fireAt: new Date(targetDate.getTime() - 7 * 86400_000) };
  if (days > 3) return { tier: "3d", fireAt: new Date(targetDate.getTime() - 3 * 86400_000) };
  if (days > 1) return { tier: "24h", fireAt: new Date(targetDate.getTime() - 86400_000) };
  if (days > -1) return { tier: "due", fireAt: targetDate };
  return { tier: "done", fireAt: new Date(targetDate.getTime() + 365 * 86400_000) };
}

/** Will reminder: 90 days after `last_reviewed`. */
export function computeWillReviewFireAt(lastReviewed: Date): Date {
  return new Date(lastReviewed.getTime() + 90 * 86400_000);
}

export function formatReminderLabel(category: InsuranceCategory, company: string): string {
  const cap = category.charAt(0).toUpperCase() + category.slice(1);
  return `${cap} Insurance · ${company}`;
}
