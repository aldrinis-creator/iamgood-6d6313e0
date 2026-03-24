import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Heart, Clock } from "lucide-react";
import { playChime, playVoiceReminder } from "@/lib/audioAlerts";
import { Card, CardContent } from "@/components/ui/card";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import CheckInDialog from "@/components/CheckInDialog";

const CHECK_IN_HOURS = [7, 12, 19]; // 7AM, 12PM, 7PM

const getCheckInWindowStart = (hour: number, date: Date = new Date()) => {
  const d = new Date(date);
  d.setHours(hour, 0, 0, 0);
  return d;
};

const getCurrentWindow = () => {
  const now = new Date();
  const hours = now.getHours();
  // Find the current or most recent check-in window
  for (let i = CHECK_IN_HOURS.length - 1; i >= 0; i--) {
    if (hours >= CHECK_IN_HOURS[i]) {
      return CHECK_IN_HOURS[i];
    }
  }
  return null; // Before first check-in of the day
};

const getNextCheckInTime = () => {
  const now = new Date();
  const hours = now.getHours();
  for (const h of CHECK_IN_HOURS) {
    if (hours < h) {
      const next = new Date(now);
      next.setHours(h, 0, 0, 0);
      return next;
    }
  }
  // Next is tomorrow 7AM
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(7, 0, 0, 0);
  return tomorrow;
};

const getMinutesUntilNext = () => {
  const next = getNextCheckInTime();
  return (next.getTime() - Date.now()) / 60000;
};

