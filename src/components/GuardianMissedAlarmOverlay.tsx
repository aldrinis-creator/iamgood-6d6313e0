import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatISTTime } from "@/lib/istTime";

export interface MissedCheckinItem {
  id: string;
  wardName: string;
  scheduledAt: string; // ISO
}

interface AlarmPayload {
  items: MissedCheckinItem[];
  /** When false, the overlay stays until the guardian taps Dismiss. */
  autoDismiss: boolean;
  token: number;
}

type Listener = (payload: AlarmPayload) => void;
let listeners: Listener[] = [];
let dismissHandler: (() => void) | null = null;
let autoDismissHandler: (() => void) | null = null;
let currentPayload: AlarmPayload = { items: [], autoDismiss: true, token: 0 };

const BLINK_MS = 5_000;
const AUTO_DISMISS_MS = 60_000;

export const showGuardianMissedAlarm = (
  items: MissedCheckinItem[],
  onDismiss: () => void,
  options?: { autoDismiss?: boolean; onAutoDismiss?: () => void }
) => {
  currentPayload = {
    items,
    autoDismiss: options?.autoDismiss !== false,
    token: Date.now(),
  };
  dismissHandler = onDismiss;
  autoDismissHandler = options?.onAutoDismiss ?? null;
  listeners.forEach((l) => l(currentPayload));
};

export const hideGuardianMissedAlarm = () => {
  currentPayload = { items: [], autoDismiss: true, token: Date.now() };
  dismissHandler = null;
  autoDismissHandler = null;
  listeners.forEach((l) => l(currentPayload));
};

const GuardianMissedAlarmOverlay = () => {
  const [payload, setPayload] = useState<AlarmPayload>(currentPayload);
  const [blinking, setBlinking] = useState(false);
  const blinkRef = useRef<number | null>(null);
  const autoRef = useRef<number | null>(null);

  useEffect(() => {
    const l: Listener = (next) => setPayload(next);
    listeners.push(l);
    return () => {
      listeners = listeners.filter((x) => x !== l);
    };
  }, []);

  const items = payload.items;

  useEffect(() => {
    const clear = () => {
      if (blinkRef.current !== null) { clearTimeout(blinkRef.current); blinkRef.current = null; }
      if (autoRef.current !== null) { clearTimeout(autoRef.current); autoRef.current = null; }
    };
    clear();
    if (items.length === 0) {
      setBlinking(false);
      return;
    }
    // Blink for 5 seconds, then go steady.
    setBlinking(true);
    blinkRef.current = window.setTimeout(() => setBlinking(false), BLINK_MS);
    // Auto close after 1 minute unless this is the final (persistent) showing.
    if (payload.autoDismiss) {
      autoRef.current = window.setTimeout(() => {
        const h = autoDismissHandler;
        hideGuardianMissedAlarm();
        h?.();
      }, AUTO_DISMISS_MS);
    }
    return clear;
  }, [payload.token, payload.autoDismiss, items.length]);

  if (items.length === 0) return null;

  const primary = items[0];

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border-2 border-destructive rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom">
        <div className="bg-destructive text-destructive-foreground px-4 py-3 flex items-center gap-2">
          <AlertTriangle className={`w-6 h-6 ${blinking ? "animate-pulse" : ""}`} />
          <h2 className="text-lg font-bold">Missed Check-iN — {primary.wardName}</h2>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-sm text-foreground">
            {items.length === 1
              ? `${primary.wardName} missed their ${formatISTTime(new Date(primary.scheduledAt))} Check-iN and has not responded for over an hour. Please check on them.`
              : `${items.length} unresolved missed Check-iNs detected. Please check on your ward(s).`}
          </p>
          {items.length > 1 && (
            <ul className="text-xs text-muted-foreground space-y-1 max-h-32 overflow-y-auto border border-border rounded-lg p-2">
              {items.map((it) => (
                <li key={it.id}>• {it.wardName} — {formatISTTime(new Date(it.scheduledAt))}</li>
              ))}
            </ul>
          )}
          <Button
            variant="destructive"
            size="lg"
            className="w-full h-14 text-base font-semibold"
            onClick={() => {
              const h = dismissHandler;
              hideGuardianMissedAlarm();
              h?.();
            }}
          >
            Dismiss Alarm
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GuardianMissedAlarmOverlay;
