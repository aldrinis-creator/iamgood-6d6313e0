import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGuardianWard } from "@/contexts/GuardianWardContext";
import AppLayout from "@/components/AppLayout";
import WardPicker from "@/components/WardPicker";
import { Card, CardContent } from "@/components/ui/card";
import { MessageCircle, Check } from "lucide-react";
import { formatISTDateTime } from "@/lib/istTime";

interface Ping {
  id: string;
  message: string;
  reply_message: string | null;
  replied_at: string | null;
  guardian_read: boolean;
  created_at: string;
  user_id: string;
}

const GuardianMessages = () => {
  const { session } = useAuth();
  const { selectedWard } = useGuardianWard();
  const [pings, setPings] = useState<Ping[]>([]);
  const [loading, setLoading] = useState(true);

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

    // Mark all replied pings as guardian_read
    if (data?.some((p: any) => p.reply_message && !p.guardian_read)) {
      await supabase
        .from("guardian_pings")
        .update({ guardian_read: true } as any)
        .eq("guardian_user_id", session.user.id)
        .eq("user_id", selectedWard.userId)
        .not("reply_message", "is", null)
        .eq("guardian_read", false);
    }
  };

  useEffect(() => {
    fetchPings();

    if (!session?.user?.id || !selectedWard) return;
    const channel = supabase
      .channel("guardian-messages-page")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "guardian_pings",
        filter: `guardian_user_id=eq.${session.user.id}`,
      }, () => fetchPings())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id, selectedWard?.userId]);

  return (
    <AppLayout>
      <div className="space-y-4">
        <WardPicker />
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold">Sent Messages</h1>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
        ) : pings.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No messages sent yet. Use the ping button on the dashboard to send a message to your ward.
          </p>
        ) : (
          pings.map(p => (
            <Card key={p.id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex justify-end">
                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-3 py-2 max-w-[80%]">
                    <p className="text-sm">{p.message}</p>
                    <p className="text-[10px] opacity-70 text-right mt-1">
                      {formatISTDateTime(p.created_at)}
                    </p>
                  </div>
                </div>

                {p.reply_message ? (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl rounded-tl-sm px-3 py-2 max-w-[80%]">
                      <p className="text-sm">{p.reply_message}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <p className="text-[10px] text-muted-foreground">
                          {p.replied_at ? formatISTDateTime(p.replied_at) : ""}
                        </p>
                        <Check className="w-3 h-3 text-primary" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground italic text-center">Awaiting reply…</p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </AppLayout>
  );
};

export default GuardianMessages;
