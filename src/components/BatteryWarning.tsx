import React, { useEffect, useState, useRef, useCallback } from "react";
import { BatteryLow, Zap, AlertTriangle } from "lucide-react";
import { playChime, playVoiceReminder, ensureAudioReady } from "@/lib/audioAlerts";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface BatteryState {
  level: number;
  charging: boolean;
}

const BatteryWarning: React.FC = () => {
  const [battery, setBattery] = useState<BatteryState>({ level: 100, charging: false });
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<"low" | "critical">("low");
  const lowShownCount = useRef(0);
  const criticalShownCount = useRef(0);
  const dismissTimer = useRef<ReturnType<typeof setTimeout>>();
  const lastSavedLevel = useRef<number>(-1);
  const { settings } = useUserSettings();
  const { session } = useAuth();

  useEffect(() => {
    let batt: any;
    const update = () => {
      if (!batt) return;
      const level = Math.round(batt.level * 100);
      setBattery({ level, charging: batt.charging });
      // Save battery level to user_settings every 5% change
      if (session?.user?.id && Math.abs(level - lastSavedLevel.current) >= 5) {
        lastSavedLevel.current = level;
        supabase.from("user_settings").upsert({
          user_id: session.user.id,
          settings: { ...settings, batteryLevel: level },
          updated_at: new Date().toISOString(),
        } as any, { onConflict: "user_id" }).then(() => {});
      }
    };
    (navigator as any).getBattery?.().then((b: any) => {
      batt = b;
      update();
      b.addEventListener("levelchange", update);
      b.addEventListener("chargingchange", update);
    });
    return () => {
      if (batt) {
        batt.removeEventListener("levelchange", update);
        batt.removeEventListener("chargingchange", update);
      }
    };
  }, [session?.user?.id]);

  const show = useCallback(async (p: "low" | "critical", level: number) => {
    setPhase(p);
    setVisible(true);
    clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => setVisible(false), 6000);

    // Re-prime audio before playing
    await ensureAudioReady();

    const isCritical = p === "critical";
    const message = isCritical
      ? `Battery critically low at ${level} percent! Charge immediately to stay connected.`
      : `Battery is getting low at ${level} percent. Please charge your phone soon.`;

    if (settings.voiceReminders) {
      playVoiceReminder(message);
    } else if (settings.audioAlerts) {
      playChime();
    }

    // Vibration
    if (settings.vibration && navigator.vibrate) {
      navigator.vibrate(isCritical ? [300, 150, 300, 150, 300] : [200, 100, 200]);
    }
  }, [settings.voiceReminders, settings.audioAlerts, settings.vibration]);

  useEffect(() => {
    if (battery.charging) {
      lowShownCount.current = 0;
      criticalShownCount.current = 0;
      setVisible(false);
      return;
    }
    if (battery.level <= 10 && criticalShownCount.current < 3) {
      criticalShownCount.current += 1;
      show("critical", battery.level);
    } else if (battery.level <= 20 && battery.level > 10 && lowShownCount.current < 3) {
      lowShownCount.current += 1;
      show("low", battery.level);
    }
  }, [battery, show]);

  if (!visible) return null;

  const isLow = phase === "low";

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => setVisible(false)}
    >
      <div
        className={`relative flex flex-col items-center gap-4 rounded-3xl p-8 mx-6 max-w-sm w-full text-center shadow-2xl ${
          isLow
            ? "bg-amber-50 dark:bg-amber-950 border-2 border-amber-400"
            : "bg-red-50 dark:bg-red-950 border-2 border-destructive"
        }`}
        style={{ animation: isLow ? "bounce-warn 1.2s ease-in-out 3" : "shake-critical 0.6s ease-in-out 5" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Animated icon */}
        <div
          className={`rounded-full p-5 ${
            isLow ? "bg-amber-100 dark:bg-amber-900" : "bg-red-100 dark:bg-red-900"
          }`}
          style={{ animation: isLow ? "pulse-icon 1.5s ease-in-out infinite" : "flash-icon 0.8s step-end infinite" }}
        >
          {isLow ? (
            <BatteryLow className="w-16 h-16 text-amber-600 dark:text-amber-400" />
          ) : (
            <AlertTriangle className="w-16 h-16 text-destructive" />
          )}
        </div>

        {/* Bolt accent */}
        <Zap
          className={`absolute top-4 right-4 ${isLow ? "text-amber-400" : "text-destructive"}`}
          style={{ animation: "spin-bolt 2s linear infinite" }}
        />

        {/* Percentage */}
        <span
          className={`text-5xl font-black tabular-nums ${
            isLow ? "text-amber-700 dark:text-amber-300" : "text-destructive"
          }`}
        >
          {battery.level}%
        </span>

        {/* Message */}
        <p className={`text-lg font-semibold leading-snug ${
          isLow ? "text-amber-800 dark:text-amber-200" : "text-red-800 dark:text-red-200"
        }`}>
          {isLow
            ? "Battery is getting low — please charge your phone soon!"
            : "Battery critically low! Charge immediately to stay connected."}
        </p>

        {/* Dismiss */}
        <button
          onClick={() => setVisible(false)}
          className={`mt-2 px-6 py-2.5 rounded-full text-sm font-semibold transition-transform active:scale-95 ${
            isLow
              ? "bg-amber-500 text-white hover:bg-amber-600"
              : "bg-destructive text-destructive-foreground hover:opacity-90"
          }`}
        >
          Got it
        </button>

        <p className="text-xs text-muted-foreground">
          Reminder {isLow ? lowShownCount.current : criticalShownCount.current} of 3
        </p>
      </div>

      <style>{`
        @keyframes bounce-warn {
          0%, 100% { transform: translateY(0); }
          25% { transform: translateY(-18px); }
          50% { transform: translateY(0); }
          75% { transform: translateY(-10px); }
        }
        @keyframes shake-critical {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          15% { transform: translateX(-8px) rotate(-2deg); }
          30% { transform: translateX(8px) rotate(2deg); }
          45% { transform: translateX(-6px) rotate(-1deg); }
          60% { transform: translateX(6px) rotate(1deg); }
          75% { transform: translateX(-3px) rotate(0deg); }
        }
        @keyframes pulse-icon {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.8; }
        }
        @keyframes flash-icon {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0.3; }
        }
        @keyframes spin-bolt {
          0% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.2); }
          100% { transform: rotate(360deg) scale(1); }
        }
      `}</style>
    </div>
  );
};

export default BatteryWarning;
