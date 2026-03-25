import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  wardUserId: string;
  wardName: string;
}

const PRESET_MESSAGES = [
  "How are you?",
  "I Love You ❤️",
  "Take your medicine 💊",
  "Stay safe! 🛡️",
  "Thinking of you 💭",
  "Call me when free 📞",
];

const GuardianPingDialog = ({ wardUserId, wardName }: Props) => {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [customMsg, setCustomMsg] = useState("");
  const [sending, setSending] = useState(false);

  const sendPing = async (message: string) => {
    if (!session?.user?.id || !message.trim()) return;
    setSending(true);
    const finalMsg = message.replace(/\bUser\b/g, wardName);
    const { error } = await supabase
      .from("guardian_pings" as any)
      .insert({
        guardian_user_id: session.user.id,
        user_id: wardUserId,
        message: finalMsg,
      } as any);
    setSending(false);
    if (error) {
      toast.error("Failed to send message");
    } else {
      toast.success(`Message sent to ${wardName}`);
      setCustomMsg("");
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex-col h-auto py-4 bg-accent hover:bg-accent/90 text-accent-foreground" size="lg">
          <MessageCircle className="w-5 h-5 mb-1" />
          <span className="text-xs">Ping</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            Send a Message to {wardName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Tap a preset or type a custom message</p>
          <div className="grid grid-cols-2 gap-2">
            {PRESET_MESSAGES.map((msg) => (
              <Button
                key={msg}
                variant="outline"
                size="sm"
                className="text-xs h-auto py-2 whitespace-normal"
                disabled={sending}
                onClick={() => sendPing(msg)}
              >
                {msg}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Type a custom message..."
              value={customMsg}
              onChange={(e) => setCustomMsg(e.target.value)}
              className="text-sm"
              maxLength={200}
              onKeyDown={(e) => e.key === "Enter" && sendPing(customMsg)}
            />
            <Button
              size="icon"
              disabled={!customMsg.trim() || sending}
              onClick={() => sendPing(customMsg)}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GuardianPingDialog;
