import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Check, Send, Clock, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatISTDateTime } from "@/lib/istTime";
import UserPingDialog from "@/components/UserPingDialog";
import { toast } from "sonner";

interface Ping {
  id: string;
  guardian_user_id: string;
  user_id: string;
  message: string;
  read: boolean;
  created_at: string;
  guardian_name?: string;
  reply_message?: string | null;
  replied_at?: string | null;
  initiated_by?: string;
}

const Messages = () => {
  const { session } = useAuth();
  const [pings, setPings] = useState<Ping[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const fetchPings = async () => {
    if (!session?.user?.id) return;

    const { data: received } = await supabase
      .from("guardian_pings")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    const { data: guardianRows } = await supabase
      .from("guardians")
      .select("guardian_user_id, guardian_name")
      .eq("user_id", session.user.id)
      .eq("status", "accepted")
      .not("guardian_user_id", "is", null);

    const guardianMap: Record<string, string> = {};
    (guardianRows || []).forEach((g) => {
      if (g.guardian_user_id) guardianMap[g.guardian_user_id] = g.guardian_name;
    });

    const allPings: Ping[] = (received || []).map((p: any) => ({
      ...p,
      guardian_name: guardianMap[p.guardian_user_id] || "Guardian",
    }));

    const unknownIds = [...new Set(allPings.filter(p => !guardianMap[p.guardian_user_id]).map(p => p.guardian_user_id))];
    if (unknownIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", unknownIds);
      const nameMap: Record<string, string> = {};
      profiles?.forEach((p) => { nameMap[p.id] = p.full_name || "Guardian"; });
      allPings.forEach((p) => {
        if (!guardianMap[p.guardian_user_id]) {
          p.guardian_name = nameMap[p.guardian_user_id] || "Guardian";
        }
      });
    }

    const unreadReceivedIds = allPings
      .filter(p => !p.read && (p.initiated_by || "guardian") === "guardian")
      .map(p => p.id);
    if (unreadReceivedIds.length > 0) {
      await supabase.from("guardian_pings").update({ read: true } as any).in("id", unreadReceivedIds);
      unreadReceivedIds.forEach(id => {
        const ping = allPings.find(p => p.id === id);
        if (ping) ping.read = true;
      });
    }

    setPings(allPings);
    setLoading(false);
  };

  useEffect(() => {
    fetchPings();
    if (!session?.user?.id) return;
    const channel = supabase
      .channel("user-messages-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "guardian_pings", filter: `user_id=eq.${session.user.id}` }, () => fetchPings())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id]);

  const sendReply = async (pingId: string) => {
    if (!replyText.trim() || !session?.user?.id) return;
    setSending(true);
    await supabase.from("guardian_pings").update({
      reply_message: replyText.trim(),
      replied_at: new Date().toISOString(),
      read: true,
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
    if (!session?.user?.id) return;
    await supabase.from("guardian_pings").delete().eq("user_id", session.user.id);
    setPings([]);
    toast.success("All messages cleared");
  };

  const isSentByUser = (p: Ping) => (p.initiated_by || "guardian") === "user";

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            Messages
          </h1>
          <div className="flex items-center gap-2">
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
                      This will permanently delete all your messages. This action cannot be undone.
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
            <UserPingDialog onSent={fetchPings} />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
        ) : pings.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <MessageCircle className="w-12 h-12 mx-auto text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground">Ping your guardian or wait for their messages</p>
            <p className="text-[10px] text-muted-foreground/60 mt-2">Messages auto-expire after 7 days</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pings.map(p => {
              const sentByUser = isSentByUser(p);
              const canReply = !sentByUser && !p.reply_message;

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

                    {sentByUser ? (
                      <div className="flex justify-end">
                        <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-3 py-2 max-w-[80%]">
                          <p className="text-sm">{p.message}</p>
                          <p className="text-[10px] opacity-70 text-right mt-1">{formatISTDateTime(p.created_at)}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-start">
                        <div className="bg-muted rounded-2xl rounded-tl-sm px-3 py-2 max-w-[80%]">
                          <span className="text-xs font-medium text-primary">{p.guardian_name}</span>
                          <p className="text-sm">{p.message}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">{formatISTDateTime(p.created_at)}</p>
                        </div>
                      </div>
                    )}

                    {p.reply_message ? (
                      <div className={`flex ${sentByUser ? "justify-start" : "justify-end"}`}>
                        <div className={`${sentByUser ? "bg-muted rounded-tl-sm" : "bg-primary text-primary-foreground rounded-tr-sm"} rounded-2xl px-3 py-2 max-w-[80%]`}>
                          {sentByUser && <span className="text-xs font-medium text-primary">{p.guardian_name}</span>}
                          <p className="text-sm">{p.reply_message}</p>
                          <div className="flex items-center gap-1 mt-1 justify-end">
                            <p className={`text-[10px] ${sentByUser ? "text-muted-foreground" : "opacity-70"}`}>
                              {p.replied_at ? formatISTDateTime(p.replied_at) : ""}
                            </p>
                            <Check className={`w-3 h-3 ${sentByUser ? "text-primary" : "opacity-70"}`} />
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
                    ) : sentByUser && !p.reply_message ? (
                      <p className="text-[10px] text-muted-foreground italic">Awaiting reply…</p>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-center gap-1.5 pt-2 pb-1">
          <Clock className="w-3 h-3 text-muted-foreground/50" />
          <p className="text-[10px] text-muted-foreground/50">Messages auto-expire after 7 days</p>
        </div>
      </div>
    </AppLayout>
  );
};

export default Messages;
