import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const DEBOUNCE_MS = 2 * 60 * 1000; // 2 minutes

const useActivityHeartbeat = () => {
  const { user } = useAuth();
  const lastWrite = useRef(0);
  const pending = useRef(false);

  useEffect(() => {
    if (!user?.id) return;

    const flush = async () => {
      const now = Date.now();
      if (now - lastWrite.current < DEBOUNCE_MS) {
        pending.current = true;
        return;
      }
      lastWrite.current = now;
      pending.current = false;
      await supabase
        .from("profiles")
        .update({ last_active_at: new Date().toISOString() } as any)
        .eq("id", user.id);
    };

    const handler = () => flush();

    const events = ["pointerdown", "scroll", "keydown"];
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));

    const onVisibility = () => {
      if (document.visibilityState === "visible") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Initial heartbeat
    flush();

    // Periodic flush for pending writes
    const interval = setInterval(() => {
      if (pending.current) flush();
    }, DEBOUNCE_MS);

    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(interval);
    };
  }, [user?.id]);
};

export default useActivityHeartbeat;
