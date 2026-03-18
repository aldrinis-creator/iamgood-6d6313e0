import React, { createContext, useContext, useState, useCallback } from "react";

export type UserRole = "user" | "guardian";

interface AppState {
  role: UserRole;
  setRole: (role: UserRole) => void;
  isLoggedIn: boolean;
  setIsLoggedIn: (v: boolean) => void;
  emergencyMode: boolean;
  triggerSOS: () => void;
  cancelSOS: () => void;
  userName: string;
  setUserName: (name: string) => void;
}

const AppContext = createContext<AppState | null>(null);

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be inside AppProvider");
  return ctx;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<UserRole>("user");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [userName, setUserName] = useState("Arjun");

  const triggerSOS = useCallback(() => setEmergencyMode(true), []);
  const cancelSOS = useCallback(() => setEmergencyMode(false), []);

  return (
    <AppContext.Provider value={{ role, setRole, isLoggedIn, setIsLoggedIn, emergencyMode, triggerSOS, cancelSOS, userName, setUserName }}>
      {children}
    </AppContext.Provider>
  );
};
