/**
 * Hospital Admission Kit slot resolution.
 *
 * The 5 slots are populated either by:
 *  1) New flow: `medical_records.record_slot` set explicitly via the
 *     "ID & Insurance — Hospital Kit" card in My Profile.
 *  2) Legacy / Medical Vault flow: rows with `record_type` matching a
 *     known pattern (e.g. "ID - Aadhaar", "Insurance - Primary") but
 *     `record_slot` is NULL. These are treated as linked from the Vault.
 *
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

/** record_type prefix → slot key fallback mapping (case-insensitive). */
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
  updated_at?: string;
}

export interface ResolvedSlotRow<T extends SlotRow = SlotRow> {
  row: T;
  source: "slot" | "vault";
}

/**
 * Resolve a list of medical_records rows into a slot→row map.
 * Rows with `record_slot` win; otherwise the first matching `record_type` row wins.
 */
export function resolveSlotRows<T extends SlotRow>(rows: T[]): Record<string, ResolvedSlotRow<T>> {
  const map: Record<string, ResolvedSlotRow<T>> = {};
  // Pass 1: slot-tagged rows take precedence
  for (const r of rows) {
    if (r.record_slot && SLOT_KEYS.includes(r.record_slot as SlotKey)) {
      if (!map[r.record_slot]) map[r.record_slot] = { row: r, source: "slot" };
    }
  }
  // Pass 2: vault fallback by record_type, only if slot empty
  for (const r of rows) {
    if (r.record_slot) continue;
    const slot = slotFromRecordType(r.record_type);
    if (slot && !map[slot]) {
      map[slot] = { row: r, source: "vault" };
    }
  }
  return map;
}
