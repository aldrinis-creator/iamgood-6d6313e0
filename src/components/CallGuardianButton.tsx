import { useCallback, useEffect, useRef, useState } from "react";
import { Phone, Loader2, UserPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useApp } from "@/contexts/AppContext";
import { useNavigate } from "react-router-dom";

interface GuardianRow {
  id: string;
  guardian_name: string | null;
  guardian_phone: string | null;
  is_primary: boolean | null;
}

interface Props {
  /** Render as a compact bottom-nav icon (no card) */
  variant?: "card" | "navIcon";
}

const normalizePhone = (raw: string) => {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (raw.startsWith("+")) return raw;
  return `+${digits}`;
};

const CallGuardianButton = ({ variant = "card" }: Props) => {
  const { session } = useAuth();
  const { role, userName } = useApp();
  const navigate = useNavigate();
  const [guardians, setGuardians] = useState<GuardianRow[]>([]);
  const [loading, setLoading] = useState(true);
  const longPressTimer = useRef<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (role !== "user" || !session?.user?.id) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("guardians")
        .select("id, guardian_name, guardian_phone, is_primary")
        .eq("user_id", session.user.id)
        .eq("status", "accepted")
        .order("is_primary", { ascending: false });
      setGuardians((data || []) as GuardianRow[]);
      setLoading(false);
    })();
  }, [role, session?.user?.id]);

  const primary =
    guardians.find((g) => g.is_primary && g.guardian_phone) ||
    guardians.find((g) => !!g.guardian_phone) ||
    null;

  const placeCall = useCallback(
    async (g: GuardianRow) => {
      if (!g.guardian_phone) return;
      const tel = normalizePhone(g.guardian_phone);
      // Fire-and-forget activity log + push notify
      try {
        supabase.from("activity_logs").insert({
          user_id: session?.user?.id,
          type: "guardian_call",
          description: `${userName || "Ward"} called ${g.guardian_name || "guardian"}`,
        } as any);
      } catch {}
      try {
        supabase.functions.invoke("notify-guardian-call", {
          body: { guardian_id: g.id },
        });
      } catch {}
      // Direct dial — use a synthesized anchor click so the native dialer
      // launches without an intermediate in-app confirmation step.
      const a = document.createElement("a");
      a.href = `tel:${tel}`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    },
    [session?.user?.id, userName]
  );

  const handlePointerDown = () => {
    if (guardians.length <= 1) return;
    longPressTimer.current = window.setTimeout(() => {
      setMenuOpen(true);
    }, 550);
  };
  const handlePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  if (role !== "user") return null;
  if (loading) return null;

  // No guardian → soft hint
  if (!primary) {
    if (variant === "navIcon") {
      return (
        <button
          onClick={() => navigate("/settings")}
          className="flex-1 flex flex-col items-center py-2 px-1 text-xs text-muted-foreground"
          aria-label="Add a guardian"
        >
          <UserPlus className="w-5 h-5 mb-1" />
          Call
        </button>
      );
    }
    return (
      <Card className="border-dashed">
        <CardContent className="p-3 flex items-center gap-3">
          <UserPlus className="w-5 h-5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground flex-1">
            Add a guardian to enable one-tap calling.
          </p>
          <Button size="sm" variant="outline" onClick={() => navigate("/settings")}>
            Add
          </Button>
        </CardContent>
      </Card>
    );
  }

  const label = primary.guardian_name?.split(" ")[0] || "Guardian";

  const triggerEl =
    variant === "navIcon" ? (
      <button
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClick={() => placeCall(primary)}
        className="flex-1 flex flex-col items-center py-2 px-1 text-xs text-success"
        aria-label={`Call ${label}`}
      >
        <Phone className="w-5 h-5 mb-1" />
        Call
      </button>
    ) : (
      <button
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClick={() => placeCall(primary)}
        className="w-full rounded-2xl bg-success text-success-foreground py-4 px-5 flex items-center justify-center gap-3 shadow-md active:scale-[0.98] transition-transform"
        aria-label={`Call ${label}`}
      >
        <Phone className="w-6 h-6" />
        <span className="text-base font-semibold">Call {label}</span>
      </button>
    );

  // If only one guardian, no dropdown needed
  if (guardians.length <= 1) return triggerEl;

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>{triggerEl}</DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-56">
        <div className="px-2 py-1 text-[10px] text-muted-foreground uppercase tracking-wide">
          Choose guardian
        </div>
        {guardians.map((g) =>
          g.guardian_phone ? (
            <DropdownMenuItem
              key={g.id}
              onClick={() => {
                setMenuOpen(false);
                placeCall(g);
              }}
            >
              <Phone className="w-4 h-4 mr-2 text-success" />
              <span className="flex-1 truncate">{g.guardian_name || g.guardian_phone}</span>
              {g.is_primary && (
                <span className="text-[10px] text-muted-foreground ml-2">Primary</span>
              )}
            </DropdownMenuItem>
          ) : null
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default CallGuardianButton;
