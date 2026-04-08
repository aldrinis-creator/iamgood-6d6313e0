import React, { useState, useEffect } from "react";
import { Settings, WifiOff } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import PwaInstallBanner from "@/components/PwaInstallBanner";
import NavTabs from "@/components/NavTabs";
import SOSButton from "@/components/SOSButton";
import EmergencyModeOverlay from "@/components/EmergencyModeOverlay";
import FallDetectionOverlay from "@/components/FallDetectionOverlay";
import GuardianPingOverlay from "@/components/GuardianPingOverlay";
import { useApp } from "@/contexts/AppContext";
import { Link } from "react-router-dom";
import CookieConsent from "@/components/CookieConsent";
import BatteryWarning from "@/components/BatteryWarning";
import useCheckInAudio from "@/hooks/useCheckInAudio";
import useMedicationAlarms from "@/hooks/useMedicationAlarms";
import useAppointmentAlarms from "@/hooks/useAppointmentAlarms";
import useExerciseReminder from "@/hooks/useExerciseReminder";
import useAutoSleepMode from "@/hooks/useAutoSleepMode";
import ReminderOverlay from "@/components/ReminderOverlay";
import useLocationSync from "@/hooks/useLocationSync";
import SOSActiveBar from "@/components/SOSActiveBar";
import useAbnormalPatternCheck from "@/hooks/useAbnormalPatternCheck";

const UserOnlyHooks = () => {
  useCheckInAudio();
  useMedicationAlarms();
  useAppointmentAlarms();
  useExerciseReminder();
  useLocationSync();
  useAbnormalPatternCheck();
  return null;
};

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role } = useApp();
  const [showCookieSettings, setShowCookieSettings] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  useAutoSleepMode();

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto min-h-screen flex flex-col bg-background shadow-lg">
        {role === "user" && <UserOnlyHooks />}
        {offline && (
          <div className="bg-warning text-warning-foreground text-xs font-medium px-3 py-1.5 flex items-center justify-center gap-1.5">
            <WifiOff className="w-3.5 h-3.5" /> You're offline — SOS will queue and send when reconnected
          </div>
        )}
        <SOSActiveBar />
        <PwaInstallBanner />
        <AppHeader />
        <main className="flex-1 overflow-y-auto pb-24">
          {children}

          {/* Disclaimer Footer */}
          <footer className="px-4 py-6 mt-6 text-center space-y-3 border-t border-border">
            <p className="text-xs text-muted-foreground font-medium">
              In case of emergency, call your local emergency number immediately.
            </p>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>© {new Date().getFullYear()} My Health Companion. All rights reserved.</p>
              <p>This app provides general health information only.</p>
              <p>Not a substitute for professional medical advice.</p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <Link
                to="/privacy-policy"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
              >
                Privacy Policy
              </Link>
              <span className="text-muted-foreground">·</span>
              <Link
                to="/terms-of-service"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
              >
                Terms of Service
              </Link>
              <span className="text-muted-foreground">·</span>
              <button
                onClick={() => setShowCookieSettings(true)}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
                Cookie Settings
              </button>
            </div>
          </footer>
        </main>
        <NavTabs />
        {role === "user" && <SOSButton />}
        <EmergencyModeOverlay />
        {role === "user" && <FallDetectionOverlay />}
        <BatteryWarning />
        <CookieConsent forceShow={showCookieSettings} onClose={() => setShowCookieSettings(false)} />
        <ReminderOverlay />
        {role === "user" && <GuardianPingOverlay />}
      </div>
    </div>
  );
};

export default AppLayout;
