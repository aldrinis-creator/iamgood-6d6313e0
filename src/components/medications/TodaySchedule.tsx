import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, AlertTriangle, Sun, CloudSun, Moon, Timer, ChevronDown, ChevronUp, Check } from "lucide-react";
import { toast } from "sonner";
import { format, startOfDay, endOfDay, differenceInMinutes } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Medication {
  id: string;
  name: string;
  dosage: string;
  instructions: string | null;
  schedule_times: string[];
  remaining_quantity: number;
}

interface DoseSlot {
  medication: Medication;
  scheduledAt: Date;
  timeLabel: string;
  logId: string | null;
  status: "pending" | "taken" | "taken_late" | "missed" | "skipped";
  takenAt: string | null;
}

type TimePeriod = "Morning" | "Afternoon" | "Evening";

const MAX_SNOOZES = 3;

const getTimePeriod = (hour: number): TimePeriod => {
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
};

const periodIcon: Record<TimePeriod, React.ReactNode> = {
  Morning: <Sun className="w-3.5 h-3.5 text-amber-500" />,
  Afternoon: <CloudSun className="w-3.5 h-3.5 text-orange-500" />,
  Evening: <Moon className="w-3.5 h-3.5 text-indigo-400" />,
};

const slotKey = (slot: DoseSlot) =>
  `${slot.medication.id}_${slot.scheduledAt.getHours()}:${slot.scheduledAt.getMinutes()}`;

const notifyGuardians = async (userId: string, medicationName: string, status: string, scheduledTime: string) => {
  try {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    await fetch(`https://${projectId}.supabase.co/functions/v1/notify-guardian-medication`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
      body: JSON.stringify({ user_id: userId, medication_name: medicationName, status, scheduled_time: scheduledTime }),
    });
  } catch {
    // silent fail
  }
};

