import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isToday, parseISO } from "date-fns";

export const useTodayAppointments = () => {
  const { session } = useAuth();

  const { data: count = 0 } = useQuery({
    queryKey: ["appointments-today-count", session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("start_date");
      if (error) throw error;
      return data.filter((a) => isToday(parseISO(a.start_date))).length;
    },
    enabled: !!session?.user?.id,
    refetchInterval: 60000,
  });

  return count;
};
