import { Moon, Sun, DoorOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import CheckInCard from "@/components/CheckInCard";
import HealthPassport from "@/components/HealthPassport";
import AppLayout from "@/components/AppLayout";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useApp, PauseMode } from "@/contexts/AppContext";
import { useUserSettings, SleepSchedule, CheckOutConfig } from "@/hooks/useUserSettings";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import SleepModeDialog from "@/components/SleepModeDialog";
import CheckOutSettingsDialog from "@/components/CheckOutSettingsDialog";

const MODE_OPTIONS: { mode: PauseMode; icon: typeof Sun; label: string; description: string }[] = [
  { mode: "active", icon: Sun, label: "Active", description: "Check-iNs running" },
  { mode: "sleep", icon: Moon, label: "Sleep", description: "Paused until you wake" },
  { mode: "checked-out", icon: DoorOpen, label: "Checked Out", description: "Away — guardians notified" },
];

// Parse "HH:MM" into minutes since midnight
const timeToMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

// Check if "now" is within a sleep window (handles overnight)
const isInSleepWindow = (from: string, to: string): boolean => {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const fromMin = timeToMinutes(from);
  const toMin = timeToMinutes(to);

  if (fromMin <= toMin) {
    // Same-day window (e.g. 13:00-15:00)
    return nowMin >= fromMin && nowMin < toMin;
  }
  // Overnight window (e.g. 22:00-06:00)
  return nowMin >= fromMin || nowMin < toMin;
};

// Get ms until sleep window ends
const msUntilSleepEnd = (to: string): number => {
  const now = new Date();
  const [h, m] = to.split(":").map(Number);
  const end = new Date(now);
  end.setHours(h, m, 0, 0);
  if (end.getTime() <= now.getTime()) {
    end.setDate(end.getDate() + 1);
  }
  return end.getTime() - now.getTime();
};

