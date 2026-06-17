import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useApp } from "@/contexts/AppContext";
import { useUserSettings } from "@/hooks/useUserSettings";
import { playLoudAlertSequence } from "@/lib/audioAlerts";
import { formatISTTime } from "@/lib/istTime";
import { canFireCheckInAudio, getCheckInAudioKey, MAX_AUDIO_ALERTS } from "@/lib/checkInAudioLimiter";
import {
  showGuardianMissedAlarm,
  hideGuardianMissedAlarm,
  MissedCheckinItem,
} from "@/components/GuardianMissedAlarmOverlay";

interface WardLite { userId: string; name: string }

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
  const [wards, setWards] = useState<WardLite[]>([]);

  const loopRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);
  const activeRef = useRef<boolean>(false);

  useEffect(() => {
    if (role !== "guardian" || !session?.user?.id) {
      setWards([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("guardians")
        .select("user_id")
        .eq("guardian_user_id", session.user.id)
        .eq("status", "accepted");
      if (!data || data.length === 0) {
        if (!cancelled) setWards([]);
        return;
      }
      const ids = data.map((g: any) => g.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      if (cancelled) return;
      setWards(ids.map((uid) => ({
        userId: uid,
        name: (profiles?.find((p: any) => p.id === uid) as any)?.full_name || "Your ward",
      })));
    })();
    return () => { cancelled = true; };
  }, [role, session?.user?.id]);

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
    const fire = (): boolean => {
      const first = items.find((item) =>
        canFireCheckInAudio(getCheckInAudioKey("guardian", item.id, new Date(item.scheduledAt)), MAX_AUDIO_ALERTS)
      );
      if (!first) return;
      const msg = `Attention Guardian. ${first.wardName} has missed their ${formatISTTime(new Date(first.scheduledAt))} Check-iN. Please check on them.`;
      playLoudAlertSequence(msg);
      if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400]);
      return true;
    };
    if (!fire()) {
      activeRef.current = false;
      return;
    }
    loopRef.current = window.setInterval(() => {
      if (!fire()) stopLoop();
    }, LOOP_MS);
  }, [stopLoop]);

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
