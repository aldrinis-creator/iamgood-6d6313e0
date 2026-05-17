import { useState, useEffect, useCallback, useMemo } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { Activity, AlertTriangle, Mail, RefreshCw, Trash2, Play, Settings as SettingsIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import AdminLayout from "@/components/AdminLayout";

const RANGE_OPTIONS = [
  { value: "24h", label: "Last 24 hours", hours: 24 },
  { value: "7d", label: "Last 7 days", hours: 24 * 7 },
  { value: "30d", label: "Last 30 days", hours: 24 * 30 },
];

const STATUS_COLORS: Record<string, string> = {
  sent: "bg-emerald-500/15 text-emerald-700 border-emerald-300",
  failed: "bg-amber-500/15 text-amber-700 border-amber-300",
  dlq: "bg-red-500/15 text-red-700 border-red-300",
  suppressed: "bg-gray-500/15 text-gray-700 border-gray-300",
  bounced: "bg-red-500/15 text-red-700 border-red-300",
  complained: "bg-red-500/15 text-red-700 border-red-300",
  pending: "bg-blue-500/15 text-blue-700 border-blue-300",
  rate_limited: "bg-amber-500/15 text-amber-700 border-amber-300",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/15 text-red-700 border-red-300",
  warning: "bg-amber-500/15 text-amber-700 border-amber-300",
  info: "bg-blue-500/15 text-blue-700 border-blue-300",
};

interface QueueStat { queue_name: string; depth: number; oldest_age_seconds: number }
interface LogRow {
  id: string;
  message_id: string | null;
  template_name: string | null;
  recipient_email: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
}
interface AlertRow {
  id: string;
  alert_type: string;
  severity: string;
  message: string;
  metadata: any;
  created_at: string;
}
interface DlqMessage { msg_id: number; enqueued_at: string; message: any }
interface SuppressedRow { email: string; reason: string | null; created_at: string }
interface AlertConfig {
  enabled: boolean;
  dlq_growth_threshold: number;
  dlq_total_threshold: number;
  stuck_queue_minutes: number;
  no_send_window_minutes: number;
  bounce_rate_threshold: number;
  complaint_rate_threshold: number;
  rate_limit_alert_minutes: number;
  cooldown_minutes: number;
  extra_notification_emails: string;
}

const AdminEmails = () => {
  const [range, setRange] = useState("24h");
  const [stats, setStats] = useState<Record<string, { sent: number; failed: number; dlq: number; suppressed: number; total: number; bounced: number; complained: number }>>({
    summary: { sent: 0, failed: 0, dlq: 0, suppressed: 0, total: 0, bounced: 0, complained: 0 },
  });
  const [queueStats, setQueueStats] = useState<QueueStat[]>([]);
  const [sendState, setSendState] = useState<{ retry_after_until: string | null } | null>(null);
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [dlqAuth, setDlqAuth] = useState<DlqMessage[]>([]);
  const [dlqTxn, setDlqTxn] = useState<DlqMessage[]>([]);
  const [suppressed, setSuppressed] = useState<SuppressedRow[]>([]);
  const [templates, setTemplates] = useState<string[]>([]);
  const [tplFilter, setTplFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<AlertConfig | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [runningCheck, setRunningCheck] = useState(false);

  const hours = useMemo(() => RANGE_OPTIONS.find((r) => r.value === range)?.hours ?? 24, [range]);
  const sinceIso = useMemo(() => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString(), [hours]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Deduplicated logs in window
      const { data: rawLogs, error: logsErr } = await supabase
        .from("email_send_log")
        .select("id, message_id, template_name, recipient_email, status, error_message, created_at")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (logsErr) throw logsErr;

      // Deduplicate client-side: latest row per message_id
      const seen = new Map<string, LogRow>();
      const summary = { sent: 0, failed: 0, dlq: 0, suppressed: 0, total: 0, bounced: 0, complained: 0 };
      const tplCounts = new Map<string, number>();
      for (const row of (rawLogs ?? []) as LogRow[]) {
        if (!row.message_id) continue;
        if (!seen.has(row.message_id)) seen.set(row.message_id, row);
      }
      for (const r of seen.values()) {
        summary.total++;
        if (r.status === "sent") summary.sent++;
        else if (r.status === "failed") summary.failed++;
        else if (r.status === "dlq") summary.dlq++;
        else if (r.status === "suppressed") summary.suppressed++;
        else if (r.status === "bounced") summary.bounced++;
        else if (r.status === "complained") summary.complained++;
        if (r.template_name) tplCounts.set(r.template_name, (tplCounts.get(r.template_name) ?? 0) + 1);
      }
      setStats({ summary });
      setTemplates(Array.from(tplCounts.keys()).sort());

      // Build display rows
      const deduped = Array.from(seen.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setLogs(deduped);

      // Latest sent
      const lastSentRow = deduped.find((r) => r.status === "sent");
      setLastSent(lastSentRow?.created_at ?? null);

      // Queue stats
      const { data: qStats } = await supabase.rpc("email_queue_stats");
      setQueueStats((qStats ?? []) as QueueStat[]);

      // Send state
      const { data: ss } = await supabase
        .from("email_send_state")
        .select("retry_after_until")
        .single();
      setSendState(ss as any);

      // Alerts
      const { data: alertRows } = await supabase
        .from("email_alert_log")
        .select("*")
        .neq("alert_type", "dlq_snapshot")
        .order("created_at", { ascending: false })
        .limit(100);
      setAlerts((alertRows ?? []) as AlertRow[]);

      // DLQ contents
      const { data: dlqA } = await supabase.rpc("read_dlq_messages", {
        dlq_name: "auth_emails_dlq",
        limit_count: 50,
      });
      const { data: dlqT } = await supabase.rpc("read_dlq_messages", {
        dlq_name: "transactional_emails_dlq",
        limit_count: 50,
      });
      setDlqAuth((dlqA ?? []) as DlqMessage[]);
      setDlqTxn((dlqT ?? []) as DlqMessage[]);

      // Suppressed
      const { data: supp } = await supabase
        .from("suppressed_emails")
        .select("email, reason, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      setSuppressed((supp ?? []) as SuppressedRow[]);

      // Config
      const { data: cfg } = await supabase
        .from("email_alert_config")
        .select("*")
        .single();
      setConfig(cfg as AlertConfig);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [sinceIso]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return logs.filter((r) => {
      if (tplFilter !== "all" && r.template_name !== tplFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!(r.recipient_email?.toLowerCase().includes(s) || r.template_name?.toLowerCase().includes(s))) return false;
      }
      return true;
    });
  }, [logs, tplFilter, statusFilter, search]);

  const requeueDlq = async (dlqName: string, msgId: number) => {
    try {
      const { error } = await supabase.rpc("requeue_dlq_message", {
        dlq_name: dlqName,
        msg_id: msgId,
      });
      if (error) throw error;
      toast.success("Message requeued");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const removeSuppression = async (email: string) => {
    try {
      const { error } = await supabase.rpc("remove_email_suppression", {
        email_addr: email,
      });
      if (error) throw error;
      toast.success(`Removed suppression for ${email}`);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const saveConfig = async () => {
    if (!config) return;
    setSavingConfig(true);
    try {
      const { error } = await supabase
        .from("email_alert_config")
        .update({
          enabled: config.enabled,
          dlq_growth_threshold: config.dlq_growth_threshold,
          dlq_total_threshold: config.dlq_total_threshold,
          stuck_queue_minutes: config.stuck_queue_minutes,
          no_send_window_minutes: config.no_send_window_minutes,
          bounce_rate_threshold: config.bounce_rate_threshold,
          complaint_rate_threshold: config.complaint_rate_threshold,
          rate_limit_alert_minutes: config.rate_limit_alert_minutes,
          cooldown_minutes: config.cooldown_minutes,
          extra_notification_emails: config.extra_notification_emails,
        })
        .eq("id", 1);
      if (error) throw error;
      toast.success("Alert settings saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingConfig(false);
    }
  };

  const runCheckNow = async () => {
    setRunningCheck(true);
    try {
      const { error } = await supabase.functions.invoke("email-queue-health-check");
      if (error) throw error;
      toast.success("Health check executed");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunningCheck(false);
    }
  };

  const deleteDlqMessage = async (queueName: string, msgId: number) => {
    try {
      const { error } = await supabase.rpc("delete_email", {
        queue_name: queueName,
        message_id: msgId,
      });
      if (error) throw error;
      toast.success("Message deleted");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const queueDepth = (name: string) =>
    queueStats.find((q) => q.queue_name === name)?.depth ?? 0;
  const cooldownActive = sendState?.retry_after_until && new Date(sendState.retry_after_until) > new Date();

  return (
    <AdminLayout title="Email Monitoring">
      <div className="p-4 max-w-7xl mx-auto space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Mail className="w-5 h-5" /> Email Monitoring
            </h1>
            <p className="text-sm text-muted-foreground">
              Queue health, send history, and automated alerts
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={runCheckNow} disabled={runningCheck}>
              <Play className="w-4 h-4 mr-1" />
              Run health check
            </Button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total emails" value={stats.summary.total} sublabel={`in ${RANGE_OPTIONS.find(r => r.value === range)?.label.toLowerCase()}`} />
          <StatCard label="Sent" value={stats.summary.sent} tone="emerald" />
          <StatCard label="Failed / DLQ" value={stats.summary.failed + stats.summary.dlq} tone={stats.summary.dlq > 0 ? "red" : "amber"} />
          <StatCard label="Suppressed" value={stats.summary.suppressed} tone="gray" />
          <StatCard label="Auth queue" value={queueDepth("auth_emails")} sublabel={`DLQ: ${queueDepth("auth_emails_dlq")}`} tone={queueDepth("auth_emails_dlq") > 0 ? "red" : undefined} />
          <StatCard label="Txn queue" value={queueDepth("transactional_emails")} sublabel={`DLQ: ${queueDepth("transactional_emails_dlq")}`} tone={queueDepth("transactional_emails_dlq") > 0 ? "red" : undefined} />
          <StatCard
            label="Last sent"
            value={lastSent ? formatDistanceToNow(new Date(lastSent), { addSuffix: true }) : "—"}
            valueIsText
          />
          <StatCard
            label="Rate limit"
            value={cooldownActive ? "ACTIVE" : "OK"}
            sublabel={cooldownActive ? `until ${format(new Date(sendState!.retry_after_until!), "HH:mm")}` : undefined}
            tone={cooldownActive ? "amber" : "emerald"}
            valueIsText
          />
        </div>

        <Tabs defaultValue="log" className="w-full">
          <TabsList>
            <TabsTrigger value="log">Send log</TabsTrigger>
            <TabsTrigger value="alerts">Alerts ({alerts.length})</TabsTrigger>
            <TabsTrigger value="dlq">DLQ ({dlqAuth.length + dlqTxn.length})</TabsTrigger>
            <TabsTrigger value="suppressed">Suppressed ({suppressed.length})</TabsTrigger>
            <TabsTrigger value="settings"><SettingsIcon className="w-4 h-4 mr-1" /> Settings</TabsTrigger>
          </TabsList>

          {/* SEND LOG */}
          <TabsContent value="log" className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              <Input
                placeholder="Search recipient or template…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-xs"
              />
              <Select value={tplFilter} onValueChange={setTplFilter}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Template" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All templates</SelectItem>
                  {templates.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="dlq">DLQ</SelectItem>
                  <SelectItem value="suppressed">Suppressed</SelectItem>
                  <SelectItem value="bounced">Bounced</SelectItem>
                  <SelectItem value="complained">Complained</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground self-center ml-auto">
                {filtered.length} of {logs.length} unique emails
              </span>
            </div>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time (IST)</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 200).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">{r.template_name || "—"}</TableCell>
                      <TableCell className="text-sm break-all">{r.recipient_email || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_COLORS[r.status] || ""}>{r.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {format(new Date(r.created_at), "dd MMM HH:mm")}
                      </TableCell>
                      <TableCell className="text-xs text-red-600 max-w-[300px] truncate">
                        {r.error_message || ""}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground text-sm">No emails in this window.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ALERTS */}
          <TabsContent value="alerts" className="space-y-2">
            {alerts.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">
                No alerts fired recently. Pipeline looks healthy.
              </CardContent></Card>
            ) : alerts.map((a) => (
              <Card key={a.id}>
                <CardContent className="py-3 flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 mt-1 text-amber-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={SEVERITY_COLORS[a.severity] || ""}>{a.severity}</Badge>
                      <span className="text-xs font-mono text-muted-foreground">{a.alert_type}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {format(new Date(a.created_at), "dd MMM HH:mm")}
                      </span>
                    </div>
                    <p className="text-sm mt-1">{a.message}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* DLQ */}
          <TabsContent value="dlq" className="space-y-4">
            <DlqSection
              title="Auth emails DLQ"
              queueName="auth_emails_dlq"
              messages={dlqAuth}
              onRequeue={requeueDlq}
            />
            <DlqSection
              title="Transactional emails DLQ"
              queueName="transactional_emails_dlq"
              messages={dlqTxn}
              onRequeue={requeueDlq}
            />
          </TabsContent>

          {/* SUPPRESSED */}
          <TabsContent value="suppressed">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppressed.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-sm">No suppressed addresses.</TableCell></TableRow>
                  )}
                  {suppressed.map((s) => (
                    <TableRow key={s.email}>
                      <TableCell className="text-sm break-all">{s.email}</TableCell>
                      <TableCell><Badge variant="outline">{s.reason || "unknown"}</Badge></TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{format(new Date(s.created_at), "dd MMM yyyy")}</TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm"><Trash2 className="w-4 h-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove suppression?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Emails to {s.email} will resume being sent. Only do this if the address was suppressed in error.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => removeSuppression(s.email)}>Remove</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* SETTINGS */}
          <TabsContent value="settings">
            {config && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Alert thresholds
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="enabled">Automated alerts enabled</Label>
                    <Switch id="enabled" checked={config.enabled} onCheckedChange={(v) => setConfig({ ...config, enabled: v })} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <NumField label="DLQ growth threshold (messages)" value={config.dlq_growth_threshold} onChange={(v) => setConfig({ ...config, dlq_growth_threshold: v })} />
                    <NumField label="DLQ total threshold (messages)" value={config.dlq_total_threshold} onChange={(v) => setConfig({ ...config, dlq_total_threshold: v })} />
                    <NumField label="Stuck queue minutes" value={config.stuck_queue_minutes} onChange={(v) => setConfig({ ...config, stuck_queue_minutes: v })} />
                    <NumField label="No-send window minutes" value={config.no_send_window_minutes} onChange={(v) => setConfig({ ...config, no_send_window_minutes: v })} />
                    <NumField label="Bounce rate threshold (%)" value={config.bounce_rate_threshold} onChange={(v) => setConfig({ ...config, bounce_rate_threshold: v })} step={0.1} />
                    <NumField label="Complaint rate threshold (%)" value={config.complaint_rate_threshold} onChange={(v) => setConfig({ ...config, complaint_rate_threshold: v })} step={0.01} />
                    <NumField label="Rate-limit alert minutes" value={config.rate_limit_alert_minutes} onChange={(v) => setConfig({ ...config, rate_limit_alert_minutes: v })} />
                    <NumField label="Cooldown between alerts (min)" value={config.cooldown_minutes} onChange={(v) => setConfig({ ...config, cooldown_minutes: v })} />
                  </div>
                  <div>
                    <Label htmlFor="extra">Extra notification emails (comma-separated)</Label>
                    <Input
                      id="extra"
                      value={config.extra_notification_emails}
                      onChange={(e) => setConfig({ ...config, extra_notification_emails: e.target.value })}
                      placeholder="ops@example.com, oncall@example.com"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Admins automatically receive in-app notifications + email. Add additional recipients here.
                    </p>
                  </div>
                  <Button onClick={saveConfig} disabled={savingConfig}>
                    {savingConfig ? "Saving…" : "Save settings"}
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

const StatCard = ({
  label, value, sublabel, tone, valueIsText,
}: { label: string; value: number | string; sublabel?: string; tone?: "emerald" | "red" | "amber" | "gray"; valueIsText?: boolean }) => {
  const toneClass =
    tone === "emerald" ? "text-emerald-700" :
    tone === "red" ? "text-red-700" :
    tone === "amber" ? "text-amber-700" :
    tone === "gray" ? "text-muted-foreground" :
    "text-foreground";
  return (
    <Card>
      <CardContent className="py-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`font-bold ${valueIsText ? "text-base" : "text-2xl"} ${toneClass}`}>{value}</p>
        {sublabel && <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>}
      </CardContent>
    </Card>
  );
};

const NumField = ({ label, value, onChange, step }: { label: string; value: number; onChange: (v: number) => void; step?: number }) => (
  <div>
    <Label className="text-xs">{label}</Label>
    <Input type="number" step={step ?? 1} value={value} onChange={(e) => onChange(Number(e.target.value))} />
  </div>
);

  const deleteDlqMessage = async (queueName: string, msgId: number) => {
    try {
      const { error } = await supabase.rpc("delete_email", {
        queue_name: queueName,
        message_id: msgId,
      });
      if (error) throw error;
      toast.success("Message deleted");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

const DlqSection = ({ title, queueName, messages, onRequeue, onDelete }: {
  title: string; queueName: string; messages: DlqMessage[]; onRequeue: (q: string, id: number) => void; onDelete: (q: string, id: number) => void;
}) => (
  <Card>
    <CardHeader><CardTitle className="text-base">{title} ({messages.length})</CardTitle></CardHeader>
    <CardContent>
      {messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">Empty — no failed messages.</p>
      ) : (
        <div className="space-y-2">
          {messages.map((m) => (
            <div key={m.msg_id} className="border rounded p-3 text-xs space-y-1">
              <div className="flex justify-between items-start gap-2 flex-wrap">
                <div>
                  <p><span className="font-medium">To:</span> {m.message?.to ?? "—"}</p>
                  <p><span className="font-medium">Template:</span> {m.message?.label ?? "—"}</p>
                  <p><span className="font-medium">Subject:</span> {m.message?.subject ?? "—"}</p>
                  <p className="text-muted-foreground">
                    Enqueued: {format(new Date(m.enqueued_at), "dd MMM HH:mm")}
                  </p>
                </div>
                <div className="flex gap-1">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline"><RefreshCw className="w-3 h-3 mr-1" />Requeue</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Requeue this message?</AlertDialogTitle>
                        <AlertDialogDescription>
                          It will be moved back to {queueName.replace("_dlq", "")} and retried by the next dispatcher run.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onRequeue(queueName, m.msg_id)}>Requeue</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700"><Trash2 className="w-3 h-3 mr-1" />Delete</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this message?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This permanently removes the message from the dead-letter queue. It will not be retried or logged again.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => onDelete(queueName, m.msg_id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);

export default AdminEmails;
