/**
 * Guardian nomination tokens arrive via `/install?g=<token>` or
 * `/register?nomination=accept&token=<token>`. Once the PWA is installed it
 * always starts at `/`, which drops the query string — the nominee then lands
 * on the User home and signs up as a User by mistake.
 *
 * We stash the token locally the first time we see it so the app can resume
 * the Guardian accept flow after install / reopen.
 */

const KEY = "checkin.pending_nomination";
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type Stashed = { token: string; savedAt: number };

/** Persist a nomination token seen in the URL (no-op when absent). */
export function stashNominationToken(token?: string | null): void {
  if (!token) return;
  try {
    const payload: Stashed = { token, savedAt: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* storage unavailable — ignore */
  }
}

/** Read a non-expired pending nomination token, if any. */
export function getPendingNominationToken(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stashed;
    if (!parsed?.token) return null;
    if (Date.now() - (parsed.savedAt || 0) > TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return parsed.token;
  } catch {
    return null;
  }
}

/** Clear the stash after accept / reject / expiry. */
export function clearPendingNomination(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Capture the token from the current URL search params, if present. */
export function captureNominationFromSearch(search: string): string | null {
  try {
    const params = new URLSearchParams(search);
    const token =
      params.get("g") ||
      (params.get("nomination") ? params.get("token") : null);
    if (token) stashNominationToken(token);
    return token;
  } catch {
    return null;
  }
}
