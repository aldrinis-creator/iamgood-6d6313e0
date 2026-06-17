import { useEffect, useRef, useCallback, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useApp } from "@/contexts/AppContext";
import { useUserSettings } from "@/hooks/useUserSettings";
import { supabase as sb } from "@/integrations/supabase/client";
import { playLoudAlertSequence } from "@/lib/audioAlerts";
import { formatISTTime } from "@/lib/istTime";
import {
  showGuardianMissedAlarm,
  hideGuardianMissedAlarm,
  MissedCheckinItem,
} from "@/components/GuardianMissedAlarmOverlay";

const POLL_MS = 60_000;
const LOOP_MS = 12_000;
const DISMISS_KEY = "guardian_dismissed_missed_checkins";

const getDismissedSet = (): Set<string> => {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as { day: string; ids: string[] };
    const todayIST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    if (parsed.day !== todayIST) {
      localStorage.removeItem(DISMISS_KEY);
      return new Set();
    }
    return new Set(parsed.ids);
  } catch {
    return new Set();
  }
};

const addDismissed = (ids: string[]) => {
  const existing = getDismissedSet();
  ids.forEach((id) => existing.add(id));
  const todayIST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  localStorage.setItem(DISMISS_KEY, JSON.stringify({ day: todayIST, ids: Array.from(existing) }));
};

const useGuardianAudio = () => {
  const { session } = useAuth();
  const { role, loginInProgress } = useApp();
  const { settings } = useUserSettings();
  const { wards } = useGuardianWard();

  const loopRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);
  const activeRef = useRef<boolean>(false);

  const stopLoop = useCallback(() => {
    if (loopRef.current !== null) {
      clearInterval(loopRef.current);
      loopRef.current = null;
    }
    activeRef.current = false;
  }, []);

  const startLoop = useCallback((items: MissedCheckinItem[]) => {
    if (loopRef.current !== null) return;
    activeRef.current = true;
    const fire = () => {
      const first = items[0];
      if (!first) return;
      const msg = `Attention Guardian. ${first.wardName} has missed their ${formatISTTime(new Date(first.scheduledAt))} Check-iN. Please check on them.`;
      playLoudAlertSequence(msg);
      if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400]);
    };
    fire();
    loopRef.current = window.setInterval(fire, LOOP_MS);
  }, []);

  const scan = useCallback(async () => {
    if (role !== "guardian") return;
    if (loginInProgress) return;
    if (settings.guardianPersistentMissedAlarm === false) {
      stopLoop();
      hideGuardianMissedAlarm();
      return;
    }
    if (!session?.user?.id || wards.length === 0) {
      stopLoop();
      hideGuardianMissedAlarm();
      return;
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const oneHourAgo = new Date(Date.now() - 3600 * 1000);

    const wardIds = wards.map((w) => w.userId);
    const { data, error } = await supabase
      .from("check_ins")
      .select("id, user_id, scheduled_at, status")
      .in("user_id", wardIds)
      .eq("status", "missed")
      .gte("scheduled_at", todayStart.toISOString())
      .lte("scheduled_at", oneHourAgo.toISOString());

    if (error) return;

    const dismissed = getDismissedSet();
    const items: MissedCheckinItem[] = (data || [])
      .filter((c: any) => !dismissed.has(c.id))
      .map((c: any) => {
        const ward = wards.find((w) => w.userId === c.user_id);
        return {
          id: c.id,
          wardName: ward?.name || "Your ward",
          scheduledAt: c.scheduled_at,
        };
      })
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

    if (items.length === 0) {
      stopLoop();
      hideGuardianMissedAlarm();
      return;
    }

    showGuardianMissedAlarm(items, () => {
      stopLoop();
      addDismissed(items.map((i) => i.id));
    });

    if (!activeRef.current) startLoop(items);
  }, [role, loginInProgress, settings.guardianPersistentMissedAlarm, session?.user?.id, wards, startLoop, stopLoop]);

  useEffect(() => {
    scan();
    pollRef.current = window.setInterval(scan, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") scan();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      if (pollRef.current !== null) clearInterval(pollRef.current);
      document.removeEventListener("visibilitychange", onVis);
      stopLoop();
    };
  }, [scan, stopLoop]);
};

export default useGuardianAudio;
