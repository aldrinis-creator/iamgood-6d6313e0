import { useEffect, useState, useSyncExternalStore } from "react";

/** Quiet period after sign-in/sign-up during which non-emergency pop-ups are held. */
export const QUIET_PERIOD_MS = 15 * 60 * 1000;
const QUIET_KEY = "popup_quiet_until";

export function startQuietPeriod(now = Date.now()) {
  try { localStorage.setItem(QUIET_KEY, String(now + QUIET_PERIOD_MS)); } catch { /* ignore */ }
  emit();
}
export function quietUntil(): number {
  try { return Number(localStorage.getItem(QUIET_KEY)) || 0; } catch { return 0; }
}
export function isQuiet(now = Date.now()) { return now < quietUntil(); }

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
export function __resetPopupQueue() { waiting.clear(); current = null; }
export function currentPopup() { return current; }

function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

/** True while the post-login quiet period is running (re-renders when it ends). */
export function useQuietPeriod(): boolean {
  const [quiet, setQuiet] = useState(isQuiet());
  useEffect(() => {
    const check = () => setQuiet(isQuiet());
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
