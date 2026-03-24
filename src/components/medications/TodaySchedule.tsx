import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, AlertTriangle, Sun, CloudSun, Moon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { format, startOfDay, endOfDay, differenceInMinutes } from "date-fns";

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
  status: "pending" | "taken" | "missed" | "skipped";
  takenAt: string | null;
}

type TimePeriod = "Morning" | "Afternoon" | "Evening";

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

  const loadSchedule = useCallback(async () => {
    if (!session?.user?.id) return;
    const userId = session.user.id;
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    const { data: meds, error: medErr } = await supabase
      .from("medications")
      .select("id, name, dosage, instructions, schedule_times, remaining_quantity")
      .eq("user_id", userId)
      .lte("start_date", format(now, "yyyy-MM-dd"));

    if (medErr || !meds) { setLoading(false); return; }

    const { data: logs } = await supabase
      .from("medication_logs")
      .select("id, medication_id, scheduled_at, taken_at, status")
      .eq("user_id", userId)
      .gte("scheduled_at", todayStart.toISOString())
      .lte("scheduled_at", todayEnd.toISOString());

    const logMap = new Map<string, any>();
    (logs || []).forEach((l) => {
      const key = `${l.medication_id}_${l.scheduled_at}`;
      logMap.set(key, l);
    });

    const slots: DoseSlot[] = [];

    for (const med of meds) {
      for (const timeStr of med.schedule_times) {
        const [hh, mm] = timeStr.split(":").map(Number);
        const scheduledAt = new Date(now);
        scheduledAt.setHours(hh, mm, 0, 0);

        const key = `${med.id}_${scheduledAt.toISOString()}`;
        const log = logMap.get(key);

        let status: DoseSlot["status"] = "pending";
        let logId: string | null = null;
        let takenAt: string | null = null;

        if (log) {
          status = log.status;
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

  const markTaken = async (slot: DoseSlot) => {
    if (!session?.user?.id) return;
    const now = new Date();
    const diffMin = Math.abs(differenceInMinutes(now, slot.scheduledAt));
    if (diffMin > 60) { toast.error("This dose window has passed (±1 hour)."); return; }

    try {
      if (slot.logId) {
        await supabase.from("medication_logs").update({ status: "taken", taken_at: now.toISOString() }).eq("id", slot.logId);
      } else {
        await supabase.from("medication_logs").insert({
          medication_id: slot.medication.id, user_id: session.user.id,
          scheduled_at: slot.scheduledAt.toISOString(), taken_at: now.toISOString(), status: "taken",
        });
      }
      await supabase.from("medications").update({ remaining_quantity: Math.max(0, slot.medication.remaining_quantity - 1) }).eq("id", slot.medication.id);
      toast.success(`${slot.medication.name} marked as taken`);
      notifyGuardians(session.user.id, slot.medication.name, "taken", slot.scheduledAt.toISOString());
      loadSchedule();
    } catch { toast.error("Failed to update"); }
  };


  // Summary stats
  const takenCount = doses.filter(d => d.status === "taken").length;
  const totalCount = doses.length;
  const progressPct = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0;

  // Group by time period
  const grouped = useMemo(() => {
    const groups: Record<TimePeriod, DoseSlot[]> = { Morning: [], Afternoon: [], Evening: [] };
    doses.forEach(d => {
      const period = getTimePeriod(d.scheduledAt.getHours());
      groups[period].push(d);
    });
    return groups;
  }, [doses]);

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

      {/* Grouped doses */}
      {periods.map(period => {
        const slots = grouped[period];
        if (slots.length === 0) return null;

        return (
          <div key={period} className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">
              {periodIcon[period]}
              {period}
            </div>
            {slots.map((slot, i) => {
              const isCurrent = Math.abs(differenceInMinutes(now, slot.scheduledAt)) <= 60;
              const isPast = slot.scheduledAt < now && !isCurrent;

              return (
                <Card
                  key={`${slot.medication.id}-${slot.timeLabel}-${i}`}
                  className={`transition-all ${
                    isCurrent && slot.status === "pending"
                      ? "border-primary bg-primary/5 shadow-md"
                      : slot.status === "missed"
                      ? "border-destructive/30 bg-destructive/5"
                      : slot.status === "taken"
                      ? "border-success/30 bg-success/5"
                      : ""
                  }`}
                >
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="text-center min-w-[60px]">
                      <p className="text-xs font-semibold text-muted-foreground">{slot.timeLabel}</p>
                      {isCurrent && slot.status === "pending" && (
                        <Badge variant="default" className="text-[10px] mt-1">NOW</Badge>
                      )}
                      {slot.status === "missed" && (
                        <Badge variant="destructive" className="text-[10px] mt-1">NOT TAKEN</Badge>
                      )}
                      {slot.status === "taken" && (
                        <Badge className="text-[10px] mt-1 bg-success text-success-foreground">TAKEN</Badge>
                      )}
                      {slot.status === "skipped" && (
                        <Badge variant="secondary" className="text-[10px] mt-1">SKIPPED</Badge>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{slot.medication.name}</p>
                      <p className="text-xs text-muted-foreground">{slot.medication.dosage}</p>
                      {slot.medication.instructions && (
                        <p className="text-xs text-muted-foreground italic">{slot.medication.instructions}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {(slot.status === "missed" || (slot.status === "pending" && !isCurrent && isPast)) && (
                        <AlertTriangle className="w-5 h-5 text-destructive" />
                      )}
                      <Checkbox
                        checked={slot.status === "taken"}
                        disabled={slot.status !== "pending" || !isCurrent}
                        onCheckedChange={() => markTaken(slot)}
                        className={`h-6 w-6 rounded-md ${
                          slot.status === "taken"
                            ? "border-success data-[state=checked]:bg-success data-[state=checked]:text-success-foreground"
                            : ""
                        }`}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export default TodaySchedule;
