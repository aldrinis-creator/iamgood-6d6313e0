import React, { useState } from "react";
import { Settings } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import NavTabs from "@/components/NavTabs";
import SOSButton from "@/components/SOSButton";
import EmergencyModeOverlay from "@/components/EmergencyModeOverlay";
import { useApp } from "@/contexts/AppContext";
import { Link } from "react-router-dom";
import CookieConsent from "@/components/CookieConsent";

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role } = useApp();
  const [showCookieSettings, setShowCookieSettings] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto min-h-screen flex flex-col bg-background shadow-lg">
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
            <button
              onClick={() => setShowCookieSettings(true)}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              Cookie Settings
            </button>
          </footer>
        </main>
        <NavTabs />
        {role === "user" && <SOSButton />}
        <EmergencyModeOverlay />
        <CookieConsent forceShow={showCookieSettings} onClose={() => setShowCookieSettings(false)} />
      </div>
    </div>
  );
};

export default AppLayout;
