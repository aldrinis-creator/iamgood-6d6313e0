import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Heart, Send, X } from "lucide-react";

interface Ping {
  id: string;
  guardian_user_id: string;
  message: string;
  created_at: string;
}

const GuardianPingOverlay = () => {
  const { session } = useAuth();
  const [ping, setPing] = useState<Ping | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [visible, setVisible] = useState(false);

  const dismiss = useCallback(async () => {
    if (ping) {
      await supabase.from("guardian_pings").update({ read: true }).eq("id", ping.id);
    }
    setVisible(false);
    setPing(null);
    setReply("");
  }, [ping]);

  const sendReply = async () => {
    if (!reply.trim() || !ping || !session?.user?.id) return;
    setSending(true);
    await supabase.from("guardian_pings").update({
      reply_message: reply.trim(),
      replied_at: new Date().toISOString(),
      read: true,
    } as any).eq("id", ping.id);
    setSending(false);
    dismiss();
  };

  useEffect(() => {
    if (!session?.user?.id) return;

    const channel = supabase
      .channel("user-pings-overlay")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "guardian_pings",
        filter: `user_id=eq.${session.user.id}`,
      }, (payload: any) => {
        const p = payload.new as Ping;
        setPing(p);
        setVisible(true);
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id]);

  if (!visible || !ping) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="relative mx-6 max-w-sm w-full rounded-2xl bg-card border-2 border-primary/30 p-6 shadow-2xl text-center space-y-4"
        style={{ animation: "ping-bounce 0.6s ease-out" }}
      >
        <button onClick={dismiss} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>

        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center"
          style={{ animation: "ping-pulse 1.5s ease-in-out infinite" }}>
          <Heart className="w-8 h-8 text-primary" style={{ animation: "ping-heart 1s ease-in-out infinite" }} />
        </div>

        <p className="text-lg font-semibold text-foreground">{ping.message}</p>
        <p className="text-xs text-muted-foreground">From your Guardian</p>

        <div className="flex gap-2">
          <Input
            placeholder="Type a reply..."
            value={reply}
            onChange={e => setReply(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendReply()}
            className="flex-1"
          />
          <Button size="icon" onClick={sendReply} disabled={sending || !reply.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>

        <Button variant="ghost" size="sm" className="text-xs" onClick={dismiss}>
          Dismiss
        </Button>
      </div>

      <style>{`
        @keyframes ping-bounce {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes ping-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        @keyframes ping-heart {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
};

export default GuardianPingOverlay;
