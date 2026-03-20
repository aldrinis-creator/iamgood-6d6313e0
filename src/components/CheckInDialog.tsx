import { useState, useEffect } from "react";
import { X, Phone, Users, Stethoscope } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Step = "ask" | "well" | "not-well";

interface Guardian {
  id: string;
  guardian_name: string;
  guardian_phone: string;
  relation: string | null;
}

interface CheckInDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirmOk: () => void;
}

const CheckInDialog = ({ open, onClose, onConfirmOk }: CheckInDialogProps) => {
  const { session } = useAuth();
  const [step, setStep] = useState<Step>("ask");
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [doctorName, setDoctorName] = useState<string | null>(null);
  const [doctorPhone, setDoctorPhone] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep("ask");
    }
  }, [open]);

  const fetchContacts = async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase
      .from("guardians")
      .select("id, guardian_name, guardian_phone, relation")
      .eq("user_id", session.user.id);
    if (data) setGuardians(data);

    // Try to get doctor from health_profile or appointments
    const { data: appt } = await supabase
      .from("appointments")
      .select("doctor_name")
      .eq("user_id", session.user.id)
      .not("doctor_name", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);
    if (appt && appt.length > 0 && appt[0].doctor_name) {
      setDoctorName(appt[0].doctor_name);
    }
  };

  const handleYes = () => {
    onConfirmOk();
    setStep("well");
  };

  const handleNo = () => {
    fetchContacts();
    setStep("not-well");
  };

  const handleCall = (phone: string) => {
    window.open(`tel:${phone}`, "_self");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-background rounded-2xl shadow-xl w-[90%] max-w-md mx-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Close button */}
        <div className="flex justify-end p-3 pb-0">
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X className="w-6 h-6" />
          </button>
        </div>

        {step === "ask" && (
          <div className="px-6 pb-8 text-center space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Are you OK? 😊</h2>
              <p className="text-lg text-muted-foreground mt-2">Let us know how you're feeling</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={handleYes}
                className="py-10 rounded-xl border-2 border-primary text-3xl font-bold text-foreground bg-primary/5 hover:bg-primary/10 transition-colors"
              >
                Yes
              </button>
              <button
                onClick={handleNo}
                className="py-10 rounded-xl border-2 border-border text-3xl font-bold text-foreground hover:bg-muted transition-colors"
              >
                No
              </button>
            </div>
          </div>
        )}

        {step === "well" && (
          <div className="px-6 pb-8 text-center space-y-4">
            <div className="w-24 h-24 mx-auto rounded-full bg-success/15 flex items-center justify-center">
              <span className="text-5xl">😊</span>
            </div>
            <h2 className="text-2xl font-bold text-foreground">Great to know you're Well!</h2>
            <p className="text-lg text-muted-foreground">Have a wonderful day!</p>
          </div>
        )}

        {step === "not-well" && (
          <div className="px-6 pb-6 space-y-4">
            <h2 className="text-xl font-bold text-foreground text-center">
              Do you want to talk to your Doctor or Guardians?
            </h2>

            {doctorName && (
              <div className="bg-muted rounded-xl p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Stethoscope className="w-5 h-5 text-primary" />
                  <span className="font-semibold">Your Doctor</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground text-lg">{doctorName}</p>
                    {doctorPhone && <p className="text-muted-foreground">{doctorPhone}</p>}
                  </div>
                  {doctorPhone && (
                    <button
                      onClick={() => handleCall(doctorPhone)}
                      className="flex items-center gap-2 bg-success text-success-foreground px-4 py-2 rounded-lg font-semibold"
                    >
                      <Phone className="w-4 h-4" /> Call
                    </button>
                  )}
                </div>
              </div>
            )}

            {guardians.length > 0 && (
              <div className="bg-muted rounded-xl p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Users className="w-5 h-5 text-primary" />
                  <span className="font-semibold">Your Guardians</span>
                </div>
                <div className="space-y-3">
                  {guardians.map((g) => (
                    <div key={g.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-foreground text-lg">{g.guardian_name}</p>
                        <p className="text-muted-foreground">{g.guardian_phone}</p>
                      </div>
                      <button
                        onClick={() => handleCall(g.guardian_phone)}
                        className="flex items-center gap-2 bg-success text-success-foreground px-4 py-2 rounded-lg font-semibold"
                      >
                        <Phone className="w-4 h-4" /> Call
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl border border-border text-lg font-semibold text-foreground hover:bg-muted transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CheckInDialog;
