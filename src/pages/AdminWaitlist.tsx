import { useState, useEffect, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { Download, CheckCircle2, Circle, Send, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import AdminLayout from "@/components/AdminLayout";

interface WaitlistEntry {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  source: string;
  user_id: string | null;
  created_at: string;
  notified_at: string | null;
}

const AdminWaitlist = () => {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notifying, setNotifying] = useState(false);

  const invoke = useCallback(async (body: Record<string, unknown>, raw = false) => {
    const { data: { session } } = await supabase.auth.getSession();
    const stepUp = sessionStorage.getItem("admin_step_up_token") || "";
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-waitlist`,
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
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error || "Request failed");
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

  const unNotifiedCount = useMemo(
    () => entries.filter((e) => !e.notified_at).length,
    [entries]
  );

  const exportCsv = async () => {
    try {
      const csv = await invoke({ action: "export" }, true);
      const blob = new Blob([csv as string], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `premium-plus-waitlist-${format(new Date(), "yyyy-MM-dd")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const toggleNotified = async (entry: WaitlistEntry) => {
    try {
      const updated = await invoke({
        action: "mark_notified",
        id: entry.id,
        notified: !entry.notified_at,
      });
      setEntries((prev) => prev.map((e) => e.id === entry.id ? updated : e));
      toast.success(updated.notified_at ? "Marked as notified" : "Marked as pending");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const notifyAll = async () => {
    setNotifying(true);
    try {
      const result = await invoke({ action: "notify_all" });
      const { queued = 0, failed = 0 } = result || {};
      if (queued > 0) {
        toast.success(`Queued ${queued} email${queued === 1 ? "" : "s"}${failed ? ` (${failed} failed)` : ""}`);
      } else {
        toast.info("No un-notified entries to send");
      }
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setNotifying(false);
      setConfirmOpen(false);
    }
  };

  return (
    <AdminLayout title="Premium Plus Waitlist">
      <div className="p-4 max-w-5xl mx-auto space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Email delivery requires domain setup</AlertTitle>
          <AlertDescription>
            Notifications will be queued, but they will only deliver once the email sender domain is configured and DNS verified.
          </AlertDescription>
        </Alert>

        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold">Premium Plus Waitlist</h1>
            <p className="text-sm text-muted-foreground">
              {entries.length} pre-registration{entries.length === 1 ? "" : "s"}
              {unNotifiedCount > 0 && ` · ${unNotifiedCount} pending`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setConfirmOpen(true)}
              size="sm"
              disabled={!unNotifiedCount || notifying}
            >
              <Send className="w-4 h-4 mr-1" />
              Notify {unNotifiedCount || ""} {unNotifiedCount === 1 ? "user" : "users"}
            </Button>
            <Button onClick={exportCsv} variant="outline" size="sm" disabled={!entries.length}>
              <Download className="w-4 h-4 mr-1" />Export CSV
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">No pre-registrations yet.</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Notified</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium break-all">{e.email}</TableCell>
                    <TableCell>{e.full_name || "—"}</TableCell>
                    <TableCell>{e.phone || "—"}</TableCell>
                    <TableCell><Badge variant="secondary">{e.source}</Badge></TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {format(new Date(e.created_at), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleNotified(e)}
                        className="gap-1"
                      >
                        {e.notified_at ? (
                          <><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Notified</>
                        ) : (
                          <><Circle className="w-4 h-4" /> Pending</>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send launch email to {unNotifiedCount} {unNotifiedCount === 1 ? "user" : "users"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This queues the Premium Plus launch announcement to every pending waitlist member. Each recipient receives the email once.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={notifying}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={notifyAll} disabled={notifying}>
              {notifying ? "Sending…" : "Send"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminWaitlist;
