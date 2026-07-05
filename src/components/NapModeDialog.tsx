import { useState, useEffect } from "react";
import { Coffee, Clock, Info } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useUserSettings } from "@/hooks/useUserSettings";

export interface NapSchedule {
  from: string; // "HH:MM" 24h
  to: string;   // "HH:MM" 24h
}

export const DEFAULT_NAP_SCHEDULE: NapSchedule = { from: "14:00", to: "16:00" };

interface NapModeDialogProps {
  open: boolean;
  onClose: () => void;
  currentSchedule: NapSchedule;
  isActive: boolean;
  onSave: (schedule: NapSchedule) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────
const to12h = (time24: string): string => {
  const [h, m] = time24.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
};

// Duration in minutes between two HH:MM strings
const durationMins = (from: string, to: string): number => {
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  const fromMins = fh * 60 + fm;
  const toMins = th * 60 + tm;
  return toMins > fromMins ? toMins - fromMins : 0;
};

const fmtDuration = (mins: number): string => {
  if (mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h} hour${h > 1 ? "s" : ""}`;
  return `${m} min`;
};

// ── Quick-pick presets ─────────────────────────────────────────────────────
const PRESETS: { label: string; from: string; to: string }[] = [
  { label: "30 min",  from: "14:00", to: "14:30" },
  { label: "1 hour",  from: "14:00", to: "15:00" },
  { label: "2 hours", from: "14:00", to: "16:00" },
  { label: "Custom",  from: "",       to: "" },
];

// ═══════════════════════════════════════════════════════════════════════════
const NapModeDialog = ({ open, onClose, currentSchedule, isActive, onSave }: NapModeDialogProps) => {
  const { settings } = useUserSettings();

  const [from, setFrom] = useState(currentSchedule.from || DEFAULT_NAP_SCHEDULE.from);
  const [to,   setTo  ] = useState(currentSchedule.to   || DEFAULT_NAP_SCHEDULE.to);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);

  // Sync when dialog opens / schedule changes
  useEffect(() => {
    if (open) {
      setFrom(currentSchedule.from || DEFAULT_NAP_SCHEDULE.from);
      setTo(currentSchedule.to   || DEFAULT_NAP_SCHEDULE.to);
      setSelectedPreset(null);
    }
  }, [open, currentSchedule]);

  const handlePreset = (i: number, preset: typeof PRESETS[0]) => {
    setSelectedPreset(i);
    if (preset.from) setFrom(preset.from);
    if (preset.to)   setTo(preset.to);
  };

  const handleSave = () => {
    if (!from || !to) return;
    onSave({ from, to });
    onClose();
  };

  const durMins = durationMins(from, to);
  const isValid = from && to && durMins > 0;

  // Labels for the time pickers showing existing saved time
  const savedFromLabel = currentSchedule.from ? to12h(currentSchedule.from) : null;
  const savedToLabel   = currentSchedule.to   ? to12h(currentSchedule.to)   : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Coffee className="w-5 h-5 text-amber-400" />
            Nap Time Settings
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground leading-relaxed">
          During nap time, all check-in reminders, medication alerts, and inactivity
          detection are paused. Alerts resume automatically when nap ends.
          Your guardians are notified when nap time starts and ends.
        </p>

        {/* ── Quick presets ── */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Quick select
          </Label>
          <div className="grid grid-cols-4 gap-1.5">
            {PRESETS.map((p, i) => (
              <button
                key={i}
                onClick={() => handlePreset(i, p)}
                className={[
                  "rounded-lg py-2 px-1 text-xs font-medium border transition-all",
                  selectedPreset === i
                    ? "bg-amber-400/10 border-amber-400 text-amber-400"
                    : "border-border text-muted-foreground hover:border-foreground/30",
                ].join(" ")}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Time pickers — FIXED ALIGNMENT ── */}
        <div className="grid grid-cols-2 gap-3">

          {/* FROM */}
          <div className="space-y-1">
            <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Clock className="w-3.5 h-3.5" /> Nap starts
            </Label>
            <input
              type="time"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setSelectedPreset(PRESETS.length - 1); }}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 transition-colors"
            />
            {/* Show existing saved time below the input */}
            {savedFromLabel && (
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                <Info className="w-3 h-3 flex-shrink-0" />
                Current: <span className="font-medium text-foreground/70">{savedFromLabel}</span>
              </p>
            )}
          </div>

          {/* TO */}
          <div className="space-y-1">
            <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Clock className="w-3.5 h-3.5" /> Nap ends
            </Label>
            <input
              type="time"
              value={to}
              onChange={(e) => { setTo(e.target.value); setSelectedPreset(PRESETS.length - 1); }}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 transition-colors"
            />
            {savedToLabel && (
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                <Info className="w-3 h-3 flex-shrink-0" />
                Current: <span className="font-medium text-foreground/70">{savedToLabel}</span>
              </p>
            )}
          </div>
        </div>

        {/* ── Live duration summary ── */}
        <div
          className="rounded-lg px-4 py-3 space-y-1.5 border"
          style={{
            background: isValid ? "rgba(245,166,35,0.06)" : "rgba(255,255,255,0.03)",
            borderColor: isValid ? "rgba(245,166,35,0.25)" : "rgba(255,255,255,0.08)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Nap duration</span>
            <span className={`text-sm font-semibold ${isValid ? "text-amber-400" : "text-muted-foreground"}`}>
              {isValid ? fmtDuration(durMins) : "Set start & end time"}
            </span>
          </div>

          {isValid && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Schedule</span>
              <span className="text-sm font-medium text-foreground/80">
                {to12h(from)} → {to12h(to)}
              </span>
            </div>
          )}

          {isActive && (
            <div className="flex items-center gap-1.5 pt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs font-medium text-amber-400">Nap mode is currently active</span>
            </div>
          )}

          {!isValid && from && to && (
            <p className="text-xs text-destructive">
              End time must be after start time.
            </p>
          )}
        </div>

        {/* ── Actions ── */}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={!isValid}
            className="bg-amber-400 hover:bg-amber-400/90 text-background font-semibold"
          >
            <Coffee className="w-4 h-4 mr-1.5" />
            {isActive ? "Update nap time" : "Start nap time"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NapModeDialog;
