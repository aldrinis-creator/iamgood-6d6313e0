import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Pill, X } from "lucide-react";
import { playChime } from "@/lib/audioAlerts";

type RefillNote = { id: string; title: string; message: string };

const istDayStartIso = () => {
  const now = Date.now() + 5.5 * 3600 * 1000;
  const day = new Date(now).toISOString().slice(0, 10);
  return new Date(Date.parse(day + "T00:00:00Z") - 5.5 * 3600 * 1000).toISOString();
};

/** One combined 12 PM refill pop-up for Wards and Guardians. */
const RefillDuePopup = ({ isGuardian }: { isGuardian: boolean }) => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [notes, setNotes] = useState<RefillNote[]>([]);
  const uid = session?.user?.id;

  useEffect(() => {
    if (!uid) return;
    supabase.from("notifications").select("id, title, message")
      .eq("user_id", uid).eq("type", "refill_due").eq("read", false)
      .gte("created_at", istDayStartIso()).order("created_at", { ascending: false })
      .then(({ data }) => { if (data?.length) setNotes(data as RefillNote[]); });

    const channel = supabase.channel(`refill-popup-${uid}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
        (payload: any) => {
          const n = payload.new;
          if (n?.type !== "refill_due") return;
          setNotes((prev) => (prev.some((p) => p.id === n.id) ? prev : [{ id: n.id, title: n.title, message: n.message }, ...prev]));
          playChime();
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [uid]);

  const close = useCallback(async () => {
    const ids = notes.map((n) => n.id);
    setNotes([]);
    if (ids.length) await supabase.from("notifications").update({ read: true }).in("id", ids);
  }, [notes]);

  if (!notes.length) return null;

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
          {notes.map((n) => <li key={n.id} className="text-lg text-foreground">{n.message}</li>)}
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
