// Pure rules for the 12 PM refill pop-up (shared by the edge function and tests).
export const REFILL_ALERT_DAYS = 3;

export interface RefillMed {
  id: string;
  user_id: string;
  name: string;
  remaining_quantity: number | null;
  low_stock_threshold: number | null;
  refill_reminder: boolean | null;
  refill_due_since: string | null; // YYYY-MM-DD (IST)
}

const dayDiff = (a: string, b: string) =>
  Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);

/** Medicines that should appear in today's pop-up, grouped by Ward. */
export function medsToAlert(
  meds: RefillMed[],
  today: string,
  alertedDates: Record<string, string[]>,
): Map<string, RefillMed[]> {
  const out = new Map<string, RefillMed[]>();
  for (const m of meds) {
    if (m.refill_reminder === false) continue;
    if (m.remaining_quantity == null || m.low_stock_threshold == null) continue;
    if (m.remaining_quantity > m.low_stock_threshold) continue; // refilled
    if (!m.refill_due_since) continue;
    const d = dayDiff(m.refill_due_since, today);
    if (d < 0 || d >= REFILL_ALERT_DAYS) continue;
    const sent = (alertedDates[m.id] || []).filter((x) => x >= m.refill_due_since!);
    if (sent.includes(today) || sent.length >= REFILL_ALERT_DAYS) continue;
    const list = out.get(m.user_id) || [];
    list.push(m);
    out.set(m.user_id, list);
  }
  return out;
}

export function istToday(d = new Date()): string {
  return new Date(d.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}
