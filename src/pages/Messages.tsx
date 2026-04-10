import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, Check, CheckCheck, ArrowUpRight, ArrowDownLeft, Clock } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatISTDateTime } from "@/lib/istTime";
import UserPingDialog from "@/components/UserPingDialog";

interface Ping {
  id: string;
  guardian_user_id: string;
  user_id: string;
  message: string;
  read: boolean;
  created_at: string;
  guardian_name?: string;
  reply_message?: string;
  replied_at?: string;
  direction: "received" | "sent";
}

const Messages = () => {
  const { session } = useAuth();
  const [pings, setPings] = useState<Ping[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPings = async () => {
    if (!session?.user?.id) return;

    // Fetch received pings (from guardians to user)
    const { data: received } = await supabase
      .from("guardian_pings")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    // Get user's guardians to fetch sent pings
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
    const guardianIds = Object.keys(guardianMap);

    // Fetch sent pings (user initiated — where user_id = me but guardian sent query won't catch them,
    // so we look for pings where user_id = me that were NOT from the guardian's perspective)
    // Actually, all pings where user_id = me are already in `received`. 
    // Sent pings by user are also user_id = me, guardian_user_id = guardian.
    // We need to distinguish: if the guardian inserted it (guardian ping to user) vs user inserted it (user ping to guardian).
    // Since both have user_id = session.user.id, we can't distinguish by columns alone.
    // However, received pings from guardians will have replies from the user,
    // and sent pings from the user won't typically have replies.
    // For now, all pings with user_id = me are shown. The direction is implicit.
    // Let's mark ones where the guardian_user_id matches a known guardian and there's no reply as potentially sent by user.
    
    // Actually the simplest approach: fetch ALL guardian_pings where user_id = me. They're all in one list.
    // We already have them from 'received'. Let's just enrich with guardian names.

    const allPings: Ping[] = (received || []).map((p) => ({
      ...p,
      guardian_name: guardianMap[p.guardian_user_id] || "Guardian",
      direction: "received" as const, // We show all as a conversation
    }));

    // Also fetch guardian names for any not in guardianMap
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

    setPings(allPings);
    setLoading(false);
  };

  useEffect(() => {
    fetchPings();

    if (!session?.user?.id) return;
    const channel = supabase
      .channel("user-messages-page")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "guardian_pings",
        filter: `user_id=eq.${session.user.id}`,
      }, () => fetchPings())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id]);

  const markAllRead = async () => {
    if (!session?.user?.id) return;
    const unreadIds = pings.filter(p => !p.read).map(p => p.id);
    if (unreadIds.length === 0) return;
    await supabase.from("guardian_pings").update({ read: true } as any).in("id", unreadIds);
    setPings(prev => prev.map(p => ({ ...p, read: true })));
  };

  const unreadCount = pings.filter(p => !p.read).length;

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            Messages
          </h1>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllRead} className="text-xs">
                <CheckCheck className="w-3 h-3 mr-1" /> Mark all read
              </Button>
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
            {pings.map(p => (
              <Card key={p.id} className={`transition-colors ${!p.read ? "border-primary/30 bg-primary/5" : ""}`}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-primary">{p.guardian_name}</span>
                        {!p.read && (
                          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        )}
                      </div>
                      <p className="text-sm">{p.message}</p>
                      {p.reply_message && (
                        <div className="mt-1.5 pl-3 border-l-2 border-primary/30">
                          <p className="text-xs text-primary font-medium">Your reply:</p>
                          <p className="text-sm text-foreground/80">{p.reply_message}</p>
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatISTDateTime(p.created_at)}
                      </p>
                    </div>
                    {p.read && <Check className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-1" />}
                  </div>
                </CardContent>
              </Card>
            ))}
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
