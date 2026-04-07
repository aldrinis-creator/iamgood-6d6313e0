import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, MapPin, Plus, Pencil, Trash2, Share2, Bell, Hourglass } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format, formatDistanceToNow, isToday, parseISO, isBefore, startOfDay } from "date-fns";
import AddAppointmentDialog from "@/components/appointments/AddAppointmentDialog";

const Appointments = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "today">("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["appointments", session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .order("start_date", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!session?.user?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Appointment deleted");
    },
  });

  const filtered = filter === "today"
    ? appointments.filter((a) => isToday(parseISO(a.start_date)))
    : appointments;

  const todayCount = appointments.filter((a) => isToday(parseISO(a.start_date))).length;

  const getCountdown = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isBefore(date, startOfDay(new Date()))) return "Past";
    return formatDistanceToNow(date, { addSuffix: true });
  };

  const alertLabel = (val: string | null) => {
    if (!val || val === "none") return null;
    const map: Record<string, string> = {
      "5min": "5 minutes before",
      "15min": "15 minutes before",
      "30min": "30 minutes before",
      "1hr": "1 hour before",
      "1day": "1 day before",
    };
    return map[val] || val;
  };

  return (
    <AppLayout>
      <div className="p-4 pb-24 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CalendarDays className="w-7 h-7 text-primary" />
              Appointments
            </h1>
            <p className="text-sm text-muted-foreground">Schedule and manage your medical appointments</p>
          </div>
          <Button onClick={() => { setEditingId(null); setShowAdd(true); }} className="gap-1">
            <Plus className="w-4 h-4" /> Add Appointment
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            variant={filter === "today" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(filter === "today" ? "all" : "today")}
            className={`gap-1 ${todayCount > 0 ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 border-destructive" : ""}`}
          >
            <Clock className="w-3.5 h-3.5" />
            Due Today {todayCount > 0 && <Badge variant="secondary" className="ml-1 text-xs bg-destructive-foreground text-destructive">{todayCount}</Badge>}
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <CalendarDays className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>No appointments {filter === "today" ? "today" : "yet"}</p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map((apt) => {
              const isDueToday = isToday(parseISO(apt.start_date));
              return (
              <Card key={apt.id} className={`p-4 space-y-3 overflow-hidden min-w-0 ${isDueToday ? "border-destructive border-2 shadow-[0_0_8px_hsl(var(--destructive)/0.3)]" : ""}`}>
                <div className="flex items-start justify-between">
                  <div className="space-y-1 min-w-0">
                    <h3 className="font-semibold text-base break-words">{apt.title}</h3>
                    <Badge variant={apt.appointment_type === "online" ? "secondary" : "outline"} className="text-xs">
                      {apt.appointment_type === "online" ? "Online" : "In-Person"}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingId(apt.id); setShowAdd(true); }}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(apt.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground space-y-1">
                  <p className="flex items-center gap-1 flex-wrap">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    Starts {format(parseISO(apt.start_date), "EEE, MMM d")} at {apt.start_time?.slice(0, 5)}
                    {apt.end_date && ` — ends ${format(parseISO(apt.end_date), "MMM d")} at ${apt.end_time?.slice(0, 5)}`}
                  </p>
                  <p className="flex items-center gap-1 text-xs">
                    <Hourglass className="w-3 h-3" /> {getCountdown(apt.start_date)}
                  </p>
                </div>

                {apt.description && <p className="text-sm break-words">{apt.description}</p>}

                {apt.location && (
                  <p className="text-sm flex items-center gap-1 text-muted-foreground break-words">
                    <MapPin className="w-3.5 h-3.5 shrink-0" /> {apt.location}
                  </p>
                )}

                <div className="flex items-center justify-center gap-2 border rounded-md py-2 text-sm">
                  <Share2 className="w-4 h-4" />
                  Share with Doctor
                  <Badge variant={apt.share_status === "shared" ? "default" : "secondary"} className="text-xs">
                    {apt.share_status === "shared" ? "Shared" : "Pending"}
                  </Badge>
                </div>

                {apt.alarm_enabled && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Bell className="w-3 h-3" />
                    Alert: {alertLabel(apt.first_alert)}
                    {alertLabel(apt.second_alert) && ` + ${alertLabel(apt.second_alert)}`}
                  </p>
                )}
              </Card>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Appointment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this appointment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteId) deleteMutation.mutate(deleteId); setDeleteId(null); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddAppointmentDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        editId={editingId}
        appointments={appointments}
      />
    </AppLayout>
  );
};

export default Appointments;
