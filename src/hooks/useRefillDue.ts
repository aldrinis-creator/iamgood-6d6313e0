import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Returns true when at least one medication is at/below its low-stock threshold.
 * Pass a userId to check a ward's medications (guardian view); defaults to the
 * signed-in user.
 */
const useRefillDue = (userId?: string): boolean => {
  const { session } = useAuth();
  const targetId = userId ?? session?.user?.id;
  const [refillDue, setRefillDue] = useState(false);

  useEffect(() => {
    if (!targetId) return;

    const check = async () => {
      const { data } = await supabase
        .from("medications")
        .select("id, remaining_quantity, low_stock_threshold")
        .eq("user_id", targetId);
      if (data) {
        setRefillDue(data.some((m: any) => m.remaining_quantity <= m.low_stock_threshold));
      }
    };

    check();

    const channel = supabase.channel(`refill-due-watch-${targetId}-${Math.random().toString(36).slice(2)}`);
    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "medications", filter: `user_id=eq.${targetId}` }, () => check())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [targetId]);

  return refillDue;
};

export default useRefillDue;
