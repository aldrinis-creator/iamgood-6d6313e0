import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Hospital, Bluetooth, Phone, Globe, Navigation2, Loader2, MapPin, Star } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { haversineDistance } from "@/lib/haversine";

// Same referrer-restricted browser key used elsewhere in the app.
const GOOGLE_MAPS_API_KEY = "AIzaSyCTaUAI6Q-yrka45TYnP4kYI5gWDjGMjaQ";
const SEARCH_RADIUS_M = 5000;

type Place = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  internationalPhoneNumber?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  currentOpeningHours?: { openNow?: boolean };
  primaryType?: string;
};

type Enriched = Place & { kind: "hospital" | "dental"; distance_km: number };

async function searchNearby(
  lat: number,
  lng: number,
  includedTypes: string[],
): Promise<Place[]> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.internationalPhoneNumber,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.currentOpeningHours,places.primaryType",
    },
    body: JSON.stringify({
      includedTypes,
      maxResultCount: 20,
      locationRestriction: {
        circle: { center: { latitude: lat, longitude: lng }, radius: SEARCH_RADIUS_M },
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Places API ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  return (json.places || []) as Place[];
}

const NearestHospitals = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Enriched[]>([]);
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [filter, setFilter] = useState<"all" | "hospital" | "dental">("all");

  const search = useCallback(async (lat: number, lng: number) => {
    setLoading(true);
    setError(null);
    try {
      const [hospitals, dental] = await Promise.all([
        searchNearby(lat, lng, ["hospital"]),
        searchNearby(lat, lng, ["dental_clinic"]),
      ]);
      const seen = new Set<string>();
      const merged: Enriched[] = [];
      for (const p of hospitals) {
        if (!p.location || seen.has(p.id)) continue;
        seen.add(p.id);
        merged.push({
          ...p,
          kind: "hospital",
          distance_km: haversineDistance(lat, lng, p.location.latitude, p.location.longitude) / 1000,
        });
      }
      for (const p of dental) {
        if (!p.location || seen.has(p.id)) continue;
        seen.add(p.id);
        merged.push({
          ...p,
          kind: "dental",
          distance_km: haversineDistance(lat, lng, p.location.latitude, p.location.longitude) / 1000,
        });
      }
      merged.sort((a, b) => a.distance_km - b.distance_km);
      setResults(merged);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to load nearby facilities");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Location not supported on this device");
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const o = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setOrigin(o);
        search(o.lat, o.lng);
      },
      (err) => {
        setError(err.message || "Unable to get your location. Enable GPS and try again.");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }, [search]);

  const retry = () => {
    if (origin) search(origin.lat, origin.lng);
    else {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const o = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setOrigin(o);
          search(o.lat, o.lng);
        },
        (err) => {
          setError(err.message);
          setLoading(false);
        },
      );
    }
  };

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/personal-healthcare")} className="gap-1">
          <ArrowLeft className="w-4 h-4" /> Nearest Hospital Finder
        </Button>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="w-3.5 h-3.5" /> Showing hospitals & dental clinics within 5 km
        </div>

        {!loading && !error && results.length > 0 && (() => {
          const hospitalCount = results.filter((r) => r.kind === "hospital").length;
          const dentalCount = results.filter((r) => r.kind === "dental").length;
          const chip = (key: "all" | "hospital" | "dental", label: string, count: number) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
                filter === key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {label} <span className="opacity-70">({count})</span>
            </button>
          );
          return (
            <div className="flex flex-wrap gap-2">
              {chip("all", "All", results.length)}
              {chip("hospital", "Hospitals", hospitalCount)}
              {chip("dental", "Dental Clinics", dentalCount)}
            </div>
          );
        })()}

        {loading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Finding facilities near you…
          </div>
        )}

        {error && !loading && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm text-destructive">{error}</p>
              <Button size="sm" onClick={retry}>Try again</Button>
            </CardContent>
          </Card>
        )}

        {!loading && !error && results.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Hospital className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold">No facilities within 5 km</p>
                <p className="text-xs text-muted-foreground mt-1">
                  We couldn't find any hospitals or dental clinics near your current location. Try again from a different spot or check your GPS signal.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={retry}>Try again</Button>
            </CardContent>
          </Card>
        )}

        {!loading && !error && results.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {results.length} {results.length === 1 ? "facility" : "facilities"} found • sorted by nearest
          </p>
        )}

        <div className="space-y-3">
          {results.map((r) => {
            const isDental = r.kind === "dental";
            const Icon = isDental ? Bluetooth : Hospital;
            const dirUrl = r.location
              ? `https://www.google.com/maps/dir/?api=1&destination=${r.location.latitude},${r.location.longitude}`
              : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.displayName?.text || "")}`;
            const phone = r.internationalPhoneNumber || r.nationalPhoneNumber;
            return (
              <Card key={r.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        isDental ? "bg-success/10 text-success" : "bg-primary/10 text-primary"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold leading-tight">{r.displayName?.text || "Unnamed"}</p>
                        <Badge variant={isDental ? "secondary" : "default"} className="text-[10px]">
                          {isDental ? "Dental Clinic" : "Hospital"}
                        </Badge>
                        {r.currentOpeningHours?.openNow != null && (
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              r.currentOpeningHours.openNow ? "text-success border-success/40" : "text-muted-foreground"
                            }`}
                          >
                            {r.currentOpeningHours.openNow ? "Open now" : "Closed"}
                          </Badge>
                        )}
                      </div>
                      {r.formattedAddress && (
                        <p className="text-xs text-muted-foreground mt-1">{r.formattedAddress}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                        <Badge variant="outline" className="text-[10px] font-semibold border-primary/40 text-primary">
                          {r.distance_km < 1
                            ? `${Math.round(r.distance_km * 1000)} m away`
                            : `${r.distance_km.toFixed(2)} km away`}
                        </Badge>
                        {typeof r.rating === "number" && (
                          <span className="flex items-center gap-0.5">
                            <Star className="w-3 h-3 fill-current text-yellow-500" />
                            {r.rating.toFixed(1)}
                            {r.userRatingCount ? ` (${r.userRatingCount})` : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {phone && (
                      <Button size="sm" variant="outline" asChild className="h-8 gap-1 text-xs">
                        <a href={`tel:${phone.replace(/\s+/g, "")}`}>
                          <Phone className="w-3.5 h-3.5" /> Call
                        </a>
                      </Button>
                    )}
                    {r.websiteUri && (
                      <Button size="sm" variant="outline" asChild className="h-8 gap-1 text-xs">
                        <a href={r.websiteUri} target="_blank" rel="noreferrer noopener">
                          <Globe className="w-3.5 h-3.5" /> Website
                        </a>
                      </Button>
                    )}
                    <Button size="sm" asChild className="h-8 gap-1 text-xs">
                      <a href={dirUrl} target="_blank" rel="noreferrer noopener">
                        <Navigation2 className="w-3.5 h-3.5" /> Directions
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
};

export default NearestHospitals;
