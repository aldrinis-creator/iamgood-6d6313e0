import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, Check, CheckCheck } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface Ping {
  id: string;
  guardian_user_id: string;
  message: string;
  read: boolean;
  created_at: string;
  guardian_name?: string;
  reply_message?: string;
  replied_at?: string;
}

const Messages = () => {
  const { session } = useAuth();
  const [pings, setPings] = useState<Ping[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPings = async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase
      .from("guardian_pings")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) {
      // Fetch guardian names
      const guardianIds = [...new Set(data.map(p => p.guardian_user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", guardianIds);

      const nameMap: Record<string, string> = {};
      profiles?.forEach(p => { nameMap[p.id] = p.full_name || "Guardian"; });

      setPings(data.map(p => ({ ...p, guardian_name: nameMap[p.guardian_user_id] || "Guardian" })));
    }
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
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead} className="text-xs">
              <CheckCheck className="w-3 h-3 mr-1" /> Mark all read
            </Button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
        ) : pings.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <MessageCircle className="w-12 h-12 mx-auto text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground">Messages from your guardian will appear here</p>
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
                        {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {p.read && <Check className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-1" />}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Messages;
