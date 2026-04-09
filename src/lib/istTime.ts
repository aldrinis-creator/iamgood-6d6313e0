/**
 * IST (India Standard Time) formatting utilities.
 * All display times in the app should use these helpers
 * to ensure consistent Asia/Kolkata timezone output.
 */

const IST = "Asia/Kolkata";
const LOCALE = "en-IN";

/** Format a Date as "dd MMM yyyy, hh:mm AM/PM" in IST */
export const formatISTDateTime = (date: Date | string): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: IST,
  });
};

/** Format a Date as "hh:mm AM/PM" in IST */
export const formatISTTime = (date: Date | string): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: IST,
  });
};

/** Format a Date as "dd MMM yyyy" in IST */
export const formatISTDate = (date: Date | string): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: IST,
  });
};

/** Format a Date as "dd MMM" in IST (short, for charts) */
export const formatISTDateShort = (date: Date | string): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(LOCALE, {
    day: "2-digit",
    month: "short",
    timeZone: IST,
  });
};

/** Format a Date as "EEE, MMM d" in IST */
export const formatISTDayDate = (date: Date | string): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(LOCALE, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: IST,
  });
};

/** Format a time string like "08:00" to "8:00 AM" in IST display */
export const formatScheduleTime = (timeStr: string): string => {
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m || 0, 0, 0);
  return d.toLocaleTimeString(LOCALE, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: IST,
  });
};

/** Get today's date string in IST as "yyyy-MM-dd" */
export const getISTDateString = (date?: Date): string => {
  const d = date || new Date();
  const parts = d.toLocaleDateString(LOCALE, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: IST,
  }).split("/");
  // en-IN gives dd/mm/yyyy
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
};

/** Get current hour in IST */
export const getISTHour = (): number => {
  const now = new Date();
  const istStr = now.toLocaleString(LOCALE, { hour: "numeric", hour12: false, timeZone: IST });
  return parseInt(istStr, 10);
};

/** Format a Date as full locale date string in IST */
export const formatISTFullDate = (date: Date | string): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: IST,
  });
};
