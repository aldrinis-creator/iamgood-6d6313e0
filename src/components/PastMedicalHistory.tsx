import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserSettings } from "@/hooks/useUserSettings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Hospital, Scissors, Plus, Trash2, Calendar, Loader2 } from "lucide-react";

interface MedicalHistoryEntry {
  id: string;
  type: "hospitalization" | "surgery";
  reason: string;
  nature: string | null;
  start_date: string | null;
  end_date: string | null;
  treatment: string | null;
  medications: string | null;
  advice: string | null;
  hospital_name: string | null;
  doctor_name: string | null;
}

const EMPTY_FORM = {
  reason: "",
  nature: "",
  start_date: "",
  end_date: "",
  treatment: "",
  medications: "",
  advice: "",
  hospital_name: "",
  doctor_name: "",
};

interface SectionProps {
  type: "hospitalization" | "surgery";
  title: string;
  icon: React.ReactNode;
  hasEntries: boolean;
  onToggle: (v: boolean) => void;
  entries: MedicalHistoryEntry[];
  editing: boolean;
  userId: string;
  onRefresh: () => void;
}

const HistorySection = ({ type, title, icon, hasEntries, onToggle, entries, editing, userId, onRefresh }: SectionProps) => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!form.reason.trim()) { toast.error("Reason is required"); return; }
    setSaving(true);
    const { error } = await supabase.from("medical_history" as any).insert({
      user_id: userId,
      type,
      reason: form.reason.trim(),
      nature: form.nature || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      treatment: form.treatment || null,
      medications: form.medications || null,
      advice: form.advice || null,
      hospital_name: form.hospital_name || null,
      doctor_name: form.doctor_name || null,
    } as any);
    setSaving(false);
    if (error) toast.error("Failed to save");
    else { toast.success(`${title} added`); setForm(EMPTY_FORM); setShowForm(false); onRefresh(); }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("medical_history" as any).delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else { toast.success("Entry removed"); onRefresh(); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium flex items-center gap-2">
          {icon} {title} (Last 10 Years)?
        </Label>
        {editing ? (
          <Switch checked={hasEntries} onCheckedChange={onToggle} />
        ) : (
          <Badge variant={hasEntries ? "default" : "secondary"} className="text-xs">
            {hasEntries ? "Yes" : "No"}
          </Badge>
        )}
      </div>

      {hasEntries && (
        <div className="space-y-2 pl-1">
          {entries.map((entry) => (
            <div key={entry.id} className="p-3 rounded-lg bg-muted/50 space-y-1">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{entry.reason}</p>
                  {entry.nature && <p className="text-xs text-muted-foreground">Nature: {entry.nature}</p>}
                  {(entry.start_date || entry.end_date) && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {entry.start_date && new Date(entry.start_date).toLocaleDateString("en-IN")}
                      {entry.end_date && ` — ${new Date(entry.end_date).toLocaleDateString("en-IN")}`}
                    </p>
                  )}
                  {entry.hospital_name && <p className="text-xs text-muted-foreground">Hospital: {entry.hospital_name}</p>}
                  {entry.doctor_name && <p className="text-xs text-muted-foreground">Doctor: {entry.doctor_name}</p>}
                  {entry.treatment && <p className="text-xs text-muted-foreground">Treatment: {entry.treatment}</p>}
                  {entry.medications && <p className="text-xs text-muted-foreground">Medications: {entry.medications}</p>}
                  {entry.advice && <p className="text-xs text-muted-foreground">Advice: {entry.advice}</p>}
                </div>
                {editing && (
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0" onClick={() => handleDelete(entry.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}

          {editing && !showForm && (
            <Button variant="outline" size="sm" className="w-full" onClick={() => setShowForm(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add {title}
            </Button>
          )}

          {editing && showForm && (
            <div className="p-3 rounded-lg border border-border space-y-3">
              <div><Label className="text-xs">Reason *</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Appendicitis" className="text-base" /></div>
              <div><Label className="text-xs">Nature</Label><Input value={form.nature} onChange={(e) => setForm({ ...form, nature: e.target.value })} placeholder="e.g. Emergency / Planned" className="text-base" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Start Date</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="text-base" /></div>
                <div><Label className="text-xs">End Date</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="text-base" /></div>
              </div>
              <div><Label className="text-xs">Hospital Name</Label><Input value={form.hospital_name} onChange={(e) => setForm({ ...form, hospital_name: e.target.value })} placeholder="Hospital name" className="text-base" /></div>
              <div><Label className="text-xs">Doctor Name</Label><Input value={form.doctor_name} onChange={(e) => setForm({ ...form, doctor_name: e.target.value })} placeholder="Doctor name" className="text-base" /></div>
              <div><Label className="text-xs">Treatment Given</Label><Textarea value={form.treatment} onChange={(e) => setForm({ ...form, treatment: e.target.value })} placeholder="Treatment details" rows={2} /></div>
              <div><Label className="text-xs">Medications Prescribed</Label><Textarea value={form.medications} onChange={(e) => setForm({ ...form, medications: e.target.value })} placeholder="Medications prescribed" rows={2} /></div>
              <div><Label className="text-xs">Other Advice</Label><Textarea value={form.advice} onChange={(e) => setForm({ ...form, advice: e.target.value })} placeholder="Any other advice" rows={2} /></div>
              <div className="flex gap-2">
                <Button className="flex-1" disabled={saving} onClick={handleAdd}>
                  {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />} Save
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const PastMedicalHistory = ({ editing }: { editing: boolean }) => {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { settings, updateSetting } = useUserSettings();
  const [entries, setEntries] = useState<MedicalHistoryEntry[]>([]);

  const loadEntries = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("medical_history" as any)
      .select("*")
      .eq("user_id", userId)
      .order("start_date", { ascending: false });
    if (data) setEntries(data as any);
  }, [userId]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const hospitalizations = entries.filter((e) => e.type === "hospitalization");
  const surgeries = entries.filter((e) => e.type === "surgery");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Hospital className="w-4 h-4 text-primary" /> Past Medical History
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <HistorySection
          type="hospitalization"
          title="Hospitalization"
          icon={<Hospital className="w-3.5 h-3.5 text-muted-foreground" />}
          hasEntries={settings.hasHospitalizations}
          onToggle={(v) => updateSetting("hasHospitalizations", v)}
          entries={hospitalizations}
          editing={editing}
          userId={userId!}
          onRefresh={loadEntries}
        />
        <div className="border-t" />
        <HistorySection
          type="surgery"
          title="Surgery"
          icon={<Scissors className="w-3.5 h-3.5 text-muted-foreground" />}
          hasEntries={settings.hasSurgeries}
          onToggle={(v) => updateSetting("hasSurgeries", v)}
          entries={surgeries}
          editing={editing}
          userId={userId!}
          onRefresh={loadEntries}
        />
      </CardContent>
    </Card>
  );
};

export default PastMedicalHistory;
