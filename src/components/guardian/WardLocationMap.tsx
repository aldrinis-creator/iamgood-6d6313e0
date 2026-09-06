import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const GOOGLE_TILES_URL = "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";

export interface SafeZone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
  enabled: boolean;
}

interface Props {
  wardLocation: { lat: number; lng: number };
  activeSOS: boolean;
  locationUpdatedAt: string | null;
  safeZones?: SafeZone[];
}

const WardLocationMap = ({ wardLocation, activeSOS, locationUpdatedAt, safeZones = [] }: Props) => {
  const [expanded, setExpanded] = useState(false);
  const mapHeight = expanded ? 400 : 192;
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${wardLocation.lat},${wardLocation.lng}`;

  useEffect(() => {
    const loadLeaflet = async () => {
      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }
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
      safeZones.filter((z) => z.enabled).forEach((zone) => {
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

  useEffect(() => {
    const L = (window as any).L;
    if (mapInstanceRef.current && markerRef.current && L) {
      markerRef.current.setLatLng([wardLocation.lat, wardLocation.lng]);
      mapInstanceRef.current.setView([wardLocation.lat, wardLocation.lng], mapInstanceRef.current.getZoom());
    }
  }, [wardLocation.lat, wardLocation.lng]);

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
      {locationUpdatedAt && (
        <p className={`text-[10px] text-center ${activeSOS ? "text-destructive font-medium" : "text-muted-foreground"}`}>
          Updated {formatDistanceToNow(new Date(locationUpdatedAt), { addSuffix: true })}
        </p>
      )}
    </>
  );
};

export default WardLocationMap;
