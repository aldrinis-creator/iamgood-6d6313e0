import { useEffect, useState } from "react";
import { useUserSettings } from "./useUserSettings";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const LS_GUARDIAN_DATE = "hydration_guardian_alert_date";

function istHourNow(): number {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    hour12: false,
  });
  return parseInt(fmt.format(new Date()), 10);
}

function istDateString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export type HydrationLevel = "comfortable" | "reminder" | "high_risk";

export function classifyHydration(humidity?: number, temp?: number): HydrationLevel {
  if (humidity == null || temp == null) return "comfortable";
  if (humidity >= 75 && temp >= 32) return "high_risk";
  if (humidity >= 60 && temp >= 28) return "reminder";
  return "comfortable";
}

export function useHydrationNudge(humidity?: number, temp?: number, userName?: string) {
  const { settings } = useUserSettings();
  const { pauseMode } = useApp();
  const { session } = useAuth();
  const [level, setLevel] = useState<HydrationLevel>("comfortable");

  useEffect(() => {
    const lvl = classifyHydration(humidity, temp);
    setLevel(lvl);
    try {
      window.dispatchEvent(new CustomEvent("hydration-level", { detail: { level: lvl, humidity, temp } }));
    } catch {}
    if (!settings.hydrationNudges) return;
    if (pauseMode === "sleep" || pauseMode === "checked-out") return;
    if (lvl === "comfortable") return;

    const hour = istHourNow();
    if (hour >= 22 || hour < 6) return; // quiet hours

    // Guardian alert (high risk, once per day)
    if (lvl === "high_risk" && settings.hydrationAdvisoryToGuardian && session?.user?.id) {
      const today = istDateString();
      if (localStorage.getItem(LS_GUARDIAN_DATE) === today) return;
      localStorage.setItem(LS_GUARDIAN_DATE, today);

      (async () => {
        const { data: g } = await supabase
          .from("guardians")
          .select("id")
          .eq("user_id", session.user.id)
          .eq("is_primary", true)
          .eq("status", "accepted")
          .maybeSingle();
        if (!g?.id) return;
        await supabase.rpc("insert_notification_deduped", {
          p_user_id: session.user.id,
          p_title: "Heat & humidity advisory",
          p_message: `${userName || "Your ward"}'s area is ${Math.round(temp!)}°C with ${Math.round(humidity!)}% humidity. Please remind them to drink water.`,
          p_type: "hydration_advisory",
          p_guardian_id: g.id,
        });
      })().catch(() => {});
    }
  }, [humidity, temp, settings.hydrationNudges, settings.hydrationAdvisoryToGuardian, pauseMode, session?.user?.id, userName]);

  return { level };
}
