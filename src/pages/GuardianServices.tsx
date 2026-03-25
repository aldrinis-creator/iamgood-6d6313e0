import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Ambulance, Calendar, Pill, Lock, Stethoscope, FileText, Heart } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AmbulanceBooking from "@/components/AmbulanceBooking";
import AddAppointmentDialog from "@/components/appointments/AddAppointmentDialog";

const GuardianServices = () => {
  const { session } = useAuth();
  const [wardUserId, setWardUserId] = useState<string | null>(null);
  const [wardName, setWardName] = useState("User");
  const [showAmbulance, setShowAmbulance] = useState(false);
  const [showApptDialog, setShowApptDialog] = useState(false);
  const [wardAppointments, setWardAppointments] = useState<any[]>([]);

  const fetchWard = useCallback(async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase.from("guardians").select("user_id").eq("guardian_user_id", session.user.id).limit(1);
    if (data?.[0]) {
      setWardUserId(data[0].user_id);
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", data[0].user_id).single();
      if (profile?.full_name) setWardName(profile.full_name);

      // Fetch ward's appointments for the dialog
      const { data: appts } = await supabase.from("appointments").select("*").eq("user_id", data[0].user_id).order("start_date", { ascending: false });
      if (appts) setWardAppointments(appts);
    }
  }, [session?.user?.id]);

  useEffect(() => { fetchWard(); }, [fetchWard]);

  const availableServices = [
    {
      icon: Ambulance,
      title: "Book Ambulance",
      desc: `Request emergency ambulance for ${wardName}`,
      color: "text-destructive",
      action: () => setShowAmbulance(!showAmbulance),
      available: true,
    },
    {
      icon: Calendar,
      title: "Book Appointment",
      desc: `Schedule appointment on behalf of ${wardName}`,
      color: "text-primary",
      action: () => setShowApptDialog(true),
      available: !!wardUserId,
    },
  ];

  const restrictedServices = [
    { icon: Heart, title: "Face Scan" },
    { icon: Stethoscope, title: "Symptom Checker" },
    { icon: FileText, title: "Document Analyzer" },
    { icon: Pill, title: "Medication Info" },
  ];

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Stethoscope className="w-5 h-5 text-primary" /> Services
        </h1>

        {/* Available services */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Available</p>
          {availableServices.map(s => (
            <Card key={s.title} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={s.action}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <div>
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {showAmbulance && <AmbulanceBooking />}

        {/* Restricted services */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">User Features</p>
          {restrictedServices.map(s => (
            <Card key={s.title} className="opacity-60">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <s.icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">{s.title}</p>
                  <p className="text-xs text-muted-foreground">Register as a User to access this feature</p>
                </div>
                <Lock className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Appointment dialog for ward */}
        {wardUserId && (
          <AddAppointmentDialog
            open={showApptDialog}
            onOpenChange={setShowApptDialog}
            editId={null}
            appointments={wardAppointments}
          />
        )}
      </div>
    </AppLayout>
  );
};

export default GuardianServices;
