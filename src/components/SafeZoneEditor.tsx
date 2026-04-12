import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { MapPin, Plus, Trash2, Navigation, Shield, Loader2, Search, Home, Building2, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFeatureGate } from "@/hooks/useFeatureGate";
import UpgradeDialog from "@/components/UpgradeDialog";
import { useSavedDestinations } from "@/hooks/useSavedDestinations";
import { usePlaceAutocomplete } from "@/hooks/usePlaceAutocomplete";

interface SafeZone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
  enabled: boolean;
  created_at: string;
}

const RADIUS_OPTIONS = [200, 500, 1000, 2000];
const RADIUS_LABELS: Record<number, string> = {
  200: "200m",
  500: "500m",
  1000: "1 km",
  2000: "2 km",
};

function SafeZoneAddForm({
  onSave,
  onCancel,
  isPending,
}: {
  onSave: (zone: { name: string; lat: number; lng: number; radius_m: number }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [newName, setNewName] = useState("Home");
  const [newRadius, setNewRadius] = useState(500);
  const [locating, setLocating] = useState(false);
  const [newLat, setNewLat] = useState<number | null>(null);
  const [newLng, setNewLng] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const { destinations, home, work } = useSavedDestinations();
  const { results, searching, search, resolveCoords, clearResults } = usePlaceAutocomplete({
    origin: newLat && newLng ? { lat: newLat, lng: newLng } : null,
    minChars: 2,
  });

  const favoriteDestinations = destinations.filter(
    (d) => d.is_favorite && !d.name.startsWith("🏠") && !d.name.startsWith("🏢")
  );

  const pickDestination = (name: string, lat: number, lng: number) => {
    setNewName(name.replace(/^🏠 Home: |^🏢 Work: /, ""));
    setNewLat(lat);
    setNewLng(lng);
    setSearchQuery("");
    setShowResults(false);
    clearResults();
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    search(value);
    setShowResults(true);
  };

  const handleSelectResult = async (result: typeof results[0]) => {
    let lat = result.lat;
    let lng = result.lng;
    if (!lat || !lng) {
      const coords = await resolveCoords(result.place_id, result.description);
      if (coords) {
        lat = coords.lat;
        lng = coords.lng;
      }
    }
    if (lat && lng) {
      pickDestination(result.main_text, lat, lng);
    } else {
      toast.error("Could not resolve location");
    }
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNewLat(pos.coords.latitude);
        setNewLng(pos.coords.longitude);
        setLocating(false);
      },
      () => {
        toast.error("Location permission denied");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  // Mini map
  useEffect(() => {
    if (!newLat || !newLng) return;
    const loadMap = async () => {
      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }
      if (!(window as any).L) {
        await new Promise<void>((resolve) => {
          const script = document.createElement("script");
          script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
          script.onload = () => resolve();
          document.head.appendChild(script);
        });
      }
      const L = (window as any).L;
      if (!mapContainerRef.current) return;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      const map = L.map(mapContainerRef.current, { zoomControl: false }).setView([newLat, newLng], 15);
      L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", { maxZoom: 20 }).addTo(map);
      L.marker([newLat, newLng]).addTo(map);
      const circle = L.circle([newLat, newLng], {
        radius: newRadius,
        color: "hsl(var(--primary))",
        fillColor: "hsl(var(--primary))",
        fillOpacity: 0.15,
        dashArray: "8 6",
      }).addTo(map);
      mapInstanceRef.current = map;
      circleRef.current = circle;
    };
    loadMap();
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [newLat, newLng]);

  useEffect(() => {
    if (circleRef.current) circleRef.current.setRadius(newRadius);
  }, [newRadius]);

  const handleSave = () => {
    if (!newLat || !newLng || !newName.trim()) {
      toast.error("Please set a name and location");
      return;
    }
    onSave({ name: newName.trim(), lat: newLat, lng: newLng, radius_m: newRadius });
  };

  const hasLocation = newLat !== null && newLng !== null;

  return (
    <div className="space-y-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
      <Input
        placeholder="Zone name (e.g. Home, Temple)"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        className="text-sm"
      />

      {/* Quick-pick saved destinations */}
      {(home || work || favoriteDestinations.length > 0) && !hasLocation && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground font-medium">Quick pick</p>
          <div className="flex flex-wrap gap-1.5">
            {home && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => pickDestination(home.name, home.lat, home.lng)}
              >
                <Home className="w-3 h-3" /> Home
              </Button>
            )}
            {work && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => pickDestination(work.name, work.lat, work.lng)}
              >
                <Building2 className="w-3 h-3" /> Work
              </Button>
            )}
            {favoriteDestinations.slice(0, 4).map((d) => (
              <Button
                key={d.id}
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => pickDestination(d.name, d.lat, d.lng)}
              >
                <Star className="w-3 h-3" /> {d.name.slice(0, 15)}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Place search */}
      {!hasLocation && (
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search for an address…"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => results.length > 0 && setShowResults(true)}
              className="text-sm pl-8"
            />
            {searching && <Loader2 className="absolute right-2.5 top-2.5 w-4 h-4 animate-spin text-muted-foreground" />}
          </div>
          {showResults && results.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
              {results.map((r) => (
                <button
                  key={r.place_id}
                  className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-start gap-2"
                  onClick={() => handleSelectResult(r)}
                >
                  <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="font-medium truncate text-xs">{r.main_text}</p>
                    {r.secondary_text && <p className="text-xs text-muted-foreground truncate">{r.secondary_text}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* GPS fallback */}
      {!hasLocation && (
        locating ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Getting your location…
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={getCurrentLocation} className="w-full">
            <Navigation className="w-3 h-3 mr-1" /> Use Current Location
          </Button>
        )
      )}

      {/* Map preview + radius */}
      {hasLocation && (
        <>
          <div ref={mapContainerRef} className="h-40 rounded-lg overflow-hidden" />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Radius</p>
              <Badge variant="secondary">{RADIUS_LABELS[newRadius] || `${newRadius}m`}</Badge>
            </div>
            <Slider
              min={0}
              max={3}
              step={1}
              value={[RADIUS_OPTIONS.indexOf(newRadius)]}
              onValueChange={([i]) => setNewRadius(RADIUS_OPTIONS[i])}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              {RADIUS_OPTIONS.map((r) => (
                <span key={r}>{RADIUS_LABELS[r]}</span>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" className="flex-1" onClick={handleSave} disabled={!hasLocation || isPending}>
          {isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
          Save Zone
        </Button>
      </div>
    </div>
  );
}

export default function SafeZoneEditor() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { canAccess, gate, upgradeDialogOpen, upgradeFeature, requiredPlan, upgradeDescription, closeUpgradeDialog } = useFeatureGate();
  const userId = session?.user?.id;

  const [showAdd, setShowAdd] = useState(false);

  const { data: zones = [], isLoading } = useQuery({
    queryKey: ["safe_zones", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("safe_zones" as any)
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as SafeZone[];
    },
    enabled: !!userId,
  });

  const addZone = useMutation({
    mutationFn: async (zone: { name: string; lat: number; lng: number; radius_m: number }) => {
      const { error } = await supabase
        .from("safe_zones" as any)
        .insert({ user_id: userId!, ...zone } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["safe_zones", userId] });
      setShowAdd(false);
      toast.success("Safe zone added");
    },
    onError: () => toast.error("Failed to add safe zone"),
  });

  const toggleZone = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("safe_zones" as any)
        .update({ enabled } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["safe_zones", userId] }),
  });

  const deleteZone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("safe_zones" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["safe_zones", userId] });
      toast.success("Safe zone removed");
    },
  });

  const handleAdd = () => {
    gate("Geofencing", () => setShowAdd(true));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Safety Zones
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Define safe areas — you'll be monitored if you leave them. Guardians get alerted automatically.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {zones.length === 0 && !showAdd && (
            <div className="text-center py-6 space-y-2">
              <MapPin className="w-10 h-10 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No safe zones configured</p>
              <p className="text-xs text-muted-foreground">Add your home or other frequent locations</p>
            </div>
          )}

          {zones.map((zone) => (
            <div key={zone.id} className="flex items-center justify-between p-3 rounded-lg bg-muted border border-border">
              <div className="flex items-center gap-3 flex-1">
                <MapPin className="w-4 h-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{zone.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {zone.radius_m >= 1000 ? `${(zone.radius_m / 1000).toFixed(1)} km` : `${zone.radius_m}m`} radius
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={zone.enabled}
                  onCheckedChange={(v) => toggleZone.mutate({ id: zone.id, enabled: v })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => deleteZone.mutate(zone.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}

          {showAdd && (
            <SafeZoneAddForm
              onSave={(zone) => addZone.mutate(zone)}
              onCancel={() => setShowAdd(false)}
              isPending={addZone.isPending}
            />
          )}

          {!showAdd && (
            <Button variant="outline" className="w-full" onClick={handleAdd}>
              <Plus className="w-4 h-4 mr-1" /> Add Safe Zone
            </Button>
          )}

          {!canAccess("Geofencing") && (
            <p className="text-xs text-muted-foreground text-center">
              🔒 Safe Zones require a Pro subscription
            </p>
          )}
        </CardContent>
      </Card>

      <UpgradeDialog
        open={upgradeDialogOpen}
        onOpenChange={closeUpgradeDialog}
        featureName={upgradeFeature}
        requiredPlan={requiredPlan}
        description={upgradeDescription}
      />
    </>
  );
}