const formatTimeLeft = (ms: number) => {
  if (ms <= 0) return "00:00";
  const totalSecs = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  if (hrs > 0) {
    return `${hrs}h ${String(mins).padStart(2, "0")}m`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

const formatHour = (h: number) => {
  if (h === 0) return "12:00 AM";
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return "12:00 PM";
  return `${h - 12}:00 PM`;
};

const CheckInCard = () => {
  const { userName, pauseMode } = useApp();
  const { session } = useAuth();
  const [checkedIn, setCheckedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentCheckInId, setCurrentCheckInId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [isApproaching, setIsApproaching] = useState(false);
  const [approachingMinutes, setApproachingMinutes] = useState(0);
  const [showDialog, setShowDialog] = useState(false);
  const [slotStatuses, setSlotStatuses] = useState<Record<number, string>>({});

  const checkInTimes = CHECK_IN_HOURS.map(formatHour);

  // Fetch or create today's check-in for the current window
  const loadCurrentCheckIn = useCallback(async () => {
    if (!session?.user?.id) return;

    const windowHour = getCurrentWindow();
    if (windowHour === null) {
      // Before first check-in of the day
      setCheckedIn(false);
      setCurrentCheckInId(null);
      return;
    }

    const windowStart = getCheckInWindowStart(windowHour);
    const nextHourIndex = CHECK_IN_HOURS.indexOf(windowHour) + 1;
    const windowEnd = nextHourIndex < CHECK_IN_HOURS.length
      ? getCheckInWindowStart(CHECK_IN_HOURS[nextHourIndex])
      : (() => { const d = new Date(windowStart); d.setHours(23, 59, 59, 999); return d; })();

    // Check if a check-in already exists for this window
    const { data: existing, error } = await supabase
      .from("check_ins")
      .select("*")
      .eq("user_id", session.user.id)
      .gte("scheduled_at", windowStart.toISOString())
      .lt("scheduled_at", windowEnd.toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Failed to fetch check-in:", error);
      return;
    }

    if (existing && existing.length > 0) {
      const checkIn = existing[0];
      setCurrentCheckInId(checkIn.id);
      setCheckedIn(checkIn.status === "responded");
    } else {
      // Create a pending check-in for this window
      const { data: created, error: insertError } = await supabase
        .from("check_ins")
        .insert({
          user_id: session.user.id,
          scheduled_at: windowStart.toISOString(),
          status: "pending",
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Failed to create check-in:", insertError);
        return;
      }
      setCurrentCheckInId(created?.id ?? null);
      setCheckedIn(false);
    }
  }, [session?.user?.id]);

  // Fetch statuses for all today's check-in slots
  const loadSlotStatuses = useCallback(async () => {
    if (!session?.user?.id) return;
    const today = new Date();
    const dayStart = new Date(today);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(today);
    dayEnd.setHours(23, 59, 59, 999);

    const { data } = await supabase
      .from("check_ins")
      .select("scheduled_at, status")
      .eq("user_id", session.user.id)
      .gte("scheduled_at", dayStart.toISOString())
      .lte("scheduled_at", dayEnd.toISOString());

    if (data) {
      const statuses: Record<number, string> = {};
      for (const ci of data) {
        const h = new Date(ci.scheduled_at).getHours();
        statuses[h] = ci.status;
      }
      setSlotStatuses(statuses);
    }
  }, [session?.user?.id]);

  const prevWindowRef = useRef<number | null>(undefined);

  useEffect(() => {
    loadCurrentCheckIn();
    loadSlotStatuses();
    const interval = setInterval(() => {
      const newWindow = getCurrentWindow();
      if (prevWindowRef.current !== undefined && newWindow !== prevWindowRef.current) {
        // Audio alerts are now handled by useCheckInAudio hook
      }
      prevWindowRef.current = newWindow;
      loadCurrentCheckIn();
      loadSlotStatuses();
    }, 30000);
    prevWindowRef.current = getCurrentWindow();
    return () => clearInterval(interval);
  }, [loadCurrentCheckIn, loadSlotStatuses]);

  // Countdown timer + approaching detection
  useEffect(() => {
    const tick = () => {
      const next = getNextCheckInTime();
      const ms = next.getTime() - Date.now();
      setTimeLeft(formatTimeLeft(ms));
      const minsLeft = getMinutesUntilNext();
      const currentWindow = getCurrentWindow();
      // Approaching = within 30 min of next window AND not currently in an active window (or already checked in)
      if (minsLeft <= 30 && minsLeft > 0 && (currentWindow === null || checkedIn)) {
        setIsApproaching(true);
        setApproachingMinutes(Math.ceil(minsLeft));
      } else {
        setIsApproaching(false);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [checkedIn]);

  const handleCheckIn = async () => {
    if (!session?.user?.id || loading) return;
    setLoading(true);

    let checkInId = currentCheckInId;

    // If no check-in record exists yet, create one on-the-fly
    if (!checkInId) {
      const now = new Date();
      const windowHour = getCurrentWindow();
      const scheduledAt = windowHour !== null
        ? getCheckInWindowStart(windowHour)
        : now;

      const { data: created, error: insertError } = await supabase
        .from("check_ins")
        .insert({
          user_id: session.user.id,
          scheduled_at: scheduledAt.toISOString(),
          status: "pending",
        })
        .select("id")
        .single();

      if (insertError || !created) {
        console.error("Failed to create check-in:", insertError);
        toast.error("Check-in failed. Please try again.");
        setLoading(false);
        return;
      }
      checkInId = created.id;
      setCurrentCheckInId(checkInId);
    }

    const { error } = await supabase
      .from("check_ins")
      .update({
        status: "responded",
        response: "ok",
        responded_at: new Date().toISOString(),
      })
      .eq("id", checkInId);

    if (error) {
      console.error("Failed to check in:", error);
      toast.error("Check-in failed. Please try again.");
    } else {
      setCheckedIn(true);
      toast.success("Check-in recorded! Your guardians have been notified.");
    }
    setLoading(false);
  };

  const nextCheckIn = getNextCheckInTime();
  const nextLabel = nextCheckIn.getDate() !== new Date().getDate()
    ? `${formatHour(nextCheckIn.getHours())} (Tomorrow)`
    : formatHour(nextCheckIn.getHours());

  const isPaused = pauseMode !== "active";
  const pauseLabel = pauseMode === "sleep" ? "Sleep Mode" : "Checked Out";

  return (
    <>
    <Card className="border border-border bg-card shadow-sm">
      <CardContent className="p-4">
        {isPaused ? (
          <div className="text-center space-y-3">
            <div
              className="relative w-24 h-24 mx-auto flex items-center justify-center"
              style={{
                background: 'radial-gradient(circle, hsl(0 0% 100%) 30%, hsl(145 47% 55% / 0.15) 60%, transparent 80%)',
              }}
            >
              <Heart className="w-12 h-12 text-success fill-current" />
            </div>
            <p className="text-accessible font-semibold text-success">
              {pauseLabel} — Check-iNs Paused
            </p>
            <p className="text-sm text-muted-foreground">
              Tap Active in the mode selector above to resume check-ins.
            </p>
          </div>
        ) : isApproaching && !checkedIn && getCurrentWindow() === null ? (
          <div className="text-center space-y-3">
            <p className="text-accessible font-semibold text-foreground">
              {userName}, Check-iN coming up!
            </p>
            <div
              className="relative w-28 h-28 mx-auto flex items-center justify-center animate-pulse-heart"
              style={{
                background: 'radial-gradient(circle, hsl(0 0% 100%) 30%, hsl(0 84% 60% / 0.15) 60%, transparent 80%)',
              }}
            >
              <Heart className="w-16 h-16 text-sos fill-current drop-shadow-lg" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              Check-iN in <span className="font-semibold text-sos">{approachingMinutes} min</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Get ready for your next check-in at {formatHour(getNextCheckInTime().getHours())}
            </p>
          </div>
        ) : !checkedIn ? (
          <div className="text-center space-y-3">
            <p className="text-accessible font-semibold text-foreground">
              {userName}, did you Check-In today?
            </p>
            <button
              onClick={() => setShowDialog(true)}
              disabled={loading}
              className="relative w-28 h-28 mx-auto flex items-center justify-center animate-pulse-heart disabled:opacity-50"
              aria-label="Check in - I'm okay"
              style={{
                background: 'radial-gradient(circle, hsl(0 0% 100%) 30%, hsl(0 84% 60% / 0.15) 60%, transparent 80%)',
              }}
            >
              <Heart className="w-16 h-16 text-sos fill-current drop-shadow-lg" />
            </button>
            <p className="text-sm text-muted-foreground">
              Tap the heart to Check-iN
            </p>
            <p className="text-sm text-muted-foreground">
              Next check-in: {nextLabel} • <span className="font-semibold text-sos">{timeLeft}</span> remaining
            </p>
          </div>
        ) : (
          <div className="text-center space-y-3">
            <div
              className="relative w-24 h-24 mx-auto flex items-center justify-center"
              style={{
                background: 'radial-gradient(circle, hsl(0 0% 100%) 30%, hsl(145 47% 55% / 0.15) 60%, transparent 80%)',
              }}
            >
              <Heart className="w-12 h-12 text-success fill-current" />
            </div>
            <p className="text-accessible font-semibold text-success">✓ Checked In!</p>
            <p className="text-sm text-muted-foreground">
              Next Check-iN: {nextLabel}
            </p>
          </div>
        )}

        <div className="mt-4 flex gap-2 justify-center">
          {checkInTimes.map((time) => (
            <span
              key={time}
              className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium"
            >
              {time}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>

    <CheckInDialog
      open={showDialog}
      onClose={() => setShowDialog(false)}
      onConfirmOk={handleCheckIn}
    />
    </>
  );
};

export default CheckInCard;
