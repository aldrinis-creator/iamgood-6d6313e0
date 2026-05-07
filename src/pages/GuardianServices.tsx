import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Ambulance, Calendar, Pill, Lock, Stethoscope, FileText, Heart, ShieldCheck } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AmbulanceBooking from "@/components/AmbulanceBooking";
import AddAppointmentDialog from "@/components/appointments/AddAppointmentDialog";
import { useGuardianWard } from "@/contexts/GuardianWardContext";
import WardPicker from "@/components/WardPicker";
import VaultClaimCard from "@/components/vault/VaultClaimCard";
import { useVaultClaimStatus } from "@/components/vault/useVaultClaimStatus";

const GuardianServices = () => {
  const { session } = useAuth();
  const { selectedWard } = useGuardianWard();
  const wardUserId = selectedWard?.userId || null;
  const wardName = selectedWard?.name || "User";
  const [showAmbulance, setShowAmbulance] = useState(false);
  const [showVault, setShowVault] = useState(false);
  const { eligible: vaultEligible } = useVaultClaimStatus(wardUserId);
  const [showApptDialog, setShowApptDialog] = useState(false);
  const [wardAppointments, setWardAppointments] = useState<any[]>([]);
  const [wardPhone, setWardPhone] = useState<string>("");
  const [wardLocation, setWardLocation] = useState<{ lat: number; lng: number } | null>(null);

  const fetchWardAppointments = useCallback(async () => {
    if (!wardUserId) return;
    const { data: appts } = await supabase.from("appointments").select("*").eq("user_id", wardUserId).order("start_date", { ascending: false });
    if (appts) setWardAppointments(appts);
  }, [wardUserId]);

  const fetchWardDetails = useCallback(async () => {
    if (!wardUserId) return;
    // Fetch phone from profile
    const { data: profile } = await supabase.from("profiles").select("phone").eq("id", wardUserId).maybeSingle();
    if (profile?.phone) setWardPhone(profile.phone);
    else setWardPhone("");

    // Fetch last known location from user_settings — only honor it if the
    // ward has consented to sharing location with guardians.
    const { data: settings } = await supabase.from("user_settings" as any).select("settings").eq("user_id", wardUserId).maybeSingle();
    if (settings) {
      const s = (settings as any).settings;
      const consent = s?.shareLocationWithGuardian !== false && s?.shareLocation !== false;
      if (consent && s?.lastLocation?.lat && s?.lastLocation?.lng) {
        setWardLocation({ lat: s.lastLocation.lat, lng: s.lastLocation.lng });
      } else {
        setWardLocation(null);
      }
    } else {
      setWardLocation(null);
    }
  }, [wardUserId]);

  useEffect(() => { fetchWardAppointments(); fetchWardDetails(); }, [fetchWardAppointments, fetchWardDetails]);

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
        <WardPicker />
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
          {vaultEligible && wardUserId && (
            <Card
              className="cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => setShowVault(v => !v)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Vault Nominee Access</p>
                  <p className="text-xs text-muted-foreground">Available if the worst should happen.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {showAmbulance && (
          <AmbulanceBooking
            wardUserId={wardUserId || undefined}
            wardName={wardName}
            wardLocation={wardLocation}
            wardPhone={wardPhone}
          />
        )}

        {showVault && wardUserId && (
          <VaultClaimCard wardUserId={wardUserId} wardName={wardName} />
        )}

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
            wardUserId={wardUserId}
          />
        )}
      </div>
    </AppLayout>
  );
};

export default GuardianServices;
