import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGuardianWard } from "@/contexts/GuardianWardContext";
import AppLayout from "@/components/AppLayout";
import WardPicker from "@/components/WardPicker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { MessageCircle, Check, Clock, Send, Trash2 } from "lucide-react";
import { formatISTDateTime } from "@/lib/istTime";
import { toast } from "sonner";

interface Ping {
  id: string;
  message: string;
  reply_message: string | null;
  replied_at: string | null;
  guardian_read: boolean;
  created_at: string;
  user_id: string;
  guardian_user_id: string;
  initiated_by: string;
}

const GuardianMessages = () => {
  const { session } = useAuth();
  const { selectedWard } = useGuardianWard();
  const [pings, setPings] = useState<Ping[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const fetchPings = async () => {
    if (!session?.user?.id || !selectedWard) return;
    const { data } = await supabase
      .from("guardian_pings")
      .select("*")
      .eq("guardian_user_id", session.user.id)
      .eq("user_id", selectedWard.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setPings(data as unknown as Ping[]);
    setLoading(false);

    if (data?.some((p: any) => !p.guardian_read && ((p.initiated_by || "guardian") === "user" || (p.reply_message && !p.guardian_read)))) {
      await supabase
        .from("guardian_pings")
        .update({ guardian_read: true } as any)
        .eq("guardian_user_id", session.user.id)
        .eq("user_id", selectedWard.userId)
        .eq("guardian_read", false);
    }
  };

  useEffect(() => {
    fetchPings();
    if (!session?.user?.id || !selectedWard) return;
    const channel = supabase
      .channel("guardian-messages-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "guardian_pings", filter: `guardian_user_id=eq.${session.user.id}` }, () => fetchPings())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id, selectedWard?.userId]);

  const sendReply = async (pingId: string) => {
    if (!replyText.trim() || !session?.user?.id) return;
    setSending(true);
    await supabase.from("guardian_pings").update({
      reply_message: replyText.trim(),
      replied_at: new Date().toISOString(),
      guardian_read: true,
    } as any).eq("id", pingId);
    setSending(false);
    setReplyingTo(null);
    setReplyText("");
    fetchPings();
  };

  const deletePing = async (pingId: string) => {
    await supabase.from("guardian_pings").delete().eq("id", pingId);
    setPings(prev => prev.filter(p => p.id !== pingId));
    toast.success("Message cleared");
  };

  const deleteAllPings = async () => {
    if (!session?.user?.id || !selectedWard) return;
    await supabase.from("guardian_pings").delete()
      .eq("guardian_user_id", session.user.id)
      .eq("user_id", selectedWard.userId);
    setPings([]);
    toast.success("All messages cleared");
  };

  const isSentByGuardian = (p: Ping) => (p.initiated_by || "guardian") === "guardian";

  return (
    <AppLayout>
      <div className="space-y-4">
        <WardPicker />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-bold">Messages</h1>
          </div>
          {pings.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs text-destructive border-destructive/30">
                  <Trash2 className="w-3 h-3 mr-1" /> Clear All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all messages?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all messages with {selectedWard?.name || "this ward"}. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteAllPings} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Clear All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
        ) : pings.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No messages yet. Use the ping button on the dashboard to send a message to your ward.
          </p>
        ) : (
          pings.map(p => {
            const sentByGuardian = isSentByGuardian(p);
            const canReply = !sentByGuardian && !p.reply_message;

            return (
              <Card key={p.id}>
                <CardContent className="p-3 space-y-2">
                  {/* Clear single message */}
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive"
                      onClick={() => deletePing(p.id)}
                    >
                      <Trash2 className="w-3 h-3 mr-1" /> Clear
                    </Button>
                  </div>

                  {sentByGuardian ? (
                    <div className="flex justify-end">
                      <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-3 py-2 max-w-[80%]">
                        <p className="text-sm">{p.message}</p>
                        <p className="text-[10px] opacity-70 text-right mt-1">{formatISTDateTime(p.created_at)}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-2xl rounded-tl-sm px-3 py-2 max-w-[80%]">
                        <span className="text-xs font-medium text-primary">{selectedWard?.name || "Ward"}</span>
                        <p className="text-sm">{p.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{formatISTDateTime(p.created_at)}</p>
                      </div>
                    </div>
                  )}

                  {p.reply_message ? (
                    <div className={`flex ${sentByGuardian ? "justify-start" : "justify-end"}`}>
                      <div className={`${sentByGuardian ? "bg-muted rounded-tl-sm" : "bg-primary text-primary-foreground rounded-tr-sm"} rounded-2xl px-3 py-2 max-w-[80%]`}>
                        {sentByGuardian && <span className="text-xs font-medium text-primary">{selectedWard?.name || "Ward"}</span>}
                        <p className="text-sm">{p.reply_message}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <p className={`text-[10px] ${sentByGuardian ? "text-muted-foreground" : "opacity-70"}`}>
                            {p.replied_at ? formatISTDateTime(p.replied_at) : ""}
                          </p>
                          <Check className={`w-3 h-3 ${sentByGuardian ? "text-primary" : "opacity-70"}`} />
                        </div>
                      </div>
                    </div>
                  ) : canReply ? (
                    replyingTo === p.id ? (
                      <div className="flex gap-2 pt-1">
                        <Input placeholder="Type a reply..." value={replyText} onChange={e => setReplyText(e.target.value)} onKeyDown={e => e.key === "Enter" && sendReply(p.id)} className="flex-1" autoFocus />
                        <Button size="icon" onClick={() => sendReply(p.id)} disabled={sending || !replyText.trim()}>
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" className="text-xs text-primary" onClick={() => { setReplyingTo(p.id); setReplyText(""); }}>
                        <Send className="w-3 h-3 mr-1" /> Reply
                      </Button>
                    )
                  ) : sentByGuardian && !p.reply_message ? (
                    <p className="text-[10px] text-muted-foreground italic">Awaiting reply…</p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })
        )}

        <div className="flex items-center justify-center gap-1.5 pt-2 pb-1">
          <Clock className="w-3 h-3 text-muted-foreground/50" />
          <p className="text-[10px] text-muted-foreground/50">Messages auto-expire after 7 days</p>
        </div>
      </div>
    </AppLayout>
  );
};

export default GuardianMessages;
