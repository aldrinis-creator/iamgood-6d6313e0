import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useApp } from "@/contexts/AppContext";
import { useUserSettings } from "@/hooks/useUserSettings";
import { playLoudAlertSequence } from "@/lib/audioAlerts";
import { formatISTTime } from "@/lib/istTime";
import {
  showGuardianMissedAlarm,
  hideGuardianMissedAlarm,
  MissedCheckinItem,
} from "@/components/GuardianMissedAlarmOverlay";

interface WardLite { userId: string; name: string }

const POLL_MS = 60_000;
const MAX_SHOWS = 3;
const DISMISS_KEY = "guardian_dismissed_missed_checkins";
const SHOWN_KEY = "guardian_shown_missed_checkins";

const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

const getDismissedSet = (): Set<string> => {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as { day: string; ids: string[] };
    if (parsed.day !== todayIST()) {
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
  localStorage.setItem(DISMISS_KEY, JSON.stringify({ day: todayIST(), ids: Array.from(existing) }));
};

const getShownCounts = (): Record<string, number> => {
  try {
    const raw = localStorage.getItem(SHOWN_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { day: string; counts: Record<string, number> };
    if (parsed.day !== todayIST()) {
      localStorage.removeItem(SHOWN_KEY);
      return {};
    }
    return parsed.counts || {};
  } catch {
    return {};
  }
};

const bumpShown = (id: string): number => {
  const counts = getShownCounts();
  const next = (counts[id] || 0) + 1;
  counts[id] = next;
  try {
    localStorage.setItem(SHOWN_KEY, JSON.stringify({ day: todayIST(), counts }));
  } catch {
    // storage unavailable — in-memory guards still apply
  }
  return next;
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

  const closeAlarm = useCallback(() => {
    activeRef.current = false;
  }, []);

  const scan = useCallback(async () => {
    if (role !== "guardian") return;
    if (loginInProgress) return;
    if (settings.guardianPersistentMissedAlarm === false) {
      closeAlarm();
      hideGuardianMissedAlarm();
      return;
    }
    if (!session?.user?.id || wards.length === 0) {
      closeAlarm();
      hideGuardianMissedAlarm();
      return;
    }

    // Alarm currently on screen — don't re-trigger over it.
    if (activeRef.current) return;

    // IST midnight (Asia/Kolkata) expressed in UTC, matching server-side logic
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(Date.now() + IST_OFFSET_MS);
    istNow.setUTCHours(0, 0, 0, 0);
    const todayStart = new Date(istNow.getTime() - IST_OFFSET_MS);
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
      closeAlarm();
      hideGuardianMissedAlarm();
      return;
    }

    const primary = items[0];
    const showNumber = bumpShown(primary.id);
    const isFinalShow = showNumber >= MAX_SHOWS;
    activeRef.current = true;

    showGuardianMissedAlarm(
      items,
      () => {
        closeAlarm();
        addDismissed(items.map((i) => i.id));
      },
      {
        // 3rd (and any later) showing stays until the guardian dismisses it.
        autoDismiss: !isFinalShow,
        onAutoDismiss: closeAlarm,
      }
    );

    // One loud alert per showing.
    const msg = `Attention Guardian. ${primary.wardName} has missed their ${formatISTTime(new Date(primary.scheduledAt))} Check-iN. Please check on them.`;
    playLoudAlertSequence(msg);
    if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400]);
  }, [role, loginInProgress, settings.guardianPersistentMissedAlarm, session?.user?.id, wards, closeAlarm]);


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
