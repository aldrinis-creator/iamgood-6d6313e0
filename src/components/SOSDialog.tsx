import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useApp } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Phone, MapPin, X, Droplets, AlertCircle, Stethoscope, Pill, Users } from "lucide-react";

interface SOSDialogProps {
  open: boolean;
  onClose: () => void;
}

interface MedicalInfo {
  bloodGroup: string | null;
  allergies: string[];
  conditions: string[];
  medications: string[];
  doctorName: string | null;
}

const SOSDialog = ({ open, onClose }: SOSDialogProps) => {
  const { session } = useAuth();
  const { triggerSOS, cancelSOS } = useApp();

  const [medical, setMedical] = useState<MedicalInfo>({
    bloodGroup: null, allergies: [], conditions: [], medications: [], doctorName: null,
  });
  const [guardians, setGuardians] = useState<{ guardian_name: string; guardian_phone: string; relation: string | null }[]>([]);
  const [toggles, setToggles] = useState({ blood: true, allergies: true, conditions: true, doctor: true });
  const [counting, setCounting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [sent, setSent] = useState(false);

  const fetchData = useCallback(async () => {
    if (!session?.user?.id) return;
    const uid = session.user.id;

    const [hpRes, gRes, apRes] = await Promise.all([
      supabase.from("health_profile").select("blood_group, allergies, chronic_conditions, current_medications").eq("user_id", uid).maybeSingle(),
      supabase.from("guardians").select("guardian_name, guardian_phone, relation").eq("user_id", uid),
      supabase.from("appointments").select("doctor_name").eq("user_id", uid).order("start_date", { ascending: false }).limit(1).maybeSingle(),
    ]);

    setMedical({
      bloodGroup: hpRes.data?.blood_group ?? null,
      allergies: hpRes.data?.allergies ?? [],
      conditions: hpRes.data?.chronic_conditions ?? [],
      medications: hpRes.data?.current_medications ?? [],
      doctorName: apRes.data?.doctor_name ?? null,
    });
    setGuardianCount(gRes.data?.length ?? 0);
  }, [session?.user?.id]);

  useEffect(() => {
    if (open) {
      fetchData();
      setCounting(false);
      setTimeLeft(30);
      setSent(false);
    }
  }, [open, fetchData]);

  useEffect(() => {
    if (!counting || timeLeft <= 0) return;
    const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [counting, timeLeft]);

  const vibrate = (pattern: number | number[]) => {
    if (navigator.vibrate) navigator.vibrate(pattern);
  };

  useEffect(() => {
    if (counting && timeLeft === 0) {
      triggerSOS();
      vibrate([200, 100, 200, 100, 400]);
      setSent(true);
      setCounting(false);
    }
  }, [counting, timeLeft, triggerSOS]);

  const handleCancel = () => {
    setCounting(false);
    setTimeLeft(30);
    cancelSOS();
  };

  const handleClose = () => {
    if (counting) handleCancel();
    onClose();
  };

  const toggle = (key: keyof typeof toggles) => setToggles((p) => ({ ...p, [key]: !p[key] }));

  if (sent) {
    return (
      <Sheet open={open} onOpenChange={handleClose}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-10">
          <div className="text-center space-y-4 py-6">
            <div className="w-16 h-16 rounded-full bg-sos/10 flex items-center justify-center mx-auto">
              <span className="text-3xl">🚨</span>
            </div>
            <h2 className="text-xl font-bold text-foreground">SOS Alert Sent!</h2>
            <p className="text-muted-foreground text-sm">
              Your {guardianCount} guardian(s) have been alerted with your location
              {toggles.blood && medical.bloodGroup ? " and medical info" : ""}.
            </p>
            <Button onClick={handleClose} variant="outline" className="mt-4">
              Close
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto pb-10">
        <SheetHeader className="text-left pb-2">
          <SheetTitle className="text-xl font-bold text-sos flex items-center gap-2">
            🚨 Emergency SOS
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            Get immediate help or alert your emergency contacts
          </p>
        </SheetHeader>

        {/* Call 112 */}
        <a href="tel:112" className="block mt-4">
          <Button className="w-full bg-sos text-sos-foreground hover:bg-sos/90 h-14 text-lg font-semibold gap-2">
            <Phone className="w-5 h-5" />
            Call 112 Emergency Services
          </Button>
        </a>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground font-medium uppercase">Or Alert Your Emergency Contacts</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Location note */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <MapPin className="w-4 h-4 text-success" />
          <span>Location will be included in message</span>
        </div>

        {/* Medical Info Toggles */}
        <div className="space-y-3 mb-5">
          <h3 className="text-sm font-semibold text-foreground">Medical Information to Share</h3>

          <InfoToggle
            icon={<Droplets className="w-4 h-4 text-sos" />}
            label="Blood Type"
            value={medical.bloodGroup || "Not set"}
            checked={toggles.blood}
            onToggle={() => toggle("blood")}
          />
          <InfoToggle
            icon={<AlertCircle className="w-4 h-4 text-destructive/70" />}
            label="Allergies"
            value={medical.allergies.length > 0 ? medical.allergies.join(", ") : "None"}
            checked={toggles.allergies}
            onToggle={() => toggle("allergies")}
          />
          <InfoToggle
            icon={<Pill className="w-4 h-4 text-primary" />}
            label="Conditions"
            value={
              [...medical.conditions, ...medical.medications].length > 0
                ? [...medical.conditions, ...medical.medications].join(", ")
                : "None"
            }
            checked={toggles.conditions}
            onToggle={() => toggle("conditions")}
          />
          <InfoToggle
            icon={<Stethoscope className="w-4 h-4 text-success" />}
            label="Doctor"
            value={medical.doctorName || "Not set"}
            checked={toggles.doctor}
            onToggle={() => toggle("doctor")}
          />
        </div>

        {/* Guardian count */}
        <p className="text-sm text-muted-foreground mb-4">
          <span className="font-semibold text-foreground">{guardianCount}</span> guardian(s) will receive your SOS via SMS &amp; WhatsApp
        </p>

        {/* Countdown or Send button */}
        {counting ? (
          <div className="border-2 border-sos rounded-xl p-4 space-y-3">
            <div className="text-center">
              <p className="text-sos font-bold text-lg">Sending SOS in {timeLeft}s</p>
              <p className="text-xs text-muted-foreground">Tap cancel to stop</p>
            </div>
            <Progress value={((30 - timeLeft) / 30) * 100} className="h-2 [&>div]:bg-sos" />
            <Button
              onClick={handleCancel}
              variant="outline"
              className="w-full border-sos text-sos hover:bg-sos/10"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel SOS
            </Button>
          </div>
        ) : (
          <Button
            onClick={() => { vibrate(200); setCounting(true); }}
            className="w-full bg-sos text-sos-foreground hover:bg-sos/90 h-12 text-base font-semibold"
          >
            Send SOS Alert
          </Button>
        )}
      </SheetContent>
    </Sheet>
  );
};

const InfoToggle = ({
  icon, label, value, checked, onToggle,
}: {
  icon: React.ReactNode; label: string; value: string; checked: boolean; onToggle: () => void;
}) => (
  <div className="flex items-center justify-between bg-secondary/50 rounded-lg p-3">
    <div className="flex items-center gap-3 min-w-0">
      {icon}
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{value}</p>
      </div>
    </div>
    <Switch checked={checked} onCheckedChange={onToggle} />
  </div>
);

export default SOSDialog;
