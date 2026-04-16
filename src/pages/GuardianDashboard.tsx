import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Navigation, BatteryFull, BatteryMedium, BatteryLow, BatteryWarning, Smartphone, MapPin, AlertTriangle, Bell, Moon, LogOut, RefreshCw, ChevronDown, MessageCircle, Maximize2, Minimize2, ExternalLink, ShieldAlert, Pill, Activity, Heart, IdCard, Apple, ScanFace, Smile, ChevronRight } from "lucide-react";
import { haversineDistance } from "@/lib/haversine";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import CareJournal from "@/components/CareJournal";
import WardEmergencyCard from "@/components/WardEmergencyCard";
import AmbulanceBooking from "@/components/AmbulanceBooking";
import WardActivitySummary from "@/components/WardActivitySummary";
import WardHealthScoreRing from "@/components/WardHealthScoreRing";
import WardVitalsSummary from "@/components/WardVitalsSummary";
import WardMedicationStatus from "@/components/WardMedicationStatus";
import WardMedicationAdherence from "@/components/WardMedicationAdherence";
import WardRefillOrder from "@/components/WardRefillOrder";
import GuardianJourneyTracker from "@/components/GuardianJourneyTracker";
import GuardianPingDialog from "@/components/GuardianPingDialog";
import { playChime, playVoiceReminder } from "@/lib/audioAlerts";
import { useUserSettings } from "@/hooks/useUserSettings";
import { formatDistanceToNow } from "date-fns";
import { formatISTDateTime, formatISTTime, formatISTDate } from "@/lib/istTime";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useGuardianWard } from "@/contexts/GuardianWardContext";
import WardPicker from "@/components/WardPicker";

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  type: string;
}

interface CheckIn {
  id: string;
  scheduled_at: string;
  status: string;
  responded_at: string | null;
}

// Consent-gated wrapper for Emergency Health Card
const EmergencyCardGated = ({ wardUserId, wardName }: { wardUserId: string; wardName: string }) => {
  const [consented, setConsented] = useState<boolean | null>(null);
  useEffect(() => {
    supabase
      .from("user_settings" as any)
      .select("settings")
      .eq("user_id", wardUserId)
      .maybeSingle()
      .then(({ data }) => {
        const s = (data as any)?.settings;
        setConsented(s?.shareEmergencyWithGuardians !== false);
      });
  }, [wardUserId]);
  if (consented === null || consented === false) return null;
  return <WardEmergencyCard wardUserId={wardUserId} wardName={wardName} />;
};

// Collapsible section wrapper
const CollapsibleSection = ({ title, icon, children, defaultOpen = false }: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Card className="cursor-pointer hover:border-primary/20 transition-colors">
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {icon}
              <span className="text-sm font-semibold">{title}</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
          </CardContent>
        </Card>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 mt-1">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
};

const GOOGLE_TILES_URL = "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";

interface SafeZone { id: string; name: string; lat: number; lng: number; radius_m: number; enabled: boolean; }

