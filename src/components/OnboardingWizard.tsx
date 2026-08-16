import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Heart, UserPlus, Clock, Shield, ChevronRight, Check, Pill, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PhoneInput from "@/components/PhoneInput";
import { toast } from "sonner";

interface OnboardingWizardProps {
  open: boolean;
  onComplete: () => void;
}

const STEPS = [
  { icon: Heart, title: "Welcome to Check-iN", color: "text-primary" },
  { icon: MapPin, title: "Location Access", color: "text-blue-500" },
  { icon: UserPlus, title: "Add Your First Guardian", color: "text-success" },
  { icon: Clock, title: "Set Check-In Times", color: "text-warning" },
  { icon: Pill, title: "Add a Medication", color: "text-primary" },
  { icon: Shield, title: "Emergency Profile", color: "text-destructive" },
];

const CHECK_IN_PRESETS = [
  { label: "Morning + Evening", times: ["07:00", "19:00"] },
  { label: "3× Daily (Recommended)", times: ["07:00", "12:00", "19:00"] },
  { label: "Custom", times: [] },
];

const OnboardingWizard = ({ open, onComplete }: OnboardingWizardProps) => {
  const { session, profile } = useAuth();
  const [step, setStep] = useState(0);

  // Guardian form
  const [gName, setGName] = useState("");
  const [gPhone, setGPhone] = useState("");
  const [gEmail, setGEmail] = useState("");
  const [gRelation, setGRelation] = useState("");

  // Check-in & Nap
  const [selectedPreset, setSelectedPreset] = useState(1);
  const [defaultNapMins, setDefaultNapMins] = useState(60);

  // Medication
  const [medName, setMedName] = useState("");
  const [medTime, setMedTime] = useState("");

  // Emergency profile
  const [bloodGroup, setBloodGroup] = useState("");
  const [allergies, setAllergies] = useState("");

  const userName = profile?.full_name || "there";

  const handleNext = async () => {
    if (step === 3) {
      // Save selected check-in preset to user_settings
      await saveCheckInTimes();
    }
    if (step < 5) setStep(step + 1);
    else handleFinish();
  };

  const handleSkip = () => {
    if (step < 5) setStep(step + 1);
    else handleFinish();
  };

  const saveCheckInTimes = async () => {
    if (!session?.user?.id) return;
    const preset = CHECK_IN_PRESETS[selectedPreset];
    if (!preset || preset.times.length === 0) return;
    try {
      const { data: existing } = await supabase
        .from("user_settings")
        .select("id, settings")
        .eq("user_id", session.user.id)
        .maybeSingle();

      const currentSettings = (existing?.settings as Record<string, unknown>) || {};
      const newSettings = { 
        ...currentSettings, 
        checkInTimes: preset.times,
        defaultNapDurationMins: defaultNapMins 
      };

      if (existing) {
        await supabase.from("user_settings").update({ settings: newSettings }).eq("id", existing.id);
      } else {
        await supabase.from("user_settings").insert({ user_id: session.user.id, settings: newSettings });
      }
    } catch (e) {
      console.error("Failed to save check-in times:", e);
    }
  };

  const handleFinish = () => {
    localStorage.setItem("onboarding_complete", "true");
    onComplete();
  };

  const saveGuardian = async () => {
    if (!session?.user?.id || !gName.trim() || !gPhone.trim()) {
      toast.error("Name and phone are required");
      return;
    }
    const { error } = await addGuardianWithInvite({
      userId: session.user.id,
      guardianName: gName,
      guardianPhone: gPhone,
      guardianEmail: gEmail || null,
      relation: gRelation || null,
      isPrimary: true,
      userName: userName || "Your ward",
    });
    if (error) {
      toast.error("Failed to add guardian");
    } else {
      toast.success("Guardian added!");
      handleNext();
    }

  };

  const saveMedication = async () => {
    if (!session?.user?.id || !medName.trim() || !medTime) {
      toast.error("Name and time are required");
      return;
    }
    const { error } = await supabase.from("medications").insert({
      user_id: session.user.id,
      name: medName.trim(),
      schedule_times: [medTime],
      alarm_enabled: true,
      alarm_mode: "both",
    });
    if (error) {
      toast.error("Failed to add medication");
    } else {
      toast.success("Medication added!");
      handleNext();
    }
  };

  const saveEmergencyProfile = async () => {
    if (!session?.user?.id) return;
    const updates: any = {};
    if (bloodGroup) updates.blood_group = bloodGroup;
    if (allergies) updates.allergies = allergies.split(",").map((s) => s.trim()).filter(Boolean);

    if (Object.keys(updates).length > 0) {
      await supabase.from("health_profile").upsert(
        { user_id: session.user.id, ...updates },
        { onConflict: "user_id" }
      );
      toast.success("Emergency profile saved!");
    }
    handleFinish();
  };

  const StepIcon = STEPS[step].icon;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-sm mx-auto [&>button]:hidden">
        {/* Progress */}
        <div className="flex gap-1 mb-4">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        <div className="text-center mb-4">
          <div className={`w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3`}>
            <StepIcon className={`w-7 h-7 ${STEPS[step].color}`} />
          </div>
          <h2 className="text-lg font-bold">{STEPS[step].title}</h2>
          <Badge variant="outline" className="mt-1 text-xs">Step {step + 1} of {STEPS.length}</Badge>
        </div>

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">
              Hi <strong>{userName}</strong>! 👋 Check-iN keeps you connected to the people who care about you.
            </p>
            <div className="text-left space-y-2 bg-muted/50 rounded-lg p-3">
              <p className="text-xs font-medium">Here's what we'll set up:</p>
              <p className="text-xs text-muted-foreground">✅ Add a trusted guardian</p>
              <p className="text-xs text-muted-foreground">✅ Set your check-in schedule</p>
              <p className="text-xs text-muted-foreground">✅ Add a daily medication</p>
              <p className="text-xs text-muted-foreground">✅ Fill your emergency health profile</p>
            </div>
            <Button className="w-full gap-1" onClick={handleNext}>
              Let's Go <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Step 1: Location Access */}
        {step === 1 && (
          <div className="space-y-4 text-center">
            <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20 text-left">
              <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-500" /> Why we need your location
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                If you ever press the SOS button, we instantly send your exact GPS location to your Guardians so they can find you immediately. 
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-2 font-medium text-foreground">
                When prompted, please tap "Allow While Using App" or "Allow All The Time".
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    () => { toast.success("Location enabled!"); handleNext(); },
                    () => { toast.error("Location denied. SOS won't include your position."); handleNext(); }
                  );
                } else {
                  handleNext();
                }
              }}>
                <MapPin className="w-4 h-4 mr-1" /> Enable Location
              </Button>
              <Button variant="ghost" className="flex-1" onClick={handleSkip}>Skip</Button>
            </div>
          </div>
        )}

        {/* Step 2: Add Guardian */}
        {step === 2 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground text-center">
              Add someone who will receive your safety alerts.
            </p>
            <div>
              <Label className="text-xs">Name *</Label>
              <Input value={gName} onChange={(e) => setGName(e.target.value)} placeholder="e.g. Mom" className="text-base" />
            </div>
            <div>
              <Label className="text-xs">Phone *</Label>
              <PhoneInput value={gPhone} onChange={setGPhone} />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input value={gEmail} onChange={(e) => setGEmail(e.target.value)} placeholder="guardian@email.com" type="email" className="text-base" />
            </div>
            <div>
              <Label className="text-xs">Relation</Label>
              <Input value={gRelation} onChange={(e) => setGRelation(e.target.value)} placeholder="e.g. Daughter" className="text-base" />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={saveGuardian} disabled={!gName.trim() || !gPhone.trim()}>
                <Check className="w-4 h-4 mr-1" /> Save Guardian
              </Button>
              <Button variant="ghost" className="flex-1" onClick={handleSkip}>Skip</Button>
            </div>
          </div>
        )}

        {/* Step 3: Check-In Times */}
        {step === 3 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground text-center">
              Choose when you'd like to check in with your guardians.
            </p>
            <div className="space-y-2">
              {CHECK_IN_PRESETS.map((preset, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedPreset(i)}
                  className={`w-full p-3 rounded-lg border text-left text-sm transition-colors ${
                    selectedPreset === i ? "border-primary bg-primary/5 font-medium" : "border-border"
                  }`}
                >
                  <p>{preset.label}</p>
                  {preset.times.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {preset.times.map((t) => {
                        const [h] = t.split(":");
                        const hr = parseInt(h);
                        return hr < 12 ? `${hr} AM` : hr === 12 ? "12 PM" : `${hr - 12} PM`;
                      }).join(", ")}
                    </p>
                  )}
                </button>
              ))}
            </div>
            <div className="pt-2 border-t border-border mt-2">
              <p className="text-xs font-semibold mb-2 text-center">Default Nap Duration</p>
              <div className="grid grid-cols-4 gap-2">
                {[15, 30, 60, 120].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => setDefaultNapMins(mins)}
                    className={`py-2 rounded-md text-xs font-medium transition-colors ${
                      defaultNapMins === mins ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {mins === 60 ? "1h" : mins === 120 ? "2h" : `${mins}m`}
                  </button>
                ))}
              </div>
            </div>
            <Button className="w-full mt-2" onClick={handleNext}>
              Continue <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Step 4: Medication */}
        {step === 4 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground text-center">
              Add your most important daily medication. You can add more later.
            </p>
            <div>
              <Label className="text-xs">Medication Name</Label>
              <Input value={medName} onChange={(e) => setMedName(e.target.value)} placeholder="e.g. Vitamin D" className="text-base" />
            </div>
            <div>
              <Label className="text-xs">Scheduled Time</Label>
              <Input type="time" value={medTime} onChange={(e) => setMedTime(e.target.value)} className="text-base" />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={saveMedication} disabled={!medName.trim() || !medTime}>
                <Check className="w-4 h-4 mr-1" /> Save Medication
              </Button>
              <Button variant="ghost" className="flex-1" onClick={handleSkip}>Skip</Button>
            </div>
          </div>
        )}

        {/* Step 5: Emergency Profile */}
        {step === 5 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground text-center">
              This info helps first responders in an emergency.
            </p>
            <div>
              <Label className="text-xs">Blood Group</Label>
              <Input value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} placeholder="e.g. O+" className="text-base" />
            </div>
            <div>
              <Label className="text-xs">Allergies (comma separated)</Label>
              <Input value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="e.g. Penicillin, Peanuts" className="text-base" />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={saveEmergencyProfile}>
                <Check className="w-4 h-4 mr-1" /> Save & Finish
              </Button>
              <Button variant="ghost" className="flex-1" onClick={handleFinish}>Skip</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingWizard;
