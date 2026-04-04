import { useState, useEffect, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Navigation, Clock, Car, Footprints, Train, Bus, Eye, Star, X, History } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import JourneyCheckInPopup from "@/components/JourneyCheckInPopup";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { toast } from "sonner";
import "leaflet/dist/leaflet.css";
import StreetViewPanel from "@/components/StreetViewPanel";
import { loadGoogleMapsAPI } from "@/lib/googleMaps";
import { useSavedDestinations } from "@/hooks/useSavedDestinations";

// Fix Leaflet default icon
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

const TRANSPORT_MODES = [
  { value: "car", label: "Car", icon: Car, osrm: "driving" },
  { value: "walk", label: "Walk", icon: Footprints, osrm: "foot" },
  { value: "bus", label: "Bus", icon: Bus, osrm: "driving" },
  { value: "train", label: "Train", icon: Train, osrm: "driving" },
  { value: "auto", label: "Auto", icon: Car, osrm: "driving" },
];

interface SearchResult {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
  lat?: number;
  lng?: number;
}

// Component to fit map bounds
function FitBounds({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [40, 40] });
  }, [bounds, map]);
  return null;
}

const MapMyJourney = () => {
  const {
    activeJourney,
    updates,
    currentPos,
    distanceRemaining,
    showCheckIn,
    arrivingSoon,
    routeDeviation,
    startJourney,
    endJourney,
    respondCheckIn,
    setShowCheckIn,
    setExpectedRoute,
  } = useJourneyTracker();

  // Setup form state
  const [destination, setDestination] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedDest, setSelectedDest] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [transportMode, setTransportMode] = useState("car");
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [eta, setEta] = useState<number | null>(null);
  const [originPos, setOriginPos] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showStreetView, setShowStreetView] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const { destinations: savedDests, saveDestination, toggleFavorite, removeDestination } = useSavedDestinations();
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const placesDiv = useRef<HTMLDivElement | null>(null);

  // Load Google Places API
  useEffect(() => {
    loadGoogleMapsAPI().then(() => {
      autocompleteService.current = new google.maps.places.AutocompleteService();
      // PlacesService needs a DOM element or map
      if (!placesDiv.current) {
        placesDiv.current = document.createElement("div");
      }
      placesService.current = new google.maps.places.PlacesService(placesDiv.current);
    }).catch(() => {
      console.warn("Google Places API failed to load, falling back to basic search");
    });
  }, []);

  // Get user's current location on mount
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setOriginPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => toast.error("Location access needed for journey tracking")
    );
  }, []);

  // Destination autocomplete via Google Places
  const searchDestination = useCallback((query: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimer.current = setTimeout(() => {
      if (!autocompleteService.current) {
        // Fallback to Nominatim if Google not loaded
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=8`, { headers: { "User-Agent": "CheckiN-App/1.0" } })
          .then(r => r.json())
          .then(data => setSearchResults(data.map((d: any) => ({ place_id: d.place_id, description: d.display_name, main_text: d.display_name.split(",")[0], secondary_text: d.display_name.split(",").slice(1).join(",").trim(), lat: parseFloat(d.lat), lng: parseFloat(d.lon) }))))
          .catch(() => setSearchResults([]));
        return;
      }

      const request: google.maps.places.AutocompletionRequest = {
        input: query,
        ...(originPos && {
          locationBias: {
            center: { lat: originPos.lat, lng: originPos.lng },
            radius: 50000,
          } as any,
        }),
      };

      autocompleteService.current.getPlacePredictions(request, (predictions, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
          setSearchResults(predictions.map(p => ({
            place_id: p.place_id,
            description: p.description,
            main_text: p.structured_formatting.main_text,
            secondary_text: p.structured_formatting.secondary_text || "",
          })));
        } else {
          setSearchResults([]);
        }
      });
    }, 300);
  }, [originPos]);

  // Fetch route from OSRM
  const fetchRoute = useCallback(async (origin: { lat: number; lng: number }, dest: { lat: number; lng: number }, mode: string) => {
    const osrmProfile = TRANSPORT_MODES.find((m) => m.value === mode)?.osrm || "driving";
    try {
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/${osrmProfile}/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson`
      );
      const data = await res.json();
      if (data.routes?.[0]) {
        const coords = data.routes[0].geometry.coordinates.map(
          ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
        );
        setRouteCoords(coords);
        setEta(Math.round(data.routes[0].duration / 60));
      }
    } catch {
      toast.error("Could not fetch route");
    }
  }, []);

  // When destination selected, fetch route
  useEffect(() => {
    if (selectedDest && originPos) {
      fetchRoute(originPos, { lat: selectedDest.lat, lng: selectedDest.lng }, transportMode);
    }
  }, [selectedDest, originPos, transportMode, fetchRoute]);

  const handleSelectDest = (result: SearchResult) => {
    // If we already have lat/lng (fallback mode), use directly
    if (result.lat && result.lng) {
      setSelectedDest({ name: result.description, lat: result.lat, lng: result.lng });
      setDestination(result.main_text);
      setSearchResults([]);
      return;
    }
    // Otherwise use PlacesService to get coordinates
    if (!placesService.current) return;
    placesService.current.getDetails(
      { placeId: result.place_id, fields: ["geometry", "name", "formatted_address"] },
      (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
          setSelectedDest({
            name: place.formatted_address || result.description,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          });
          setDestination(result.main_text);
          setSearchResults([]);
        } else {
          toast.error("Could not get location details");
        }
      }
    );
  };

  const handleStartJourney = async () => {
    if (!selectedDest || !originPos || eta === null) return;
    setLoading(true);
    // Save destination for future quick access
    saveDestination({ name: selectedDest.name, lat: selectedDest.lat, lng: selectedDest.lng });
    // Set expected route for geofence detection before starting
    if (routeCoords.length > 0) {
      setExpectedRoute(routeCoords);
    }
    const journey = await startJourney({
      destination_name: selectedDest.name,
      destination_lat: selectedDest.lat,
      destination_lng: selectedDest.lng,
      origin_name: "Current Location",
      origin_lat: originPos.lat,
      origin_lng: originPos.lng,
      transport_mode: transportMode,
      estimated_duration_min: eta,
    });
    setLoading(false);
    if (journey) toast.success("Journey started! Your guardians have been notified.");
    else toast.error("Failed to start journey");
  };

  const handleEndJourney = async () => {
    await endJourney("completed");
    setRouteCoords([]);
    setSelectedDest(null);
    setEta(null);
    toast.success("Journey ended safely ✅");
  };

  // Map bounds
  const mapBounds = (() => {
    if (activeJourney && currentPos) {
      return L.latLngBounds(
        [currentPos.lat, currentPos.lng],
        [activeJourney.destination_lat, activeJourney.destination_lng]
      );
    }
    if (originPos && selectedDest) {
      return L.latLngBounds([originPos.lat, originPos.lng], [selectedDest.lat, selectedDest.lng]);
    }
    return null;
  })();

  const mapCenter: [number, number] = currentPos
    ? [currentPos.lat, currentPos.lng]
    : originPos
      ? [originPos.lat, originPos.lng]
      : [20.5937, 78.9629]; // India center

  // Active journey route (from updates)
  const activeRouteCoords: [number, number][] = activeJourney
    ? updates.filter((u) => u.lat && u.lng).map((u) => [u.lat!, u.lng!])
    : [];

  // Elapsed time
  const elapsed = activeJourney
    ? Math.round((Date.now() - new Date(activeJourney.started_at).getTime()) / 60000)
    : 0;

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Navigation className="w-5 h-5 text-primary" />
          Map My Journey
        </h1>

        {/* Active Journey View */}
        {activeJourney ? (
          <>
            {/* Status Card */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-primary">🗺️ Journey Active</span>
                  <div className="flex items-center gap-1.5">
                    {routeDeviation && (
                      <span className="text-xs bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full animate-pulse">
                        ⚠️ Off Route
                      </span>
                    )}
                    {arrivingSoon && (
                      <span className="text-xs bg-success text-success-foreground px-2 py-0.5 rounded-full animate-pulse">
                        🏁 Arriving Soon
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm font-medium">{activeJourney.destination_name}</p>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {elapsed} min elapsed
                  </span>
                  {distanceRemaining !== null && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {distanceRemaining > 1000
                        ? `${(distanceRemaining / 1000).toFixed(1)} km`
                        : `${Math.round(distanceRemaining)} m`} left
                    </span>
                  )}
                </div>

                {/* Check-in responses */}
                {updates.filter((u) => u.check_in_response).length > 0 && (
                  <div className="space-y-1 pt-2 border-t border-border">
                    <p className="text-xs font-semibold text-muted-foreground">Check-in Responses</p>
                    {updates
                      .filter((u) => u.check_in_response)
                      .slice(-3)
                      .map((u) => (
                        <p key={u.id} className="text-xs text-muted-foreground">
                          {new Date(u.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          : {u.check_in_response}
                        </p>
                      ))}
                  </div>
                )}

                <Button variant="destructive" onClick={handleEndJourney} className="w-full">
                  End Journey
                </Button>
              </CardContent>
            </Card>

            {/* Map */}
            <div className="relative rounded-lg overflow-hidden border border-border" style={{ height: 350 }}>
              <MapContainer center={mapCenter} zoom={13} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <FitBounds bounds={mapBounds} />
                {currentPos && <Marker position={[currentPos.lat, currentPos.lng]} icon={userIcon} />}
                <Marker position={[activeJourney.destination_lat, activeJourney.destination_lng]} icon={destIcon} />
                {activeJourney.origin_lat && activeJourney.origin_lng && (
                  <Marker position={[activeJourney.origin_lat, activeJourney.origin_lng]} icon={userIcon} />
                )}
                {activeRouteCoords.length > 1 && (
                  <Polyline positions={activeRouteCoords} pathOptions={{ color: "hsl(213, 53%, 23%)", weight: 3 }} />
                )}
              </MapContainer>

              {/* Street View toggle */}
              <Button
                size="sm"
                variant={showStreetView ? "default" : "secondary"}
                className="absolute bottom-2 right-2 z-[1000] h-7 shadow-md text-[10px] gap-1"
                onClick={() => setShowStreetView((s) => !s)}
              >
                <Eye className="w-3 h-3" />
                Street View
              </Button>
            </div>

            {/* Street View Panel */}
            {showStreetView && currentPos && (
              <StreetViewPanel
                lat={currentPos.lat}
                lng={currentPos.lng}
                heading={activeRouteCoords.length >= 2
                  ? (() => {
                      const last = activeRouteCoords[activeRouteCoords.length - 1];
                      const prev = activeRouteCoords[activeRouteCoords.length - 2];
                      const dLat = last[0] - prev[0];
                      const dLng = last[1] - prev[1];
                      return (Math.atan2(dLng, dLat) * 180 / Math.PI + 360) % 360;
                    })()
                  : 0}
                height={250}
              />
            )}
          </>
        ) : (
          <>
            {/* Setup Form */}
            <Card>
              <CardContent className="p-4 space-y-4">
                {/* Destination Input */}
                <div className="space-y-2">
                  <Label>Destination</Label>
                  <div className="relative">
                    <Input
                      placeholder="Search destination..."
                      value={destination}
                      onFocus={() => setInputFocused(true)}
                      onBlur={() => setTimeout(() => setInputFocused(false), 200)}
                      onChange={(e) => {
                        setDestination(e.target.value);
                        searchDestination(e.target.value);
                      }}
                    />
                    {/* Search results dropdown */}
                    {searchResults.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {searchResults.map((r, i) => (
                          <button
                            key={r.place_id || i}
                            className="w-full text-left px-3 py-2.5 hover:bg-accent transition-colors border-b border-border last:border-0"
                            onClick={() => handleSelectDest(r)}
                          >
                            <div className="flex items-start gap-2">
                              <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{r.main_text}</p>
                                {r.secondary_text && (
                                  <p className="text-xs text-muted-foreground truncate">{r.secondary_text}</p>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {/* Recent/Saved destinations when input is focused but empty */}
                    {inputFocused && searchResults.length === 0 && destination.length < 2 && savedDests.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                        <div className="px-3 py-2 border-b border-border">
                          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                            <History className="w-3 h-3" /> Recent & Saved
                          </p>
                        </div>
                        {savedDests.map((d) => (
                          <div
                            key={d.id}
                            className="flex items-center gap-1 hover:bg-accent transition-colors border-b border-border last:border-0"
                          >
                            <button
                              className="flex-1 text-left px-3 py-2.5"
                              onClick={() => {
                                setSelectedDest({ name: d.name, lat: d.lat, lng: d.lng });
                                setDestination(d.name.split(",")[0]);
                                setInputFocused(false);
                              }}
                            >
                              <div className="flex items-start gap-2">
                                {d.is_favorite ? (
                                  <Star className="w-4 h-4 mt-0.5 text-yellow-500 fill-yellow-500 shrink-0" />
                                ) : (
                                  <History className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                                )}
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">{d.name.split(",")[0]}</p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {d.name.split(",").slice(1).join(",").trim() || `Used ${d.use_count}×`}
                                  </p>
                                </div>
                              </div>
                            </button>
                            <button
                              className="p-1.5 hover:text-yellow-500 text-muted-foreground"
                              onClick={() => toggleFavorite(d.id, d.is_favorite)}
                              title={d.is_favorite ? "Remove from favorites" : "Add to favorites"}
                            >
                              <Star className={`w-3.5 h-3.5 ${d.is_favorite ? "text-yellow-500 fill-yellow-500" : ""}`} />
                            </button>
                            <button
                              className="p-1.5 hover:text-destructive text-muted-foreground mr-1"
                              onClick={() => removeDestination(d.id)}
                              title="Remove"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Transport Mode */}
                <div className="space-y-2">
                  <Label>Mode of Transport</Label>
                  <Select value={transportMode} onValueChange={setTransportMode}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSPORT_MODES.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          <span className="flex items-center gap-2">
                            <m.icon className="w-4 h-4" /> {m.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Route Info */}
                {eta !== null && selectedDest && (
                  <Card className="bg-muted/50">
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-primary" />
                        <span>Estimated: <strong>{eta} min</strong></span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Check-in every {eta <= 60 ? "15" : "30"} min
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Map Preview */}
                {originPos && (
                  <div className="rounded-lg overflow-hidden border border-border" style={{ height: 250 }}>
                    <MapContainer center={[originPos.lat, originPos.lng]} zoom={12} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <FitBounds bounds={mapBounds} />
                      <Marker position={[originPos.lat, originPos.lng]} icon={userIcon} />
                      {selectedDest && (
                        <Marker position={[selectedDest.lat, selectedDest.lng]} icon={destIcon} />
                      )}
                      {routeCoords.length > 1 && (
                        <Polyline positions={routeCoords} pathOptions={{ color: "hsl(213, 53%, 23%)", weight: 3, dashArray: "8 4" }} />
                      )}
                    </MapContainer>
                  </div>
                )}

                <Button
                  onClick={handleStartJourney}
                  disabled={!selectedDest || !originPos || eta === null || loading}
                  className="w-full"
                  size="lg"
                >
                  <Navigation className="w-4 h-4 mr-2" />
                  {loading ? "Starting..." : "Start Journey"}
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Journey Check-in Popup */}
      <JourneyCheckInPopup
        open={showCheckIn}
        onRespond={respondCheckIn}
        onDismiss={() => setShowCheckIn(false)}
      />
    </AppLayout>
  );
};

export default MapMyJourney;
