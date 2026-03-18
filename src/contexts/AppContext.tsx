import React, { createContext, useContext, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

export type UserRole = "user" | "guardian";

interface AppState {
  role: UserRole;
  setRole: (role: UserRole) => void;
  isLoggedIn: boolean;
  emergencyMode: boolean;
  triggerSOS: () => void;
  cancelSOS: () => void;
  userName: string;
}

const AppContext = createContext<AppState | null>(null);

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be inside AppProvider");
  return ctx;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, profile } = useAuth();
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [roleOverride, setRoleOverride] = useState<UserRole | null>(null);

  const isLoggedIn = !!session;
  const userName = profile?.full_name || "User";
  const role: UserRole = roleOverride ?? ((profile?.role === "guardian" ? "guardian" : "user") as UserRole);

  const setRole = useCallback((r: UserRole) => setRoleOverride(r), []);
  const triggerSOS = useCallback(() => setEmergencyMode(true), []);
  const cancelSOS = useCallback(() => setEmergencyMode(false), []);

  return (
    <AppContext.Provider value={{ role, setRole, isLoggedIn, emergencyMode, triggerSOS, cancelSOS, userName }}>
      {children}
    </AppContext.Provider>
  );
};
