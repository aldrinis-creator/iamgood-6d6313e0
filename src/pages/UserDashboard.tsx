import { Moon, Sun, DoorOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import CheckInCard from "@/components/CheckInCard";
import HealthPassport from "@/components/HealthPassport";
import AppLayout from "@/components/AppLayout";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useApp, PauseMode } from "@/contexts/AppContext";
import { useUserSettings } from "@/hooks/useUserSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";

const MODE_OPTIONS: { mode: PauseMode; icon: typeof Sun; label: string; description: string }[] = [
  { mode: "active", icon: Sun, label: "Active", description: "Check-iNs running" },
  { mode: "sleep", icon: Moon, label: "Sleep", description: "Paused until you wake" },
  { mode: "checked-out", icon: DoorOpen, label: "Checked Out", description: "Away — guardians notified" },
];

const UserDashboard = () => {
  const { pauseMode, setPauseMode, userName } = useApp();
  const { settings, updateSetting } = useUserSettings();
  const [expectedReturn, setExpectedReturn] = useState(settings.expectedReturn || "");

  const handleModeChange = (newMode: PauseMode) => {
    if (newMode === pauseMode) {
      // Tapping the active mode again → go back to active
      if (newMode !== "active") {
        setPauseMode("active");
        updateSetting("pauseMode", "active");
        updateSetting("expectedReturn", null);
        toast.success("Back to Active Mode — Check-iNs resumed");
      }
      return;
    }

    setPauseMode(newMode);
    updateSetting("pauseMode", newMode);

    if (newMode === "active") {
      updateSetting("expectedReturn", null);
      toast.success("Active Mode — Check-iNs resumed");
    } else if (newMode === "sleep") {
      updateSetting("expectedReturn", null);
      toast.success(`${userName} entered Sleep Mode 🌙`);
    } else if (newMode === "checked-out") {
      toast.success(`${userName} checked out 🚪`);
    }
  };

  const handleSetReturn = () => {
    if (expectedReturn) {
      updateSetting("expectedReturn", expectedReturn);
      toast.success(`Expected return set to ${expectedReturn}`);
    }
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

            {/* Expected return time for Check-Out mode */}
            {pauseMode === "checked-out" && (
              <div className="flex gap-2 items-center">
                <Input
                  type="time"
                  value={expectedReturn}
                  onChange={(e) => setExpectedReturn(e.target.value)}
                  className="flex-1 text-sm"
                  placeholder="Expected return"
                />
                <Button size="sm" variant="outline" onClick={handleSetReturn}>
                  Set
                </Button>
              </div>
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
    </AppLayout>
  );
};

export default UserDashboard;
