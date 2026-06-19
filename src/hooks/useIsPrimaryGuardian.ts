import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Returns whether the currently-signed-in user is the accepted Primary Guardian
 * of the given ward. `loading` is true until the check resolves.
 */
export function useIsPrimaryGuardian(wardUserId?: string | null) {
  const { session } = useAuth();
  const [isPrimary, setIsPrimary] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const guardianUserId = session?.user?.id;
    if (!guardianUserId || !wardUserId) {
      setIsPrimary(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("guardians")
      .select("id")
      .eq("guardian_user_id", guardianUserId)
      .eq("user_id", wardUserId)
      .eq("is_primary", true)
      .eq("status", "accepted")
      .limit(1)
      .then(({ data }) => {
        if (cancelled) return;
        setIsPrimary(!!(data && data.length));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [session?.user?.id, wardUserId]);

  return { isPrimary, loading };
}
