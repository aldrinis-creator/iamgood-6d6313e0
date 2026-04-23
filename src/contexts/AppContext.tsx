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
  loginInProgress: boolean;
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
  const { session, profile, loginInProgress } = useAuth();
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [activeSosId, setActiveSosId] = useState<string | null>(null);
  const [roleOverride, setRoleOverride] = useState<UserRole | null>(null);
  const [pauseMode, setPauseMode] = useState<PauseMode>("active");
  const invokedSosIdsRef = React.useRef<Set<string>>(new Set());

  const isLoggedIn = !!session;
  const userName = profile?.full_name || "User";
  const role: UserRole = roleOverride ?? ((profile?.role === "guardian" ? "guardian" : "user") as UserRole);

  const setRole = useCallback((r: UserRole) => setRoleOverride(r), []);

  const invokeSosAlertOnce = useCallback(async (sosId: string) => {
    if (invokedSosIdsRef.current.has(sosId)) {
      console.log("[triggerSOS] skipping duplicate invoke for sosId:", sosId);
      return { skipped: true } as any;
    }
    invokedSosIdsRef.current.add(sosId);
    if (!session?.user?.id) return { error: "no-session" } as any;
    try {
      const currentUserName = profile?.full_name || "User";
      const { data: guardianRows } = await supabase
        .from("guardians")
        .select("guardian_email, guardian_phone")
        .eq("user_id", session.user.id)
        .eq("status", "accepted");

      const guardian_emails = (guardianRows ?? []).map((g: any) => g.guardian_email).filter(Boolean);
      const guardian_phones = (guardianRows ?? []).map((g: any) => g.guardian_phone).filter(Boolean);

      console.log("[triggerSOS] invoking send-sos-alert", {
        sosId,
        acceptedGuardians: guardianRows?.length ?? 0,
        phones: guardian_phones.length,
        emails: guardian_emails.length,
      });

      const { data, error } = await supabase.functions.invoke("send-sos-alert", {
        body: {
          user_id: session.user.id,
          message: `🚨 SOS ALERT from ${currentUserName} — immediate attention needed.`,
          guardian_emails,
          guardian_phones,
          user_name: currentUserName,
        },
      });

      if (error) {
        console.error("[triggerSOS] send-sos-alert invoke error:", error);
        toast.error(`SOS backend error: ${error.message || "invoke failed"}`);
        return { error };
      }

      console.log("[triggerSOS] send-sos-alert response:", data);

      const recipientCount = (data as any)?.recipientCount ?? 0;
      const whatsappQueued = (data as any)?.whatsappQueued ?? 0;
      const smsQueued = (data as any)?.smsQueued ?? 0;

      if (recipientCount === 0) {
        toast.error("SOS sent, but no accepted guardians have valid phone numbers.");
      } else if (whatsappQueued === 0 && smsQueued === 0) {
        const errs = (data as any)?.errors || {};
        toast.error(`SOS delivery failed. WhatsApp: ${errs.whatsapp || "n/a"} | SMS: ${errs.sms || "n/a"}`);
      }

      return { data };
    } catch (e: any) {
      console.error("[triggerSOS] Failed to invoke send-sos-alert:", e);
      toast.error(`SOS invoke failed: ${e?.message || String(e)}`);
      return { error: e };
    }
  }, [session?.user?.id, profile?.full_name]);

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

    const sosPayload = {
      user_id: session.user.id,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
      trigger_type: "manual",
      status: "active",
    };

    try {
      const { data, error } = await supabase
        .from("sos_events")
        .insert(sosPayload)
        .select("id")
        .single();

      if (error) {
        throw error;
      } else if (data) {
        setActiveSosId(data.id);
        // Await invoke so we surface backend errors instead of silently failing.
        await invokeSosAlertOnce(data.id);
      }
    } catch (err) {
      console.error("Failed to create SOS event (may be offline):", err);
      // Queue for offline sync
      try {
        const { queueSOS } = await import("@/lib/offlineQueue");
        await queueSOS(sosPayload);
        toast.warning("You're offline — SOS queued and will send when reconnected");
        // Register background sync
        if ("serviceWorker" in navigator && "SyncManager" in window) {
          const reg = await navigator.serviceWorker.ready;
          await (reg as any).sync.register("sos-sync");
        }
      } catch (queueErr) {
        console.error("Failed to queue SOS:", queueErr);
        toast.error("Failed to record SOS event");
      }
    }
  }, [session?.user?.id, invokeSosAlertOnce]);

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

    // Notify guardians that user is safe
    if (session?.user?.id) {
      const currentUserName = profile?.full_name || "User";

      // Get guardians
      const { data: guardianRows } = await supabase
        .from("guardians")
        .select("id, guardian_email")
        .eq("user_id", session.user.id);

      if (guardianRows?.length) {
        // Insert "all clear" notifications
        const notifRows = guardianRows.map((g: any) => ({
          user_id: session.user.id,
          guardian_id: g.id,
          title: "✅ SOS Resolved",
          message: `${currentUserName} has marked themselves as safe. The SOS alert has been cancelled.`,
          type: "sos_resolved",
        }));
        await supabase.rpc("insert_notifications_deduped", { p_notifications: notifRows });

        // Send "all clear" via edge function (email/push/WhatsApp)
        const guardianEmails = guardianRows.map((g: any) => g.guardian_email).filter(Boolean);
        supabase.functions.invoke("send-sos-alert", {
          body: {
            user_id: session.user.id,
            message: `✅ ALL CLEAR — ${currentUserName} has confirmed they are safe. The SOS alert has been cancelled.`,
            guardian_emails: guardianEmails,
            user_name: currentUserName,
          },
        }).catch((e) => console.error("Failed to send all-clear:", e));
      }
    }
  }, [activeSosId, session, profile]);

  return (
    <AppContext.Provider value={{ role, setRole, isLoggedIn, loginInProgress, emergencyMode, activeSosId, triggerSOS, cancelSOS, userName, pauseMode, setPauseMode }}>
      {children}
    </AppContext.Provider>
  );
};
