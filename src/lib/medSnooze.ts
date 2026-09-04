/**
 * Shared, persisted medication snooze state.
 *
 * Snooze entries are keyed by medication id + scheduled hour:minute, stored in
 * localStorage namespaced per signed-in user, and scoped to a single day.
 * Both TodaySchedule.tsx (UI) and useMedicationAlarms.ts (background reminders)
 * read/write through these helpers so they always agree on "snoozed until".
 */

export interface SnoozeEntry {
  count: number;
  until: number; // epoch ms
}

type SnoozeStore = {
  date: string;
  entries: Record<string, SnoozeEntry>;
};

/** Local (device-time) date key, matching how doses are scheduled locally. */
export const snoozeDateKey = (d: Date = new Date()) =>
  `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/** Key for a dose: medication id + scheduled hour:minute (no zero padding). */
export const snoozeKey = (medicationId: string, hour: number, minute: number) =>
  `${medicationId}_${hour}:${minute}`;

const storageKey = (userId: string) => `med_snooze_v1_${userId}`;

export const loadSnoozes = (userId: string | undefined): Map<string, SnoozeEntry> => {
  const map = new Map<string, SnoozeEntry>();
  if (!userId || typeof localStorage === "undefined") return map;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return map;
    const parsed = JSON.parse(raw) as SnoozeStore;
    if (!parsed || parsed.date !== snoozeDateKey()) {
      localStorage.removeItem(storageKey(userId));
      return map;
    }
    Object.entries(parsed.entries || {}).forEach(([k, v]) => {
      if (v && typeof v.until === "number") map.set(k, { count: v.count || 0, until: v.until });
    });
  } catch {
    /* ignore corrupt store */
  }
  return map;
};

export const saveSnoozes = (userId: string | undefined, entries: Map<string, SnoozeEntry>) => {
  if (!userId || typeof localStorage === "undefined") return;
  try {
    const store: SnoozeStore = { date: snoozeDateKey(), entries: Object.fromEntries(entries) };
    localStorage.setItem(storageKey(userId), JSON.stringify(store));
  } catch {
    /* ignore quota errors */
  }
};

/** True when this dose is currently snoozed (today's entry with a future `until`). */
export const isSnoozed = (
  userId: string | undefined,
  medicationId: string,
  hour: number,
  minute: number,
  now: number = Date.now()
): boolean => {
  const entry = loadSnoozes(userId).get(snoozeKey(medicationId, hour, minute));
  return !!entry && entry.until > now;
};
