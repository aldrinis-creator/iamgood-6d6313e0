import { useState, useEffect, useCallback } from "react";
import WardPicker from "@/components/WardPicker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, AlertTriangle, Heart, Pill, Activity, Filter, Trash2 } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatISTDateTime } from "@/lib/istTime";
import { playVoiceReminder, playChime } from "@/lib/audioAlerts";
import { useUserSettings } from "@/hooks/useUserSettings";

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  type: string;
}

const TYPE_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  sos: { icon: AlertTriangle, color: "text-destructive", label: "SOS" },
  fall: { icon: AlertTriangle, color: "text-destructive", label: "Fall" },
  missed_checkin: { icon: Bell, color: "text-warning", label: "Missed Check-in" },
  medication_missed: { icon: Pill, color: "text-warning", label: "Medication" },
  medication_taken: { icon: Pill, color: "text-success", label: "Medication" },
  vital_anomaly: { icon: Heart, color: "text-destructive", label: "Vitals" },
  nomination_rejected: { icon: Bell, color: "text-muted-foreground", label: "Nomination" },
  journey: { icon: Activity, color: "text-primary", label: "Journey" },
  route_deviation: { icon: AlertTriangle, color: "text-destructive", label: "Route Alert" },
};

const GuardianAlerts = () => {
  const { session } = useAuth();
  const { settings } = useUserSettings();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (data) {
      const now = Date.now();
      const processed = (data as Notification[]).map(n => {
        if ((n.type === "medication_missed" || n.type === "medication_taken") && !n.read) {
          const age = now - new Date(n.created_at).getTime();
          if (age > 3600000) return { ...n, read: true };
        }
        return n;
      });
      processed.filter((n, i) => n.read && !(data as Notification[])[i].read).forEach(n => {
        supabase.from("notifications").update({ read: true }).eq("id", n.id).then(() => {});
      });
      setNotifications(processed);
    }
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const channel = supabase
      .channel("guardian-alerts-page")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (payload: any) => {
        fetchAll();
        const newNotif = payload?.new;
        if ((newNotif?.type === "sos" || newNotif?.type === "fall") && settings.guardianVoiceAlerts) {
          const eventType = newNotif.type === "sos" ? "an SOS" : "a Fall";
          playVoiceReminder(`Dear Guardian, please check on your user, as we have detected ${eventType} alert`);
        } else if (newNotif?.type === "route_deviation" && settings.guardianVoiceAlerts) {
          playVoiceReminder("Dear Guardian, your ward has deviated from the expected route. Please check on them.");
        } else if (newNotif?.type === "missed_checkin") {
          playChime();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;
    for (const id of unreadIds) {
      await supabase.from("notifications").update({ read: true }).eq("id", id);
    }
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearReadAlerts = async () => {
    const readIds = notifications.filter(n => n.read).map(n => n.id);
    if (readIds.length === 0) return;
    await supabase.from("notifications").delete().in("id", readIds);
    setNotifications(prev => prev.filter(n => !n.read));
  };

  const readCount = notifications.filter(n => n.read).length;

  const filtered = filter === "all" ? notifications : notifications.filter(n => n.type === filter);
  const types = [...new Set(notifications.map(n => n.type))];

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <WardPicker />
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" /> Alerts
          </h1>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={markAllRead} className="text-xs">
              Mark all read
            </Button>
            {readCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearReadAlerts} className="text-xs gap-1 text-destructive hover:text-destructive">
                <Trash2 className="w-4 h-4" /> Clear
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <Badge
            variant={filter === "all" ? "default" : "outline"}
            className="cursor-pointer shrink-0"
            onClick={() => setFilter("all")}
          >
            All ({notifications.length})
          </Badge>
          {types.map(t => {
            const cfg = TYPE_CONFIG[t] || { label: t, color: "text-muted-foreground" };
            const count = notifications.filter(n => n.type === t).length;
            return (
              <Badge
                key={t}
                variant={filter === t ? "default" : "outline"}
                className="cursor-pointer shrink-0"
                onClick={() => setFilter(t)}
              >
                {cfg.label} ({count})
              </Badge>
            );
          })}
        </div>

        {/* Alerts list */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Loading alerts…</div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No alerts yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map(n => {
              const cfg = TYPE_CONFIG[n.type] || { icon: Bell, color: "text-muted-foreground", label: n.type };
              const Icon = cfg.icon;
              return (
                <Card key={n.id} className={`${!n.read ? "border-primary/30 bg-primary/5" : ""}`}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${cfg.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-medium">{n.title}</p>
                          {!n.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatISTDateTime(n.created_at)}
                        </p>
                      </div>
                      {!n.read && (
                        <Button variant="ghost" size="sm" className="text-xs shrink-0" onClick={() => markAsRead(n.id)}>
                          Dismiss
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default GuardianAlerts;
