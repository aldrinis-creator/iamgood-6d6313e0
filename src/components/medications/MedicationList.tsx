import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Pill, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatScheduleTime, getISTDateString } from "@/lib/istTime";
import { WEEKDAYS, getISTWeekday, scheduleDaysLabel } from "@/lib/medSchedule";

interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  instructions: string | null;
  total_quantity: number;
  remaining_quantity: number;
  low_stock_threshold: number;
  schedule_times: string[];
  schedule_days: number[] | null;
  start_date: string;
  end_date: string | null;
}

const FREQUENCIES = [
  { value: "once_daily", label: "Once daily" },
  { value: "twice_daily", label: "Twice daily" },
  { value: "three_daily", label: "Three times daily" },
  { value: "once_weekly", label: "Once a week" },
  { value: "as_needed", label: "As needed" },
];

const emptyForm = {
  name: "",
  dosage: "1 tablet",
  frequency: "once_daily",
  instructions: "",
  total_quantity: "30",
  remaining_quantity: "30",
  low_stock_threshold: "5",
  schedule_times: ["08:00"],
  schedule_days: [] as number[],
  start_date: new Date().toISOString().split("T")[0],
  end_date: "",
};

interface MedicationListProps {
  onChange?: () => void;
}

const MedicationList = ({ onChange }: MedicationListProps = {}) => {
  const { session } = useAuth();
  const [activeMeds, setActiveMeds] = useState<Medication[]>([]);
  const [endedMeds, setEndedMeds] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Medication | null>(null);
  const [continueTarget, setContinueTarget] = useState<Medication | null>(null);
  const [continueDate, setContinueDate] = useState<string>("");

  const loadMeds = useCallback(async () => {
    if (!session?.user?.id) return;
    const today = getISTDateString();
    const { data } = await supabase
      .from("medications")
      .select("*")
      .eq("user_id", session.user.id)
      .order("name");
    const all = (data as Medication[]) || [];
    setActiveMeds(all.filter((m) => !m.end_date || m.end_date >= today));
    setEndedMeds(all.filter((m) => m.end_date && m.end_date < today));
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => { loadMeds(); }, [loadMeds]);

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (med: Medication) => {
    setEditId(med.id);
    setForm({
      name: med.name,
      dosage: med.dosage,
      frequency: med.frequency,
      instructions: med.instructions || "",
      total_quantity: String(med.total_quantity),
      remaining_quantity: String(med.remaining_quantity),
      low_stock_threshold: String(med.low_stock_threshold),
      schedule_times: med.schedule_times,
      schedule_days: (med.schedule_days || []) as number[],
      start_date: med.start_date,
      end_date: med.end_date || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!session?.user?.id || !form.name.trim()) {
      toast.error("Medication name is required");
      return;
    }

    const totalQty = Number(form.total_quantity);
    const remainingQty = Number(form.remaining_quantity);
    const threshold = Number(form.low_stock_threshold);

    if (!totalQty || totalQty <= 0) {
      toast.error("Total quantity must be greater than 0");
      return;
    }
    if (remainingQty < 0) {
      toast.error("Remaining quantity cannot be negative");
      return;
    }
    if (remainingQty > totalQty) {
      toast.error("Remaining quantity cannot exceed total quantity");
      return;
    }
    if (threshold < 0) {
      toast.error("Low stock threshold cannot be negative");
      return;
    }

    if (form.frequency === "once_weekly" && form.schedule_days.length === 0) {
      toast.error("Please select the day of the week");
      return;
    }

    const payload = {
      user_id: session.user.id,
      name: form.name.trim(),
      dosage: form.dosage,
      frequency: form.frequency,
      instructions: form.instructions || null,
      total_quantity: totalQty,
      remaining_quantity: remainingQty,
      low_stock_threshold: threshold,
      schedule_times: form.schedule_times,
      schedule_days: form.frequency === "once_weekly" && form.schedule_days.length > 0 ? form.schedule_days : null,
      start_date: form.start_date,
      end_date: form.end_date || null,
    };

    if (editId) {
      const { error } = await supabase.from("medications").update(payload).eq("id", editId);
      if (error) { toast.error("Failed to update"); return; }
      toast.success("Medication updated");
    } else {
      const { error } = await supabase.from("medications").insert(payload);
      if (error) { toast.error("Failed to add"); return; }
      toast.success("Medication added");
    }

    setDialogOpen(false);
    loadMeds();
    onChange?.();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("medications").delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); return; }
    toast.success("Medication deleted");
    loadMeds();
    onChange?.();
  };

  const handleContinue = async () => {
    if (!continueTarget) return;
    const newEnd = continueDate || null;
    const { error } = await supabase
      .from("medications")
      .update({ end_date: newEnd })
      .eq("id", continueTarget.id);
    if (error) { toast.error("Failed to continue"); return; }
    toast.success(newEnd ? `${continueTarget.name} continued until ${newEnd}` : `${continueTarget.name} continued (no end date)`);
    setContinueTarget(null);
    setContinueDate("");
    loadMeds();
    onChange?.();
  };

  const openContinue = (med: Medication) => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setContinueDate(d.toISOString().split("T")[0]);
    setContinueTarget(med);
  };

  const addScheduleTime = () => {
    setForm((f) => ({ ...f, schedule_times: [...f.schedule_times, "12:00"] }));
  };

  const updateScheduleTime = (idx: number, val: string) => {
    setForm((f) => {
      const times = [...f.schedule_times];
      times[idx] = val;
      return { ...f, schedule_times: times };
    });
  };

  const removeScheduleTime = (idx: number) => {
    setForm((f) => ({ ...f, schedule_times: f.schedule_times.filter((_, i) => i !== idx) }));
  };

  if (loading) return <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>;

  return (
    <div className="space-y-3">
      <Button onClick={openAdd} className="w-full" variant="outline">
        <Plus className="w-4 h-4 mr-1" /> Add Medication
      </Button>

      {endedMeds.length > 0 && (
        <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
            Ended medications — continue or delete?
          </p>
          {endedMeds.map((med) => (
            <Card key={med.id} className="border-amber-500/30">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                    <Pill className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{med.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {med.dosage} · ended {med.end_date}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openContinue(med)}>
                    Continue
                  </Button>
                  <Button size="sm" variant="destructive" className="flex-1" onClick={() => setDeleteTarget(med)}>
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {activeMeds.length === 0 && endedMeds.length === 0 && (
        <div className="text-center py-8 space-y-2">
          <Pill className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">No medications added yet.</p>
        </div>
      )}

      {activeMeds.map((med) => {
        const isLowStock = med.remaining_quantity <= med.low_stock_threshold;
        return (
          <Card key={med.id} className={isLowStock ? "border-destructive/30" : ""}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Pill className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{med.name}</p>
                <p className="text-xs text-muted-foreground">
                  {med.dosage} · {med.schedule_times.map((t) => formatScheduleTime(t)).join(", ")}
                  {scheduleDaysLabel(med.schedule_days) ? ` · ${scheduleDaysLabel(med.schedule_days)} only` : ""}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">
                    Stock: {med.remaining_quantity}/{med.total_quantity}
                  </span>
                  {isLowStock && (
                    <Badge variant="destructive" className="text-[10px]">
                      <AlertTriangle className="w-3 h-3 mr-0.5" /> Low
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(med)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(med)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Medication" : "Add Medication"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm">Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Metformin 500mg" />
            </div>
            <div>
              <Label className="text-sm">Dosage</Label>
              <Input value={form.dosage} onChange={(e) => setForm((f) => ({ ...f, dosage: e.target.value }))} placeholder="e.g. 1 tablet" />
            </div>
            <div>
              <Label className="text-sm">Frequency</Label>
              <Select value={form.frequency} onValueChange={(v) => setForm((f) => ({ ...f, frequency: v, schedule_days: v === "once_weekly" ? (f.schedule_days.length ? f.schedule_days : [getISTWeekday()]) : [] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((fr) => (
                    <SelectItem key={fr.value} value={fr.value}>{fr.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.frequency === "once_weekly" && (
              <div>
                <Label className="text-sm">Day of the Week *</Label>
                <div className="grid grid-cols-4 gap-1.5 mt-1">
                  {WEEKDAYS.map((d) => (
                    <Button
                      key={d.value}
                      type="button"
                      size="sm"
                      variant={form.schedule_days.includes(d.value) ? "default" : "outline"}
                      onClick={() => setForm((f) => ({ ...f, schedule_days: [d.value] }))}
                    >
                      {d.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <Label className="text-sm">Instructions</Label>
              <Input value={form.instructions} onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))} placeholder="e.g. Take after food" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-sm">Total Qty</Label>
                <Input type="number" value={form.total_quantity} onChange={(e) => setForm((f) => ({ ...f, total_quantity: e.target.value }))} />
              </div>
              <div>
                <Label className="text-sm">Remaining</Label>
                <Input type="number" value={form.remaining_quantity} onChange={(e) => setForm((f) => ({ ...f, remaining_quantity: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-sm">Low Stock Alert Threshold</Label>
              <Input type="number" value={form.low_stock_threshold} onChange={(e) => setForm((f) => ({ ...f, low_stock_threshold: e.target.value }))} />
            </div>
            <div>
              <Label className="text-sm">Schedule Times</Label>
              {form.schedule_times.map((t, idx) => (
                <div key={idx} className="flex items-center gap-2 mt-1">
                  <Input type="time" value={t} onChange={(e) => updateScheduleTime(idx, e.target.value)} className="flex-1" />
                  {form.schedule_times.length > 1 && (
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeScheduleTime(idx)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" className="mt-1 w-full" onClick={addScheduleTime}>
                <Plus className="w-3 h-3 mr-1" /> Add Time
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-sm">Start Date</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div>
                <Label className="text-sm">End Date</Label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editId ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Medication</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-medium text-foreground">{deleteTarget?.name}</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (deleteTarget) handleDelete(deleteTarget.id); setDeleteTarget(null); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!continueTarget} onOpenChange={(open) => { if (!open) { setContinueTarget(null); setContinueDate(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Continue {continueTarget?.name}?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Set a new end date or leave blank for no end date.
            </p>
            <div>
              <Label className="text-sm">New End Date</Label>
              <Input type="date" value={continueDate} onChange={(e) => setContinueDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setContinueTarget(null); setContinueDate(""); }}>Cancel</Button>
            <Button onClick={handleContinue}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MedicationList;
