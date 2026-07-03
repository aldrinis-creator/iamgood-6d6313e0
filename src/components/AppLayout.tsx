import React, { useState, useEffect } from "react";
import { Settings, WifiOff } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import PwaInstallBanner from "@/components/PwaInstallBanner";
import NavTabs from "@/components/NavTabs";
import SOSButton from "@/components/SOSButton";
import EmergencyModeOverlay from "@/components/EmergencyModeOverlay";
import FallDetectionOverlay from "@/components/FallDetectionOverlay";
import GuardianPingOverlay from "@/components/GuardianPingOverlay";
import UserPingOverlay from "@/components/UserPingOverlay";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import CookieConsent from "@/components/CookieConsent";
import { PRIVACY_POLICY_PDF_URL } from "@/lib/legal";
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
import useActivityHeartbeat from "@/hooks/useActivityHeartbeat";
import { useUserSettings } from "@/hooks/useUserSettings";
import useMorningBriefing from "@/hooks/useMorningBriefing";
import MorningBriefingOverlay from "@/components/MorningBriefingOverlay";
import useGuardianAudio from "@/hooks/useGuardianAudio";
import GuardianMissedAlarmOverlay from "@/components/GuardianMissedAlarmOverlay";

const UserOnlyHooks = () => {
  useCheckInAudio();
  useMedicationAlarms();
  useAppointmentAlarms();
  useExerciseReminder();
  useLocationSync();
  useAbnormalPatternCheck();
  useActivityHeartbeat();
  useMorningBriefing();
  return null;
};

const GuardianOnlyHooks = () => {
  useGuardianAudio();
  return null;
};

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role } = useApp();
  const { loginInProgress } = useAuth();
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

  const { settings } = useUserSettings();
  useEffect(() => {
    if (settings?.largeTextMode) {
      document.documentElement.style.fontSize = '18px';
    } else {
      document.documentElement.style.fontSize = '16px';
    }
  }, [settings?.largeTextMode]);

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <div className="max-w-md mx-auto min-h-screen flex flex-col bg-background shadow-lg relative">
        {role === "user" && !loginInProgress && <UserOnlyHooks />}
        {role === "guardian" && !loginInProgress && <GuardianOnlyHooks />}
        {offline && (
          <div className="bg-warning text-warning-foreground text-xs font-medium px-3 py-1.5 flex items-center justify-center gap-1.5">
            <WifiOff className="w-3.5 h-3.5" /> You're offline — SOS will queue and send when reconnected
          </div>
        )}
        <SOSActiveBar />
        <PwaInstallBanner />
        <AppHeader />
        <main className="flex-1 overflow-y-auto">
          {children}

          {/* Disclaimer Footer */}
          <footer className="px-4 py-6 mt-6 text-center space-y-3 border-t border-border">
            <p className="text-xs text-white font-medium">
              In case of emergency, call your local emergency number immediately.
            </p>
            <div className="text-xs text-white space-y-1">
              <p>© {new Date().getFullYear()} My Health Companion. All rights reserved.</p>
              <p>This app provides general health information only.</p>
              <p>Not a substitute for professional medical advice.</p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <a
                href={PRIVACY_POLICY_PDF_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-white hover:text-white/80 transition-colors underline"
              >
                Privacy Policy
              </a>
              <span className="text-white">·</span>
              <Link
                to="/terms-of-service"
                className="text-xs text-white hover:text-white/80 transition-colors underline"
              >
                Terms of Service
              </Link>
              <span className="text-white">·</span>
              <span className="text-xs text-white font-mono">v1.1.0</span>
              <span className="text-white">·</span>
              <button
                onClick={() => setShowCookieSettings(true)}
                className="inline-flex items-center gap-1.5 text-xs text-white hover:text-white/80 transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
                Cookie Settings
              </button>
            </div>
          </footer>
        </main>
        <NavTabs />
        {role === "user" && <SOSButton />}
        {!loginInProgress && <EmergencyModeOverlay />}
        {role === "user" && !loginInProgress && <FallDetectionOverlay />}
        {role === "user" && !loginInProgress && <BatteryWarning />}
        {!loginInProgress && <CookieConsent forceShow={showCookieSettings} onClose={() => setShowCookieSettings(false)} />}
        {!loginInProgress && <ReminderOverlay />}
        {role === "user" && !loginInProgress && <MorningBriefingOverlay />}
        {role === "user" && !loginInProgress && <GuardianPingOverlay />}
        {role === "guardian" && !loginInProgress && <UserPingOverlay />}
        {role === "guardian" && !loginInProgress && <GuardianMissedAlarmOverlay />}
      </div>
    </div>
  );
};

export default AppLayout;
