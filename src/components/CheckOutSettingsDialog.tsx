import { useState, useEffect } from "react";
import { DoorOpen, MessageCircle, Mail } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { CheckOutConfig, DEFAULT_CHECKOUT_CONFIG } from "@/hooks/useUserSettings";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Guardian {
  id: string;
  guardian_name: string;
  guardian_phone: string;
  guardian_email: string | null;
}

interface CheckOutSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  currentConfig: CheckOutConfig;
  onSave: (config: CheckOutConfig) => void;
}

const DURATION_OPTIONS = [
  { value: "30min", label: "30 minutes" },
  { value: "1h", label: "1 hour" },
  { value: "2h", label: "2 hours" },
  { value: "3h", label: "3 hours" },
  { value: "4h", label: "4 hours" },
  { value: "6h", label: "6 hours" },
  { value: "8h", label: "8 hours" },
];

const REASON_OPTIONS = [
  "Shopping / Errands",
  "Doctor visit",
  "Visiting family / friends",
  "Travel",
  "Exercise / Walk",
  "Other",
];

const durationToMs = (d: string): number => {
  if (d.endsWith("min")) return parseInt(d) * 60 * 1000;
  if (d.endsWith("h")) return parseInt(d) * 3600 * 1000;
  return 3600 * 1000;
};

const CheckOutSettingsDialog = ({ open, onClose, currentConfig, onSave }: CheckOutSettingsDialogProps) => {
  const { session } = useAuth();
  const [config, setConfig] = useState<CheckOutConfig>({ ...DEFAULT_CHECKOUT_CONFIG, ...currentConfig });
  const [guardians, setGuardians] = useState<Guardian[]>([]);

  useEffect(() => {
    if (!session?.user?.id || !open) return;
    supabase
      .from("guardians")
      .select("id, guardian_name, guardian_phone, guardian_email")
      .eq("user_id", session.user.id)
      .then(({ data }) => {
        if (data) setGuardians(data as Guardian[]);
      });
  }, [session?.user?.id, open]);

  const update = <K extends keyof CheckOutConfig>(key: K, value: CheckOutConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const toggleGuardian = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      selectedGuardianIds: prev.selectedGuardianIds.includes(id)
        ? prev.selectedGuardianIds.filter((g) => g !== id)
        : [...prev.selectedGuardianIds, id],
    }));
  };

  const handleSave = () => {
    const endsAt = config.durationType === "quick"
      ? new Date(Date.now() + durationToMs(config.duration)).toISOString()
      : config.endDate
        ? new Date(config.endDate + "T23:59:59").toISOString()
        : null;

    onSave({ ...config, endsAt });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <DoorOpen className="w-5 h-5" />
            Check-Out Settings
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Set a check-out period when you'll be away. Check-in reminders will be paused during this time.
        </p>

        {/* Duration Type */}
        <div className="space-y-2 mt-2">
          <Label className="text-sm font-semibold">Duration Type</Label>
          <RadioGroup
            value={config.durationType}
            onValueChange={(v) => update("durationType", v as "quick" | "date-range")}
            className="space-y-2"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="quick" id="quick" />
              <Label htmlFor="quick" className="text-sm flex items-center gap-1.5 cursor-pointer">
                <span>⏱</span> Quick Time Slot
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="date-range" id="date-range" />
              <Label htmlFor="date-range" className="text-sm flex items-center gap-1.5 cursor-pointer">
                <span>📅</span> Date Range (Travel/Vacation)
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Quick: Duration select */}
        {config.durationType === "quick" && (
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">How long?</Label>
            <Select value={config.duration} onValueChange={(v) => update("duration", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Date Range */}
        {config.durationType === "date-range" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Start Date</Label>
              <Input
                type="date"
                value={config.startDate || ""}
                onChange={(e) => update("startDate", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">End Date</Label>
              <Input
                type="date"
                value={config.endDate || ""}
                onChange={(e) => update("endDate", e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Reason */}
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold">Reason</Label>
          <Select value={config.reason} onValueChange={(v) => update("reason", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Why are you checking out?" />
            </SelectTrigger>
            <SelectContent>
              {REASON_OPTIONS.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Inform guardians */}
        <div className="space-y-3 mt-1">
          <div className="flex items-center gap-2">
            <Checkbox
              id="inform-guardians"
              checked={config.informGuardians}
              onCheckedChange={(c) => update("informGuardians", !!c)}
            />
            <Label htmlFor="inform-guardians" className="text-sm font-medium cursor-pointer">
              Inform my guardians about this check-out
            </Label>
          </div>

          {config.informGuardians && (
            <>
              <div className="space-y-2 pl-2">
                <Label className="text-sm text-muted-foreground">Notify via</Label>
                <RadioGroup
                  value={config.notifyVia}
                  onValueChange={(v) => update("notifyVia", v as "whatsapp" | "email" | "both")}
                  className="space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="whatsapp" id="nv-wa" />
                    <Label htmlFor="nv-wa" className="text-sm flex items-center gap-1.5 cursor-pointer">
                      <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="email" id="nv-email" />
                    <Label htmlFor="nv-email" className="text-sm flex items-center gap-1.5 cursor-pointer">
                      <Mail className="w-3.5 h-3.5" /> Email
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="both" id="nv-both" />
                    <Label htmlFor="nv-both" className="text-sm cursor-pointer">Both</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Guardian selection */}
              {guardians.length > 0 && (
                <div className="space-y-2 pl-2">
                  <Label className="text-sm text-muted-foreground">Select guardians to inform</Label>
                  {guardians.map((g) => (
                    <div key={g.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`g-${g.id}`}
                        checked={config.selectedGuardianIds.includes(g.id)}
                        onCheckedChange={() => toggleGuardian(g.id)}
                      />
                      <Label htmlFor={`g-${g.id}`} className="text-sm cursor-pointer flex items-center gap-2">
                        {g.guardian_name}
                        {g.guardian_phone && (
                          <span className="text-xs bg-muted px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <MessageCircle className="w-3 h-3" /> Phone
                          </span>
                        )}
                        {g.guardian_email && (
                          <span className="text-xs bg-muted px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <Mail className="w-3 h-3" /> Email
                          </span>
                        )}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CheckOutSettingsDialog;
