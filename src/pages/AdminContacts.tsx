import { useState, useEffect, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { Download, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import AdminLayout from "@/components/AdminLayout";

interface ContactSubmission {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  source: string;
  status: "new" | "in_progress" | "resolved";
  admin_notes: string | null;
  responded_at: string | null;
  created_at: string;
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  new: "default",
  in_progress: "secondary",
  resolved: "outline",
};

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  in_progress: "In Progress",
  resolved: "Resolved",
};

const AdminContacts = () => {
  const [entries, setEntries] = useState<ContactSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "new" | "in_progress" | "resolved">("all");
  const [selected, setSelected] = useState<ContactSubmission | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const invoke = useCallback(async (body: Record<string, unknown>, raw = false) => {
    const { data: { session } } = await supabase.auth.getSession();
    const stepUp = sessionStorage.getItem("admin_step_up_token") || "";
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-contacts`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "x-admin-step-up": stepUp,
        },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      const txt = await res.text();
      let msg = "Request failed";
      try { msg = JSON.parse(txt).error || msg; } catch { /* not JSON */ }
      throw new Error(msg);
    }
    return raw ? await res.text() : await res.json();
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await invoke({ action: "list" });
      setEntries(data);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [invoke]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(
    () => filter === "all" ? entries : entries.filter((e) => e.status === filter),
    [entries, filter]
  );

  const newCount = useMemo(() => entries.filter((e) => e.status === "new").length, [entries]);

  const exportCsv = async () => {
    try {
      const csv = await invoke({ action: "export" }, true);
      const blob = new Blob([csv as string], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contact-submissions-${format(new Date(), "yyyy-MM-dd")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const updateStatus = async (entry: ContactSubmission, status: ContactSubmission["status"]) => {
    try {
      const updated = await invoke({ action: "update_status", id: entry.id, status });
      setEntries((prev) => prev.map((e) => e.id === entry.id ? updated : e));
      if (selected?.id === entry.id) setSelected(updated);
      toast.success(`Marked as ${STATUS_LABELS[status]}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const saveNote = async () => {
    if (!selected) return;
    setSavingNote(true);
    try {
      const updated = await invoke({ action: "add_note", id: selected.id, admin_notes: noteDraft });
      setEntries((prev) => prev.map((e) => e.id === selected.id ? updated : e));
      setSelected(updated);
      toast.success("Notes saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingNote(false);
    }
  };

  const openDetail = (entry: ContactSubmission) => {
    setSelected(entry);
    setNoteDraft(entry.admin_notes || "");
  };

  return (
    <AdminLayout title="Contact Submissions">
      <div className="p-4 max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold">Contact Submissions</h1>
            <p className="text-sm text-muted-foreground">
              {entries.length} submission{entries.length === 1 ? "" : "s"}
              {newCount > 0 && ` · ${newCount} new`}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={exportCsv} variant="outline" size="sm" disabled={!entries.length}>
              <Download className="w-4 h-4 mr-1" />Export CSV
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-sm">No submissions{filter !== "all" ? ` with status "${STATUS_LABELS[filter]}"` : ""}.</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">View</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e.id} className="cursor-pointer" onClick={() => openDetail(e)}>
                    <TableCell className="font-medium break-all">{e.email}</TableCell>
                    <TableCell>{e.full_name}</TableCell>
                    <TableCell>{e.phone || "—"}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{e.subject}</TableCell>
                    <TableCell><Badge variant="secondary">{e.source}</Badge></TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {format(new Date(e.created_at), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[e.status]}>{STATUS_LABELS[e.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={(ev) => { ev.stopPropagation(); openDetail(e); }}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.subject}</DialogTitle>
                <DialogDescription>
                  From {selected.full_name} ({selected.email})
                  {selected.phone && ` · ${selected.phone}`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Message</p>
                  <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap break-words">
                    {selected.message}
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-muted-foreground">
                    Submitted {format(new Date(selected.created_at), "dd MMM yyyy 'at' HH:mm")}
                  </span>
                  <Badge variant="secondary">{selected.source}</Badge>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-xs font-medium">Status:</span>
                    <Select
                      value={selected.status}
                      onValueChange={(v) => updateStatus(selected, v as ContactSubmission["status"])}
                    >
                      <SelectTrigger className="w-[150px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Admin notes</p>
                  <Textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="Internal notes (not visible to user)…"
                    rows={3}
                    maxLength={1000}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
                <Button onClick={saveNote} disabled={savingNote || noteDraft === (selected.admin_notes || "")}>
                  {savingNote ? "Saving…" : "Save notes"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminContacts;
