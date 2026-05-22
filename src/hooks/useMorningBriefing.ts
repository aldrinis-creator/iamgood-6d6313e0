import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useApp } from "@/contexts/AppContext";
import { showMorningBriefing, isBriefingVisible } from "@/components/MorningBriefingOverlay";
import { format } from "date-fns";

export const useMorningBriefing = () => {
  const { session } = useAuth();
  const { pauseMode, loginInProgress } = useApp();
  const hasTriggeredRef = useRef(false);

  const check = useCallback(async () => {
    if (pauseMode !== "active") return;
    if (loginInProgress) return;
    if (!session?.user?.id) return;
    if (isBriefingVisible()) return;

    const now = new Date();
    const hours = now.getHours();
    
    // Only trigger between 9:00 AM and 1:00 PM (13:00)
    if (hours < 9 || hours >= 13) return;

    const dateKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    const storageKey = 'lastBriefingDate';
    
    if (localStorage.getItem(storageKey) === dateKey) {
      return; // Already shown today
    }
    
    // Prevent multiple parallel executions
    if (hasTriggeredRef.current) return;
    hasTriggeredRef.current = true;

    try {
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);

      // 1. Get Profile Name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", session.user.id)
        .single();
        
      const userName = profile?.full_name?.split(" ")[0] || "User";

      // 2. Check for today's medications & refills
      const { data: meds } = await supabase
        .from("medications")
        .select("name, remaining_quantity")
        .eq("user_id", session.user.id)
        .eq("alarm_enabled", true);

      const medicationsList: string[] = [];
      const refillsList: string[] = [];
      
      if (meds) {
        meds.forEach(med => {
          medicationsList.push(med.name);
          if (med.remaining_quantity != null && med.remaining_quantity <= 2) {
            refillsList.push(med.name);
          }
        });
      }

      // 3. Check for today's check-ins
      const { data: checkins } = await supabase
        .from("check_ins")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("status", "pending")
        .gte("scheduled_at", todayStart.toISOString())
        .lte("scheduled_at", todayEnd.toISOString())
        .limit(1);

      const hasCheckins = checkins && checkins.length > 0;

      // 4. Check for today's appointments
      const { data: appointments } = await supabase
        .from("appointments")
        .select("appointment_time")
        .eq("user_id", session.user.id)
        .gte("appointment_time", todayStart.toISOString())
        .lte("appointment_time", todayEnd.toISOString())
        .order("appointment_time", { ascending: true });

      const appointmentsList: string[] = [];
      if (appointments && appointments.length > 0) {
        // Just take the first one for the summary
        const aptTime = new Date(appointments[0].appointment_time);
        appointmentsList.push(format(aptTime, "h:mm a"));
      }

      // Mark as shown in localStorage so it doesn't run again today
      localStorage.setItem(storageKey, dateKey);

      // Show the briefing
      showMorningBriefing({
        userName,
        dateStr: format(now, "EEEE, MMMM do"),
        timeStr: format(now, "h:mm a"),
        hasCheckins,
        medications: medicationsList,
        refills: refillsList,
        appointments: appointmentsList
      });

    } catch (e) {
      console.error("Failed to load morning briefing data:", e);
      // Reset trigger lock on failure so it can try again
      hasTriggeredRef.current = false;
    }
  }, [session?.user?.id, pauseMode, loginInProgress]);

  useEffect(() => {
    // Check immediately and then every minute
    check();
    const interval = setInterval(check, 60_000);

    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check]);
};

export default useMorningBriefing;
