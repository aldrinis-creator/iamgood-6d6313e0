import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Send, Users, ExternalLink } from "lucide-react";

interface ShareAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: {
    id: string;
    title: string;
    start_date: string;
    start_time: string;
    end_date?: string | null;
    end_time?: string | null;
    location?: string | null;
    doctor_name?: string | null;
    description?: string | null;
    appointment_type: string;
  } | null;
}

const ShareAppointmentDialog = ({ open, onOpenChange, appointment }: ShareAppointmentDialogProps) => {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  const { data: guardians = [], isLoading } = useQuery({
    queryKey: ["guardians-for-share", session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guardians")
        .select("id, guardian_name, guardian_phone, relation, status")
        .eq("user_id", session!.user.id)
        .eq("status", "accepted");
      if (error) throw error;
      return data;
    },
    enabled: !!session?.user?.id && open,
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleShare = async () => {
    if (!appointment || selected.length === 0) return;
    setSending(true);

    const recipients = guardians
      .filter((g) => selected.includes(g.id))
      .map((g) => ({ phone: g.guardian_phone, name: g.guardian_name }));

    try {
      const { data, error } = await supabase.functions.invoke("share-appointment-whatsapp", {
        body: { appointment, recipients },
      });

      if (error) throw error;

      // If MSG91 worked, update share_status
      if (data?.success) {
        await supabase
          .from("appointments")
          .update({ share_status: "shared" })
          .eq("id", appointment.id);

        queryClient.invalidateQueries({ queryKey: ["appointments"] });
        toast.success(`Appointment shared with ${recipients.length} member(s)`);
        setSelected([]);
        onOpenChange(false);
      } else {
        // Fallback: open wa.me links
        openWhatsAppFallback(recipients);
      }
    } catch {
      // Fallback: open wa.me links
      openWhatsAppFallback(recipients);
    } finally {
      setSending(false);
    }
  };

  const openWhatsAppFallback = (recipients: { phone: string; name: string }[]) => {
    if (!appointment) return;
    const text = encodeURIComponent(
      `📅 Appointment: ${appointment.title}\n📆 Date: ${appointment.start_date}\n⏰ Time: ${appointment.start_time?.slice(0, 5)}${appointment.location ? `\n📍 Location: ${appointment.location}` : ""}${appointment.doctor_name ? `\n👨‍⚕️ Doctor: ${appointment.doctor_name}` : ""}`
    );

    recipients.forEach((r) => {
      const phone = r.phone.replace(/[^0-9]/g, "");
      window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
    });

    // Still mark as shared
    supabase
      .from("appointments")
      .update({ share_status: "shared" })
      .eq("id", appointment.id)
      .then(() => queryClient.invalidateQueries({ queryKey: ["appointments"] }));

    toast.success("Opening WhatsApp to share appointment");
    setSelected([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Share with Member/s
          </DialogTitle>
          <DialogDescription>
            Select members to share this appointment via WhatsApp
          </DialogDescription>
        </DialogHeader>

        {appointment && (
          <div className="rounded-md border p-3 text-sm space-y-1 bg-muted/30">
            <p className="font-medium">{appointment.title}</p>
            <p className="text-muted-foreground">
              {appointment.start_date} at {appointment.start_time?.slice(0, 5)}
            </p>
            {appointment.doctor_name && (
              <p className="text-muted-foreground">Dr. {appointment.doctor_name}</p>
            )}
          </div>
        )}

        <div className="space-y-2 max-h-60 overflow-y-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Loading contacts…</p>
          ) : guardians.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No accepted guardians found. Add guardians in Settings first.
            </p>
          ) : (
            guardians.map((g) => (
              <label
                key={g.id}
                className="flex items-center gap-3 p-3 rounded-md border cursor-pointer hover:bg-accent/50 transition-colors"
              >
                <Checkbox
                  checked={selected.includes(g.id)}
                  onCheckedChange={() => toggleSelect(g.id)}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{g.guardian_name}</p>
                  <p className="text-xs text-muted-foreground">{g.guardian_phone}</p>
                </div>
                {g.relation && (
                  <Badge variant="outline" className="text-xs shrink-0">
                    {g.relation}
                  </Badge>
                )}
              </label>
            ))
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleShare}
            disabled={selected.length === 0 || sending}
            className="gap-2"
          >
            {sending ? (
              "Sending…"
            ) : (
              <>
                <Send className="w-4 h-4" />
                Share via WhatsApp ({selected.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ShareAppointmentDialog;
