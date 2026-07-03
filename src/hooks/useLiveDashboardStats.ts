import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useLiveDashboardStats() {
  const { session } = useAuth();
  const [stats, setStats] = useState({
    checkInsCompleted: 0,
    checkInsTotal: 0,
    medsCompleted: 0,
    medsTotal: 0,
    healthScore: 100,
  });

  useEffect(() => {
    if (!session?.user?.id) return;

    const fetchStats = async () => {
      const todayDate = new Date();
      const todayStr = todayDate.toISOString().slice(0, 10);
      todayDate.setHours(0, 0, 0, 0);
      const tomorrow = new Date(todayDate);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [checkInsRes, medsRes, healthRes] = await Promise.all([
        supabase
          .from("check_ins")
          .select("status")
          .eq("user_id", session.user.id)
          .gte("scheduled_at", todayDate.toISOString())
          .lt("scheduled_at", tomorrow.toISOString()),
        supabase
          .from("medication_logs")
          .select("status")
          .eq("user_id", session.user.id)
          .gte("scheduled_time", todayDate.toISOString())
          .lt("scheduled_time", tomorrow.toISOString()),
        supabase
          .from("health_passport_scores")
          .select("overall")
          .eq("user_id", session.user.id)
          .eq("score_date", todayStr)
          .maybeSingle()
      ]);

      let ciCompleted = 0;
      let ciTotal = 3; // Typically 3 slots a day
      if (checkInsRes.data) {
        ciTotal = Math.max(3, checkInsRes.data.length);
        ciCompleted = checkInsRes.data.filter(c => c.status === "responded" || c.status === "late").length;
      }

      let mCompleted = 0;
      let mTotal = 0;
      if (medsRes.data) {
        mTotal = medsRes.data.length;
        mCompleted = medsRes.data.filter(m => m.status === "taken" || m.status === "taken_late").length;
      }

      const score = healthRes.data?.overall ?? 0;
      
      setStats({
        checkInsCompleted: ciCompleted,
        checkInsTotal: ciTotal,
        medsCompleted: mCompleted,
        medsTotal: mTotal,
        healthScore: score,
      });
    };

    fetchStats();
    
    // Poll every minute to keep it fresh
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, [session?.user?.id]);

  return stats;
}
