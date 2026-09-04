import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useApp } from "@/contexts/AppContext";
import SOSDialog from "@/components/SOSDialog";

interface GuardianRow {
  id: string;
  guardian_name: string | null;
  guardian_phone: string | null;
  is_primary: boolean | null;
}

const normalizePhone = (raw: string) => {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (raw.startsWith("+")) return raw;
  return `+${digits}`;
};

/**
 * "I NEED HELP" — places a call to the primary guardian AND fires a real SOS.
 * Call logic mirrors CallGuardianButton (logCall + notify-guardian-call).
 */
const NeedHelpButton = () => {
  const { session } = useAuth();
  const { role, userName } = useApp();
  const [guardians, setGuardians] = useState<GuardianRow[]>([]);
  const [sosOpen, setSosOpen] = useState(false);

  useEffect(() => {
    if (role !== "user" || !session?.user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("guardians")
        .select("id, guardian_name, guardian_phone, is_primary")
        .eq("user_id", session.user.id)
        .eq("status", "accepted")
        .order("is_primary", { ascending: false });
      setGuardians((data || []) as GuardianRow[]);
    })();
  }, [role, session?.user?.id]);

  const primary =
    guardians.find((g) => g.is_primary && g.guardian_phone) ||
    guardians.find((g) => !!g.guardian_phone) ||
    null;

  const logCall = useCallback(
    (g: GuardianRow) => {
      try {
        supabase.from("activity_logs").insert({
          user_id: session?.user?.id,
          type: "guardian_call",
          description: `${userName || "Ward"} called ${g.guardian_name || "guardian"}`,
        } as any);
      } catch {}
      try {
        supabase.functions.invoke("notify-guardian-call", { body: { guardian_id: g.id } });
      } catch {}
    },
    [session?.user?.id, userName]
  );

  const placeMobileCall = useCallback(
    async (g: GuardianRow) => {
      if (!g.guardian_phone) return;
      const tel = normalizePhone(g.guardian_phone);
      logCall(g);

      try {
        const { Capacitor } = await import("@capacitor/core");
        if (Capacitor?.isNativePlatform?.()) {
          window.open(`tel:${tel}`, "_system");
          return;
        }
      } catch {}

      const a = document.createElement("a");
      a.href = `tel:${tel}`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    },
    [logCall]
  );

  const handleHelp = () => {
    setSosOpen(true);
    if (primary) {
      placeMobileCall(primary);
    }
  };

  return (
    <>
      <button
        onClick={handleHelp}
        className="w-full rounded-2xl bg-sos text-sos-foreground py-6 px-5 flex items-center justify-center gap-3 shadow-lg active:scale-[0.98] transition-transform"
        aria-label="I need help"
      >
        <AlertTriangle className="w-8 h-8" />
        <span className="text-2xl font-extrabold tracking-wide">I NEED HELP</span>
      </button>
      <SOSDialog open={sosOpen} onClose={() => setSosOpen(false)} />
    </>
  );
};

export default NeedHelpButton;
