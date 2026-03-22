import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCallback, useRef } from "react";

export interface ActivityGoals {
  steps: number;
  heart_rate: number;
  distance_km: number;
  cadence: number;
  calories: number;
  active_minutes: number;
  breaths_per_min: number;
  floors_climbed: number;
  spo2: number;
}

export const DEFAULT_ACTIVITY_GOALS: ActivityGoals = {
  steps: 10000,
  heart_rate: 80,
  distance_km: 5,
  cadence: 160,
  calories: 500,
  active_minutes: 120,
  breaths_per_min: 16,
  floors_climbed: 10,
  spo2: 98,
};

export type PauseMode = "active" | "sleep" | "checked-out";

export interface UserSettings {
  // Alerts
  audioAlerts: boolean;
  voiceReminders: boolean;
  vibration: boolean;
  checkInPush: boolean;
  medPush: boolean;
  guardianPush: boolean;
  weeklyReport: boolean;
  // Check-In
  sleepMode: boolean;
  pauseMode: PauseMode;
  expectedReturn: string | null;
  nudgeFrequency: string;
  fallDetection: boolean;
  fallSensitivity: string;
  // Appointments
  preAlert: string;
  // Privacy
  shareLocation: boolean;
  shareHealthData: boolean;
  // Activity Goals
  activityGoals: ActivityGoals;
}

const DEFAULTS: UserSettings = {
  audioAlerts: true,
  voiceReminders: true,
  vibration: true,
  checkInPush: true,
  medPush: true,
  activityGoals: DEFAULT_ACTIVITY_GOALS,
  guardianPush: true,
  weeklyReport: true,
  sleepMode: true,
  pauseMode: "active",
  expectedReturn: null,
  nudgeFrequency: "4",
  fallDetection: true,
  fallSensitivity: "medium",
  preAlert: "15min",
  shareLocation: true,
  shareHealthData: true,
};

export function useUserSettings() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const userId = session?.user?.id;

  const { data: settings = DEFAULTS, isLoading } = useQuery({
    queryKey: ["user_settings", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_settings" as any)
        .select("settings")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return DEFAULTS;
      return { ...DEFAULTS, ...(data as any).settings } as UserSettings;
    },
    enabled: !!userId,
  });

  const mutation = useMutation({
    mutationFn: async (newSettings: UserSettings) => {
      const { error } = await supabase
        .from("user_settings" as any)
        .upsert(
          { user_id: userId!, settings: newSettings as any, updated_at: new Date().toISOString() } as any,
          { onConflict: "user_id" }
        );
      if (error) throw error;
    },
  });

  const updateSetting = useCallback(
    <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
      const current = queryClient.getQueryData<UserSettings>(["user_settings", userId]) ?? DEFAULTS;
      const updated = { ...current, [key]: value };
      // Optimistic update
      queryClient.setQueryData(["user_settings", userId], updated);
      // Debounce the DB write
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => mutation.mutate(updated), 500);
    },
    [userId, queryClient, mutation]
  );

  return { settings, isLoading, updateSetting };
}
