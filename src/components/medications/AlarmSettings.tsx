import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Volume2, Pill, Bell } from "lucide-react";
import { playChime, playVoiceReminder } from "@/lib/audioAlerts";
import { toast } from "sonner";

interface Medication {
  id: string;
  name: string;
  alarm_enabled: boolean;
  alarm_mode: string;
  schedule_times: string[];
}

const AlarmSettings = () => {
  const { session } = useAuth();
  const [meds, setMeds] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase
      .from("medications")
      .select("id, name, alarm_enabled, alarm_mode, schedule_times")
      .eq("user_id", session.user.id)
      .order("name");
    setMeds((data as Medication[]) || []);
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => { load(); }, [load]);

  const toggleAlarm = async (med: Medication) => {
    await supabase
      .from("medications")
      .update({ alarm_enabled: !med.alarm_enabled })
      .eq("id", med.id);
    load();
  };

  const setMode = async (med: Medication, mode: string) => {
    await supabase
      .from("medications")
      .update({ alarm_mode: mode })
      .eq("id", med.id);
    load();
  };

  const testAlarm = (med: Medication) => {
    if (med.alarm_mode === "chime") {
      playChime();
    } else if (med.alarm_mode === "voice") {
      playVoiceReminder(`Time to take ${med.name}`);
    }
    toast.info(`Testing alarm for ${med.name}`);
  };

  if (loading) return <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>;

  if (meds.length === 0) {
    return (
      <div className="text-center py-8 space-y-2">
        <Bell className="w-10 h-10 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">Add medications first to configure alarms.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Configure audio reminders for each medication. Alarms fire when the app is open at scheduled times.
      </p>

      {meds.map((med) => (
        <Card key={med.id}>
          <CardContent className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pill className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">{med.name}</span>
              </div>
              <Switch checked={med.alarm_enabled} onCheckedChange={() => toggleAlarm(med)} />
            </div>

            {med.alarm_enabled && (
              <>
                <RadioGroup value={med.alarm_mode} onValueChange={(v) => setMode(med, v)} className="space-y-1">
                  <div className="flex items-center space-x-3 p-1.5 rounded hover:bg-muted/50">
                    <RadioGroupItem value="chime" id={`chime-${med.id}`} />
                    <Label htmlFor={`chime-${med.id}`} className="text-xs cursor-pointer">Chime</Label>
                  </div>
                  <div className="flex items-center space-x-3 p-1.5 rounded hover:bg-muted/50">
                    <RadioGroupItem value="voice" id={`voice-${med.id}`} />
                    <Label htmlFor={`voice-${med.id}`} className="text-xs cursor-pointer">Voice — "Time to take {med.name}"</Label>
                  </div>
                  <div className="flex items-center space-x-3 p-1.5 rounded hover:bg-muted/50">
                    <RadioGroupItem value="off" id={`off-${med.id}`} />
                    <Label htmlFor={`off-${med.id}`} className="text-xs cursor-pointer">Off</Label>
                  </div>
                </RadioGroup>
                <Button size="sm" variant="outline" className="w-full" onClick={() => testAlarm(med)} disabled={med.alarm_mode === "off"}>
                  <Volume2 className="w-3 h-3 mr-1" /> Test Alarm
                </Button>
              </>
            )}

            <p className="text-xs text-muted-foreground">
              Times: {med.schedule_times.map((t) => {
                const [h, m] = t.split(":").map(Number);
                const d = new Date(); d.setHours(h, m);
                return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
              }).join(", ")}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default AlarmSettings;
