import React, { createContext, useContext, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type UserRole = "user" | "guardian";
export type PauseMode = "active" | "sleep" | "checked-out";

interface AppState {
  role: UserRole;
  setRole: (role: UserRole) => void;
  isLoggedIn: boolean;
  emergencyMode: boolean;
  activeSosId: string | null;
  triggerSOS: () => void;
  cancelSOS: () => void;
  userName: string;
  pauseMode: PauseMode;
  setPauseMode: (mode: PauseMode) => void;
}

const AppContext = createContext<AppState | null>(null);

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be inside AppProvider");
  return ctx;
};

const getCurrentPosition = (): Promise<{ latitude: number; longitude: number } | null> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 5000 }
    );
  });
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, profile } = useAuth();
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [activeSosId, setActiveSosId] = useState<string | null>(null);
  const [roleOverride, setRoleOverride] = useState<UserRole | null>(null);
  const [pauseMode, setPauseMode] = useState<PauseMode>("active");

  const isLoggedIn = !!session;
  const userName = profile?.full_name || "User";
  const role: UserRole = roleOverride ?? ((profile?.role === "guardian" ? "guardian" : "user") as UserRole);

  const setRole = useCallback((r: UserRole) => setRoleOverride(r), []);

  const triggerSOS = useCallback(async () => {
    setEmergencyMode(true);

    if (!session?.user?.id) {
      toast.error("You must be logged in to trigger SOS");
      return;
    }

    const coords = await getCurrentPosition();
    if (!coords) {
      toast.warning("Location unavailable — SOS sent without coordinates");
    }

    const { data, error } = await supabase
      .from("sos_events")
      .insert({
        user_id: session.user.id,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        trigger_type: "manual",
        status: "active",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to create SOS event:", error);
      toast.error("Failed to record SOS event");
    } else if (data) {
      setActiveSosId(data.id);
    }
  }, [session]);

  const cancelSOS = useCallback(async () => {
    setEmergencyMode(false);

    if (activeSosId) {
      const { error } = await supabase
        .from("sos_events")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
        .eq("id", activeSosId);

      if (error) {
        console.error("Failed to cancel SOS event:", error);
      }
      setActiveSosId(null);
    }
  }, [activeSosId]);

  return (
    <AppContext.Provider value={{ role, setRole, isLoggedIn, emergencyMode, activeSosId, triggerSOS, cancelSOS, userName, pauseMode, setPauseMode }}>
      {children}
    </AppContext.Provider>
  );
};
