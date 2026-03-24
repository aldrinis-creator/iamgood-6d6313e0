import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Hospital, Cross, MapPin, Loader2, Navigation, Phone, Clock,
  ArrowLeft, Search, SlidersHorizontal, Plus, Trash2, User
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AddFacilityDialog from "@/components/facilities/AddFacilityDialog";
import { toast } from "sonner";

interface Facility {
  id: number | string;
  name: string;
  lat: number;
  lon: number;
  phone?: string;
  website?: string;
  openingHours?: string;
  distance?: number;
  address?: string;
  isUserAdded?: boolean;
}

interface Props {
  type: "hospitals" | "pharmacies" | "janaushadhi";
  onBack: () => void;
}

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

const buildQuery = (lat: number, lon: number, type: "hospitals" | "pharmacies" | "janaushadhi", radius = 5000) => {
  if (type === "janaushadhi") {
    return `[out:json][timeout:15];(node["name"~"Jan Aushadhi|Janaushadhi|PMBJP",i](around:${radius},${lat},${lon});way["name"~"Jan Aushadhi|Janaushadhi|PMBJP",i](around:${radius},${lat},${lon});node["operator"~"PMBJP|Jan Aushadhi",i](around:${radius},${lat},${lon}););out center body;`;
  }
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
  const { user } = useAuth();
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [userFacilities, setUserFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userPos, setUserPos] = useState<{ lat: number; lon: number } | null>(null);
  const [searchCenter, setSearchCenter] = useState<{ lat: number; lon: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
  const [addressSearching, setAddressSearching] = useState(false);
  const [maxDistance, setMaxDistance] = useState(5);
  const [showFilters, setShowFilters] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const isHospital = type === "hospitals";
  const isJanAushadhi = type === "janaushadhi";
  const label = isJanAushadhi ? "Jan Aushadhi Kendras" : isHospital ? "Hospitals" : "Pharmacies";
  const Icon = isJanAushadhi ? Cross : isHospital ? Hospital : Cross;
  const accentClass = isJanAushadhi ? "text-[hsl(142,70%,45%)]" : isHospital ? "text-primary" : "text-success";
  const effectiveCenter = searchCenter || userPos;

  const fetchUserFacilities = useCallback(async () => {
    if (!user) return;
    const facilityType = type === "hospitals" ? "hospital" : type === "janaushadhi" ? "janaushadhi" : "pharmacy";
    const { data } = await supabase
      .from("user_facilities" as any)
      .select("*")
      .eq("user_id", user.id)
      .eq("facility_type", facilityType);
    if (data) {
      const mapped: Facility[] = (data as any[]).map((f: any) => ({
        id: f.id,
        name: f.name,
        lat: f.lat,
        lon: f.lon,
        phone: f.phone,
        address: f.address,
        distance: effectiveCenter ? haversine(effectiveCenter.lat, effectiveCenter.lon, f.lat, f.lon) : undefined,
        isUserAdded: true,
      }));
      setUserFacilities(mapped);
    }
  }, [user, type, effectiveCenter]);

  const fetchFacilities = useCallback(async (lat: number, lon: number) => {
    setLoading(true);
    setError(null);
    try {
      const radiusM = maxDistance * 1000;
      const query = buildQuery(lat, lon, type, radiusM);
      const res = await fetch(OVERPASS_URL, {
        method: "POST",
        body: `data=${encodeURIComponent(query)}`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      if (!res.ok) throw new Error("Search failed");
      const json = await res.json();
      let results: Facility[] = (json.elements || [])
        .map((el: any) => {
          const elLat = el.lat ?? el.center?.lat;
          const elLon = el.lon ?? el.center?.lon;
          if (!elLat || !elLon) return null;
          return {
            id: el.id,
            name: el.tags?.name || (isHospital ? "Hospital" : isJanAushadhi ? "Jan Aushadhi Kendra" : "Pharmacy"),
            lat: elLat,
            lon: elLon,
            phone: el.tags?.phone || el.tags?.["contact:phone"],
            website: el.tags?.website,
            openingHours: el.tags?.opening_hours,
            distance: haversine(lat, lon, elLat, elLon),
            address: [el.tags?.["addr:street"], el.tags?.["addr:city"]].filter(Boolean).join(", "),
          };
        })
        .filter(Boolean);

      // For Jan Aushadhi, also fetch from our database
      if (isJanAushadhi) {
        try {
          const { data } = await supabase.functions.invoke("jan-aushadhi-search", {
            body: { type: "store_search", lat, lon },
          });
          if (data?.stores?.length) {
            const dbStores: Facility[] = data.stores.map((s: any) => ({
              id: `db-${s.id}`,
              name: s.store_name,
              lat: s.lat,
              lon: s.lon,
              phone: s.phone,
              address: [s.address, s.district, s.state].filter(Boolean).join(", "),
              distance: s.distance_km ?? haversine(lat, lon, s.lat, s.lon),
            }));
            // Merge and deduplicate by proximity (within 100m)
            for (const dbStore of dbStores) {
              const isDuplicate = results.some(
                (r: Facility) => haversine(r.lat, r.lon, dbStore.lat, dbStore.lon) < 0.1
              );
              if (!isDuplicate) results.push(dbStore);
            }
          }
        } catch (e) {
          console.error("Jan Aushadhi store search error:", e);
        }
      }

      results = results
        .sort((a: Facility, b: Facility) => (a.distance ?? 99) - (b.distance ?? 99))
        .slice(0, 50);

      setFacilities(results);
      addMarkers(results, lat, lon);
    } catch {
      setError("Could not fetch nearby facilities. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [type, isHospital, maxDistance]);

  const addMarkers = (items: Facility[], uLat: number, uLon: number) => {
    if (!leafletMap.current) return;
    markersRef.current?.clearLayers();
    const group = L.layerGroup().addTo(leafletMap.current);
    markersRef.current = group;

    L.circleMarker([uLat, uLon], {
      radius: 8, fillColor: "#3b82f6", fillOpacity: 1, color: "#fff", weight: 2,
    }).addTo(group).bindPopup(searchCenter ? "Search location" : "You are here");

    const bounds = L.latLngBounds([[uLat, uLon]]);
    const allItems = [...items, ...userFacilities];
    allItems.forEach((f) => {
      const color = f.isUserAdded ? "#f59e0b" : (isHospital ? "#1e3a5f" : "#0d9668");
      L.circleMarker([f.lat, f.lon], {
        radius: 7, fillColor: color, fillOpacity: 0.85, color: "#fff", weight: 1.5,
      })
        .addTo(group)
        .bindPopup(`<strong>${f.name}</strong>${f.isUserAdded ? "<br/><em>User added</em>" : ""}${f.phone ? `<br/><a href="tel:${f.phone}">${f.phone}</a>` : ""}`);
      bounds.extend([f.lat, f.lon]);
    });
    if (allItems.length > 0) {
      leafletMap.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
    }
  };

  // Search by address using Nominatim
  const searchByAddress = async () => {
    if (!addressQuery.trim()) return;
    setAddressSearching(true);
    try {
      const res = await fetch(
        `${NOMINATIM_URL}?format=json&q=${encodeURIComponent(addressQuery)}&limit=1`,
        { headers: { "User-Agent": "CheckiN-App/1.0" } }
      );
      const data = await res.json();
      if (data.length > 0) {
        const newCenter = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
        setSearchCenter(newCenter);
        leafletMap.current?.flyTo([newCenter.lat, newCenter.lon], 13, { duration: 1 });
        fetchFacilities(newCenter.lat, newCenter.lon);
        toast.success(`Searching near: ${data[0].display_name?.split(",").slice(0, 2).join(",")}`);
      } else {
        toast.error("Location not found. Try a different address.");
      }
    } catch {
      toast.error("Address search failed.");
    } finally {
      setAddressSearching(false);
    }
  };

  const resetToCurrentLocation = () => {
    if (userPos) {
      setSearchCenter(null);
      setAddressQuery("");
      leafletMap.current?.flyTo([userPos.lat, userPos.lon], 13, { duration: 1 });
      fetchFacilities(userPos.lat, userPos.lon);
    }
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
          setError("Location access denied. Please enable location services or search by address.");
          setLoading(false);
        },
        { timeout: 8000, enableHighAccuracy: true }
      );
    } else {
      setError("Geolocation is not supported. Use the address search instead.");
      setLoading(false);
    }

    return () => {
      leafletMap.current?.remove();
      leafletMap.current = null;
    };
  }, []);

  // Fetch user facilities when user or center changes
  useEffect(() => {
    fetchUserFacilities();
  }, [fetchUserFacilities]);

  // Re-add markers when user facilities update
  useEffect(() => {
    if (effectiveCenter && facilities.length > 0) {
      addMarkers(facilities, effectiveCenter.lat, effectiveCenter.lon);
    }
  }, [userFacilities]);

  const deleteUserFacility = async (id: string) => {
    const { error } = await supabase.from("user_facilities" as any).delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); return; }
    toast.success("Facility removed");
    fetchUserFacilities();
  };

  const openDirections = (f: Facility) => {
    const origin = effectiveCenter || userPos;
    const url = origin
      ? `https://www.google.com/maps/dir/${origin.lat},${origin.lon}/${f.lat},${f.lon}`
      : `https://www.google.com/maps/search/?api=1&query=${f.lat},${f.lon}`;
    window.open(url, "_blank");
  };

  const focusOnMap = (f: Facility) => {
    leafletMap.current?.flyTo([f.lat, f.lon], 16, { duration: 0.8 });
  };

  const allFacilities = useMemo(() => {
    const center = effectiveCenter;
    const userWithDist = center
      ? userFacilities.map(f => ({ ...f, distance: haversine(center.lat, center.lon, f.lat, f.lon) }))
      : userFacilities;
    return [...facilities, ...userWithDist].sort((a, b) => (a.distance ?? 99) - (b.distance ?? 99));
  }, [facilities, userFacilities, effectiveCenter]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return allFacilities.filter((f) => {
      if (q && !f.name.toLowerCase().includes(q) && !(f.address || "").toLowerCase().includes(q)) return false;
      if (f.distance != null && f.distance > maxDistance) return false;
      return true;
    });
  }, [allFacilities, searchQuery, maxDistance]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 px-2">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <Icon className={`w-5 h-5 ${accentClass}`} />
        <h2 className="text-lg font-semibold">Nearby {label}</h2>
        <div className="ml-auto flex items-center gap-1">
          {!loading && (
            <Badge variant="secondary" className="text-xs">
              {filtered.length} found
            </Badge>
          )}
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setAddDialogOpen(true)} title="Add facility">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Address Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search any location worldwide…"
            value={addressQuery}
            onChange={(e) => setAddressQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchByAddress()}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <Button size="sm" className="h-9" onClick={searchByAddress} disabled={addressSearching || !addressQuery.trim()}>
          {addressSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Go"}
        </Button>
      </div>
      {searchCenter && (
        <Button size="sm" variant="link" className="text-xs h-auto p-0" onClick={resetToCurrentLocation}>
          ← Back to my location
        </Button>
      )}

      {/* Map */}
      <div
        ref={mapRef}
        className="w-full h-48 rounded-lg border border-border overflow-hidden bg-muted"
        style={{ minHeight: 192 }}
      />

      {/* Search & Filter Bar */}
      {!loading && allFacilities.length > 0 && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={`Filter ${label.toLowerCase()} by name…`}
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
                min={1}
                max={25}
                step={1}
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
            {effectiveCenter && (
              <Button size="sm" variant="outline" className="mt-2" onClick={() => fetchFacilities(effectiveCenter.lat, effectiveCenter.lon)}>
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
              key={`${f.isUserAdded ? "u" : "o"}-${f.id}`}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => focusOnMap(f)}
            >
              <CardContent className="p-3 flex items-start gap-3">
                <div className={`w-9 h-9 rounded-full ${f.isUserAdded ? "bg-amber-500/10" : (isHospital ? "bg-primary/10" : "bg-success/10")} flex items-center justify-center shrink-0 mt-0.5`}>
                  {f.isUserAdded ? <User className="w-4 h-4 text-amber-600" /> : <Icon className={`w-4 h-4 ${accentClass}`} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium truncate">{f.name}</p>
                    {f.isUserAdded && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0 border-amber-400 text-amber-600">
                        Added
                      </Badge>
                    )}
                  </div>
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
                  {f.isUserAdded && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={(e) => { e.stopPropagation(); deleteUserFacility(f.id as string); }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && !error && allFacilities.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-center text-muted-foreground py-4">
          No matches. Try adjusting your search or distance filter.
        </p>
      )}

      {!loading && !error && allFacilities.length === 0 && (
        <p className="text-sm text-center text-muted-foreground py-4">
          No {label.toLowerCase()} found nearby. Try searching a different location or add one manually.
        </p>
      )}

      <p className="text-[10px] text-center text-muted-foreground">
        Data from OpenStreetMap · Location used only for search
      </p>

      <AddFacilityDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        type={type}
        userPos={userPos}
        onAdded={fetchUserFacilities}
      />
    </div>
  );
};

export default NearbyFacilities;
