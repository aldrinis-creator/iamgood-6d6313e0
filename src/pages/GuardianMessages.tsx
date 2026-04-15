import { useState, useEffect, useRef } from "react";
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

interface ChatBubble {
  id: string;
  text: string;
  isMine: boolean;
  createdAt: string;
  wardName: string;
}

const PRESET_MESSAGES = ["How are you?", "I Love You ❤️", "Take your medicine 💊", "Stay safe! 🛡️"];

const GuardianMessages = () => {
  const { session } = useAuth();
  const { selectedWard } = useGuardianWard();
  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchPings = async () => {
    if (!session?.user?.id || !selectedWard) return;
    const { data } = await supabase
      .from("guardian_pings")
      .select("*")
      .eq("guardian_user_id", session.user.id)
      .eq("user_id", selectedWard.userId)
      .order("created_at", { ascending: false })
      .limit(100);
      
    const pings = (data || []) as unknown as Ping[];

    if (pings.some((p: any) => !p.guardian_read && ((p.initiated_by || "guardian") === "user" || (p.reply_message && !p.guardian_read)))) {
      await supabase
        .from("guardian_pings")
        .update({ guardian_read: true } as any)
        .eq("guardian_user_id", session.user.id)
        .eq("user_id", selectedWard.userId)
        .eq("guardian_read", false);
    }
    
    // Flatten into generic ChatBubbles
    const flatBubbles: ChatBubble[] = [];
    pings.forEach(p => {
       const sentByGuardian = (p.initiated_by || "guardian") === "guardian";
       
       // push the original message
       flatBubbles.push({
          id: p.id + "-orig",
          text: p.message,
          isMine: sentByGuardian,
          createdAt: p.created_at,
          wardName: selectedWard.name || "Ward"
       });

       // push the reply message if it exists as a separate bubble
       if (p.reply_message) {
         flatBubbles.push({
            id: p.id + "-reply",
            text: p.reply_message,
            isMine: !sentByGuardian,
            createdAt: p.replied_at || p.created_at,
            wardName: selectedWard.name || "Ward"
         });
       }
    });

    // Sort chronologically (oldest top, newest bottom)
    flatBubbles.sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    setBubbles(flatBubbles);
    setLoading(false);
    
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 100);
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

  const sendNewMessage = async (msgText: string) => {
    const finalMsg = msgText.trim();
    if (!finalMsg || !session?.user?.id || !selectedWard) return;
    setSending(true);
    
    await supabase.from("guardian_pings").insert({
      guardian_user_id: session.user.id,
      user_id: selectedWard.userId,
      message: finalMsg.replace(/\bUser\b/g, selectedWard.name || "Ward"),
      initiated_by: "guardian",
      read: false,
      guardian_read: true,
    } as any);
    
    setSending(false);
    setInputText("");
    fetchPings();
  };

  const deleteAllPings = async () => {
    if (!session?.user?.id || !selectedWard) return;
    await supabase.from("guardian_pings").delete()
      .eq("guardian_user_id", session.user.id)
      .eq("user_id", selectedWard.userId);
    setBubbles([]);
    toast.success("All messages cleared");
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-5rem)] md:h-[calc(100vh-6rem)]">
        {/* Header Overlay (Includes WardPicker) */}
        <div className="flex-none p-4 pb-2 border-b space-y-3">
          <WardPicker />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary" />
              <h1 className="text-lg font-bold">Chat</h1>
            </div>
            {bubbles.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs text-destructive border-destructive/30">
                    <Trash2 className="w-3 h-3 mr-1" /> Clear Chat
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear all messages?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete your entire message history with {selectedWard?.name || "this ward"}.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={deleteAllPings} className="bg-destructive text-destructive-foreground">Clear All</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* Chat History Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Loading chat...</div>
          ) : !selectedWard ? (
            <div className="text-center py-12 text-sm text-muted-foreground">Please select a ward to view messages.</div>
          ) : bubbles.length === 0 ? (
            <div className="text-center py-12 space-y-2 h-full flex flex-col items-center justify-center">
              <MessageCircle className="w-12 h-12 mx-auto text-muted-foreground/30 opacity-50" />
              <p className="text-sm text-muted-foreground">No messages yet</p>
              <p className="text-xs text-muted-foreground max-w-[200px] text-center">Send a message to check in on {selectedWard.name}.</p>
            </div>
          ) : (
            <div className="flex flex-col space-y-3 pb-8">
              <p className="text-[10px] text-muted-foreground/50 text-center pb-2 flex items-center justify-center gap-1">
                <Clock className="w-3 h-3" /> Messages auto-expire after 7 days
              </p>
              
              {bubbles.map((msg, index) => {
                const showAvatar = !msg.isMine && (index === 0 || bubbles[index - 1]?.isMine);
                
                return (
                  <div key={msg.id} className={`flex w-full ${msg.isMine ? "justify-end" : "justify-start"}`}>
                    <div className={`relative max-w-[75%] md:max-w-[60%] flex flex-col ${msg.isMine ? "items-end" : "items-start"}`}>
                      {showAvatar && (
                        <span className="text-[10px] font-medium text-primary mb-1 ml-1">{msg.wardName}</span>
                      )}
                      <div className={`px-3 py-2 rounded-2xl ${msg.isMine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"}`}>
                        <p className="text-sm break-words whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                      </div>
                      <span className="text-[9px] text-muted-foreground/60 mt-1 mx-1">
                        {formatISTDateTime(msg.createdAt)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Unified Input Bottom Bar */}
        <div className="flex-none p-3 pb-safe bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-t">
          {selectedWard ? (
            <div className="space-y-2">
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide no-scrollbar">
                {PRESET_MESSAGES.map(preset => (
                  <Button 
                    key={preset} variant="outline" size="sm" 
                    className="text-[10px] h-7 px-2 shrink-0 bg-muted/50 rounded-full"
                    onClick={() => setInputText(preset)}
                  >
                    {preset}
                  </Button>
                ))}
              </div>
              <div className="flex items-end gap-2 relative">
                <Input
                  className="rounded-full bg-muted/50 border-transparent pr-10 min-h-[44px]"
                  placeholder={`Message ${selectedWard.name}...`}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendNewMessage(inputText)}
                  maxLength={500}
                />
                <Button
                  size="icon"
                  className="absolute right-1 bottom-1 h-9 w-9 rounded-full shrink-0"
                  disabled={!inputText.trim() || sending}
                  onClick={() => sendNewMessage(inputText)}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </AppLayout>
  );
};

export default GuardianMessages;
