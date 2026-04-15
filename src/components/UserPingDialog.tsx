import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Guardian {
  guardian_user_id: string;
  guardian_name: string;
}

const PRESET_MESSAGES = [
  "I'm fine ✅",
  "Call me please 📞",
  "Need help",
  "Miss you ❤️",
  "Took my medicine 💊",
  "Feeling unwell 🤒",
];

interface Props {
  onSent?: () => void;
}

const UserPingDialog = ({ onSent }: Props) => {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [selectedGuardian, setSelectedGuardian] = useState<string>("");
  const [customMsg, setCustomMsg] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open || !session?.user?.id) return;
    supabase
      .from("guardians")
      .select("guardian_user_id, guardian_name")
      .eq("user_id", session.user.id)
      .eq("status", "accepted")
      .not("guardian_user_id", "is", null)
      .then(({ data }) => {
        const list = (data || []).filter((g): g is Guardian => !!g.guardian_user_id);
        setGuardians(list);
        if (list.length === 1) setSelectedGuardian(list[0].guardian_user_id);
      });
  }, [open, session?.user?.id]);

  const sendPing = async (message: string) => {
    if (!session?.user?.id || !selectedGuardian || !message.trim()) return;
    setSending(true);
    const { error } = await supabase
      .from("guardian_pings")
      .insert({
        user_id: session.user.id,
        guardian_user_id: selectedGuardian,
        message: message.trim(),
        initiated_by: "user",
        read: true,
        guardian_read: false,
      } as any);
    setSending(false);
    if (error) {
      toast.error("Failed to send message");
    } else {
      toast.success("Message sent to guardian");
      setCustomMsg("");
      setOpen(false);
      onSent?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <MessageCircle className="w-4 h-4" />
          Ping Guardian
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            Ping Your Guardian
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {guardians.length === 0 ? (
            <p className="text-sm text-muted-foreground">No linked guardians found.</p>
          ) : (
            <>
              {guardians.length > 1 && (
                <Select value={selectedGuardian} onValueChange={setSelectedGuardian}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Select guardian" />
                  </SelectTrigger>
                  <SelectContent>
                    {guardians.map((g) => (
                      <SelectItem key={g.guardian_user_id} value={g.guardian_user_id}>
                        {g.guardian_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-muted-foreground">Tap a preset or type a custom message</p>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_MESSAGES.map((msg) => (
                  <Button
                    key={msg}
                    variant="outline"
                    size="sm"
                    className="text-xs h-auto py-2 whitespace-normal"
                    disabled={sending || !selectedGuardian}
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
                  disabled={!customMsg.trim() || sending || !selectedGuardian}
                  onClick={() => sendPing(customMsg)}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserPingDialog;
