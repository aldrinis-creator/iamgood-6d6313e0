import { useState, useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, Navigation, Maximize2, Minimize2, AlertTriangle, Gauge, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import "leaflet/dist/leaflet.css";

// ── Helpers ──────────────────────────────────────────────────────────

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// ── Custom Leaflet Icons ─────────────────────────────────────────────

function createWardIcon(rotation: number) {
  return L.divIcon({
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    html: `<div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;width:36px;height:36px;border-radius:50%;background:hsl(213,53%,23%,0.2);animation:pulse-ring 1.5s ease-out infinite;"></div>
      <div style="position:absolute;width:20px;height:20px;border-radius:50%;background:hsl(213,53%,23%);border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>
      <div style="position:absolute;top:-4px;transform:rotate(${rotation}deg);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:10px solid hsl(213,53%,23%);"></div>
    </div>`,
  });
}

const originIcon = L.divIcon({
  className: "",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  html: `<div style="width:18px;height:18px;border-radius:50%;background:hsl(142,71%,45%);border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
});

const destIcon = L.divIcon({
  className: "",
  iconSize: [28, 36],
  iconAnchor: [14, 36],
  html: `<div style="display:flex;flex-direction:column;align-items:center;">
    <div style="width:20px;height:20px;border-radius:50% 50% 50% 0;background:hsl(0,72%,51%);border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;">
      <div style="width:6px;height:6px;border-radius:50%;background:white;transform:rotate(45deg);"></div>
    </div>
    <div style="width:2px;height:8px;background:hsl(0,72%,51%);margin-top:-2px;"></div>
  </div>`,
});

// ── Map Sub-components ───────────────────────────────────────────────

function AutoPan({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.panTo(position, { animate: true, duration: 1 });
  }, [position, map]);
  return null;
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length >= 2) {
      map.fitBounds(
        L.latLngBounds(points.map(([lat, lng]) => L.latLng(lat, lng))),
        { padding: [40, 40] }
      );
    }
  }, [points, map]);
  return null;
}

// ── Animated Marker ──────────────────────────────────────────────────

function AnimatedWardMarker({
  position,
  prevPosition,
}: {
  position: [number, number];
  prevPosition: [number, number] | null;
}) {
  const markerRef = useRef<L.Marker | null>(null);
  const animFrameRef = useRef<number>();

  const rot = prevPosition ? bearing(prevPosition[0], prevPosition[1], position[0], position[1]) : 0;
  const icon = createWardIcon(rot);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker || !prevPosition) {
      marker?.setLatLng(position);
      return;
    }
    // Animate from prev to new over 1s
    const start = performance.now();
    const duration = 1000;
    const fromLat = prevPosition[0];
    const fromLng = prevPosition[1];
    const toLat = position[0];
    const toLng = position[1];

    const animate = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = t * (2 - t); // ease-out quad
      const lat = fromLat + (toLat - fromLat) * eased;
      const lng = fromLng + (toLng - fromLng) * eased;
      marker.setLatLng([lat, lng]);
      if (t < 1) animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [position, prevPosition]);

  return <Marker ref={markerRef} position={position} icon={icon} />;
}

// ── Types ────────────────────────────────────────────────────────────

interface Props {
  wardUserId: string;
  wardName: string;
}

interface Journey {
  id: string;
  destination_name: string;
  destination_lat: number;
  destination_lng: number;
  origin_lat: number | null;
  origin_lng: number | null;
  transport_mode: string;
  estimated_duration_min: number | null;
  started_at: string;
  status: string;
}

interface Update {
  id: string;
  lat: number | null;
  lng: number | null;
  check_in_response: string | null;
  created_at: string;
}

// ── CSS for pulsing animation (injected once) ────────────────────────

const PULSE_STYLE_ID = "guardian-tracker-pulse";
if (typeof document !== "undefined" && !document.getElementById(PULSE_STYLE_ID)) {
  const style = document.createElement("style");
  style.id = PULSE_STYLE_ID;
  style.textContent = `@keyframes pulse-ring{0%{transform:scale(.8);opacity:.8}100%{transform:scale(2);opacity:0}}`;
  document.head.appendChild(style);
}

// ── Main Component ───────────────────────────────────────────────────

const GuardianJourneyTracker = ({ wardUserId, wardName }: Props) => {
  const [journey, setJourney] = useState<Journey | null>(null);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [etaCountdown, setEtaCountdown] = useState<string>("");
  const prevPosRef = useRef<[number, number] | null>(null);
  const hasFittedRef = useRef(false);

  // Fetch journey + updates
  useEffect(() => {
    const fetchJourney = async () => {
      const { data } = await supabase
        .from("journeys")
        .select("*")
        .eq("user_id", wardUserId)
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setJourney(data as Journey);
        const { data: upd } = await supabase
          .from("journey_updates")
          .select("*")
          .eq("journey_id", data.id)
          .order("created_at", { ascending: true });
        if (upd) setUpdates(upd as Update[]);
      } else {
        setJourney(null);
      }
    };
    fetchJourney();

    // Realtime: journey changes + new location updates
    const channel = supabase
      .channel(`guardian-journey-live-${wardUserId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "journeys", filter: `user_id=eq.${wardUserId}` }, () => fetchJourney())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "journey_updates" }, (payload) => {
        const u = payload.new as Update;
        setUpdates((prev) => [...prev, u]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [wardUserId]);

  // Track previous position for animation
  const latestPos = [...updates].reverse().find((u) => u.lat && u.lng);
  const currentPosition: [number, number] | null = latestPos ? [latestPos.lat!, latestPos.lng!] : null;

  useEffect(() => {
    if (currentPosition) {
      // Update prevPos AFTER render so animation can use old value
      const timer = setTimeout(() => {
        prevPosRef.current = currentPosition;
      }, 1100); // after animation duration
      return () => clearTimeout(timer);
    }
  }, [currentPosition?.[0], currentPosition?.[1]]);

  // Live ETA countdown
  useEffect(() => {
    if (!journey) return;
    const interval = setInterval(() => {
      if (!journey.estimated_duration_min || !journey.started_at) {
        setEtaCountdown("");
        return;
      }
      const etaMs = new Date(journey.started_at).getTime() + journey.estimated_duration_min * 60000;
      const remaining = etaMs - Date.now();
      if (remaining <= 0) {
        setEtaCountdown("Overdue");
      } else {
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        setEtaCountdown(`${mins}:${secs.toString().padStart(2, "0")}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [journey?.started_at, journey?.estimated_duration_min]);

  if (!journey) return null;

  const routePoints: [number, number][] = updates.filter((u) => u.lat && u.lng).map((u) => [u.lat!, u.lng!]);
  const elapsed = Math.round((Date.now() - new Date(journey.started_at).getTime()) / 60000);

  const distRemaining = currentPosition
    ? haversine(currentPosition[0], currentPosition[1], journey.destination_lat, journey.destination_lng)
    : null;

  const originDist =
    journey.origin_lat && journey.origin_lng
      ? haversine(journey.origin_lat, journey.origin_lng, journey.destination_lat, journey.destination_lng)
      : null;

  const progress =
    originDist && distRemaining !== null
      ? Math.min(100, Math.max(0, ((originDist - distRemaining) / originDist) * 100))
      : 0;
  const arrivingSoon = distRemaining !== null && distRemaining < 500;

  // Compute current speed from last two GPS updates
  const validUpdates = updates.filter((u) => u.lat && u.lng);
  const speedKmh = (() => {
    if (validUpdates.length < 2) return null;
    const last = validUpdates[validUpdates.length - 1];
    const prev = validUpdates[validUpdates.length - 2];
    const dist = haversine(prev.lat!, prev.lng!, last.lat!, last.lng!);
    const timeDiffS = (new Date(last.created_at).getTime() - new Date(prev.created_at).getTime()) / 1000;
    if (timeDiffS <= 0) return null;
    const speed = (dist / timeDiffS) * 3.6; // m/s → km/h
    return speed > 300 ? null : Math.round(speed); // discard GPS noise spikes
  })();

  const checkIns = updates.filter((u) => u.check_in_response);

  // Points for initial fit bounds (only first time)
  const fitPoints: [number, number][] = [];
  if (currentPosition) fitPoints.push(currentPosition);
  fitPoints.push([journey.destination_lat, journey.destination_lng]);
  if (journey.origin_lat && journey.origin_lng) fitPoints.push([journey.origin_lat, journey.origin_lng]);

  const mapCenter: [number, number] = currentPosition ?? [journey.destination_lat, journey.destination_lng];
  const mapHeight = isFullscreen ? 500 : 350;

  // Remaining path line (current pos → destination)
  const remainingPath: [number, number][] = currentPosition
    ? [currentPosition, [journey.destination_lat, journey.destination_lng]]
    : [];

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2 text-sm">
            <Navigation className="w-4 h-4 text-primary" />
            {wardName}'s Live Journey
          </h3>
          <div className="flex items-center gap-2">
            {distRemaining !== null && distRemaining > 200 && (() => {
              // Check for route deviation visually — if latest position is far from straight line
              const straightDist = journey.origin_lat && journey.origin_lng
                ? haversine(journey.origin_lat, journey.origin_lng, journey.destination_lat, journey.destination_lng)
                : null;
              return null; // Deviation shown via notifications; badge below is driven by notification type
            })()}
            {arrivingSoon ? (
              <Badge className="bg-success text-success-foreground animate-pulse text-[10px]">🏁 Arriving</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] border-primary/40">🗺️ Live</Badge>
            )}
          </div>
        </div>

        {/* Destination */}
        <p className="text-xs text-muted-foreground truncate">
          <MapPin className="w-3 h-3 inline mr-1" />
          {journey.destination_name}
        </p>

        {/* Stats row */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span><Clock className="w-3 h-3 inline mr-1" />{elapsed} min elapsed</span>
          {speedKmh !== null && (
            <span className="font-semibold text-primary">
              <Gauge className="w-3 h-3 inline mr-1" />{speedKmh} km/h
            </span>
          )}
          {etaCountdown && (
            <span className={`font-semibold ${etaCountdown === "Overdue" ? "text-destructive" : "text-primary"}`}>
              ETA: {etaCountdown}
            </span>
          )}
          {distRemaining !== null && (
            <span>
              {distRemaining > 1000
                ? `${(distRemaining / 1000).toFixed(1)} km left`
                : `${Math.round(distRemaining)} m left`}
            </span>
          )}
        </div>

        <Progress value={progress} className="h-2" />

        {/* Map */}
        <div className="relative rounded-lg overflow-hidden border border-border" style={{ height: mapHeight }}>
          <MapContainer center={mapCenter} zoom={14} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false} zoomControl={false}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Initial fit bounds (only when no previous position tracked) */}
            {!hasFittedRef.current && fitPoints.length >= 2 && (
              <FitBounds points={fitPoints} />
            )}

            {/* Auto-pan to ward position on updates */}
            {currentPosition && <AutoPan position={currentPosition} />}

            {/* Traveled path — solid primary */}
            {routePoints.length > 1 && (
              <Polyline
                positions={routePoints}
                pathOptions={{ color: "hsl(213, 53%, 23%)", weight: 4, opacity: 0.9 }}
              />
            )}

            {/* Remaining path — dashed gray */}
            {remainingPath.length === 2 && (
              <Polyline
                positions={remainingPath}
                pathOptions={{ color: "hsl(213, 53%, 60%)", weight: 3, dashArray: "8 8", opacity: 0.5 }}
              />
            )}

            {/* Origin marker */}
            {journey.origin_lat && journey.origin_lng && (
              <Marker position={[journey.origin_lat, journey.origin_lng]} icon={originIcon} />
            )}

            {/* Destination marker */}
            <Marker position={[journey.destination_lat, journey.destination_lng]} icon={destIcon} />

            {/* Animated ward marker */}
            {currentPosition && (
              <AnimatedWardMarker position={currentPosition} prevPosition={prevPosRef.current} />
            )}
          </MapContainer>

          {/* Fullscreen toggle */}
          <Button
            size="icon"
            variant="secondary"
            className="absolute top-2 right-2 z-[1000] h-7 w-7 shadow-md"
            onClick={() => {
              setIsFullscreen((f) => !f);
              hasFittedRef.current = true;
            }}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </Button>
        </div>

        {/* Check-in responses */}
        {checkIns.length > 0 && (
          <div className="space-y-1 pt-2 border-t border-border">
            <p className="text-xs font-semibold">Check-in Updates</p>
            {checkIns.slice(-5).map((u) => (
              <p key={u.id} className="text-xs text-muted-foreground">
                {new Date(u.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                : {u.check_in_response}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GuardianJourneyTracker;
