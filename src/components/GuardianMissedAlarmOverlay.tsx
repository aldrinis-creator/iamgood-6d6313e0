import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatISTTime } from "@/lib/istTime";

export interface MissedCheckinItem {
  id: string;
  wardName: string;
  scheduledAt: string; // ISO
}

type Listener = (items: MissedCheckinItem[]) => void;
let listeners: Listener[] = [];
let dismissHandler: (() => void) | null = null;
let currentItems: MissedCheckinItem[] = [];

export const showGuardianMissedAlarm = (items: MissedCheckinItem[], onDismiss: () => void) => {
  currentItems = items;
  dismissHandler = onDismiss;
  listeners.forEach((l) => l(items));
};

export const hideGuardianMissedAlarm = () => {
  currentItems = [];
  dismissHandler = null;
  listeners.forEach((l) => l([]));
};

const GuardianMissedAlarmOverlay = () => {
  const [items, setItems] = useState<MissedCheckinItem[]>(currentItems);

  useEffect(() => {
    const l: Listener = (next) => setItems(next);
    listeners.push(l);
    return () => {
      listeners = listeners.filter((x) => x !== l);
    };
  }, []);

  if (items.length === 0) return null;

  const primary = items[0];

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border-2 border-destructive rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom">
        <div className="bg-destructive text-destructive-foreground px-4 py-3 flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 animate-pulse" />
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
