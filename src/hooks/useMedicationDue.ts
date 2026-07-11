import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const useMedicationDue = (): boolean => {
  const { session } = useAuth();
  const [due, setDue] = useState(false);

  const check = useCallback(async () => {
    if (!session?.user?.id) return;
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
    const todayStr = now.toISOString().slice(0, 10);

    const [{ data: meds }, { data: logs }] = await Promise.all([
      supabase
        .from("medications")
        .select("id, schedule_times, start_date, end_date")
        .eq("user_id", session.user.id)
        .lte("start_date", todayStr),
      supabase
        .from("medication_logs")
        .select("medication_id, scheduled_at, status")
        .eq("user_id", session.user.id)
        .gte("scheduled_at", todayStart.toISOString())
        .lte("scheduled_at", todayEnd.toISOString()),
    ]);

    const active = (meds ?? []).filter((m: any) => !m.end_date || m.end_date >= todayStr);
    const nowMin = now.getHours() * 60 + now.getMinutes();

    let anyDue = false;
    for (const med of active) {
      const times: string[] = Array.isArray(med.schedule_times) ? med.schedule_times : [];
      for (const t of times) {
        const [hStr, mStr] = t.split(":");
        const h = parseInt(hStr, 10);
        const m = parseInt(mStr || "0", 10);
        if (isNaN(h)) continue;
        if (h * 60 + m > nowMin) continue; // not yet due
        const handled = (logs ?? []).some((l: any) => {
          if (l.medication_id !== med.id) return false;
          const d = new Date(l.scheduled_at);
          return d.getHours() === h && d.getMinutes() === m &&
            (l.status === "taken" || l.status === "taken_late" || l.status === "skipped");
        });
        if (!handled) { anyDue = true; break; }
      }
      if (anyDue) break;
    }
    setDue(anyDue);
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id) return;
    check();
    const interval = setInterval(check, 60000);

    const suffix = `${session.user.id}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(`med-due-watch-${suffix}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "medication_logs", filter: `user_id=eq.${session.user.id}` }, () => check())
      .on("postgres_changes", { event: "*", schema: "public", table: "medications", filter: `user_id=eq.${session.user.id}` }, () => check())
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, check]);

  return due;
};

export default useMedicationDue;
