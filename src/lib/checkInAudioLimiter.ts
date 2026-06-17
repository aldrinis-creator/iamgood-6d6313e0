const STORAGE_KEY = "checkin:audio-alert-counts";
const MAX_AUDIO_ALERTS = 3;

type StoredCounts = Record<string, number>;

const loadCounts = (): StoredCounts => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredCounts;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const saveCounts = (counts: StoredCounts) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
  } catch {
    // If storage is unavailable, the in-memory hook guards still prevent tight loops.
  }
};

export const getISTDateKey = (date: Date = new Date()) =>
  date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export const getCheckInAudioKey = (scope: string, subjectId: string, scheduledAt: Date) => {
  const day = getISTDateKey(scheduledAt);
  const hour = scheduledAt.toLocaleString("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    hour12: false,
  });
  return `${scope}:${subjectId}:${day}:${hour}`;
};

export const canFireCheckInAudio = (key: string, max = MAX_AUDIO_ALERTS): boolean => {
  const counts = loadCounts();
  const current = counts[key] || 0;
  if (current >= max) return false;
  counts[key] = current + 1;

  const today = getISTDateKey();
  Object.keys(counts).forEach((storedKey) => {
    if (!storedKey.includes(`:${today}:`)) delete counts[storedKey];
  });

  saveCounts(counts);
  return true;
};

export const clearCheckInAudioCount = (key: string) => {
  const counts = loadCounts();
  if (key in counts) {
    delete counts[key];
    saveCounts(counts);
  }
};

export { MAX_AUDIO_ALERTS };