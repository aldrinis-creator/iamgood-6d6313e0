import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Hospital, Cross, MapPin, Loader2, Navigation, Phone, Clock,
  ArrowLeft, Search, SlidersHorizontal
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Facility {
  id: number;
  name: string;
  lat: number;
  lon: number;
  phone?: string;
  website?: string;
  openingHours?: string;
  distance?: number;
  address?: string;
}

interface Props {
  type: "hospitals" | "pharmacies";
  onBack: () => void;
}

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

const buildQuery = (lat: number, lon: number, type: "hospitals" | "pharmacies", radius = 5000) => {
  const tag = type === "hospitals"
    ? '["amenity"="hospital"]'
    : '["amenity"="pharmacy"]';
  return `[out:json][timeout:15];(node${tag}(around:${radius},${lat},${lon});way${tag}(around:${radius},${lat},${lon}););out center body;`;
};

const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const NearbyFacilities = ({ type, onBack }: Props) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userPos, setUserPos] = useState<{ lat: number; lon: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [maxDistance, setMaxDistance] = useState(5);
  const [showFilters, setShowFilters] = useState(false);

  const isHospital = type === "hospitals";
  const label = isHospital ? "Hospitals" : "Pharmacies";
  const Icon = isHospital ? Hospital : Cross;
  const accentClass = isHospital ? "text-primary" : "text-success";

  const fetchFacilities = useCallback(async (lat: number, lon: number) => {
    setLoading(true);
    setError(null);
    try {
      const query = buildQuery(lat, lon, type);
      const res = await fetch(OVERPASS_URL, {
        method: "POST",
        body: `data=${encodeURIComponent(query)}`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      if (!res.ok) throw new Error("Search failed");
      const json = await res.json();
      const results: Facility[] = (json.elements || [])
        .map((el: any) => {
          const elLat = el.lat ?? el.center?.lat;
          const elLon = el.lon ?? el.center?.lon;
          if (!elLat || !elLon) return null;
          return {
            id: el.id,
            name: el.tags?.name || (isHospital ? "Hospital" : "Pharmacy"),
            lat: elLat,
            lon: elLon,
            phone: el.tags?.phone || el.tags?.["contact:phone"],
            website: el.tags?.website,
            openingHours: el.tags?.opening_hours,
            distance: haversine(lat, lon, elLat, elLon),
            address: [el.tags?.["addr:street"], el.tags?.["addr:city"]].filter(Boolean).join(", "),
          };
        })
        .filter(Boolean)
        .sort((a: Facility, b: Facility) => (a.distance ?? 99) - (b.distance ?? 99))
        .slice(0, 30);

      setFacilities(results);
      addMarkers(results, lat, lon);
    } catch {
      setError("Could not fetch nearby facilities. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [type, isHospital]);

  const addMarkers = (items: Facility[], uLat: number, uLon: number) => {
    if (!leafletMap.current) return;
    markersRef.current?.clearLayers();
    const group = L.layerGroup().addTo(leafletMap.current);
    markersRef.current = group;

    L.circleMarker([uLat, uLon], {
      radius: 8, fillColor: "#3b82f6", fillOpacity: 1, color: "#fff", weight: 2,
    }).addTo(group).bindPopup("You are here");

    const bounds = L.latLngBounds([[uLat, uLon]]);
    items.forEach((f) => {
      const color = isHospital ? "#1e3a5f" : "#0d9668";
      L.circleMarker([f.lat, f.lon], {
        radius: 7, fillColor: color, fillOpacity: 0.85, color: "#fff", weight: 1.5,
      })
        .addTo(group)
        .bindPopup(`<strong>${f.name}</strong>${f.phone ? `<br/><a href="tel:${f.phone}">${f.phone}</a>` : ""}`);
      bounds.extend([f.lat, f.lon]);
    });
    leafletMap.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
  };

  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;
    leafletMap.current = L.map(mapRef.current, {
      center: [20.5937, 78.9629],
      zoom: 5,
      zoomControl: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 18,
    }).addTo(leafletMap.current);
    L.control.zoom({ position: "bottomright" }).addTo(leafletMap.current);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude: lat, longitude: lon } = pos.coords;
          setUserPos({ lat, lon });
          fetchFacilities(lat, lon);
        },
        () => {
          setError("Location access denied. Please enable location services.");
          setLoading(false);
        },
        { timeout: 8000, enableHighAccuracy: true }
      );
    } else {
      setError("Geolocation is not supported by your browser.");
      setLoading(false);
    }

    return () => {
      leafletMap.current?.remove();
      leafletMap.current = null;
    };
  }, [fetchFacilities]);

  const openDirections = (f: Facility) => {
    const url = userPos
      ? `https://www.google.com/maps/dir/${userPos.lat},${userPos.lon}/${f.lat},${f.lon}`
      : `https://www.google.com/maps/search/?api=1&query=${f.lat},${f.lon}`;
    window.open(url, "_blank");
  };

  const focusOnMap = (f: Facility) => {
    leafletMap.current?.flyTo([f.lat, f.lon], 16, { duration: 0.8 });
  };

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return facilities.filter((f) => {
      if (q && !f.name.toLowerCase().includes(q) && !(f.address || "").toLowerCase().includes(q)) return false;
      if (f.distance != null && f.distance > maxDistance) return false;
      return true;
    });
  }, [facilities, searchQuery, maxDistance]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 px-2">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <Icon className={`w-5 h-5 ${accentClass}`} />
        <h2 className="text-lg font-semibold">Nearby {label}</h2>
        {!loading && (
          <Badge variant="secondary" className="ml-auto text-xs">
            {filtered.length} found
          </Badge>
        )}
      </div>

      {/* Map */}
      <div
        ref={mapRef}
        className="w-full h-48 rounded-lg border border-border overflow-hidden bg-muted"
        style={{ minHeight: 192 }}
      />

      {/* Search & Filter Bar */}
      {!loading && facilities.length > 0 && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={`Search ${label.toLowerCase()}…`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <Button
              variant={showFilters ? "default" : "outline"}
              size="sm"
              className="h-9 gap-1 px-2.5"
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </Button>
          </div>
          {showFilters && (
            <div className="flex items-center gap-3 px-1">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Max distance</span>
              <Slider
                value={[maxDistance]}
                onValueChange={(v) => setMaxDistance(v[0])}
                min={0.5}
                max={5}
                step={0.5}
                className="flex-1"
              />
              <span className="text-xs font-medium w-12 text-right">{maxDistance} km</span>
            </div>
          )}
        </div>
      )}

      {/* Loading / Error */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Searching nearby {label.toLowerCase()}…</span>
        </div>
      )}
      {error && (
        <Card>
          <CardContent className="p-4 text-center text-sm text-destructive">
            {error}
            {userPos && (
              <Button size="sm" variant="outline" className="mt-2" onClick={() => fetchFacilities(userPos.lat, userPos.lon)}>
                Retry
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results List */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((f) => (
            <Card
              key={f.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => focusOnMap(f)}
            >
              <CardContent className="p-3 flex items-start gap-3">
                <div className={`w-9 h-9 rounded-full ${isHospital ? "bg-primary/10" : "bg-success/10"} flex items-center justify-center shrink-0 mt-0.5`}>
                  <Icon className={`w-4 h-4 ${accentClass}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{f.name}</p>
                  {f.address && (
                    <p className="text-xs text-muted-foreground truncate">{f.address}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {f.distance != null && (
                      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                        <MapPin className="w-3 h-3" />
                        {f.distance < 1 ? `${Math.round(f.distance * 1000)}m` : `${f.distance.toFixed(1)}km`}
                      </span>
                    )}
                    {f.openingHours && (
                      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                        <Clock className="w-3 h-3" />
                        {f.openingHours.length > 20 ? f.openingHours.slice(0, 20) + "…" : f.openingHours}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  {f.phone && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={(e) => { e.stopPropagation(); window.open(`tel:${f.phone}`); }}
                    >
                      <Phone className="w-4 h-4 text-success" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={(e) => { e.stopPropagation(); openDirections(f); }}
                  >
                    <Navigation className="w-4 h-4 text-primary" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && !error && facilities.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-center text-muted-foreground py-4">
          No matches. Try adjusting your search or distance filter.
        </p>
      )}

      {!loading && !error && facilities.length === 0 && (
        <p className="text-sm text-center text-muted-foreground py-4">
          No {label.toLowerCase()} found nearby. Try moving to a different area.
        </p>
      )}

      <p className="text-[10px] text-center text-muted-foreground">
        Data from OpenStreetMap · Location used only for search
      </p>
    </div>
  );
};

export default NearbyFacilities;
