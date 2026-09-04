import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Pill } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isMedScheduledToday } from "@/lib/medSchedule";

interface WardMedicationStatusProps {
  wardUserId: string;
  wardName: string;
}

interface Medication {
  id: string;
  name: string;
  dosage: string;
  schedule_times: string[];
}

interface DoseSlot {
  medName: string;
  dosage: string;
  time: string;
  hour: number;
  minute: number;
  status: "taken" | "taken_late" | "missed" | "pending";
}

type TimePeriod = "Morning" | "Afternoon" | "Evening";

const getTimePeriod = (hour: number): TimePeriod => {
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
};

const WardMedicationStatus = ({ wardUserId, wardName }: WardMedicationStatusProps) => {
  const [doses, setDoses] = useState<DoseSlot[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSchedule = useCallback(async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [{ data: meds }, { data: logs }] = await Promise.all([
      supabase
        .from("medications")
        .select("id, name, dosage, schedule_times, schedule_days")
        .eq("user_id", wardUserId),
      supabase
        .from("medication_logs")
        .select("medication_id, status, scheduled_at")
        .eq("user_id", wardUserId)
        .gte("scheduled_at", todayStart.toISOString())
        .lte("scheduled_at", todayEnd.toISOString()),
    ]);

    if (!meds) { setLoading(false); return; }

    const now = new Date();
    const slots: DoseSlot[] = [];

    for (const med of (meds as Medication[]).filter((m) => isMedScheduledToday(m as any))) {
      for (const t of med.schedule_times) {
        const [hStr, mStr] = t.split(":");
        const h = parseInt(hStr, 10);
        const m = parseInt(mStr || "0", 10);

        // Find matching log
        const log = logs?.find(
          (l) =>
            l.medication_id === med.id &&
            new Date(l.scheduled_at).getHours() === h &&
            new Date(l.scheduled_at).getMinutes() === m
        );

        let status: DoseSlot["status"] = "pending";
        const scheduledAt = new Date(now);
        scheduledAt.setHours(h, m, 0, 0);
        const minutesLate = Math.floor((now.getTime() - scheduledAt.getTime()) / 60000);
        if (log?.status === "taken") status = "taken";
        else if (log?.status === "taken_late") status = "taken_late";
        else if (log?.status === "missed" || log?.status === "skipped") status = "missed";
        else if (minutesLate > 60) {
          status = "missed";
        }


        slots.push({
          medName: med.name,
          dosage: med.dosage,
          time: t,
          hour: h,
          minute: m,
          status,
        });
      }
    }

    slots.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
    setDoses(slots);
    setLoading(false);
  }, [wardUserId]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  // Realtime subscription for live updates
  useEffect(() => {
    const channel = supabase
      .channel(`ward-med-logs-${wardUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "medication_logs",
          filter: `user_id=eq.${wardUserId}`,
        },
        () => loadSchedule()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [wardUserId, loadSchedule]);

  const grouped = useMemo(() => {
    const groups: Record<TimePeriod, DoseSlot[]> = { Morning: [], Afternoon: [], Evening: [] };
    doses.forEach((d) => groups[getTimePeriod(d.hour)].push(d));
    return groups;
  }, [doses]);

  const takenCount = doses.filter((d) => d.status === "taken" || d.status === "taken_late").length;
  const totalCount = doses.length;
  const progress = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0;

  const formatTime = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 text-center text-sm text-muted-foreground">
          Loading medications…
        </CardContent>
      </Card>
    );
  }

  if (totalCount === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Pill className="w-5 h-5 text-primary" />
          {wardName}'s Medications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Progress summary */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {takenCount} of {totalCount} doses taken
            </span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Grouped doses */}
        {(["Morning", "Afternoon", "Evening"] as TimePeriod[]).map((period) =>
          grouped[period].length > 0 ? (
            <div key={period}>
              <p className="text-xs font-medium text-muted-foreground mb-1">{period}</p>
              <div className="space-y-1">
                {grouped[period].map((slot, i) => (
                  <div
                    key={`${slot.medName}-${slot.time}-${i}`}
                    className={`flex items-center justify-between py-2 px-2 rounded-lg ${
                      slot.status === "missed" ? "bg-destructive/5" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-16">
                        {formatTime(slot.time)}
                      </span>
                      <span className="text-sm font-medium">{slot.medName}</span>
                      <span className="text-xs text-muted-foreground">{slot.dosage}</span>
                    </div>
                    <Badge
                      variant={
                        slot.status === "taken"
                          ? "default"
                          : slot.status === "taken_late"
                          ? "default"
                          : slot.status === "missed"
                          ? "destructive"
                          : "secondary"
                      }
                      className={`text-[10px] ${
                        slot.status === "taken" ? "bg-success text-success-foreground" : 
                        slot.status === "taken_late" ? "bg-amber-500 text-white" : ""
                      }`}
                    >
                      {slot.status === "taken" ? "Taken" : slot.status === "taken_late" ? "Late" : slot.status === "missed" ? "Missed" : "Pending"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ) : null
        )}
      </CardContent>
    </Card>
  );
};

export default WardMedicationStatus;
