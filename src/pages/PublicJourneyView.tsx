import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { Navigation, MapPin, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatISTTime } from "@/lib/istTime";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const userIcon = new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const destIcon = new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  className: "hue-rotate-[120deg]",
});

interface JourneyData {
  destination_name: string;
  destination_lat: number;
  destination_lng: number;
  transport_mode: string | null;
  started_at: string;
  status: string;
  current_lat: number | null;
  current_lng: number | null;
  updated_at: string | null;
}

function FitBounds({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [50, 50] });
  }, [bounds, map]);
  return null;
}

const PublicJourneyView = () => {
  const { token } = useParams<{ token: string }>();
  const [journey, setJourney] = useState<JourneyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    if (!token) return;

    const fetchJourney = async () => {
      const { data, error } = await supabase.rpc("get_public_journey", { _token: token });
      if (error) {
        console.error(error);
        setEnded(true);
        setLoading(false);
        return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        setEnded(true);
        setJourney(null);
      } else {
        setJourney(row as JourneyData);
      }
      setLoading(false);
    };

    fetchJourney();
    const interval = setInterval(fetchJourney, 15000);
    return () => clearInterval(interval);
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (ended || !journey) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
          <MapPin className="w-10 h-10 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Journey has ended</h1>
        <p className="text-muted-foreground max-w-sm">
          This live tracking link is no longer active. The journey has been completed or the link has expired.
        </p>
      </div>
    );
  }

  const center: [number, number] = journey.current_lat && journey.current_lng
    ? [journey.current_lat, journey.current_lng]
    : [journey.destination_lat, journey.destination_lng];

  const bounds = journey.current_lat && journey.current_lng
    ? L.latLngBounds(
        [journey.current_lat, journey.current_lng],
        [journey.destination_lat, journey.destination_lng]
      )
    : null;

  const elapsed = Math.round((Date.now() - new Date(journey.started_at).getTime()) / 60000);

  return (
    <div className="relative w-full h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border shadow-sm">
        <div className="max-w-xl mx-auto px-4 py-3">
          <div className="flex items-center gap-2 text-primary">
            <Navigation className="w-5 h-5" />
            <span className="text-sm font-semibold">Live Journey Tracking</span>
          </div>
          <p className="text-base font-medium mt-1 truncate">
            On the way to {journey.destination_name}
          </p>
          <div className="flex gap-4 text-xs text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {elapsed} min elapsed
            </span>
            {journey.transport_mode && (
              <span className="capitalize">via {journey.transport_mode}</span>
            )}
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="absolute inset-0 z-0">
        <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }} zoomControl={false}>
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          <FitBounds bounds={bounds} />
          {journey.current_lat && journey.current_lng && (
            <Marker position={[journey.current_lat, journey.current_lng]} icon={userIcon} />
          )}
          <Marker position={[journey.destination_lat, journey.destination_lng]} icon={destIcon} />
        </MapContainer>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-card/95 backdrop-blur-sm border-t border-border">
        <div className="max-w-xl mx-auto px-4 py-3 text-center">
          {journey.updated_at ? (
            <p className="text-xs text-muted-foreground">
              Last updated: {formatISTTime(journey.updated_at)} · auto-refreshes every 15s
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Waiting for first location update…</p>
          )}
          <p className="text-[10px] text-muted-foreground mt-1">
            Shared via Check-iN · Live tracking ends when journey ends
          </p>
        </div>
      </div>
    </div>
  );
};

export default PublicJourneyView;
