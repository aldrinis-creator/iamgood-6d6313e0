/**
 * Hospital Admission Kit slot resolution.
 *
 * Each slot can now hold MULTIPLE image pages (page_index ordered).
 * Slot-tagged rows always win over `record_type` matches.
 */

export type SlotKey =
  | "aadhaar"
  | "pan"
  | "insurance_primary"
  | "insurance_secondary"
  | "id_photo";

export const SLOT_KEYS: SlotKey[] = [
  "aadhaar",
  "pan",
  "insurance_primary",
  "insurance_secondary",
  "id_photo",
];

export const SLOT_LABELS: Record<SlotKey, string> = {
  aadhaar: "Aadhaar Card",
  pan: "PAN Card",
  insurance_primary: "Health Insurance — Primary",
  insurance_secondary: "Health Insurance — Secondary",
  id_photo: "Passport Photo",
};

const TYPE_PATTERNS: Array<{ slot: SlotKey; re: RegExp }> = [
  { slot: "aadhaar", re: /^id\s*-\s*aadhaar/i },
  { slot: "pan", re: /^id\s*-\s*pan/i },
  { slot: "insurance_primary", re: /^insurance\s*-\s*primary/i },
  { slot: "insurance_secondary", re: /^insurance\s*-\s*secondary/i },
  { slot: "id_photo", re: /^id\s*-\s*photo/i },
];

export function slotFromRecordType(recordType: string | null | undefined): SlotKey | null {
  if (!recordType) return null;
  const hit = TYPE_PATTERNS.find((p) => p.re.test(recordType));
  return hit ? hit.slot : null;
}

export interface SlotRow {
  id: string;
  record_slot: string | null;
  record_type?: string | null;
  file_url: string | null;
  file_name: string | null;
  page_index?: number | null;
  updated_at?: string;
}

export interface ResolvedSlotPages<T extends SlotRow = SlotRow> {
  rows: T[];                 // ordered by page_index
  source: "slot" | "vault";
}

/** Multi-page resolver: groups all rows belonging to a slot, ordered. */
export function resolveSlotPages<T extends SlotRow>(
  rows: T[]
): Record<string, ResolvedSlotPages<T>> {
  const out: Record<string, ResolvedSlotPages<T>> = {};
  // Slot-tagged groups
  for (const k of SLOT_KEYS) {
    const group = rows
      .filter((r) => r.record_slot === k)
      .sort((a, b) => (a.page_index ?? 0) - (b.page_index ?? 0));
    if (group.length) out[k] = { rows: group, source: "slot" };
  }
  // Vault fallback (single row) for any empty slot
  for (const r of rows) {
    if (r.record_slot) continue;
    const slot = slotFromRecordType(r.record_type);
    if (slot && !out[slot]) out[slot] = { rows: [r], source: "vault" };
  }
  return out;
}

// Backward-compat: first row per slot
export interface ResolvedSlotRow<T extends SlotRow = SlotRow> {
  row: T;
  source: "slot" | "vault";
}
export function resolveSlotRows<T extends SlotRow>(rows: T[]): Record<string, ResolvedSlotRow<T>> {
  const pages = resolveSlotPages(rows);
  const map: Record<string, ResolvedSlotRow<T>> = {};
  Object.entries(pages).forEach(([k, v]) => { map[k] = { row: v.rows[0], source: v.source }; });
  return map;
}
