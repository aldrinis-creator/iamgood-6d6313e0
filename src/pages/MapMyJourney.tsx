import { useState, useEffect, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Navigation, Clock, Car, Footprints, Train, Bus, Eye, Star, X, History, Home, Briefcase, Hospital, ShoppingBag, TrainFront, UtensilsCrossed, Loader2 } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import JourneyCheckInPopup from "@/components/JourneyCheckInPopup";
import JourneyAlertOverlay from "@/components/JourneyAlertOverlay";
import JourneyReportCard from "@/components/JourneyReportCard";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { useAuth } from "@/contexts/AuthContext";
import { formatISTTime } from "@/lib/istTime";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import "leaflet/dist/leaflet.css";
import StreetViewPanel from "@/components/StreetViewPanel";
import { useSavedDestinations } from "@/hooks/useSavedDestinations";
import { usePlaceAutocomplete, type PlaceResult } from "@/hooks/usePlaceAutocomplete";

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

// SearchResult type removed — using PlaceResult from usePlaceAutocomplete

// Component to fit map bounds
function FitBounds({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [40, 40] });
  }, [bounds, map]);
  return null;
}

const MapMyJourney = () => {
  const { session } = useAuth();
  const {
    activeJourney,
    updates,
    currentPos,
    distanceRemaining,
    showCheckIn,
    arrivingSoon,
    arrivingSoonDismissed,
    setArrivingSoonDismissed,
    routeDeviation,
    routeDeviationDismissed,
    setRouteDeviationDismissed,
    startJourney,
    endJourney,
    respondCheckIn,
    setShowCheckIn,
    setExpectedRoute,
  } = useJourneyTracker();

  // Setup form state
  const [destination, setDestination] = useState("");
  const [selectedDest, setSelectedDest] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [transportMode, setTransportMode] = useState("car");
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [eta, setEta] = useState<number | null>(null);
  const [originPos, setOriginPos] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showStreetView, setShowStreetView] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [pendingHomeWork, setPendingHomeWork] = useState<"home" | "work" | null>(null);
  const [journeyReports, setJourneyReports] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const { destinations: savedDests, saveDestination, toggleFavorite, removeDestination, home: homeDest, work: workDest, setHomeWork } = useSavedDestinations();

  // Google-first place autocomplete hook
  const {
    results: searchResults,
    searching,
    apiStatus,
    search: searchDestination,
    clear: clearSearch,
    resolveCoords,
  } = usePlaceAutocomplete({ origin: originPos });

  // Get user's current location on mount
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setOriginPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => toast.error("Location access needed for journey tracking")
    );
  }, []);

  // Fetch journey reports when no active journey
  useEffect(() => {
    if (activeJourney || !session?.user?.id) return;
    supabase
      .from("journey_reports")
      .select("*")
      .eq("user_id", session.user.id)
      .order("ended_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setJourneyReports(data || []));
  }, [activeJourney, session?.user?.id]);

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

  const handleSelectDest = async (result: PlaceResult) => {
    const finalize = (name: string, lat: number, lng: number) => {
      setSelectedDest({ name, lat, lng });
      setDestination(name.split(",")[0]);
      clearSearch();
      if (pendingHomeWork) {
        setHomeWork(pendingHomeWork, { name, lat, lng });
        toast.success(`${pendingHomeWork === "home" ? "Home" : "Work"} location saved!`);
        setPendingHomeWork(null);
      }
    };

    // Resolve coordinates (instant for Nominatim, getDetails for Google)
    const coords = await resolveCoords(result);
    if (coords) {
      finalize(result.description, coords.lat, coords.lng);
    } else {
      toast.error("Could not get location details");
    }
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
                          {formatISTTime(u.created_at)}
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
                  attribution="&copy; Google"
                  url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
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
                {/* Home / Work Quick-Set */}
                <div className="flex gap-2">
                  <Button
                    variant={homeDest ? "default" : "outline"}
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => {
                      if (homeDest) {
                        const name = homeDest.name.replace("🏠 Home: ", "");
                        setSelectedDest({ name: homeDest.name, lat: homeDest.lat, lng: homeDest.lng });
                        setDestination(name.split(",")[0]);
                        setPendingHomeWork(null);
                      } else {
                        setPendingHomeWork("home");
                        setDestination("");
                        setSelectedDest(null);
                        clearSearch();
                        setInputFocused(true);
                        setTimeout(() => inputRef.current?.focus(), 50);
                        toast.info("Search and select a place to set as Home");
                      }
                    }}
                  >
                    <Home className="w-4 h-4" />
                    {homeDest ? "Home" : "Set Home"}
                  </Button>
                  <Button
                    variant={workDest ? "default" : "outline"}
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => {
                      if (workDest) {
                        const name = workDest.name.replace("🏢 Work: ", "");
                        setSelectedDest({ name: workDest.name, lat: workDest.lat, lng: workDest.lng });
                        setDestination(name.split(",")[0]);
                        setPendingHomeWork(null);
                      } else {
                        setPendingHomeWork("work");
                        setDestination("");
                        setSelectedDest(null);
                        clearSearch();
                        setInputFocused(true);
                        setTimeout(() => inputRef.current?.focus(), 50);
                        toast.info("Search and select a place to set as Work");
                      }
                    }}
                  >
                    <Briefcase className="w-4 h-4" />
                    {workDest ? "Work" : "Set Work"}
                  </Button>
                </div>
                {pendingHomeWork && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground"
                    onClick={() => setPendingHomeWork(null)}
                  >
                    <X className="w-3.5 h-3.5 mr-1" />
                    Cancel setting {pendingHomeWork === "home" ? "Home" : "Work"}
                  </Button>
                )}

                {/* Destination Input */}
                <div className="space-y-2">
                  <Label>Destination</Label>
                  <div className="relative">
                     <div className="relative">
                      <Input
                        ref={inputRef}
                        placeholder={pendingHomeWork ? `Search to set as ${pendingHomeWork === "home" ? "Home 🏠" : "Work 🏢"}...` : "Search destination..."}
                        value={destination}
                        onFocus={() => setInputFocused(true)}
                        onBlur={() => setTimeout(() => setInputFocused(false), 300)}
                        onChange={(e) => {
                          setDestination(e.target.value);
                          searchDestination(e.target.value);
                          if (!e.target.value) setSelectedDest(null);
                        }}
                        className={pendingHomeWork ? "ring-2 ring-primary" : ""}
                      />
                      {destination && !searching && (
                        <button
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setDestination("");
                            setSelectedDest(null);
                            clearSearch();
                            setRouteCoords([]);
                            setEta(null);
                            setPendingHomeWork(null);
                          }}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      {searching && (
                        <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    {/* Search results dropdown */}
                    {inputFocused && destination.length > 0 && !searching && searchResults.length === 0 && !selectedDest && (
                      <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-md shadow-lg px-3 py-2.5">
                        <p className="text-xs text-muted-foreground">No results found. Try a different search.</p>
                        {apiStatus && (
                          <p className="text-xs text-destructive mt-1">{apiStatus}</p>
                        )}
                      </div>
                    )}
                    {searchResults.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {searchResults.some(r => r.isFuzzy) && (
                          <div className="px-3 py-1.5 bg-muted/50 border-b border-border">
                            <p className="text-xs text-muted-foreground italic">No exact match found. Showing similar places nearby.</p>
                          </div>
                        )}
                        {searchResults.map((r, i) => (
                          <button
                            key={r.place_id || i}
                            className="w-full text-left px-3 py-2.5 hover:bg-accent transition-colors border-b border-border last:border-0"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelectDest(r);
                            }}
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
                    {/* Recent/Saved destinations + category chips when input is focused but empty */}
                    {inputFocused && searchResults.length === 0 && destination.length < 1 && (
                      <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-72 overflow-y-auto">
                        {/* Quick category chips */}
                        <div className="px-3 py-2 border-b border-border">
                          <p className="text-xs font-semibold text-muted-foreground mb-2">Quick Search</p>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { label: "Restaurant", icon: UtensilsCrossed },
                              { label: "Hospital", icon: Hospital },
                              { label: "Mall", icon: ShoppingBag },
                              { label: "Station", icon: TrainFront },
                            ].map((chip) => (
                              <button
                                key={chip.label}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-xs font-medium text-foreground hover:bg-accent transition-colors"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setDestination(chip.label);
                                  searchDestination(chip.label);
                                }}
                              >
                                <chip.icon className="w-3 h-3" />
                                {chip.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        {/* Saved destinations list */}
                        {savedDests.length > 0 && (
                          <>
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
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    setSelectedDest({ name: d.name, lat: d.lat, lng: d.lng });
                                    setDestination(d.name.split(",")[0]);
                                    setInputFocused(false);
                                    if (pendingHomeWork) {
                                      setHomeWork(pendingHomeWork, { name: d.name, lat: d.lat, lng: d.lng });
                                      toast.success(`${pendingHomeWork === "home" ? "Home" : "Work"} location saved!`);
                                      setPendingHomeWork(null);
                                    }
                                  }}
                                >
                                  <div className="flex items-start gap-2">
                                    {d.name.startsWith("🏠") ? (
                                      <Home className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                                    ) : d.name.startsWith("🏢") ? (
                                      <Briefcase className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                                    ) : d.is_favorite ? (
                                      <Star className="w-4 h-4 mt-0.5 text-accent-foreground shrink-0" />
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
                                  className="p-1.5 hover:text-accent-foreground text-muted-foreground"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    toggleFavorite(d.id, d.is_favorite);
                                  }}
                                  title={d.is_favorite ? "Remove from favorites" : "Add to favorites"}
                                >
                                  <Star className={`w-3.5 h-3.5 ${d.is_favorite ? "text-accent-foreground fill-current" : ""}`} />
                                </button>
                                <button
                                  className="p-1.5 hover:text-destructive text-muted-foreground mr-1"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    removeDestination(d.id);
                                  }}
                                  title="Remove"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </>
                        )}
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

                {/* Map Preview — only after destination selected */}
                {originPos && selectedDest && routeCoords.length > 0 && (
                  <div className="rounded-lg overflow-hidden border border-border" style={{ height: 250 }}>
                    <MapContainer center={[originPos.lat, originPos.lng]} zoom={12} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
                      <TileLayer
                        attribution="&copy; Google"
                        url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                      />
                      <FitBounds bounds={mapBounds} />
                      <Marker position={[originPos.lat, originPos.lng]} icon={userIcon} />
                      <Marker position={[selectedDest.lat, selectedDest.lng]} icon={destIcon} />
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
            {/* Journey History */}
            {journeyReports.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <History className="w-4 h-4 text-muted-foreground" />
                  Past Journeys
                </h2>
                {journeyReports.map((r) => (
                  <JourneyReportCard key={r.id} report={r} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Journey Alert Overlays */}
      {arrivingSoon && !arrivingSoonDismissed && (
        <JourneyAlertOverlay
          type="arriving"
          message={`You are approaching ${activeJourney?.destination_name || "your destination"}.`}
          onDismiss={() => setArrivingSoonDismissed(true)}
        />
      )}
      {routeDeviation && !routeDeviationDismissed && (
        <JourneyAlertOverlay
          type="deviation"
          message={`You have deviated from the expected route to ${activeJourney?.destination_name || "your destination"}.`}
          onDismiss={() => setRouteDeviationDismissed(true)}
        />
      )}

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
