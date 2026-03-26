import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MapPin, Clock, Navigation } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length >= 2) {
      map.fitBounds(L.latLngBounds(points.map(([lat, lng]) => L.latLng(lat, lng))), { padding: [30, 30] });
    }
  }, [points, map]);
  return null;
}

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

const GuardianJourneyTracker = ({ wardUserId, wardName }: Props) => {
  const [journey, setJourney] = useState<Journey | null>(null);
  const [updates, setUpdates] = useState<Update[]>([]);

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

    // Realtime updates
    const channel = supabase
      .channel(`guardian-journey-${wardUserId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "journeys", filter: `user_id=eq.${wardUserId}` }, () => fetchJourney())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "journey_updates" }, (payload) => {
        const newUpdate = payload.new as Update;
        setUpdates((prev) => [...prev, newUpdate]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [wardUserId]);

  if (!journey) return null;

  const latestPos = [...updates].reverse().find((u) => u.lat && u.lng);
  const routePoints: [number, number][] = updates.filter((u) => u.lat && u.lng).map((u) => [u.lat!, u.lng!]);
  const elapsed = Math.round((Date.now() - new Date(journey.started_at).getTime()) / 60000);

  const distRemaining = latestPos
    ? haversine(latestPos.lat!, latestPos.lng!, journey.destination_lat, journey.destination_lng)
    : null;

  const originDist = journey.origin_lat && journey.origin_lng
    ? haversine(journey.origin_lat, journey.origin_lng, journey.destination_lat, journey.destination_lng)
    : null;

  const progress = originDist && distRemaining !== null ? Math.min(100, Math.max(0, ((originDist - distRemaining) / originDist) * 100)) : 0;
  const arrivingSoon = distRemaining !== null && distRemaining < 500;

  const checkIns = updates.filter((u) => u.check_in_response);

  const mapPoints: [number, number][] = [];
  if (latestPos) mapPoints.push([latestPos.lat!, latestPos.lng!]);
  mapPoints.push([journey.destination_lat, journey.destination_lng]);
  if (journey.origin_lat && journey.origin_lng) mapPoints.push([journey.origin_lat, journey.origin_lng]);

  const mapCenter: [number, number] = latestPos
    ? [latestPos.lat!, latestPos.lng!]
    : [journey.destination_lat, journey.destination_lng];

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2 text-sm">
            <Navigation className="w-4 h-4 text-primary" />
            {wardName}'s Journey
          </h3>
          {arrivingSoon ? (
            <Badge className="bg-success text-success-foreground animate-pulse text-[10px]">🏁 Arriving</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">🗺️ Active</Badge>
          )}
        </div>

        <p className="text-xs text-muted-foreground truncate">
          <MapPin className="w-3 h-3 inline mr-1" />
          {journey.destination_name}
        </p>

        <div className="flex gap-4 text-xs text-muted-foreground">
          <span><Clock className="w-3 h-3 inline mr-1" />{elapsed} min elapsed</span>
          {journey.estimated_duration_min && (
            <span>ETA: {journey.estimated_duration_min} min</span>
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
        <div className="rounded-lg overflow-hidden border border-border" style={{ height: 200 }}>
          <MapContainer center={mapCenter} zoom={12} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {mapPoints.length >= 2 && <FitBounds points={mapPoints} />}
            {latestPos && <Marker position={[latestPos.lat!, latestPos.lng!]} />}
            <Marker position={[journey.destination_lat, journey.destination_lng]} />
            {routePoints.length > 1 && (
              <Polyline positions={routePoints} pathOptions={{ color: "hsl(213, 53%, 23%)", weight: 3 }} />
            )}
          </MapContainer>
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
