import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useApp } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const STORAGE_KEY = (uid: string) => `anomaly_check_last_run_${uid}`;

export default function useAbnormalPatternCheck() {
  const { session } = useAuth();
  const { role } = useApp();

  useEffect(() => {
    if (!session?.user?.id) return;
    // Only ward accounts have health data worth scanning; guardians never need this.
    if (role !== "user") return;
    const uid = session.user.id;

    const getLastRun = (): number => {
      try {
        const v = localStorage.getItem(STORAGE_KEY(uid));
        return v ? parseInt(v, 10) || 0 : 0;
      } catch {
        return 0;
      }
    };
    const setLastRun = (ts: number) => {
      try { localStorage.setItem(STORAGE_KEY(uid), String(ts)); } catch { /* ignore */ }
    };

    const runCheck = async () => {
      const now = Date.now();
      if (now - getLastRun() < CHECK_INTERVAL_MS) return;
      // Reserve the slot immediately so concurrent mounts don't double-fire.
      setLastRun(now);

      try {
        const { data, error } = await supabase.functions.invoke("detect-anomalous-patterns", {
          body: { user_id: uid },
        });

        if (error) {
          console.error("Anomaly check error:", error);
          return;
        }

        if (data?.anomalies_detected && data?.summary) {
          await supabase.rpc("insert_notification_deduped", {
            p_user_id: uid,
            p_title: "Health Pattern Alert",
            p_message: data.summary,
            p_type: "anomaly",
          });

          if (data.severity === "high") {
            const { data: guardians } = await supabase
              .from("guardians")
              .select("guardian_user_id")
              .eq("user_id", uid)
              .eq("status", "accepted");

            if (guardians?.length) {
              const guardianNotifications = guardians
                .filter((g) => g.guardian_user_id)
                .map((g) => ({
                  user_id: g.guardian_user_id!,
                  title: "Ward Health Pattern Alert",
                  message: data.summary,
                  type: "anomaly",
                }));

              if (guardianNotifications.length > 0) {
                await supabase.rpc("insert_notifications_deduped", {
                  p_notifications: guardianNotifications,
                });
              }
            }
          }

          toast.warning("Health pattern alert detected", {
            description: data.summary.substring(0, 100) + (data.summary.length > 100 ? "…" : ""),
          });
        }
      } catch (e) {
        console.error("Anomaly check failed:", e);
      }
    };

    // Run once on mount (gated by localStorage throttle, so navigation won't re-fire).
    runCheck();
    const interval = setInterval(runCheck, CHECK_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [session?.user?.id, role]);
}
