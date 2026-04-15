import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Check, Send, Clock, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatISTDateTime } from "@/lib/istTime";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // For choosing guardian to chat with if multiple

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

interface ChatBubble {
  id: string;
  text: string;
  isMine: boolean;
  createdAt: string;
  guardianId: string;
  guardianName: string;
}

const PRESET_MESSAGES = ["I'm fine ✅", "Call me please 📞", "Need help", "Miss you ❤️", "Took my medicine 💊"];

const Messages = () => {
  const { session } = useAuth();
  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [guardians, setGuardians] = useState<{ id: string, name: string }[]>([]);
  const [activeGuardianId, setActiveGuardianId] = useState<string>("");
  
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchPings = async () => {
    if (!session?.user?.id) return;

    // 1. Fetch Guardian connections
    const { data: guardianRows } = await supabase
      .from("guardians")
      .select("guardian_user_id, guardian_name")
      .eq("user_id", session.user.id)
      .eq("status", "accepted")
      .not("guardian_user_id", "is", null);

    const guardianMap: Record<string, string> = {};
    const guardianList: { id: string, name: string }[] = [];
    (guardianRows || []).forEach((g) => {
      if (g.guardian_user_id) {
        guardianMap[g.guardian_user_id] = g.guardian_name;
        guardianList.push({ id: g.guardian_user_id, name: g.guardian_name });
      }
    });
    setGuardians(guardianList);

    // 2. Fetch Pings
    const { data: received } = await supabase
      .from("guardian_pings")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    const allPings: Ping[] = received || [];

    // Map names for unknown guardians
    const unknownIds = [...new Set(allPings.filter(p => !guardianMap[p.guardian_user_id]).map(p => p.guardian_user_id))];
    if (unknownIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", unknownIds);
      profiles?.forEach((p) => { guardianMap[p.id] = p.full_name || "Guardian"; });
    }

    // 3. Mark newly received as read
    const unreadReceivedIds = allPings.filter(p => !p.read && (p.initiated_by || "guardian") === "guardian").map(p => p.id);
    if (unreadReceivedIds.length > 0) {
      await supabase.from("guardian_pings").update({ read: true } as any).in("id", unreadReceivedIds);
    }

    // 4. Flatten into generic ChatBubbles
    const flatBubbles: ChatBubble[] = [];
    allPings.forEach(p => {
       const sentByUser = (p.initiated_by || "guardian") === "user";
       const gName = guardianMap[p.guardian_user_id] || "Guardian";
       
       // push the original message (either mine or theirs based on initiated_by)
       flatBubbles.push({
          id: p.id + "-orig",
          text: p.message,
          isMine: sentByUser,
          createdAt: p.created_at,
          guardianId: p.guardian_user_id,
          guardianName: gName
       });

       // push the reply message if it exists as a separate bubble
       if (p.reply_message) {
         flatBubbles.push({
            id: p.id + "-reply",
            text: p.reply_message,
            isMine: !sentByUser, // The opposite party sent the reply
            createdAt: p.replied_at || p.created_at,
            guardianId: p.guardian_user_id,
            guardianName: gName
         });
       }
    });

    // 5. Sort chronologically (oldest top, newest bottom)
    flatBubbles.sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    setBubbles(flatBubbles);
    setLoading(false);
    
    // Auto-scroll to bottom on load
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 100);
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
  
  useEffect(() => {
    // If no active guardian is selected, just default to the first one available
    if (!activeGuardianId && guardians.length > 0) {
       setActiveGuardianId(guardians[0].id);
    }
  }, [guardians, activeGuardianId]);

  const sendNewMessage = async (msgText: string) => {
    const finalMsg = msgText.trim();
    if (!finalMsg || !session?.user?.id || !activeGuardianId) return;
    setSending(true);
    
    await supabase.from("guardian_pings").insert({
      user_id: session.user.id,
      guardian_user_id: activeGuardianId,
      message: finalMsg,
      initiated_by: "user",
      read: true,
      guardian_read: false,
    } as any);
    
    setSending(false);
    setInputText("");
    fetchPings();
  };

  const deleteAllPings = async () => {
    if (!session?.user?.id) return;
    await supabase.from("guardian_pings").delete().eq("user_id", session.user.id);
    setBubbles([]);
    toast.success("All messages cleared");
  };

  // Filter bubbles based on the selected guardian thread (if multiple guardians exist)
  const activeChat = bubbles.filter(b => b.guardianId === activeGuardianId);

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-5rem)] md:h-[calc(100vh-6rem)]">
        {/* Header */}
        <div className="flex-none p-4 pb-2 border-b">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary" />
              Chat
            </h1>
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
                      This will permanently delete your entire message history.
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
          
          {guardians.length > 1 && (
            <Select value={activeGuardianId} onValueChange={setActiveGuardianId}>
              <SelectTrigger className="w-full text-sm font-medium">
                <SelectValue placeholder="Select guardian thread" />
              </SelectTrigger>
              <SelectContent>
                {guardians.map(g => (
                  <SelectItem key={g.id} value={g.id}>Chat with {g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Chat History Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Loading chat...</div>
          ) : activeChat.length === 0 ? (
            <div className="text-center py-12 space-y-2 h-full flex flex-col items-center justify-center">
              <MessageCircle className="w-12 h-12 mx-auto text-muted-foreground/30 opacity-50" />
              <p className="text-sm text-muted-foreground">No messages yet</p>
              <p className="text-xs text-muted-foreground max-w-[200px] text-center">Say hello to start the conversation!</p>
            </div>
          ) : (
            <div className="flex flex-col space-y-3 pb-8">
              <p className="text-[10px] text-muted-foreground/50 text-center pb-2 flex items-center justify-center gap-1">
                <Clock className="w-3 h-3" /> Messages auto-expire after 7 days
              </p>
              
              {activeChat.map((msg, index) => {
                const showAvatar = !msg.isMine && (index === 0 || activeChat[index - 1]?.isMine);
                
                return (
                  <div key={msg.id} className={`flex w-full ${msg.isMine ? "justify-end" : "justify-start"}`}>
                    <div className={`relative max-w-[75%] md:max-w-[60%] flex flex-col ${msg.isMine ? "items-end" : "items-start"}`}>
                      {showAvatar && (
                        <span className="text-[10px] font-medium text-primary mb-1 ml-1">{msg.guardianName}</span>
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
          {activeGuardianId ? (
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
                  placeholder="Message..."
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
          ) : (
            <div className="text-center py-2 text-sm text-muted-foreground">Select a guardian to start chatting</div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Messages;
