import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getISTDateString } from "@/lib/istTime";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editId: string | null;
  appointments: any[];
}

const empty = {
  title: "",
  description: "",
  start_date: "",
  start_time: "",
  end_date: "",
  end_time: "",
  appointment_type: "in-person",
  recurrence: "none",
  location: "",
  doctor_name: "",
  alarm_enabled: true,
  alarm_sound: "default",
  first_alert: "15min",
  second_alert: "none",
};

const AddAppointmentDialog = ({ open, onOpenChange, editId, appointments }: Props) => {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (editId) {
      const apt = appointments.find((a) => a.id === editId);
      if (apt) {
        setForm({
          title: apt.title || "",
          description: apt.description || "",
          start_date: apt.start_date || "",
          start_time: apt.start_time?.slice(0, 5) || "",
          end_date: apt.end_date || "",
          end_time: apt.end_time?.slice(0, 5) || "",
          appointment_type: apt.appointment_type || "in-person",
          recurrence: apt.recurrence || "none",
          location: apt.location || "",
          doctor_name: apt.doctor_name || "",
          alarm_enabled: apt.alarm_enabled ?? true,
          alarm_sound: apt.alarm_sound || "default",
          first_alert: apt.first_alert || "15min",
          second_alert: apt.second_alert || "none",
        });
      }
    } else {
      setForm(empty);
    }
  }, [editId, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!session?.user?.id) throw new Error("Not authenticated");
      const payload = {
        user_id: session.user.id,
        title: form.title,
        description: form.description || null,
        start_date: form.start_date,
        start_time: form.start_time,
        end_date: form.end_date || null,
        end_time: form.end_time || null,
        appointment_type: form.appointment_type,
        recurrence: form.recurrence,
        location: form.location || null,
        doctor_name: form.doctor_name || null,
        alarm_enabled: form.alarm_enabled,
        alarm_sound: form.alarm_sound,
        first_alert: form.first_alert,
        second_alert: form.second_alert === "none" ? null : form.second_alert,
      };
      if (editId) {
        const { error } = await supabase.from("appointments").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("appointments").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success(editId ? "Appointment updated" : "Appointment added");
      onOpenChange(false);
      // Send appointment confirmation email for new appointments
      if (!editId && session?.user?.email) {
        supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "appointment-confirmation",
            recipientEmail: session.user.email,
            idempotencyKey: `appt-confirm-${Date.now()}`,
            templateData: {
              name: session.user.user_metadata?.full_name || "",
              title: form.title,
              date: form.start_date,
              time: form.start_time,
              doctorName: form.doctor_name || undefined,
              location: form.location || undefined,
              appointmentType: form.appointment_type,
            },
          },
        }).catch(() => {});
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const set = (key: string, val: any) => setForm((p) => ({ ...p, [key]: val }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editId ? "Edit Appointment" : "New Appointment"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Title *</Label>
            <Input placeholder="e.g., Annual Checkup, Dental Cleaning" value={form.title} onChange={(e) => set("title", e.target.value)} />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea placeholder="Additional details about the appointment" value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Date *</Label>
              <Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Time *</Label>
              <Input type="time" value={form.start_time} onChange={(e) => set("start_time", e.target.value)} />
            </div>
            <div>
              <Label>End Time</Label>
              <Input type="time" value={form.end_time} onChange={(e) => set("end_time", e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Appointment Type</Label>
            <Select value={form.appointment_type} onValueChange={(v) => set("appointment_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="in-person">🏥 In-Person</SelectItem>
                <SelectItem value="online">💻 Online</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Recurrence</Label>
            <Select value={form.recurrence} onValueChange={(v) => set("recurrence", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Does not repeat</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Location</Label>
            <Input placeholder="Hospital/Clinic name and address" value={form.location} onChange={(e) => set("location", e.target.value)} />
          </div>

          <div>
            <Label>Doctor Name</Label>
            <Input placeholder="Dr. Smith" value={form.doctor_name} onChange={(e) => set("doctor_name", e.target.value)} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Alarm Reminder</p>
              <p className="text-xs text-muted-foreground">Get notified before your appointment</p>
            </div>
            <Switch checked={form.alarm_enabled} onCheckedChange={(v) => set("alarm_enabled", v)} />
          </div>

          {form.alarm_enabled && (
            <>
              <div>
                <Label>Alarm Sound</Label>
                <Select value={form.alarm_sound} onValueChange={(v) => set("alarm_sound", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default</SelectItem>
                    <SelectItem value="chime">Chime</SelectItem>
                    <SelectItem value="bell">Bell</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>First Alert</Label>
                  <Select value={form.first_alert} onValueChange={(v) => set("first_alert", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5min">5 minutes before</SelectItem>
                      <SelectItem value="15min">15 minutes before</SelectItem>
                      <SelectItem value="30min">30 minutes before</SelectItem>
                      <SelectItem value="1hr">1 hour before</SelectItem>
                      <SelectItem value="1day">1 day before</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Second Alert</Label>
                  <Select value={form.second_alert} onValueChange={(v) => set("second_alert", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="5min">5 minutes before</SelectItem>
                      <SelectItem value="15min">15 minutes before</SelectItem>
                      <SelectItem value="30min">30 minutes before</SelectItem>
                      <SelectItem value="1hr">1 hour before</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">Snooze up to 3 times (5 min each), then auto-dismiss</p>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => mutation.mutate()} disabled={!form.title || !form.start_date || !form.start_time || mutation.isPending}>
              {editId ? "Save Changes" : "Add Appointment"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddAppointmentDialog;