const TodaySchedule = () => {
  const { session } = useAuth();
  const [doses, setDoses] = useState<DoseSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [hiddenTaken, setHiddenTaken] = useState<Set<string>>(new Set());
  const [fadingOut, setFadingOut] = useState<Set<string>>(new Set());
  const [showCompleted, setShowCompleted] = useState(false);

  // Snooze state: key → { count, until (timestamp) }
  const [snoozeState, setSnoozeState] = useState<Map<string, { count: number; until: number }>>(new Map());
  const snoozeTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const loadSchedule = useCallback(async () => {
    if (!session?.user?.id) return;
    const userId = session.user.id;
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    const todayStr = format(now, "yyyy-MM-dd");
    const { data: meds, error: medErr } = await supabase
      .from("medications")
      .select("id, name, dosage, instructions, schedule_times, remaining_quantity")
      .eq("user_id", userId)
      .lte("start_date", todayStr)
      .or(`end_date.is.null,end_date.gte.${todayStr}`);

    if (medErr || !meds) { setLoading(false); return; }

    const { data: logs } = await supabase
      .from("medication_logs")
      .select("id, medication_id, scheduled_at, taken_at, status")
      .eq("user_id", userId)
      .gte("scheduled_at", todayStart.toISOString())
      .lte("scheduled_at", todayEnd.toISOString());

    const slots: DoseSlot[] = [];

    for (const med of meds) {
      for (const timeStr of med.schedule_times) {
        const [hh, mm] = timeStr.split(":").map(Number);
        const scheduledAt = new Date(now);
        scheduledAt.setHours(hh, mm || 0, 0, 0);

        // Match logs by medication_id + hour + minute (robust, no ISO mismatch)
        const log = (logs || []).find((l) => {
          if (l.medication_id !== med.id) return false;
          const logDate = new Date(l.scheduled_at);
          return logDate.getHours() === hh && logDate.getMinutes() === (mm || 0);
        });

        let status: DoseSlot["status"] = "pending";
        let logId: string | null = null;
        let takenAt: string | null = null;

        if (log) {
          status = log.status as DoseSlot["status"];
          logId = log.id;
          takenAt = log.taken_at;
        } else {
          const diffMin = differenceInMinutes(now, scheduledAt);
          if (diffMin > 60) status = "missed";
        }

        slots.push({
          medication: med as Medication,
          scheduledAt,
          timeLabel: format(scheduledAt, "h:mm a"),
          logId, status, takenAt,
        });
      }
    }

    slots.sort((a, b) => {
      const nowMs = now.getTime();
      const aIsCurrent = Math.abs(differenceInMinutes(now, a.scheduledAt)) <= 60;
      const bIsCurrent = Math.abs(differenceInMinutes(now, b.scheduledAt)) <= 60;
      if (aIsCurrent && !bIsCurrent) return -1;
      if (!aIsCurrent && bIsCurrent) return 1;
      return Math.abs(a.scheduledAt.getTime() - nowMs) - Math.abs(b.scheduledAt.getTime() - nowMs);
    });

    setDoses(slots);
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => {
    loadSchedule();
    const interval = setInterval(loadSchedule, 60_000);
    return () => clearInterval(interval);
  }, [loadSchedule]);

  // Cleanup snooze timers
  useEffect(() => {
    return () => {
      snoozeTimers.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  const markTaken = async (slot: DoseSlot) => {
    if (!session?.user?.id) return;
    const now = new Date();
    const key = slotKey(slot);

    try {
      const diffMin = differenceInMinutes(now, slot.scheduledAt);
      const effectiveStatus = diffMin > 60 ? "taken_late" : "taken";

      if (!navigator.onLine) {
        const req = indexedDB.open("checkin-offline", 2);
        req.onsuccess = async () => {
          const db = req.result;
          const tx = db.transaction("med_queue", "readwrite");
          tx.objectStore("med_queue").add({
            medication_id: slot.medication.id,
            user_id: session.user.id,
            scheduled_at: slot.scheduledAt.toISOString(),
            taken_at: now.toISOString(),
            status: effectiveStatus,
            queued_at: Date.now()
          });
          const sw = await navigator.serviceWorker.ready;
          // @ts-ignore
          sw.sync.register("med-sync");
        };
        const label = effectiveStatus === "taken_late" ? "taken (late)" : "taken";
        toast.success(`${slot.medication.name} marked as ${label} ✓ (Saved offline)`);
        import("canvas-confetti").then((module) => {
          const confetti = module.default;
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#22c55e', '#3b82f6', '#eab308'] });
        });
        setFadingOut((prev) => new Set(prev).add(key));
        setTimeout(() => {
          setFadingOut((prev) => { const n = new Set(prev); n.delete(key); return n; });
          setHiddenTaken((prev) => new Set(prev).add(key));
        }, 800);
        return;
      }

      if (slot.logId) {
        await supabase.from("medication_logs").update({ status: effectiveStatus, taken_at: now.toISOString() }).eq("id", slot.logId);
      } else {
        await supabase.from("medication_logs").insert({
          medication_id: slot.medication.id, user_id: session.user.id,
          scheduled_at: slot.scheduledAt.toISOString(), taken_at: now.toISOString(), status: effectiveStatus,
        });
      }
      await supabase.from("medications").update({ remaining_quantity: Math.max(0, slot.medication.remaining_quantity - 1) }).eq("id", slot.medication.id);
      const label = effectiveStatus === "taken_late" ? "taken (late)" : "taken";
      toast.success(`${slot.medication.name} marked as ${label} ✓`);
      notifyGuardians(session.user.id, slot.medication.name, effectiveStatus, slot.scheduledAt.toISOString());

      import("canvas-confetti").then((module) => {
        const confetti = module.default;
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#22c55e', '#3b82f6', '#eab308']
        });
      });

      // Fade out then hide
      setFadingOut((prev) => new Set(prev).add(key));
      setTimeout(() => {
        setFadingOut((prev) => { const n = new Set(prev); n.delete(key); return n; });
        setHiddenTaken((prev) => new Set(prev).add(key));
        loadSchedule();
      }, 800);
    } catch { toast.error("Failed to update"); }
  };

  const handleSnooze = (slot: DoseSlot, minutes: number) => {
    const key = slotKey(slot);
    const current = snoozeState.get(key);
    const count = (current?.count || 0) + 1;

    if (count > MAX_SNOOZES) {
      // Auto-mark missed
      autoMarkMissed(slot);
      return;
    }

    const until = Date.now() + minutes * 60_000;
    setSnoozeState((prev) => {
      const next = new Map(prev);
      next.set(key, { count, until });
      return next;
    });

    toast(`${slot.medication.name} snoozed for ${minutes}m (${count}/${MAX_SNOOZES})`);

    // Clear previous timer
    const existingTimer = snoozeTimers.current.get(key);
    if (existingTimer) clearTimeout(existingTimer);

    // Set timer to re-show
    const timer = setTimeout(() => {
      setSnoozeState((prev) => {
        const next = new Map(prev);
        const entry = next.get(key);
        if (entry) {
          next.set(key, { ...entry, until: 0 });
        }
        return next;
      });

      // If this was the last snooze, auto-mark missed after re-show
      if (count >= MAX_SNOOZES) {
        setTimeout(() => autoMarkMissed(slot), 2000);
      }
    }, minutes * 60_000);

    snoozeTimers.current.set(key, timer);
  };

  const autoMarkMissed = async (slot: DoseSlot) => {
    if (!session?.user?.id) return;
    const key = slotKey(slot);

    try {
      if (slot.logId) {
        await supabase.from("medication_logs").update({ status: "missed" }).eq("id", slot.logId);
      } else {
        await supabase.from("medication_logs").insert({
          medication_id: slot.medication.id, user_id: session.user.id,
          scheduled_at: slot.scheduledAt.toISOString(), status: "missed",
        });
      }
      // Guardian SMS is handled centrally by useMedicationAlarms — no duplicate here
      toast.error(`${slot.medication.name} recorded as Not Taken`);
      setSnoozeState((prev) => { const n = new Map(prev); n.delete(key); return n; });
      loadSchedule();
    } catch { /* silent */ }
  };

  // Summary stats (include all, even hidden)
  const takenCount = doses.filter(d => d.status === "taken" || d.status === "taken_late").length;
  const totalCount = doses.length;
  const progressPct = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0;

  // Separate pending/active from completed
  const { activeDoses, completedDoses } = useMemo(() => {
    const now = Date.now();
    const active: DoseSlot[] = [];
    const completed: DoseSlot[] = [];

    doses.forEach((d) => {
      const key = slotKey(d);

      // Hidden after taking
      if (hiddenTaken.has(key) || d.status === "taken" || d.status === "taken_late") {
        completed.push(d);
        return;
      }

      // Currently snoozed (hidden)
      const snooze = snoozeState.get(key);
      if (snooze && snooze.until > now) {
        return; // hidden during snooze
      }

      active.push(d);
    });

    return { activeDoses: active, completedDoses: completed };
  }, [doses, hiddenTaken, snoozeState]);

  // Group active doses by period
  const grouped = useMemo(() => {
    const groups: Record<TimePeriod, DoseSlot[]> = { Morning: [], Afternoon: [], Evening: [] };
    activeDoses.forEach(d => {
      const period = getTimePeriod(d.scheduledAt.getHours());
      groups[period].push(d);
    });
    return groups;
  }, [activeDoses]);

  if (loading) {
    return <p className="text-sm text-muted-foreground text-center py-8">Loading schedule...</p>;
  }

  if (doses.length === 0) {
    return (
      <div className="text-center py-8 space-y-2">
        <Clock className="w-10 h-10 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">No medications scheduled today.</p>
        <p className="text-xs text-muted-foreground">Add medications in "Manage Medications" below.</p>
      </div>
    );
  }

  const now = new Date();
  const periods: TimePeriod[] = ["Morning", "Afternoon", "Evening"];

  return (
    <div className="space-y-3">
      {/* Summary header */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{takenCount} of {totalCount} doses taken</span>
          <span className="text-muted-foreground">{progressPct}%</span>
        </div>
        <Progress value={progressPct} className="h-2" />
      </div>

      {/* Active (pending/missed) doses grouped by period */}
      {activeDoses.length === 0 && completedDoses.length > 0 ? (
        <div className="text-center py-6 space-y-2">
          <Check className="w-8 h-8 text-success mx-auto" />
          <p className="text-sm font-medium text-success">All doses taken! 🎉</p>
        </div>
      ) : (
        periods.map(period => {
          const slots = grouped[period];
          if (slots.length === 0) return null;

          return (
            <div key={period} className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">
                {periodIcon[period]}
                {period}
              </div>
              {slots.map((slot, i) => {
                const key = slotKey(slot);
                const isCurrent = Math.abs(differenceInMinutes(now, slot.scheduledAt)) <= 60;
                const isPast = slot.scheduledAt < now && !isCurrent;
                const isFading = fadingOut.has(key);
                const snooze = snoozeState.get(key);
                const snoozeCount = snooze?.count || 0;
                const canSnooze = snoozeCount < MAX_SNOOZES && slot.status === "pending";

                return (
                  <Card
                    key={`${slot.medication.id}-${slot.timeLabel}-${i}`}
                    className={`transition-all duration-500 ${
                      isFading ? "opacity-0 scale-95 h-0 overflow-hidden" : "opacity-100"
                    } ${
                      isCurrent && slot.status === "pending"
                        ? "border-primary bg-primary/5 shadow-md"
                        : slot.status === "missed"
                        ? "border-destructive/30 bg-destructive/5"
                        : ""
                    }`}
                  >
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="text-center min-w-[60px]">
                          <p className="text-xs font-semibold text-muted-foreground">{slot.timeLabel}</p>
                          {isCurrent && slot.status === "pending" && (
                            <Badge variant="default" className="text-[10px] mt-1">DUE NOW</Badge>
                          )}
                          {slot.status === "missed" && (
                            <Badge variant="destructive" className="text-[10px] mt-1">NOT TAKEN</Badge>
                          )}
                          {snoozeCount > 0 && slot.status === "pending" && (
                            <Badge variant="secondary" className="text-[10px] mt-1">
                              <Timer className="w-2.5 h-2.5 mr-0.5" />
                              {snoozeCount}/{MAX_SNOOZES}
                            </Badge>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{slot.medication.name}</p>
                          <p className="text-xs text-muted-foreground">{slot.medication.dosage}</p>
                          {slot.medication.instructions && (
                            <p className="text-xs text-muted-foreground italic">{slot.medication.instructions}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {(slot.status === "missed" || (slot.status === "pending" && !isCurrent && isPast)) && (
                            <AlertTriangle className="w-4 h-4 text-destructive" />
                          )}
                        </div>
                      </div>

                      {/* Action buttons for pending doses */}
                      {slot.status === "pending" && isCurrent && (
                        <div className="flex items-center gap-2 pl-[72px]">
                          <Button
                            size="sm"
                            variant="default"
                            className="h-8 text-xs gap-1"
                            onClick={() => markTaken(slot)}
                          >
                            <Check className="w-3.5 h-3.5" />
                            Taken
                          </Button>
                          {canSnooze && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs gap-1"
                                onClick={() => handleSnooze(slot, 5)}
                              >
                                <Timer className="w-3 h-3" />
                                5m
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs gap-1"
                                onClick={() => handleSnooze(slot, 15)}
                              >
                                <Timer className="w-3 h-3" />
                                15m
                              </Button>
                            </>
                          )}
                        </div>
                      )}

                      {/* Taken Late button for missed doses */}
                      {slot.status === "missed" && (
                        <div className="flex items-center gap-2 pl-[72px]">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1 border-amber-500 text-amber-600 hover:bg-amber-50"
                            onClick={() => markTaken(slot)}
                          >
                            <Check className="w-3.5 h-3.5" />
                            Taken (Late)
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          );
        })
      )}

      {/* Show completed toggle */}
      {completedDoses.length > 0 && (
        <Collapsible open={showCompleted} onOpenChange={setShowCompleted}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground gap-1">
              {showCompleted ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {showCompleted ? "Hide" : "Show"} completed ({completedDoses.length})
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1.5 pt-1">
            {completedDoses.map((slot, i) => {
              const isLate = slot.status === "taken_late";
              return (
                <Card key={`done-${slot.medication.id}-${slot.timeLabel}-${i}`} className={isLate ? "border-amber-400/30 bg-amber-50/50" : "border-success/30 bg-success/5"}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="text-center min-w-[60px]">
                      <p className="text-xs font-semibold text-muted-foreground">{slot.timeLabel}</p>
                      <Badge className={`text-[10px] mt-1 ${isLate ? "bg-amber-500 text-white" : "bg-success text-success-foreground"}`}>
                        {isLate ? "TAKEN LATE" : "TAKEN"}
                      </Badge>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate line-through opacity-70">{slot.medication.name}</p>
                      <p className="text-xs text-muted-foreground">{slot.medication.dosage}</p>
                    </div>
                    <Check className={`w-5 h-5 shrink-0 ${isLate ? "text-amber-500" : "text-success"}`} />
                  </CardContent>
                </Card>
              );
            })}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};

export default TodaySchedule;
