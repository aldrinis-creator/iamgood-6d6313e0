import { startQuietPeriod, setQuietUser, QUIET_PERIOD_MS } from "@/lib/popupQueue";
import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { flushPendingSettings } from "@/hooks/useUserSettings";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type AuthMetadata = Record<string, unknown>;

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  loginInProgress: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, metadata?: AuthMetadata) => Promise<{ error: Error | null; data: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginInProgress, setLoginInProgress] = useState(false);
  const lastFetchedUserIdRef = useRef<string | null>(null);

  const fetchProfile = async (userId: string) => {
    if (lastFetchedUserIdRef.current === userId) return;
    lastFetchedUserIdRef.current = userId;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (error) {
      lastFetchedUserIdRef.current = null;
    }
    setProfile(data);
  };

  const refreshProfile = async () => {
    if (user) {
      lastFetchedUserIdRef.current = null;
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    let profileFetchedByListener = false;

    // Set up auth listener BEFORE getSession
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Track the quiet period per user (null when signed out).
        setQuietUser(session?.user?.id ?? null);
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // Anchor the 15 minutes on the real sign-in time (fall back to account creation for sign-ups).
          const signedInAt =
            (session.user.last_sign_in_at ? Date.parse(session.user.last_sign_in_at) : 0) ||
            (session.user.created_at ? Date.parse(session.user.created_at) : 0);
          const key = `quiet_started_${session.user.id}_${signedInAt}`;
          const isEntryEvent = event === "SIGNED_IN" || event === "INITIAL_SESSION";
          // Any sign-in still inside its 15-minute window counts, so a slow device/network
          // can't skip the quiet period. The key stops reloads/tab refocus from restarting it.
          if (
            isEntryEvent &&
            signedInAt > 0 &&
            Date.now() - signedInAt < QUIET_PERIOD_MS &&
            !localStorage.getItem(key)
          ) {
            localStorage.setItem(key, "1");
            startQuietPeriod(session.user.id, signedInAt);
          }
          profileFetchedByListener = true;
          setLoginInProgress(true);
          // Use setTimeout to avoid Supabase deadlock
          setTimeout(async () => {
            await fetchProfile(session.user.id);
            // Auto-link guardian records by email/phone
            try { await supabase.rpc("link_guardian_user_id" as any); } catch {};
            // Send welcome email once per account (guarded by profiles.welcome_sent_at)
            if (session.user.email) {
              const profileData = await supabase
                .from("profiles")
                .select("full_name, phone, welcome_sent_at")
                .eq("id", session.user.id)
                .single();
              if (!profileData.data?.welcome_sent_at) {
                // Claim the send slot atomically to prevent double-fire across devices/tabs
                const { data: claimed } = await supabase
                  .from("profiles")
                  .update({ welcome_sent_at: new Date().toISOString() })
                  .eq("id", session.user.id)
                  .is("welcome_sent_at", null)
                  .select("id")
                  .maybeSingle();
                if (claimed) {
                  const { data: guardianData } = await supabase
                    .from("guardians")
                    .select("guardian_name, guardian_phone")
                    .eq("user_id", session.user.id)
                    .eq("is_primary", true)
                    .maybeSingle();
                  const primaryGuardian = guardianData
                    ? `${guardianData.guardian_name} (${guardianData.guardian_phone})`
                    : "None nominated yet";
                  const isPhoneOnly = session.user.email?.endsWith("@phone.checkin.app");
                  supabase.functions.invoke("send-transactional-email", {
                    body: {
                      templateName: "welcome",
                      recipientEmail: session.user.email,
                      idempotencyKey: `welcome-${session.user.id}`,
                      templateData: {
                        name: profileData.data?.full_name || "",
                        phone: profileData.data?.phone || "",
                        primaryGuardian,
                        ...(isPhoneOnly ? { setPasswordUrl: `${window.location.origin}/reset-password` } : {}),
                      },
                    },
                  }).catch(() => {});
                }
              }
            }
            setLoginInProgress(false);
            // Request notification permission after login completes
            if ("Notification" in window && Notification.permission === "default") {
              Notification.requestPermission();
            }
          }, 0);
        } else {
          setProfile(null);
          lastFetchedUserIdRef.current = null;
          setLoginInProgress(false);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setQuietUser(session?.user?.id ?? null);
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user && !profileFetchedByListener) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    // Flush pending settings on abrupt tab close
    const handleUnload = () => flushPendingSettings();
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoginInProgress(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setLoginInProgress(false);
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, metadata?: AuthMetadata) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: window.location.origin,
      },
    });
    return { data, error: error as Error | null };
  };

  const signOut = async () => {
    flushPendingSettings();
    sessionStorage.removeItem("admin_step_up_token");
    await supabase.auth.signOut();
    setProfile(null);
    lastFetchedUserIdRef.current = null;
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error as Error | null };
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, loginInProgress, signIn, signUp, signOut, resetPassword, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
