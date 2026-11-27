import { useEffect, useState, useSyncExternalStore } from "react";

/** Quiet period after sign-in/sign-up during which non-emergency pop-ups are held. */
export const QUIET_PERIOD_MS = 15 * 60 * 1000;
const QUIET_KEY_PREFIX = "popup_quiet_until:";

/** The signed-in user whose quiet period applies. Set by AuthContext (null = signed out). */
let activeUserId: string | null = null;
const quietKey = (userId: string) => `${QUIET_KEY_PREFIX}${userId}`;

/** Tell the queue which user is signed in so the quiet period is tracked per user. */
export function setQuietUser(userId: string | null) {
  if (activeUserId === userId) return;
  activeUserId = userId;
  recompute();
  emit();
}

export function startQuietPeriod(userId: string, now = Date.now()) {
  activeUserId = userId;
  try { localStorage.setItem(quietKey(userId), String(now + QUIET_PERIOD_MS)); } catch { /* ignore */ }
  recompute();
  emit();
}
export function quietUntil(userId: string | null = activeUserId): number {
  if (!userId) return 0;
  try { return Number(localStorage.getItem(quietKey(userId))) || 0; } catch { return 0; }
}
export function isQuiet(now = Date.now(), userId: string | null = activeUserId) {
  return now < quietUntil(userId);
}

/** Popup priority — lower number shows first. */
export const POPUP_PRIORITY = {
  reminder: 1, guardianMissed: 1, refill: 2, guardianPing: 3, userPing: 3,
  guardianSafeZone: 4, safeZoneExit: 4, morningBriefing: 5, battery: 6, cookie: 7,
} as const;
export type PopupId = keyof typeof POPUP_PRIORITY;

const waiting = new Set<PopupId>();
let current: PopupId | null = null;
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }

/** Pure selection: keep the shown popup until released, else highest priority waiting. */
export function pickNext(cur: PopupId | null, wait: Iterable<PopupId>): PopupId | null {
  const list = [...wait];
  if (cur && list.includes(cur)) return cur;
  list.sort((a, b) => POPUP_PRIORITY[a] - POPUP_PRIORITY[b]);
  return list[0] ?? null;
}
function recompute() {
  const next = isQuiet() ? null : pickNext(current, waiting);
  if (next !== current) { current = next; emit(); }
}
export function requestPopup(id: PopupId) { waiting.add(id); recompute(); }
export function releasePopup(id: PopupId) { waiting.delete(id); if (current === id) current = null; recompute(); emit(); }
export function __resetPopupQueue() { waiting.clear(); current = null; activeUserId = null; }
export function currentPopup() { return current; }

function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

/** True while the post-login quiet period is running (re-renders when it ends). */
export function useQuietPeriod(): boolean {
  const [quiet, setQuiet] = useState(isQuiet());
  useEffect(() => {
    const check = () => setQuiet(isQuiet());
    check();
    const unsub = subscribe(check);
    const t = setInterval(() => { check(); recompute(); }, 15000);
    return () => { unsub(); clearInterval(t); };
  }, []);
  return quiet;
}

/** Returns true when this popup may render now. `wantsOpen` = popup has something to show. */
export function usePopupSlot(id: PopupId, wantsOpen: boolean): boolean {
  useQuietPeriod();
  const cur = useSyncExternalStore(subscribe, () => current);
  useEffect(() => {
    if (wantsOpen) requestPopup(id); else releasePopup(id);
    return () => { if (wantsOpen) releasePopup(id); };
  }, [id, wantsOpen]);
  return wantsOpen && cur === id;
}
