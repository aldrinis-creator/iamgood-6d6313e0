import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { CalendarIcon, Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import AppLayout from "@/components/AppLayout";

interface Coupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  applicable_plans: string[];
  expires_at: string | null;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
  created_at: string;
}

const EMPTY: Partial<Coupon> = {
  code: "",
  discount_type: "percentage",
  discount_value: 0,
  applicable_plans: ["basic", "premium"],
  expires_at: null,
  max_uses: null,
  is_active: true,
};

const AdminCoupons = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Coupon> & { id?: string }>(EMPTY);
  const [saving, setSaving] = useState(false);

  const invoke = useCallback(async (body: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-coupons`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify(body),
      }
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Request failed");
    return json;
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await invoke({ action: "list" });
      setCoupons(data);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [invoke]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing({ ...EMPTY }); setDialogOpen(true); };
  const openEdit = (c: Coupon) => { setEditing({ ...c }); setDialogOpen(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing.id) {
        await invoke({ action: "update", id: editing.id, code: editing.code, discount_type: editing.discount_type, discount_value: editing.discount_value, applicable_plans: editing.applicable_plans, expires_at: editing.expires_at, max_uses: editing.max_uses, is_active: editing.is_active });
      } else {
        await invoke({ action: "create", code: editing.code, discount_type: editing.discount_type, discount_value: editing.discount_value, applicable_plans: editing.applicable_plans, expires_at: editing.expires_at, max_uses: editing.max_uses, is_active: editing.is_active });
      }
      toast.success(editing.id ? "Coupon updated" : "Coupon created");
      setDialogOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (c: Coupon) => {
    try {
      await invoke({ action: "update", id: c.id, is_active: !c.is_active });
      setCoupons((prev) => prev.map((x) => x.id === c.id ? { ...x, is_active: !x.is_active } : x));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await invoke({ action: "delete", id: deleteId });
      setCoupons((prev) => prev.filter((x) => x.id !== deleteId));
      toast.success("Coupon deleted");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeleteId(null);
    }
  };

  const getStatus = (c: Coupon) => {
    if (c.max_uses && c.used_count >= c.max_uses) return "exhausted";
    if (c.expires_at && new Date(c.expires_at) < new Date()) return "expired";
    return c.is_active ? "active" : "inactive";
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { active: "bg-emerald-500/20 text-emerald-600", inactive: "bg-muted text-muted-foreground", expired: "bg-amber-500/20 text-amber-600", exhausted: "bg-red-500/20 text-red-600" };
    return <Badge className={cn("capitalize", map[s])}>{s}</Badge>;
  };

  const togglePlan = (plan: string) => {
    const plans = editing.applicable_plans || [];
    setEditing({ ...editing, applicable_plans: plans.includes(plan) ? plans.filter((p) => p !== plan) : [...plans, plan] });
  };

  return (
    <AppLayout>
      <div className="p-4 max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Coupon Management</h1>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <a href="/admin/waitlist">Waitlist</a>
            </Button>
            <Button onClick={openCreate} size="sm"><Plus className="w-4 h-4 mr-1" />Create Coupon</Button>
          </div>
        </div>

        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : coupons.length === 0 ? (
          <p className="text-muted-foreground text-sm">No coupons yet.</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Plans</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono font-semibold">{c.code}</TableCell>
                    <TableCell>{c.discount_type === "percentage" ? `${c.discount_value}%` : `₹${c.discount_value}`}</TableCell>
                    <TableCell>{(c.applicable_plans || []).join(", ")}</TableCell>
                    <TableCell>{c.expires_at ? format(new Date(c.expires_at), "dd MMM yyyy") : "—"}</TableCell>
                    <TableCell>{c.used_count}{c.max_uses ? `/${c.max_uses}` : ""}</TableCell>
                    <TableCell>{statusBadge(getStatus(c))}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Switch checked={c.is_active} onCheckedChange={() => handleToggle(c)} className="align-middle" />
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing.id ? "Edit Coupon" : "Create Coupon"}</DialogTitle>
            <DialogDescription>Fill in the coupon details below.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Code</Label>
              <Input value={editing.code || ""} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} placeholder="SAVE20" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Discount Type</Label>
                <Select value={editing.discount_type} onValueChange={(v) => setEditing({ ...editing, discount_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="flat">Flat (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Value</Label>
                <Input type="number" min={0} value={editing.discount_value ?? ""} onChange={(e) => setEditing({ ...editing, discount_value: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Applicable Plans</Label>
              <div className="flex gap-4">
                {[
                  { key: "basic", label: "Basic" },
                  { key: "premium", label: "Premium" },
                  { key: "premium-plus", label: "Premium Plus" },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2">
                    <Checkbox checked={(editing.applicable_plans || []).includes(key)} onCheckedChange={() => togglePlan(key)} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label>Expiry Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !editing.expires_at && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editing.expires_at ? format(new Date(editing.expires_at), "PPP") : "No expiry"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={editing.expires_at ? new Date(editing.expires_at) : undefined}
                    onSelect={(d) => setEditing({ ...editing, expires_at: d ? d.toISOString() : null })}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Max Uses (leave empty for unlimited)</Label>
              <Input type="number" min={0} value={editing.max_uses ?? ""} onChange={(e) => setEditing({ ...editing, max_uses: e.target.value ? Number(e.target.value) : null })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete coupon?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default AdminCoupons;
