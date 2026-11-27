import { usePopupSlot } from "@/lib/popupQueue";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Pill, X } from "lucide-react";
import { playChime } from "@/lib/audioAlerts";

type RawNote = { id: string; title: string; message: string; guardian_id?: string | null };
type RefillNote = RawNote & { names: string };

const istDayStartIso = () => {
  const now = Date.now() + 5.5 * 3600 * 1000;
  const day = new Date(now).toISOString().slice(0, 10);
  return new Date(Date.parse(day + "T00:00:00Z") - 5.5 * 3600 * 1000).toISOString();
};

/**
 * Re-checks current stock for the notifications' wards.
 * - Notes whose medicines have all been refilled are dropped (and marked read).
 * - Remaining notes show only the medicines that are still due.
 * If the check itself fails, the notes are shown as saved (never hide a real alert).
 */
async function validateNotes(uid: string, raw: RawNote[]): Promise<RefillNote[]> {
  const fallback = raw.map((n) => ({ ...n, names: "" }));
  try {
    const gIds = [...new Set(raw.map((n) => n.guardian_id).filter(Boolean))] as string[];
    const wardOfGuardianRow: Record<string, string> = {};
    if (gIds.length) {
      const { data, error } = await supabase.from("guardians").select("id, user_id").in("id", gIds);
      if (error) return fallback;
      for (const g of data || []) wardOfGuardianRow[g.id] = g.user_id;
    }
    const wardIdOf = (n: RawNote) => (n.guardian_id ? wardOfGuardianRow[n.guardian_id] : uid);
    const wardIds = [...new Set(raw.map(wardIdOf).filter(Boolean))] as string[];
    if (!wardIds.length) return fallback;

    const { data: meds, error } = await supabase
      .from("medications")
      .select("name, user_id, remaining_quantity, low_stock_threshold, refill_reminder")
      .in("user_id", wardIds);
    if (error || !meds) return fallback;

    const kept: RefillNote[] = [];
    const staleIds: string[] = [];
    for (const n of raw) {
      const wardId = wardIdOf(n);
      if (!wardId) { kept.push({ ...n, names: "" }); continue; }
      const stillDue = meds.filter(
        (m: any) =>
          m.user_id === wardId &&
          m.refill_reminder !== false &&
          m.remaining_quantity != null &&
          m.low_stock_threshold != null &&
          m.remaining_quantity <= m.low_stock_threshold &&
          n.message.includes(m.name),
      );
      if (!stillDue.length) staleIds.push(n.id);
      else kept.push({ ...n, names: stillDue.map((m: any) => m.name).join(", ") });
    }
    if (staleIds.length) await supabase.from("notifications").update({ read: true }).in("id", staleIds);
    return kept;
  } catch {
    return fallback;
  }
}

/** One combined 12 PM refill pop-up for Wards and Guardians. */
const RefillDuePopup = ({ isGuardian }: { isGuardian: boolean }) => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [notes, setNotes] = useState<RefillNote[]>([]);
  const uid = session?.user?.id;
  const rawRef = useRef<RawNote[]>([]);

  const refresh = useCallback(async () => {
    if (!uid || !rawRef.current.length) { setNotes([]); return; }
    setNotes(await validateNotes(uid, rawRef.current));
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    rawRef.current = [];
    (supabase.from("notifications") as any).select("id, title, message, guardian_id")
      .eq("user_id", uid).eq("type", "refill_due").eq("read", false)
      .gte("created_at", istDayStartIso()).order("created_at", { ascending: false })
      .then(({ data }: any) => { if (data?.length) { rawRef.current = data; refresh(); } });

    const channel = supabase.channel(`refill-popup-${uid}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
        (payload: any) => {
          const n = payload.new;
          if (n?.type !== "refill_due") return;
          if (!rawRef.current.some((p) => p.id === n.id)) {
            rawRef.current = [{ id: n.id, title: n.title, message: n.message, guardian_id: n.guardian_id }, ...rawRef.current];
          }
          refresh();
        })
      .subscribe();
    // Re-check stock periodically so a refill done elsewhere removes a waiting pop-up.
    const t = setInterval(refresh, 60000);
    return () => { supabase.removeChannel(channel); clearInterval(t); };
  }, [uid, refresh]);

  const close = useCallback(async () => {
    const ids = rawRef.current.map((n) => n.id);
    rawRef.current = [];
    setNotes([]);
    if (ids.length) await supabase.from("notifications").update({ read: true }).in("id", ids);
  }, []);

  const wantsOpen = notes.length > 0;
  const popupAllowed = usePopupSlot("refill", wantsOpen);
  const visible = popupAllowed && wantsOpen;

  // Re-check stock right before showing, then chime/vibrate only when it is actually visible
  // (never during the post-login quiet period).
  const wasVisible = useRef(false);
  useEffect(() => {
    if (visible && !wasVisible.current) {
      wasVisible.current = true;
      refresh();
      playChime();
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }
    if (!visible) wasVisible.current = false;
  }, [visible, refresh]);

  if (!visible) return null;

  const lineFor = (n: RefillNote) => {
    if (!n.names) return n.message;
    return isGuardian
      ? `${n.title.split(":")[0]}'s medicines to refill: ${n.names}.`
      : `Time to refill: ${n.names}.`;
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-background/80 p-4" role="dialog" aria-modal="true" aria-label="Medicine refill due">
      <div className="relative w-full max-w-[400px] rounded-2xl border-2 border-destructive bg-card p-5 shadow-xl space-y-4">
        <button onClick={close} aria-label="Dismiss" className="absolute right-3 top-3 text-muted-foreground">
          <X className="h-6 w-6" />
        </button>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <Pill className="h-6 w-6 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground pr-6">{notes[0].title}</h2>
        </div>
        <ul className="space-y-2">
          {notes.map((n) => <li key={n.id} className="text-lg text-foreground">{lineFor(n)}</li>)}
        </ul>
        <div className="flex gap-3">
          <Button size="lg" className="flex-1 text-lg" onClick={async () => { await close(); navigate(isGuardian ? "/guardian/activity" : "/my-health"); }}>
            Order Refill
          </Button>
          <Button size="lg" variant="outline" className="flex-1 text-lg" onClick={close}>OK</Button>
        </div>
      </div>
    </div>
  );
};

export default RefillDuePopup;
