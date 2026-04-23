import { Moon, Sun, DoorOpen, Navigation, CalendarDays, Pill, ChevronRight } from "lucide-react";
import EmailPromptBanner from "@/components/EmailPromptBanner";
import VaultClaimCancelBanner from "@/components/vault/VaultClaimCancelBanner";
import { useTodayAppointments } from "@/hooks/useTodayAppointments";
import useRefillDue from "@/hooks/useRefillDue";
import { useNavigate } from "react-router-dom";
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
import OnboardingWizard from "@/components/OnboardingWizard";
import VoiceQueryButton from "@/components/VoiceQueryButton";
import { formatISTTime } from "@/lib/istTime";

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
  const todayAppointments = useTodayAppointments();
  const refillDue = useRefillDue();
  const navigate = useNavigate();
  const { settings, updateSetting } = useUserSettings();

  const { session } = useAuth();

  const [showSleepDialog, setShowSleepDialog] = useState(false);
  const [showCheckOutDialog, setShowCheckOutDialog] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem("onboarding_complete");
  });
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

    const { error } = await supabase.rpc("insert_notifications_deduped", { p_notifications: notifications });
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
    const now = formatISTTime(new Date());
    notifyGuardians(
      "🌙 Sleep Mode Activated",
      `${userName} entered Sleep Mode at ${now}. Check-iNs paused until ${schedule.to}.`
    );
  };

  const handleCheckOutSave = (config: CheckOutConfig) => {
    updateSetting("checkOutConfig", config);
    setPauseMode("checked-out");
    updateSetting("pauseMode", "checked-out");
    setShowCheckOutDialog(false);
    toast.success(`${userName} checked out 🚪`);
    const returnTime = config.endsAt
      ? formatISTTime(config.endsAt)
      : "unknown";
    const reasonText = config.reason ? ` Reason: ${config.reason}.` : "";
    notifyGuardians(
      "🚪 Checked Out",
      `${userName} checked out.${reasonText} Expected back by ${returnTime}. Check-iNs paused.`
    );
  };

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <VaultClaimCancelBanner />
        <EmailPromptBanner userEmail={session?.user?.email} />
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
                🚪 Returns at {formatISTTime(settings.checkOutConfig.endsAt)}
                {settings.checkOutConfig.reason ? ` • ${settings.checkOutConfig.reason}` : ""}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Check-In Card */}
        <CheckInCard />

        {/* Map My Journey */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20" onClick={() => navigate("/journey")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Navigation className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Map My Journey</h3>
              <p className="text-xs text-muted-foreground">Track your travel & keep guardians informed</p>
            </div>
          </CardContent>
        </Card>

        {/* Today's Appointments */}
        {todayAppointments > 0 && (
          <Card className="cursor-pointer hover:shadow-md transition-shadow border-primary/20" onClick={() => navigate("/appointments")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <CalendarDays className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm">Today's Appointments</h3>
                <p className="text-xs text-muted-foreground">You have {todayAppointments} appointment{todayAppointments > 1 ? "s" : ""} today</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>
        )}

        {/* Medication Refill Due */}
        {refillDue && (
          <Card className="cursor-pointer hover:shadow-md transition-shadow border-warning/30 bg-warning/5" onClick={() => navigate("/my-health?tool=Medications")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center">
                <Pill className="w-5 h-5 text-warning" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm">Medication Refill Due</h3>
                <p className="text-xs text-muted-foreground">One or more medications are running low</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>
        )}

        {/* Health Passport — collapsible */}
        <Accordion type="single" collapsible>
          <AccordionItem value="health-passport">
            <AccordionTrigger className="text-accessible font-semibold">
              Health Passport
            </AccordionTrigger>
            <AccordionContent>
              <HealthPassport />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
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

      {showOnboarding && (
        <OnboardingWizard
          open={showOnboarding}
          onComplete={() => setShowOnboarding(false)}
        />
      )}

      <VoiceQueryButton />
    </AppLayout>
  );
};

export default UserDashboard;
