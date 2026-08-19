/**
 * Weekly medication scheduling helpers.
 *
 * `schedule_days` on a medication holds the weekdays it is taken
 * (0 = Sunday … 6 = Saturday). NULL / empty means "every day",
 * which keeps every pre-existing medication behaving as before.
 */

export const WEEKDAYS = [
  { value: 1, label: "Mon", full: "Monday" },
  { value: 2, label: "Tue", full: "Tuesday" },
  { value: 3, label: "Wed", full: "Wednesday" },
  { value: 4, label: "Thu", full: "Thursday" },
  { value: 5, label: "Fri", full: "Friday" },
  { value: 6, label: "Sat", full: "Saturday" },
  { value: 0, label: "Sun", full: "Sunday" },
] as const;

/** Current weekday (0=Sun..6=Sat) in IST. */
export const getISTWeekday = (date: Date = new Date()): number => {
  const name = date.toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "Asia/Kolkata",
  });
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[name] ?? date.getDay();
};

/** True when a medication is scheduled for the given IST weekday. */
export const isMedScheduledOnDay = (
  med: { schedule_days?: number[] | null } | null | undefined,
  weekday: number,
): boolean => {
  const days = med?.schedule_days;
  if (!Array.isArray(days) || days.length === 0) return true;
  return days.map(Number).includes(weekday);
};

/** True when a medication is scheduled today (IST). */
export const isMedScheduledToday = (
  med: { schedule_days?: number[] | null } | null | undefined,
  date: Date = new Date(),
): boolean => isMedScheduledOnDay(med, getISTWeekday(date));

/** Short label for a medication's weekly day, e.g. "Mondays". */
export const scheduleDaysLabel = (days?: number[] | null): string | null => {
  if (!Array.isArray(days) || days.length === 0) return null;
  return days
    .map((d) => WEEKDAYS.find((w) => w.value === Number(d))?.full)
    .filter(Boolean)
    .join(", ");
};
