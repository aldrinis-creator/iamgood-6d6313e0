import { useEffect } from "react";
import { useFallDetection } from "@/hooks/useFallDetection";
import { useApp } from "@/contexts/AppContext";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const FallDetectionOverlay = () => {
  const { fallDetected, countdown, cancelFallAlert, countdownExpired, permissionState, requestPermission, enabled } = useFallDetection();
  const { triggerSOS } = useApp();

  useEffect(() => {
    if (countdownExpired) {
      triggerSOS();
      cancelFallAlert();
    }
  }, [countdownExpired, triggerSOS, cancelFallAlert]);

  // Show permission prompt for iOS users
  if (enabled && permissionState === "unknown") {
    return (
      <div className="fixed bottom-24 left-4 right-4 z-[90] bg-card border border-border rounded-xl p-4 shadow-lg animate-in slide-in-from-bottom duration-300 max-w-md mx-auto">
        <div className="flex items-start gap-3">
          <Smartphone className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Motion Sensors Required</p>
            <p className="text-xs text-muted-foreground mt-1">
              Fall detection needs access to your device's motion sensors. Tap below to enable.
            </p>
            <Button onClick={requestPermission} size="sm" className="mt-3 w-full">
              Enable Motion Sensors
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!fallDetected) return null;

  const progress = (countdown / 15) * 100;

  return (
    <div className="fixed inset-0 z-[100] bg-destructive/95 flex flex-col items-center justify-center text-destructive-foreground p-6 animate-in fade-in duration-300">
      <div className="w-24 h-24 rounded-full bg-destructive-foreground/20 flex items-center justify-center mb-6 animate-pulse">
        <AlertTriangle className="w-14 h-14" />
      </div>

      <h1 className="text-2xl font-bold mb-2">Fall Detected!</h1>
      <p className="text-center text-sm opacity-90 mb-8 max-w-xs">
        A fall has been detected. Emergency SOS will trigger automatically unless you cancel.
      </p>

      <div className="relative w-32 h-32 mb-8">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4" opacity={0.2} />
          <circle
            cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4"
            strokeDasharray={`${2 * Math.PI * 45}`}
            strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-4xl font-bold">{countdown}</span>
        </div>
      </div>

      <p className="text-sm opacity-80 mb-6">
        SOS in {countdown} second{countdown !== 1 ? "s" : ""}
      </p>

      <Button
        onClick={cancelFallAlert}
        variant="outline"
        size="lg"
        className="bg-destructive-foreground text-destructive hover:bg-destructive-foreground/90 border-none font-bold text-lg px-10 py-6"
      >
        <X className="w-5 h-5 mr-2" /> I'm OK — Cancel
      </Button>
    </div>
  );
};

export default FallDetectionOverlay;
