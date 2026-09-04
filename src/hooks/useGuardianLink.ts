import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Dual-role support: a person can hold `profiles.role = 'user'` for their own
 * safety account AND separately be linked as a Guardian for one or more wards.
 * This hook answers "is this signed-in account linked as a guardian anywhere?"
 * without touching the meaning of `profiles.role`.
 *
 * Self-healing: if the account is NOT linked yet, we call the trusted
 * `link_guardian_user_id()` RPC (same call Register.tsx makes) once per session
 * per user, then refetch. This rescues guardians stuck in the
 * `status = 'accepted'` but `guardian_user_id IS NULL` state without a manual
 * database fix.
 *
 * Cached by react-query so route guards / header don't re-query on every render.
 */
export function useGuardianLink() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const healAttempted = useRef<string | null>(null);

  const query = useQuery({
    queryKey: ["guardian-link", userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guardians")
        .select("id")
        .eq("guardian_user_id", userId!)
        .limit(1);
      if (error) throw error;
      return !!(data && data.length > 0);
    },
  });

  useEffect(() => {
    if (!userId) return;
    if (query.isLoading || query.data !== false) return;
    // Only one repair attempt per user per app load — never on every render.
    if (healAttempted.current === userId) return;
    healAttempted.current = userId;

    (async () => {
      try {
        await supabase.rpc("link_guardian_user_id");
        await query.refetch();
      } catch (e) {
        console.warn("guardian self-link attempt failed", e);
      }
    })();
  }, [userId, query.isLoading, query.data, query]);

  return {
    isGuardianLinked: query.data === true,
    loading: !!userId && query.isLoading,
  };
}

export default useGuardianLink;
