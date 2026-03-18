import React from "react";
import AppHeader from "@/components/AppHeader";
import NavTabs from "@/components/NavTabs";
import SOSButton from "@/components/SOSButton";
import EmergencyModeOverlay from "@/components/EmergencyModeOverlay";
import { useApp } from "@/contexts/AppContext";

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role } = useApp();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto min-h-screen flex flex-col bg-background shadow-lg">
        <AppHeader />
        <main className="flex-1 overflow-y-auto pb-24">
          {children}
        </main>
        <NavTabs />
        {role === "user" && <SOSButton />}
        <EmergencyModeOverlay />
      </div>
    </div>
  );
};

export default AppLayout;
