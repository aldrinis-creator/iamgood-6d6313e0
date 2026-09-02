import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Dual-role support: a person can hold `profiles.role = 'user'` for their own
 * safety account AND separately be linked as a Guardian for one or more wards.
 * This hook answers "is this signed-in account linked as a guardian anywhere?"
 * without touching the meaning of `profiles.role`.
 *
 * Cached by react-query so route guards / header don't re-query on every render.
 */
export function useGuardianLink() {
  const { session } = useAuth();
  const userId = session?.user?.id;

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

  return {
    isGuardianLinked: query.data === true,
    loading: !!userId && query.isLoading,
  };
}

export default useGuardianLink;
