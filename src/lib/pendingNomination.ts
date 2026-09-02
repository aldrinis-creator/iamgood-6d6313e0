/**
 * Guardian nomination tokens arrive via `/install?g=<token>` or
 * `/register?nomination=accept&token=<token>`. Once the PWA is installed it
 * always starts at `/`, which drops the query string — the nominee then lands
 * on the User home and signs up as a User by mistake.
 *
 * We stash the token locally the first time we see it so the app can resume
 * the Guardian accept flow after install / reopen. The token is written to BOTH
 * localStorage and sessionStorage, because some iOS home-screen-launch
 * scenarios do not carry localStorage over reliably.
 */

const KEY = "checkin.pending_nomination";
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type Stashed = { token: string; savedAt: number };

/** Persist a nomination token seen in the URL (no-op when absent). */
export function stashNominationToken(token?: string | null): void {
  if (!token) return;
  const payload = JSON.stringify({ token, savedAt: Date.now() } satisfies Stashed);
  try {
    localStorage.setItem(KEY, payload);
  } catch {
    /* storage unavailable — ignore */
  }
  try {
    sessionStorage.setItem(KEY, payload);
  } catch {
    /* storage unavailable — ignore */
  }
}

function readFrom(store: Storage | undefined): string | null {
  try {
    const raw = store?.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stashed;
    if (!parsed?.token) return null;
    if (Date.now() - (parsed.savedAt || 0) > TTL_MS) {
      store?.removeItem(KEY);
      return null;
    }
    return parsed.token;
  } catch {
    return null;
  }
}

/** Read a non-expired pending nomination token from either store, if any. */
export function getPendingNominationToken(): string | null {
  return (
    readFrom(typeof localStorage !== "undefined" ? localStorage : undefined) ||
    readFrom(typeof sessionStorage !== "undefined" ? sessionStorage : undefined)
  );
}

/** Clear the stash after accept / reject / expiry. */
export function clearPendingNomination(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.removeItem(KEY);
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
