import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const useRefillDue = (): boolean => {
  const { session } = useAuth();
  const [refillDue, setRefillDue] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) return;

    const check = async () => {
      const { data } = await supabase
        .from("medications")
        .select("id, remaining_quantity, low_stock_threshold")
        .eq("user_id", session.user.id);
      if (data) {
        setRefillDue(data.some((m: any) => m.remaining_quantity <= m.low_stock_threshold));
      }
    };

    check();

    const channel = supabase
      .channel("refill-due-watch")
      .on("postgres_changes", { event: "*", schema: "public", table: "medications" }, () => check())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id]);

  return refillDue;
};

export default useRefillDue;
