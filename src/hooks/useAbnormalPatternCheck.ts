import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export default function useAbnormalPatternCheck() {
  const { session } = useAuth();
  const lastCheckRef = useRef(0);

  useEffect(() => {
    if (!session?.user?.id) return;
    const uid = session.user.id;

    const runCheck = async () => {
      const now = Date.now();
      if (now - lastCheckRef.current < CHECK_INTERVAL_MS) return;
      lastCheckRef.current = now;

      try {
        const { data, error } = await supabase.functions.invoke("detect-anomalous-patterns", {
          body: { user_id: uid },
        });

        if (error) {
          console.error("Anomaly check error:", error);
          return;
        }

        if (data?.anomalies_detected && data?.summary) {
          // Create in-app notification (deduped)
          await supabase.rpc("insert_notification_deduped", {
            p_user_id: uid,
            p_title: "Health Pattern Alert",
            p_message: data.summary,
            p_type: "anomaly",
          });

          // Notify guardians if critical
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

    // Run on mount and on visibility change (app foreground)
    runCheck();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") runCheck();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const interval = setInterval(runCheck, CHECK_INTERVAL_MS);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(interval);
    };
  }, [session?.user?.id]);
}
