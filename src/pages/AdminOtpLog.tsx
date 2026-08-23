import { useCallback, useEffect, useState } from "react";
import { Copy, Eye, EyeOff, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AdminLayout from "@/components/AdminLayout";

const RANGE_OPTIONS = [
  { value: "24", label: "Last 24 hours" },
  { value: "168", label: "Last 7 days" },
  { value: "720", label: "Last 30 days" },
];

const STATUS_COLORS: Record<string, string> = {
  sent: "bg-emerald-500/15 text-emerald-700 border-emerald-300",
  verified: "bg-emerald-500/15 text-emerald-700 border-emerald-300",
  delivered: "bg-emerald-500/15 text-emerald-700 border-emerald-300",
  failed: "bg-red-500/15 text-red-700 border-red-300",
  rate_limited: "bg-amber-500/15 text-amber-700 border-amber-300",
  pending: "bg-blue-500/15 text-blue-700 border-blue-300",
};

interface OtpRow {
  id: string;
  phone: string;
  action: string;
  status: string;
  request_id: string | null;
  delivery_status: string | null;
  delivery_time: string | null;
  failure_reason: string | null;
  verified: boolean;
  expires_at: string | null;
  created_at: string;
}

interface Summary { total: number; sends: number; verified: number; failed: number }

const ist = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";

export default function AdminOtpLog() {
  const [rows, setRows] = useState<OtpRow[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, sends: 0, verified: 0, failed: 0 });
  const [hours, setHours] = useState("24");
  const [phone, setPhone] = useState("");
  const [reveal, setReveal] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const stepUp = sessionStorage.getItem("admin_step_up_token") || "";
      const { data, error } = await supabase.functions.invoke("admin-otp-log", {
        body: { action: "list", hours: Number(hours), phone, reveal },
        headers: { "x-admin-step-up": stepUp },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setRows((data as any).rows ?? []);
      setSummary((data as any).summary ?? { total: 0, sends: 0, verified: 0, failed: 0 });
    } catch (err: any) {
      toast.error("Could not load OTP log", { description: err?.message ?? "Please try again." });
    } finally {
      setLoading(false);
    }
  }, [hours, phone, reveal]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hours, reveal]);

  const copy = (value: string) => {
    navigator.clipboard.writeText(value);
    toast.success("Request ID copied");
  };

  const rate = summary.sends > 0 ? Math.round((summary.verified / summary.sends) * 100) : 0;

  return (
    <AdminLayout title="OTP Delivery Log">
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Sends", value: summary.sends },
            { label: "Verified", value: summary.verified },
            { label: "Failed", value: summary.failed },
            { label: "Verification rate", value: `${rate}%` },
          ].map((s) => (
            <Card key={s.label}>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">{s.label}</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{s.value}</CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Recent OTP attempts
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && load()}
                  placeholder="Search phone digits"
                  className="pl-7 h-9 w-48"
                />
              </div>
              <Select value={hours} onValueChange={setHours}>
                <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RANGE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => setReveal((v) => !v)}>
                {reveal ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                {reveal ? "Mask" : "Reveal"}
              </Button>
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time (IST)</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead>Verified</TableHead>
                  <TableHead>Request ID</TableHead>
                  <TableHead>Failure reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      {loading ? "Loading…" : "No OTP attempts in this range."}
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs">{ist(r.created_at)}</TableCell>
                    <TableCell className="font-mono text-xs">{r.phone}</TableCell>
                    <TableCell className="text-xs">{r.action}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[r.status] ?? ""}>{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.delivery_status ? (
                        <Badge variant="outline" className={STATUS_COLORS[r.delivery_status] ?? ""}>
                          {r.delivery_status}
                        </Badge>
                      ) : "—"}
                      {r.delivery_time && <div className="text-[11px] text-muted-foreground mt-0.5">{ist(r.delivery_time)}</div>}
                    </TableCell>
                    <TableCell className="text-xs">{r.verified ? "Yes" : "No"}</TableCell>
                    <TableCell className="text-xs font-mono max-w-[180px] truncate">
                      {r.request_id ? (
                        <button className="inline-flex items-center gap-1 hover:text-primary" onClick={() => copy(r.request_id!)}>
                          <span className="truncate">{r.request_id}</span>
                          <Copy className="h-3 w-3 shrink-0" />
                        </button>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[220px] break-words">
                      {r.failure_reason ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
