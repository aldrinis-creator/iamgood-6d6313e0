import { useEffect, useRef, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ensureAudioReady, playChime } from "@/lib/audioAlerts";

interface JourneyAutoSosOverlayProps {
  open: boolean;
  onCancel: () => void;
  onTrigger: () => void;
  destinationName?: string;
}

const COUNTDOWN_SEC = 60;

const JourneyAutoSosOverlay = ({ open, onCancel, onTrigger, destinationName }: JourneyAutoSosOverlayProps) => {
  const [countdown, setCountdown] = useState(COUNTDOWN_SEC);
  const firedRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!open) {
      setCountdown(COUNTDOWN_SEC);
      firedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    firedRef.current = false;
    setCountdown(COUNTDOWN_SEC);
    ensureAudioReady().then(() => playChime());
    if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500]);

    intervalRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          if (!firedRef.current) {
            firedRef.current = true;
            onTrigger();
          }
          return 0;
        }
        // Pulse chime + vibrate every 5 seconds
        if (c % 5 === 0) {
          playChime();
          if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
        }
        return c - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [open, onTrigger]);

  if (!open) return null;

  const progress = (countdown / COUNTDOWN_SEC) * 100;

  return (
    <div className="fixed inset-0 z-[100] bg-destructive/95 flex flex-col items-center justify-center text-destructive-foreground p-6 animate-in fade-in duration-300">
      <div className="w-24 h-24 rounded-full bg-destructive-foreground/20 flex items-center justify-center mb-6 animate-pulse">
        <AlertTriangle className="w-14 h-14" />
      </div>

      <h1 className="text-2xl font-bold mb-2">Are you OK?</h1>

      <div className="bg-destructive-foreground/10 rounded-lg px-4 py-2 mb-4 max-w-xs text-center">
        <p className="text-sm font-medium">
          Off-route + no check-in response
        </p>
        {destinationName && (
          <p className="text-xs opacity-80 mt-1">on the way to {destinationName}</p>
        )}
      </div>

      <p className="text-center text-sm opacity-90 mb-8 max-w-xs">
        Auto-SOS will trigger and notify your guardians unless you cancel.
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
        onClick={onCancel}
        variant="outline"
        size="lg"
        className="bg-destructive-foreground text-destructive hover:bg-destructive-foreground/90 border-none font-bold text-lg px-10 py-6"
      >
        <X className="w-5 h-5 mr-2" /> I'm Safe — Cancel
      </Button>
    </div>
  );
};

export default JourneyAutoSosOverlay;