const MapExpandable = ({ wardLocation, activeSOS, locationUpdatedAt, safeZones = [] }: { wardLocation: { lat: number; lng: number }; activeSOS: boolean; locationUpdatedAt: string | null; safeZones?: SafeZone[] }) => {
  const [expanded, setExpanded] = useState(false);
  const mapHeight = expanded ? 400 : 192;
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${wardLocation.lat},${wardLocation.lng}`;

  useEffect(() => {
    const loadLeaflet = async () => {
      // Load Leaflet CSS if not already loaded
      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }
      // Load Leaflet JS if not already loaded
      if (!(window as any).L) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
          script.onload = () => resolve();
          script.onerror = () => reject();
          document.head.appendChild(script);
        });
      }
      const L = (window as any).L;
      if (!mapContainerRef.current || mapInstanceRef.current) return;

      const map = L.map(mapContainerRef.current, { zoomControl: false }).setView([wardLocation.lat, wardLocation.lng], 15);
      L.tileLayer(GOOGLE_TILES_URL, { maxZoom: 20, attribution: "" }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      const marker = L.marker([wardLocation.lat, wardLocation.lng]).addTo(map);
      // Render safe zone circles
      safeZones.filter(z => z.enabled).forEach((zone) => {
        L.circle([zone.lat, zone.lng], {
          radius: zone.radius_m,
          color: "#6366f1",
          fillColor: "#6366f1",
          fillOpacity: 0.08,
          dashArray: "8 6",
          weight: 2,
        }).addTo(map).bindTooltip(zone.name, { permanent: false });
      });
      mapInstanceRef.current = map;
      markerRef.current = marker;
    };
    loadLeaflet();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // Update marker position when location changes
  useEffect(() => {
    const L = (window as any).L;
    if (mapInstanceRef.current && markerRef.current && L) {
      markerRef.current.setLatLng([wardLocation.lat, wardLocation.lng]);
      mapInstanceRef.current.setView([wardLocation.lat, wardLocation.lng], mapInstanceRef.current.getZoom());
    }
  }, [wardLocation.lat, wardLocation.lng]);

  // Invalidate size when expanded/collapsed
  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => mapInstanceRef.current.invalidateSize(), 300);
    }
  }, [expanded]);

  return (
    <>
      <div className="bg-muted rounded-lg relative overflow-hidden transition-all duration-300" style={{ height: mapHeight }}>
        <div ref={mapContainerRef} className="w-full h-full" />
        <Button
          size="icon"
          variant="secondary"
          className="absolute top-2 right-2 z-[1000] h-7 w-7 shadow-md"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </Button>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {wardLocation.lat.toFixed(4)}° N, {wardLocation.lng.toFixed(4)}° E
          {activeSOS && " • Auto-refreshing every 30s"}
        </p>
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline">
          <ExternalLink className="w-3 h-3" /> Open
        </a>
      </div>
      {locationUpdatedAt && !activeSOS && (
        <p className="text-[10px] text-muted-foreground text-center">
          Updated {formatDistanceToNow(new Date(locationUpdatedAt), { addSuffix: true })}
        </p>
      )}
    </>
  );
};

const GuardianDashboard = () => {
  const { session } = useAuth();
  const { settings } = useUserSettings();
  const { toast } = useToast();
  const [showAmbulance, setShowAmbulance] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [todayCheckIns, setTodayCheckIns] = useState<CheckIn[]>([]);
  const [wardName, setWardName] = useState("User");
  const [wardUserId, setWardUserId] = useState<string | null>(null);
  const [wardPhone, setWardPhone] = useState<string | null>(null);
  const { selectedWard } = useGuardianWard();
  const [wardPauseMode, setWardPauseMode] = useState<string>("active");
  const [wardPauseDetails, setWardPauseDetails] = useState<{ sleepTo?: string; endsAt?: string; reason?: string }>({});
  const [lastActiveAt, setLastActiveAt] = useState<string | null>(null);
  const [locationConsent, setLocationConsent] = useState<boolean>(false);
  const [wardLocation, setWardLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationUpdatedAt, setLocationUpdatedAt] = useState<string | null>(null);
  const [activeSOS, setActiveSOS] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [wardBattery, setWardBattery] = useState<number | null>(null);
  const [batteryUpdatedAt, setBatteryUpdatedAt] = useState<string | null>(null);
  const [batteryAlertShown, setBatteryAlertShown] = useState(false);
  const [wardSafeZones, setWardSafeZones] = useState<SafeZone[]>([]);
  const [wardLastActive, setWardLastActive] = useState<string | null>(null);

  // Track missed medication/check-in counts for escalation
  const missedMedCount = useRef(0);
  const missedCheckInCount = useRef(0);
  const alertedNotifIds = useRef<Set<string>>(new Set());

  const fetchNotifications = useCallback(async () => {
    if (!session?.user?.id || !selectedWard) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", selectedWard.userId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) {
      // Auto-dismiss medication alerts older than 1 hour
      const now = Date.now();
      const processed = (data as Notification[]).map(n => {
        if ((n.type === "medication_missed" || n.type === "medication_taken") && !n.read) {
          const age = now - new Date(n.created_at).getTime();
          if (age > 3600000) return { ...n, read: true };
        }
        return n;
      });
      // Mark old ones as read in DB (fire-and-forget)
      processed.filter((n, i) => n.read && !(data as Notification[])[i].read).forEach(n => {
        supabase.from("notifications").update({ read: true }).eq("id", n.id).then(() => {});
      });
      setNotifications(processed);
    }
  }, [session?.user?.id, selectedWard]);

  const fetchWardCheckIns = useCallback(async () => {
    if (!session?.user?.id) return;
    if (!selectedWard) return;
    const wardId = selectedWard.userId;
    setWardUserId(wardId);
    setWardName(selectedWard.name);

    // Fetch phone
    const { data: wardProfile } = await supabase
      .from("profiles")
      .select("phone, last_active_at")
      .eq("id", wardId)
      .single();
    if (wardProfile?.phone) setWardPhone(wardProfile.phone);
    if ((wardProfile as any)?.last_active_at) setWardLastActive((wardProfile as any).last_active_at);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: checkIns } = await supabase
      .from("check_ins")
      .select("id, scheduled_at, status, responded_at")
      .eq("user_id", wardId)
      .gte("scheduled_at", todayStart.toISOString())
      .order("scheduled_at", { ascending: true });

    if (checkIns) setTodayCheckIns(checkIns);

    const { data: lastActivity } = await supabase
      .from("check_ins")
      .select("responded_at")
      .eq("user_id", wardId)
      .not("responded_at", "is", null)
      .order("responded_at", { ascending: false })
      .limit(1);

    if (lastActivity?.[0]?.responded_at) {
      setLastActiveAt(lastActivity[0].responded_at);
    }

    // Check for active SOS
    const { data: sos } = await supabase
      .from("sos_events")
      .select("*")
      .eq("user_id", wardId)
      .eq("status", "active")
      .order("triggered_at", { ascending: false })
      .limit(1);

    if (sos?.[0]) {
      // Auto-stale: treat SOS older than 2 hours as stale
      const sosAge = Date.now() - new Date(sos[0].triggered_at).getTime();
      setActiveSOS({ ...sos[0], isStale: sosAge > 7200000 });
      if (sos[0].latitude && sos[0].longitude) {
        setWardLocation({ lat: sos[0].latitude, lng: sos[0].longitude });
      }
    } else {
      setActiveSOS(null);
    }

    // Fetch ward's safe zones
    const { data: zones } = await supabase
      .from("safe_zones" as any)
      .select("*")
      .eq("user_id", wardId)
      .eq("enabled", true);
    if (zones) setWardSafeZones(zones as unknown as SafeZone[]);
  }, [session?.user?.id, selectedWard]);

  const fetchWardSettings = useCallback(async (wId: string) => {
    const { data } = await supabase
      .from("user_settings" as any)
      .select("settings, updated_at")
      .eq("user_id", wId)
      .maybeSingle();
    if (data) {
      const s = (data as any).settings;
      setWardPauseMode(s?.pauseMode || "active");
      setWardPauseDetails({
        sleepTo: s?.sleepSchedule?.to,
        endsAt: s?.checkOutConfig?.endsAt,
        reason: s?.checkOutConfig?.reason,
      });
      setLocationConsent(s?.shareLocationWithGuardian !== false);
      if (typeof s?.batteryLevel === "number") {
        setWardBattery(s.batteryLevel);
      }
      if ((data as any)?.updated_at) {
        setBatteryUpdatedAt((data as any).updated_at);
      }
      // Read ward's saved location
      if (s?.lastLocation?.lat && s?.lastLocation?.lng) {
        setWardLocation({ lat: s.lastLocation.lat, lng: s.lastLocation.lng });
        if (s?.lastLocationAt) setLocationUpdatedAt(s.lastLocationAt);
      }
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchNotifications(), fetchWardCheckIns()]);
    if (wardUserId) await fetchWardSettings(wardUserId);
    setRefreshing(false);
  }, [fetchNotifications, fetchWardCheckIns, wardUserId, fetchWardSettings]);

  useEffect(() => {
    fetchNotifications();
    fetchWardCheckIns();
  }, [fetchNotifications, fetchWardCheckIns]);

  useEffect(() => {
    if (wardUserId) fetchWardSettings(wardUserId);
    // Poll ward settings every 2 minutes to keep battery level fresh
    if (!wardUserId) return;
    const pollId = setInterval(() => fetchWardSettings(wardUserId), 120_000);
    return () => clearInterval(pollId);
  }, [wardUserId, fetchWardSettings]);

  // Battery low visual indicator only – no audio alert

  // Realtime subscriptions
  useEffect(() => {
    const channels: any[] = [];

    const notifChannel = supabase
      .channel("guardian-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: wardUserId ? `user_id=eq.${wardUserId}` : undefined }, (payload: any) => {
        fetchNotifications();
        const newNotif = payload?.new;
        if (!newNotif?.id) return;
        // Skip if we already alerted for this notification
        if (alertedNotifIds.current.has(newNotif.id)) return;
        alertedNotifIds.current.add(newNotif.id);
        // Only alert for the selected ward's notifications
        if (wardUserId && newNotif.user_id !== wardUserId) return;

        if ((newNotif?.type === "sos" || newNotif?.type === "fall") && settings.guardianVoiceAlerts) {
          const eventType = newNotif.type === "sos" ? "an SOS" : "a Fall";
          playVoiceReminder(`Dear Guardian, please check on ${wardName}, as we have detected ${eventType} alert`);
        } else if (newNotif?.type === "missed_checkin") {
          // Play chime once, only if the check-in was missed within the last 60 minutes
          const createdAt = newNotif?.created_at ? new Date(newNotif.created_at).getTime() : 0;
          if (Date.now() - createdAt <= 3600000) {
            playChime();
          }
        }
        // No audio for medication_missed, medication_taken, route_deviation, battery, etc.
      })
      .subscribe();
    channels.push(notifChannel);

    if (wardUserId) {
      const settingsChannel = supabase
        .channel("ward-settings")
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "user_settings", filter: `user_id=eq.${wardUserId}` }, () => fetchWardSettings(wardUserId))
        .subscribe();
      channels.push(settingsChannel);

      const checkInChannel = supabase
        .channel("ward-checkins-rt")
        .on("postgres_changes", { event: "*", schema: "public", table: "check_ins", filter: `user_id=eq.${wardUserId}` }, () => fetchWardCheckIns())
        .subscribe();
      channels.push(checkInChannel);

      const sosChannel = supabase
        .channel("ward-sos-rt")
        .on("postgres_changes", { event: "*", schema: "public", table: "sos_events", filter: `user_id=eq.${wardUserId}` }, () => fetchWardCheckIns())
        .subscribe();
      channels.push(sosChannel);

      const profileChannel = supabase
        .channel("ward-profile-rt")
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${wardUserId}` }, (payload: any) => {
          if (payload?.new?.last_active_at) setWardLastActive(payload.new.last_active_at);
        })
        .subscribe();
      channels.push(profileChannel);
    }

    return () => { channels.forEach(c => supabase.removeChannel(c)); };
  }, [fetchNotifications, fetchWardCheckIns, wardUserId, fetchWardSettings, wardName, settings.guardianVoiceAlerts]);

  // Poll SOS location every 30s during active SOS
  useEffect(() => {
    if (!activeSOS || !wardUserId) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("sos_events")
        .select("latitude, longitude, status")
        .eq("id", activeSOS.id)
        .single();
      if (data) {
        if (data.latitude && data.longitude) setWardLocation({ lat: data.latitude, lng: data.longitude });
        if (data.status !== "active") setActiveSOS(null);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [activeSOS, wardUserId]);

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const resolveSOS = async () => {
    if (!activeSOS) return;
    await supabase.from("sos_events").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", activeSOS.id);
    setActiveSOS(null);

    // Notify user and other guardians
    if (wardUserId && session?.user?.id) {
      const resolverName = session.user.user_metadata?.full_name || "Guardian";
      const notifRows = [{
        user_id: wardUserId,
        title: "✅ SOS Resolved by Guardian",
        message: `${resolverName} has resolved your SOS alert.`,
        type: "sos_resolved",
      }];
      await supabase.rpc("insert_notifications_deduped", { p_notifications: notifRows });
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  // --- Auto-collapsing Alerts ---
  const [alertsOpen, setAlertsOpen] = useState(false);
  const alertsTimerRef = useRef<NodeJS.Timeout | null>(null);

  // --- Medications summary ---
  const [medDetailsOpen, setMedDetailsOpen] = useState(false);
  const medDetailsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [medDoseSummary, setMedDoseSummary] = useState<{ taken: number; total: number } | null>(null);

  // --- Data analysis sheet ---
  const [dataAnalysisSheet, setDataAnalysisSheet] = useState<"vitals" | "activity" | "emergency" | "nutrition" | "facescan" | "wellness" | null>(null);

  // Fetch medication dose summary
  const fetchMedSummary = useCallback(async () => {
    if (!wardUserId) return;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const [{ data: meds }, { data: logs }] = await Promise.all([
      supabase.from("medications").select("id, schedule_times").eq("user_id", wardUserId),
      supabase.from("medication_logs").select("status").eq("user_id", wardUserId)
        .gte("scheduled_at", todayStart.toISOString()).lte("scheduled_at", todayEnd.toISOString()),
    ]);
    const total = meds?.reduce((s, m: any) => s + (m.schedule_times?.length || 0), 0) || 0;
    const taken = logs?.filter((l: any) => l.status === "taken" || l.status === "taken_late").length || 0;
    setMedDoseSummary({ taken, total });
  }, [wardUserId]);

  useEffect(() => { fetchMedSummary(); }, [fetchMedSummary]);

  // Auto-open/close alerts based on unread or active journey
  useEffect(() => {
    const hasActiveJourney = !!document.querySelector("[data-journey-active]"); // proxy
    if (unreadCount > 0 || hasActiveJourney) {
      setAlertsOpen(true);
      if (alertsTimerRef.current) clearTimeout(alertsTimerRef.current);
    } else if (alertsOpen) {
      alertsTimerRef.current = setTimeout(() => setAlertsOpen(false), 5 * 60 * 1000);
    }
    return () => { if (alertsTimerRef.current) clearTimeout(alertsTimerRef.current); };
  }, [unreadCount]);

  // Auto-collapse med details after 5 min
  useEffect(() => {
    if (medDetailsOpen) {
      medDetailsTimerRef.current = setTimeout(() => setMedDetailsOpen(false), 5 * 60 * 1000);
    }
    return () => { if (medDetailsTimerRef.current) clearTimeout(medDetailsTimerRef.current); };
  }, [medDetailsOpen]);

  const CHECK_IN_HOURS = [7, 12, 19];
  const formatCheckInTime = (scheduled_at: string) => {
    // Extract local hour from the stored timestamp and map to known check-in labels
    const d = new Date(scheduled_at);
    const hour = d.getHours();
    // Find nearest check-in hour
    let closest = CHECK_IN_HOURS[0];
    for (const h of CHECK_IN_HOURS) {
      if (Math.abs(h - hour) < Math.abs(closest - hour)) closest = h;
    }
    if (closest === 0) return "12:00 AM";
    if (closest < 12) return `${closest}:00 AM`;
    if (closest === 12) return "12:00 PM";
    return `${closest - 12}:00 PM`;
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "ok": case "responded": return "Checked In";
      case "missed": return "Missed";
      case "pending": return "Pending";
      default: return status;
    }
  };

  const getLastActiveText = () => {
    if (!lastActiveAt) return "N/A";
    const diff = Date.now() - new Date(lastActiveAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return formatISTDate(lastActiveAt);
  };

  const handleCallUser = (type: "whatsapp" | "phone" | "flash") => {
    if (!wardPhone) {
      toast({
        title: "No phone number available",
        description: `Ask ${wardName} to add their phone number in Profile settings.`,
        variant: "destructive",
      });
      return;
    }
    const clean = wardPhone.replace(/[^0-9+]/g, "");
    const openLink = (url: string) => {
      // Try opening in a new window first; fall back to location change
      const w = window.open(url, "_blank");
      if (!w || w.closed) {
        window.location.href = url;
      }
    };
    if (type === "whatsapp") {
      openLink(`https://wa.me/${clean.replace("+", "")}`);
      toast({ title: "Opening WhatsApp", description: `Calling ${wardName} on WhatsApp (${wardPhone})` });
    } else if (type === "flash") {
      openLink(`tel:${clean}`);
      toast({ title: "Flash Call initiated", description: `Calling ${wardPhone} — ring briefly to alert ${wardName}` });
      // Also send a ping so User gets a notification
      if (wardUserId && session?.user?.id) {
        supabase.from("guardian_pings").insert({
          guardian_user_id: session.user.id,
          user_id: wardUserId,
          message: `📞 Flash Call from ${session?.user?.user_metadata?.full_name || "Guardian"} — Please call back`,
        } as any);
      }
    } else {
      openLink(`tel:${clean}`);
      toast({ title: "Calling", description: `Dialing ${wardPhone}` });
    }
  };

  const handleRoute = () => {
    if (wardLocation) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${wardLocation.lat},${wardLocation.lng}`, "_blank");
    }
  };

  const handleRefreshLocation = async () => {
    if (!wardUserId) return;
    // First try user_settings (latest saved location)
    const { data: settingsData } = await supabase
      .from("user_settings" as any)
      .select("settings")
      .eq("user_id", wardUserId)
      .maybeSingle();
    const s = (settingsData as any)?.settings;
    if (s?.lastLocation?.lat && s?.lastLocation?.lng) {
      setWardLocation({ lat: s.lastLocation.lat, lng: s.lastLocation.lng });
      if (s?.lastLocationAt) setLocationUpdatedAt(s.lastLocationAt);
      return;
    }
    // Fallback to last SOS event
    const { data: lastSOS } = await supabase
      .from("sos_events")
      .select("latitude, longitude")
      .eq("user_id", wardUserId)
      .not("latitude", "is", null)
      .order("triggered_at", { ascending: false })
      .limit(1);
    if (lastSOS?.[0]?.latitude) {
      setWardLocation({ lat: lastSOS[0].latitude, lng: lastSOS[0].longitude });
    }
  };

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <WardPicker />
        {activeSOS && (
          <Card className={`border-destructive bg-destructive/10 ${activeSOS.isStale ? "" : "animate-pulse"}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-6 h-6 text-destructive" />
                <h3 className="font-bold text-destructive text-lg">
                  🆘 SOS {activeSOS.isStale ? "(Stale)" : "ACTIVE"}
                </h3>
              </div>
              <p className="text-sm text-destructive">
                {wardName} triggered SOS at {formatISTDateTime(activeSOS.triggered_at)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Type: {activeSOS.trigger_type} {activeSOS.isStale ? "• Over 2 hours ago" : "• Location updates every 30s"}
              </p>
              <Button variant="outline" size="sm" className="mt-2" onClick={resolveSOS}>
                ✓ Resolve / Mark Safe
              </Button>
              {wardUserId && (
                <div className="mt-3 space-y-2">
                  <WardEmergencyCard wardUserId={wardUserId} wardName={wardName} />
                  <WardVitalsSummary wardUserId={wardUserId} wardName={wardName} />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Health Pattern Alerts (last 24h) */}
        {(() => {
          const now24h = Date.now() - 24 * 60 * 60 * 1000;
          const anomalyAlerts = notifications.filter(
            n => n.type === "anomaly" && new Date(n.created_at).getTime() > now24h
          );
          if (anomalyAlerts.length === 0) return null;
          return (
            <Card className="border-warning bg-warning/10">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-5 h-5 text-warning-foreground" />
                  <h3 className="font-semibold text-sm text-warning-foreground">Health Pattern Alert</h3>
                </div>
                {anomalyAlerts.map(a => (
                  <div key={a.id} className="p-3 rounded-lg bg-warning/5 border border-warning/30 space-y-1">
                    <p className="text-sm text-foreground">{a.message}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                    </p>
                    {!a.read && (
                      <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => markAsRead(a.id)}>
                        Dismiss
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })()}

        {/* User Status */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  wardPauseMode === "active" ? "bg-success text-success-foreground" :
                  wardPauseMode === "sleep" ? "bg-primary text-primary-foreground" :
                  "bg-amber-500 text-white"
                }`}>
                  {wardPauseMode === "sleep" ? <Moon className="w-5 h-5" /> :
                   wardPauseMode === "checked-out" ? <LogOut className="w-5 h-5" /> :
                   wardName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold">{wardName}</p>
                  {wardPauseMode === "active" && (() => {
                    const outsideZone = wardSafeZones.length > 0 && wardLocation && !wardSafeZones.some(z => haversineDistance(wardLocation.lat, wardLocation.lng, z.lat, z.lng) <= z.radius_m);
                    return outsideZone
                      ? <p className="text-xs text-destructive font-medium flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Outside Safe Zone</p>
                      : <p className="text-xs text-success font-medium">● Online — Safe</p>;
                  })()}
                  {wardPauseMode === "sleep" && (
                    <p className="text-xs text-primary font-medium">
                      😴 Sleep Mode {wardPauseDetails.sleepTo ? `— until ${wardPauseDetails.sleepTo}` : ""}
                    </p>
                  )}
                  {wardPauseMode === "checked-out" && (
                    <p className="text-xs text-amber-600 font-medium">
                      🧳 Checked Out {wardPauseDetails.reason ? `— ${wardPauseDetails.reason}` : ""}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <WardHealthScoreRing wardUserId={wardUserId} />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={refreshAll} disabled={refreshing}>
                  <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-muted">
                <Smartphone className="w-4 h-4 mx-auto text-primary mb-1" />
                <p className="text-sm font-semibold">{getLastActiveText()}</p>
                <p className="text-[10px] text-muted-foreground">Since Last Check-iN</p>
              </div>
              <div className="p-2 rounded-lg bg-muted">
                {(() => {
                  const level = wardBattery;
                  const iconClass = `w-5 h-5 mx-auto mb-1 ${level !== null && level <= 10 ? "text-destructive animate-pulse" : level !== null && level <= 30 ? "text-amber-500" : "text-success"}`;
                  if (level === null) return <BatteryLow className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />;
                  if (level <= 10) return <BatteryWarning className={iconClass} />;
                  if (level <= 30) return <BatteryLow className={iconClass} />;
                  if (level <= 60) return <BatteryMedium className={iconClass} />;
                  return <BatteryFull className={iconClass} />;
                })()}
                <p className={`text-sm font-semibold ${
                  wardBattery !== null && wardBattery <= 30 ? "text-destructive" : ""
                }`}>
                  {wardBattery !== null ? `${wardBattery}%` : "N/A"}
                </p>
                <p className="text-[10px] text-muted-foreground">Battery</p>
                <p className="text-[9px] text-muted-foreground truncate">
                  {batteryUpdatedAt
                    ? formatDistanceToNow(new Date(batteryUpdatedAt), { addSuffix: true })
                    : "—"}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-muted">
                <Smartphone className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                <p className="text-sm font-semibold">
                  {wardLastActive
                    ? formatDistanceToNow(new Date(wardLastActive), { addSuffix: true })
                    : "N/A"}
                </p>
                <p className="text-[10px] text-muted-foreground">Last Active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Missed Check-in Alert */}
        {(() => {
          const missedCount = todayCheckIns.filter(ci => ci.status === "missed").length;
          return missedCount > 0 ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
              <p className="text-sm font-medium text-destructive">
                {wardName} missed {missedCount} check-in{missedCount > 1 ? "s" : ""} today
              </p>
            </div>
          ) : null;
        })()}

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className={`flex-col h-auto py-4 ${wardPhone ? "bg-primary" : "bg-muted text-muted-foreground"}`} size="lg">
                <Phone className="w-5 h-5 mb-1" />
                <span className="text-xs">Call{!wardPhone ? " ⚠" : ""}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleCallUser("phone")}>📞 Mobile Call</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCallUser("whatsapp")}>💬 WhatsApp</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCallUser("flash")}>⚡ Flash Call</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button className="flex-col h-auto py-4 bg-success hover:bg-success/90" size="lg" onClick={handleRoute} disabled={!wardLocation}>
            <Navigation className="w-5 h-5 mb-1" />
            <span className="text-xs">Route</span>
          </Button>
          <Button className="flex-col h-auto py-4 bg-destructive hover:bg-destructive/90" size="lg" onClick={() => setShowAmbulance(!showAmbulance)}>
            <Navigation className="w-5 h-5 mb-1" />
            <span className="text-xs">Ambulance</span>
          </Button>
          {wardUserId && <GuardianPingDialog wardUserId={wardUserId} wardName={wardName} />}
        </div>

        {showAmbulance && <AmbulanceBooking />}

        {/* ===== TODAY'S CHECK-INS (moved above Alerts) ===== */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Today's Check-iNs</CardTitle>
              <span className="text-[10px] text-muted-foreground">Auto-refreshes</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {todayCheckIns.length > 0 ? (
              todayCheckIns.map(ci => (
                <div key={ci.id} className={`flex items-center justify-between py-2 border-b border-border last:border-0 ${ci.status === "missed" ? "bg-destructive/5 -mx-2 px-2 rounded" : ""}`}>
                  <span className="text-sm">{formatCheckInTime(ci.scheduled_at)}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    ci.status === "ok" || ci.status === "responded" ? "bg-success/10 text-success" :
                    ci.status === "missed" ? "bg-destructive/10 text-destructive font-semibold" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {getStatusLabel(ci.status)}
                    {(ci.status === "ok" || ci.status === "responded") && ci.responded_at && (
                      <span className="ml-1 opacity-75">· {formatISTTime(ci.responded_at)}</span>
                    )}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No check-ins recorded today</p>
            )}
          </CardContent>
        </Card>

        {/* ===== MEDICATIONS SUMMARY (moved above Alerts) ===== */}
        {wardUserId && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Pill className="w-5 h-5 text-primary" />
                  <span className="text-sm font-semibold">{wardName}'s Medications</span>
                </div>
              </div>
              {medDoseSummary && medDoseSummary.total > 0 ? (
                <>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {medDoseSummary.taken} of {medDoseSummary.total} doses taken
                      </span>
                      <span className="font-medium">
                        {Math.round((medDoseSummary.taken / medDoseSummary.total) * 100)}%
                      </span>
                    </div>
                    <Progress value={Math.round((medDoseSummary.taken / medDoseSummary.total) * 100)} className="h-2" />
                  </div>
                  {!medDetailsOpen ? (
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setMedDetailsOpen(true)}>
                      View Details <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <WardMedicationStatus wardUserId={wardUserId} wardName={wardName} />
                      <WardMedicationAdherence wardUserId={wardUserId} wardName={wardName} />
                      <WardRefillOrder wardUserId={wardUserId} wardName={wardName} />
                      <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setMedDetailsOpen(false)}>
                        Collapse
                      </Button>
                    </div>
                  )}
                </>
              ) : medDoseSummary && medDoseSummary.total === 0 ? (
                <p className="text-sm text-muted-foreground text-center">No medications scheduled</p>
              ) : (
                <p className="text-sm text-muted-foreground text-center">Loading…</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* ===== ALERTS (auto-collapsing) ===== */}
        <Collapsible open={alertsOpen} onOpenChange={setAlertsOpen}>
          <CollapsibleTrigger asChild>
            <Card className="cursor-pointer hover:border-primary/20 transition-colors">
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-destructive" />
                  <span className="text-sm font-semibold">Alerts</span>
                  {unreadCount > 0 && <Badge variant="destructive" className="text-[10px]">{unreadCount}</Badge>}
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${alertsOpen ? "rotate-180" : ""}`} />
              </CardContent>
            </Card>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1">
            {unreadCount > 0 ? (
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="p-4 space-y-2">
                  {notifications.filter(n => !n.read).slice(0, 5).map(n => (
                    <div key={n.id} className="p-3 rounded-lg bg-card border border-destructive/20 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{n.title}</p>
                        <span className="text-[10px] text-muted-foreground">{formatISTTime(n.created_at)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{n.message}</p>
                      <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => markAsRead(n.id)}>Dismiss</Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-4 text-center text-sm text-muted-foreground">No active alerts</CardContent>
              </Card>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Active Journey Tracker */}
        {wardUserId && <GuardianJourneyTracker wardUserId={wardUserId} wardName={wardName} />}

        {/* Location (collapsible) */}
        <CollapsibleSection
          title={activeSOS ? "🔴 Live Location (SOS Active)" : "Location"}
          icon={<MapPin className="w-5 h-5 text-primary" />}
          defaultOpen={!!activeSOS}
        >
          <Card>
            <CardContent className="pt-3">
              {!locationConsent && !activeSOS ? (
                <div className="h-32 bg-muted rounded-lg flex items-center justify-center">
                  <p className="text-sm text-muted-foreground text-center px-4">
                    {wardName} has not permitted their location to be displayed
                  </p>
                </div>
              ) : wardLocation ? (
                <div className="space-y-2">
                  <MapExpandable wardLocation={wardLocation} activeSOS={!!activeSOS} locationUpdatedAt={locationUpdatedAt} safeZones={wardSafeZones} />
                  {!activeSOS && (
                    <Button variant="outline" size="sm" className="w-full" onClick={handleRefreshLocation}>
                      <RefreshCw className="w-3 h-3 mr-1" /> Refresh Location
                    </Button>
                  )}
                </div>
              ) : (
                <div className="h-32 bg-muted rounded-lg flex flex-col items-center justify-center gap-2">
                  <MapPin className="w-8 h-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No location data available</p>
                  <Button variant="outline" size="sm" onClick={handleRefreshLocation}>
                    <RefreshCw className="w-3 h-3 mr-1" /> Refresh
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </CollapsibleSection>

        {/* ===== DATA ANALYSIS LINK ===== */}
        {wardUserId && (
          <Card className="cursor-pointer hover:border-primary/20 transition-colors" onClick={() => window.open("/guardian/reports", "_blank")}>
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                <span className="text-sm font-semibold">{wardName}'s Data Analysis</span>
              </div>
              <span className="text-xs text-primary font-medium">View Reports →</span>
            </CardContent>
          </Card>
        )}

        {/* Care Journal */}
        {wardUserId && (
          <CollapsibleSection title="Care Journal" icon={<Badge variant="outline" className="text-[10px] px-1.5 py-0">📔</Badge>}>
            <CareJournal wardUserId={wardUserId} />
          </CollapsibleSection>
        )}
      </div>
    </AppLayout>
  );
};

export default GuardianDashboard;
