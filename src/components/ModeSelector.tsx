import { useState, useCallback } from "react";
import { Moon, Sun, DoorOpen, Coffee } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { useUserSettings, SleepSchedule, CheckOutConfig } from "@/hooks/useUserSettings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatISTTime } from "@/lib/istTime";
import SleepModeDialog from "@/components/SleepModeDialog";
import NapModeDialog from "@/components/NapModeDialog";
import CheckOutSettingsDialog from "@/components/CheckOutSettingsDialog";
import type { PauseMode } from "@/contexts/AppContext";

const MODE_OPTIONS: { mode: PauseMode; icon: typeof Sun; label: string; description: string }[] = [
  { mode: "active", icon: Sun, label: "Active", description: "Normal check-in reminders" },
  { mode: "sleep", icon: Moon, label: "Sleep", description: "Pause reminders during rest hours" },
  { mode: "nap", icon: Coffee, label: "Nap", description: "Pause reminders during your nap" },
  { mode: "checked-out", icon: DoorOpen, label: "Away", description: "Pause reminders while away" },
];

export default function ModeSelector() {
  const { pauseMode, setPauseMode, userName } = useApp();
  const { session } = useAuth();
  const { settings, updateSetting } = useUserSettings();

  const [showSleepDialog, setShowSleepDialog] = useState(false);
  const [showNapDialog, setShowNapDialog] = useState(false);
  const [showCheckOutDialog, setShowCheckOutDialog] = useState(false);

  const returnToActive = useCallback(() => {
    setPauseMode("active");
    updateSetting("pauseMode", "active");
    toast.success("Back to Active Mode — Check-iNs resumed ☀️");
  }, [setPauseMode, updateSetting]);

  const notifyGuardians = useCallback(async (title: string, message: string) => {
    if (!session?.user?.id) return;
    const { data: guardians } = await supabase
      .from("guardians")
      .select("id")
      .eq("user_id", session.user.id);
    if (!guardians?.length) return;
    const notifications = guardians.map((g) => ({
      user_id: session.user!.id,
      guardian_id: g.id,
      title,
      message,
      type: "mode_change",
    }));
    const { error } = await supabase.rpc("insert_notifications_deduped", { p_notifications: notifications });
    if (error) console.error("Failed to notify guardians:", error);
  }, [session?.user?.id]);

  const handleModeChange = (newMode: PauseMode) => {
    if (newMode === pauseMode) {
      if (newMode !== "active") {
        returnToActive();
      }
      return;
    }
    if (newMode === "active") {
      returnToActive();
    } else if (newMode === "sleep") {
      setShowSleepDialog(true);
    } else if (newMode === "nap") {
      setShowNapDialog(true);
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

  const handleNapSave = (schedule: SleepSchedule) => {
    updateSetting("napSchedule", schedule);
    updateSetting("autoNapMode", true);
    setPauseMode("nap");
    updateSetting("pauseMode", "nap");
    setShowNapDialog(false);
    toast.success("Your Nap time is now active. No alerts will be sent to your Guardian/s", { duration: 5000 });
    notifyGuardians("💤 Nap Mode", `${userName} is taking a nap from ${schedule.from} to ${schedule.to}.`);
  };

  const handleCheckOutSave = (config: CheckOutConfig) => {
    updateSetting("checkOutConfig", config);
    setPauseMode("checked-out");
    updateSetting("pauseMode", "checked-out");
    setShowCheckOutDialog(false);
    toast.success(`${userName} checked out 🚪`);
    const returnTime = config.endsAt ? formatISTTime(config.endsAt) : "unknown";
    const reasonText = config.reason ? ` Reason: ${config.reason}.` : "";
    notifyGuardians(
      "🚪 Checked Out",
      `${userName} checked out.${reasonText} Expected back by ${returnTime}. Check-iNs paused.`
    );
  };

  return (
    <>
      <Card className="bg-primary/5">
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Check-iN Mode</h3>
          <div className="grid grid-cols-2 gap-2">
            {MODE_OPTIONS.map(({ mode, icon: Icon, label }) => (
              <Button
                key={mode}
                variant={pauseMode === mode ? "default" : "outline"}
                size="sm"
                className={`gap-1.5 ${
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
            {MODE_OPTIONS.find((o) => o.mode === pauseMode)?.description}
          </p>

          {pauseMode === "sleep" && settings.sleepSchedule && (
            <p className="text-xs text-success text-center">
              🌙 Sleep: {settings.sleepSchedule.from} – {settings.sleepSchedule.to} • Auto-resumes at {settings.sleepSchedule.to}
            </p>
          )}

          {pauseMode === "nap" && settings.napSchedule && (
            <p className="text-xs text-success text-center">
              💤 Nap: {settings.napSchedule.from} – {settings.napSchedule.to} • Auto-resumes at {settings.napSchedule.to}
            </p>
          )}

          {pauseMode === "checked-out" && settings.checkOutConfig?.endsAt && (
            <p className="text-xs text-success text-center">
              🚪 Returns at {formatISTTime(settings.checkOutConfig.endsAt)}
              {settings.checkOutConfig.reason ? ` • ${settings.checkOutConfig.reason}` : ""}
            </p>
          )}
        </CardContent>
      </Card>

      <SleepModeDialog
        open={showSleepDialog}
        onClose={() => setShowSleepDialog(false)}
        currentSchedule={settings.sleepSchedule}
        isActive={pauseMode === "sleep"}
        onSave={handleSleepSave}
      />
      <NapModeDialog
        open={showNapDialog}
        onClose={() => setShowNapDialog(false)}
        currentSchedule={settings.napSchedule}
        isActive={pauseMode === "nap"}
        onSave={handleNapSave}
      />
      <CheckOutSettingsDialog
        open={showCheckOutDialog}
        onClose={() => setShowCheckOutDialog(false)}
        currentConfig={settings.checkOutConfig}
        onSave={handleCheckOutSave}
      />
    </>
  );
}
