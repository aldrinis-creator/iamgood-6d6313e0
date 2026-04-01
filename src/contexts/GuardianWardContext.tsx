import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Ward {
  userId: string;
  name: string;
}

interface GuardianWardContextType {
  wards: Ward[];
  selectedWard: Ward | null;
  setSelectedWard: (ward: Ward) => void;
  loading: boolean;
}

const GuardianWardContext = createContext<GuardianWardContextType | null>(null);

export const useGuardianWard = () => {
  const ctx = useContext(GuardianWardContext);
  if (!ctx) throw new Error("useGuardianWard must be used within GuardianWardProvider");
  return ctx;
};

const STORAGE_KEY = "checkin_selected_ward";

export const GuardianWardProvider = ({ children }: { children: ReactNode }) => {
  const { session } = useAuth();
  const [wards, setWards] = useState<Ward[]>([]);
  const [selectedWard, setSelectedWardState] = useState<Ward | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWards = useCallback(async () => {
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("guardians")
      .select("user_id")
      .eq("guardian_user_id", session.user.id)
      .eq("status", "accepted");

    if (!data || data.length === 0) {
      setWards([]);
      setSelectedWardState(null);
      setLoading(false);
      return;
    }

    // Fetch profile names for each ward
    const userIds = data.map((g) => g.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    const wardList: Ward[] = userIds.map((uid) => {
      const profile = profiles?.find((p) => p.id === uid);
      return { userId: uid, name: profile?.full_name || "User" };
    });

    setWards(wardList);

    // Restore last selected from localStorage
    const savedId = localStorage.getItem(STORAGE_KEY);
    const saved = wardList.find((w) => w.userId === savedId);
    setSelectedWardState(saved || wardList[0]);
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => {
    fetchWards();
  }, [fetchWards]);

  const setSelectedWard = (ward: Ward) => {
    setSelectedWardState(ward);
    localStorage.setItem(STORAGE_KEY, ward.userId);
  };

  return (
    <GuardianWardContext.Provider value={{ wards, selectedWard, setSelectedWard, loading }}>
      {children}
    </GuardianWardContext.Provider>
  );
};