const UserDashboard = () => {
  const { pauseMode, setPauseMode, userName } = useApp();
  const { settings, updateSetting } = useUserSettings();

  const { session } = useAuth();

  const [showSleepDialog, setShowSleepDialog] = useState(false);
  const [showCheckOutDialog, setShowCheckOutDialog] = useState(false);
  const autoReturnTimer = useRef<ReturnType<typeof setTimeout>>();

  // Notify all guardians about mode change
  const notifyGuardians = useCallback(async (title: string, message: string) => {
    if (!session?.user?.id) return;
    const { data: guardians } = await supabase
      .from("guardians")
      .select("id")
      .eq("user_id", session.user.id);
    if (!guardians?.length) return;

    const notifications = guardians.map((g) => ({
      user_id: session.user.id,
      guardian_id: g.id,
      title,
      message,
      type: "mode_change",
    }));

    const { error } = await supabase.from("notifications").insert(notifications);
    if (error) console.error("Failed to notify guardians:", error);
  }, [session?.user?.id]);

  // Auto-return logic
  const returnToActive = useCallback(() => {
    setPauseMode("active");
    updateSetting("pauseMode", "active");
    toast.success("Back to Active Mode — Check-iNs resumed ☀️");
  }, [setPauseMode, updateSetting]);

  // Schedule auto-return timers whenever pauseMode changes
  useEffect(() => {
    if (autoReturnTimer.current) clearTimeout(autoReturnTimer.current);

    if (pauseMode === "sleep") {
      const schedule = settings.sleepSchedule;
      if (schedule && isInSleepWindow(schedule.from, schedule.to)) {
        const ms = msUntilSleepEnd(schedule.to);
        autoReturnTimer.current = setTimeout(returnToActive, ms);
      }
    } else if (pauseMode === "checked-out") {
      const config = settings.checkOutConfig;
      if (config?.endsAt) {
        const ms = new Date(config.endsAt).getTime() - Date.now();
        if (ms > 0) {
          autoReturnTimer.current = setTimeout(returnToActive, ms);
        } else {
          // Already expired
          returnToActive();
        }
      }
    }

    return () => {
      if (autoReturnTimer.current) clearTimeout(autoReturnTimer.current);
    };
  }, [pauseMode, settings.sleepSchedule, settings.checkOutConfig, returnToActive]);

  // Also check on load: if sleep window has passed, auto-return
  useEffect(() => {
    if (pauseMode === "sleep") {
      const schedule = settings.sleepSchedule;
      if (schedule && !isInSleepWindow(schedule.from, schedule.to)) {
        returnToActive();
      }
    }
    if (pauseMode === "checked-out") {
      const config = settings.checkOutConfig;
      if (config?.endsAt && new Date(config.endsAt).getTime() <= Date.now()) {
        returnToActive();
      }
    }
  }, []); // intentionally run once on mount

  const handleModeChange = (newMode: PauseMode) => {
    if (newMode === pauseMode) {
      // Tapping the active mode again → go back to active
      if (newMode !== "active") {
        returnToActive();
      }
      return;
    }

    if (newMode === "active") {
      returnToActive();
    } else if (newMode === "sleep") {
      setShowSleepDialog(true);
    } else if (newMode === "checked-out") {
      setShowCheckOutDialog(true);
    }
  };

  const handleSleepSave = (schedule: SleepSchedule) => {
    updateSetting("sleepSchedule", schedule);
    setPauseMode("sleep");
    updateSetting("pauseMode", "sleep");
    setShowSleepDialog(false);
    toast.success(`${userName} entered Sleep Mode 🌙 (${schedule.from} – ${schedule.to})`);
  };

  const handleCheckOutSave = (config: CheckOutConfig) => {
    updateSetting("checkOutConfig", config);
    setPauseMode("checked-out");
    updateSetting("pauseMode", "checked-out");
    setShowCheckOutDialog(false);
    toast.success(`${userName} checked out 🚪`);
  };

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        {/* Mode Selector */}
        <Card className="bg-primary/5">
          <CardContent className="p-3 space-y-3">
            <div className="flex gap-2">
              {MODE_OPTIONS.map(({ mode, icon: Icon, label }) => (
                <Button
                  key={mode}
                  variant={pauseMode === mode ? "default" : "outline"}
                  size="sm"
                  className={`flex-1 gap-1.5 ${
                    pauseMode === mode && mode === "active" ? "bg-primary text-primary-foreground" : ""
                  } ${
                    pauseMode === mode && mode !== "active" ? "bg-success text-success-foreground" : ""
                  }`}
                  onClick={() => handleModeChange(mode)}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {MODE_OPTIONS.find(o => o.mode === pauseMode)?.description}
            </p>

            {/* Show active sleep schedule info */}
            {pauseMode === "sleep" && settings.sleepSchedule && (
              <p className="text-xs text-success text-center">
                🌙 Sleep: {settings.sleepSchedule.from} – {settings.sleepSchedule.to} • Auto-resumes at {settings.sleepSchedule.to}
              </p>
            )}

            {/* Show active checkout info */}
            {pauseMode === "checked-out" && settings.checkOutConfig?.endsAt && (
              <p className="text-xs text-success text-center">
                🚪 Returns at {new Date(settings.checkOutConfig.endsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                {settings.checkOutConfig.reason ? ` • ${settings.checkOutConfig.reason}` : ""}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Check-In Card */}
        <CheckInCard />

        {/* Health Passport */}
        <HealthPassport />

        {/* How It Works */}
        <Accordion type="single" collapsible>
          <AccordionItem value="how-it-works">
            <AccordionTrigger className="text-accessible font-semibold">
              How Check-iN Works
            </AccordionTrigger>
            <AccordionContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex gap-3 items-start">
                <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">1</span>
                <p><strong>Set Your Schedule:</strong> Choose your daily Check-iN times (default: 7AM, 12PM, 7PM).</p>
              </div>
              <div className="flex gap-3 items-start">
                <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">2</span>
                <p><strong>Tap the Heart:</strong> When prompted, tap the pulsing heart to confirm you're okay.</p>
              </div>
              <div className="flex gap-3 items-start">
                <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">3</span>
                <p><strong>Automatic Alerts:</strong> If you miss a Check-iN, your guardians are notified automatically.</p>
              </div>
              <div className="flex gap-3 items-start">
                <span className="w-7 h-7 rounded-full bg-sos text-sos-foreground flex items-center justify-center text-xs font-bold shrink-0">!</span>
                <p><strong>SOS Anytime:</strong> Press the SOS button for immediate emergency alert with live location sharing.</p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* AI Health Companion */}
        <Card className="bg-gradient-to-r from-primary/10 to-success/10 border-0">
          <CardContent className="p-4">
            <h3 className="text-accessible font-semibold mb-2">🤖 AI Health Companion</h3>
            <p className="text-sm text-muted-foreground">
              Check-iN uses AI to learn your daily patterns and detect unusual inactivity.
              Combined with phone-based fall detection, it provides a proactive safety net — even without wearable hardware.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <SleepModeDialog
        open={showSleepDialog}
        onClose={() => setShowSleepDialog(false)}
        currentSchedule={settings.sleepSchedule}
        isActive={pauseMode === "sleep"}
        onSave={handleSleepSave}
      />
      <CheckOutSettingsDialog
        open={showCheckOutDialog}
        onClose={() => setShowCheckOutDialog(false)}
        currentConfig={settings.checkOutConfig}
        onSave={handleCheckOutSave}
      />
    </AppLayout>
  );
};

export default UserDashboard;
