import { useState, useEffect, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Navigation, Clock, Car, Footprints, Train, Bus, Eye, Star, X, History, Home, Briefcase, Hospital, ShoppingBag, TrainFront, UtensilsCrossed, Loader2, Users, Share2 } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import JourneyCheckInPopup from "@/components/JourneyCheckInPopup";
import JourneyAlertOverlay from "@/components/JourneyAlertOverlay";
import JourneyAutoSosOverlay from "@/components/JourneyAutoSosOverlay";
import JourneyReportCard from "@/components/JourneyReportCard";
import { Checkbox } from "@/components/ui/checkbox";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { useApp } from "@/contexts/AppContext";
import { useUserSettings } from "@/hooks/useUserSettings";
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
  const { triggerSOS } = useApp();
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
    pendingAutoSos,
    cancelAutoSos,
    notifyAutoSosFired,
    createShareToken,
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
  const [availableGuardians, setAvailableGuardians] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const { destinations: savedDests, saveDestination, toggleFavorite, removeDestination, home: homeDest, work: workDest, setHomeWork } = useSavedDestinations();
  const { settings, updateSetting } = useUserSettings();

  // Fetch guardians once
  useEffect(() => {
    if (!session?.user?.id) return;
    supabase
      .from("guardians")
      .select("*")
      .eq("user_id", session.user.id)
      .then(({ data }) => {
        if (data) setAvailableGuardians(data.filter((g) => !g.is_primary));
      });
  }, [session?.user?.id]);

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

  const handleDeleteReport = async (id: string) => {
    try {
      const { error } = await supabase.from("journey_reports").delete().eq("id", id);
      if (error) throw error;
      setJourneyReports((prev) => prev.filter((r) => r.id !== id));
      toast.success("Report deleted successfully");
    } catch (err: any) {
      toast.error("Failed to delete report");
    }
  };

  const handleDeleteAllReports = async () => {
    if (!session?.user?.id) return;
    try {
      const { error } = await supabase.from("journey_reports").delete().eq("user_id", session.user.id);
      if (error) throw error;
      setJourneyReports([]);
      toast.success("All reports erased");
    } catch (err: any) {
      toast.error("Failed to delete reports");
    }
  };

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

  const handleShareLiveLink = async () => {
    const token = await createShareToken();
    if (!token) {
      toast.error("Could not create share link");
      return;
    }
    const url = `${window.location.origin}/j/${token}`;
    const msg = `I'm sharing my live journey with you. Track me here: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
    toast.success("Live tracking link opened in WhatsApp");
  };

  const handleAutoSosTrigger = async () => {
    await notifyAutoSosFired();
    triggerSOS();
    cancelAutoSos();
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
      <div className="relative w-full h-[calc(100vh-64px)] flex flex-col bg-background overflow-hidden">
        <h1 className="absolute top-4 left-4 z-10 bg-card/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-sm text-lg font-bold flex items-center gap-2 border border-border">
          <Navigation className="w-5 h-5 text-primary" />
          Map My Journey
        </h1>

        {/* Full-screen absolute Map */}
        <div className="absolute inset-0 z-0">
          <MapContainer center={mapCenter} zoom={13} style={{ height: "100%", width: "100%" }} zoomControl={false}>
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
            <FitBounds bounds={mapBounds} />
            {currentPos && <Marker position={[currentPos.lat, currentPos.lng]} icon={userIcon} />}
            {selectedDest && !activeJourney && <Marker position={[selectedDest.lat, selectedDest.lng]} icon={destIcon} />}
            {activeJourney?.destination_lat && activeJourney?.destination_lng && (
               <Marker position={[activeJourney.destination_lat, activeJourney.destination_lng]} icon={destIcon} />
            )}
            {activeJourney?.origin_lat && activeJourney?.origin_lng && (
              <Marker position={[activeJourney.origin_lat, activeJourney.origin_lng]} icon={userIcon} />
            )}
            {(activeRouteCoords.length > 1) ? (
              <Polyline positions={activeRouteCoords} pathOptions={{ color: "hsl(213, 53%, 23%)", weight: 4 }} />
            ) : (routeCoords.length > 1) ? (
              <Polyline positions={routeCoords} pathOptions={{ color: "hsl(213, 53%, 23%)", weight: 3, dashArray: "8 4" }} />
            ) : null}
          </MapContainer>

          {/* Street View toggle */}
          <Button
            size="sm"
            variant={showStreetView ? "default" : "secondary"}
            className="absolute bottom-[40vh] right-4 z-[1000] h-9 shadow-lg gap-1.5 rounded-full px-4"
            onClick={() => setShowStreetView((s) => !s)}
          >
            <Eye className="w-4 h-4" />
            Street View
          </Button>
        </div>

        {/* Street View Panel */}
        {showStreetView && currentPos && (
          <div className="absolute top-20 right-4 left-4 z-20 rounded-xl overflow-hidden shadow-2xl border border-border">
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
          </div>
        )}

        {/* Floating Controls (Bottom Sheet) */}
        <div className="relative z-10 flex flex-col h-full pointer-events-none p-0 justify-end">
          {activeJourney ? (
            <Card className="pointer-events-auto shadow-2xl rounded-t-3xl w-full max-w-xl mx-auto bg-card/95 backdrop-blur-md border-t-4 border-t-primary border-x-0 border-b-0 animate-in slide-in-from-bottom pt-2">
              <CardContent className="p-5 space-y-4">
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
                <p className="text-base font-medium">{activeJourney.destination_name}</p>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" /> {elapsed} min elapsed
                  </span>
                  {distanceRemaining !== null && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4" />
                      {distanceRemaining > 1000
                        ? `${(distanceRemaining / 1000).toFixed(1)} km`
                        : `${Math.round(distanceRemaining)} m`} left
                    </span>
                  )}
                </div>

                {updates.filter((u) => u.check_in_response).length > 0 && (
                  <div className="space-y-1.5 pt-3 border-t border-border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Check-in Responses</p>
                    {updates
                      .filter((u) => u.check_in_response)
                      .slice(-3)
                      .map((u) => (
                        <p key={u.id} className="text-sm text-muted-foreground">
                          {formatISTTime(u.created_at)}
                          : <span className="text-foreground">{u.check_in_response}</span>
                        </p>
                      ))}
                  </div>
                )}

                <Button variant="outline" onClick={handleShareLiveLink} className="w-full h-11 text-sm font-medium gap-2">
                  <Share2 className="w-4 h-4" /> Share live link via WhatsApp
                </Button>

                <Button variant="destructive" onClick={handleEndJourney} className="w-full h-12 text-md font-semibold mt-2">
                  End Journey
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="pointer-events-auto w-full max-w-xl mx-auto bg-card rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.15)] border-t border-border overflow-y-auto max-h-[75vh]">
              <div className="p-5 pb-8 space-y-5">
                <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mb-2" />

                {/* Home / Work Quick-Set */}
                <div className="flex gap-2">
                  <Button variant={homeDest ? "default" : "secondary"} size="sm" className="flex-1 gap-1.5 h-10" onClick={() => {
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
                  }}>
                    <Home className="w-4 h-4" /> {homeDest ? "Home" : "Set Home"}
                  </Button>
                  <Button variant={workDest ? "default" : "secondary"} size="sm" className="flex-1 gap-1.5 h-10" onClick={() => {
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
                  }}>
                    <Briefcase className="w-4 h-4" /> {workDest ? "Work" : "Set Work"}
                  </Button>
                </div>

                {pendingHomeWork && (
                  <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setPendingHomeWork(null)}>
                    <X className="w-3.5 h-3.5 mr-1" />
                    Cancel setting {pendingHomeWork === "home" ? "Home" : "Work"}
                  </Button>
                )}

                {/* Destination Input */}
                <div className="space-y-2 relative z-50">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Where to?</Label>
                  <div className="relative">
                    <Input
                      ref={inputRef}
                      placeholder={pendingHomeWork ? `Search to set ${pendingHomeWork}...` : "Search destination..."}
                      value={destination}
                      onFocus={() => setInputFocused(true)}
                      onBlur={() => setTimeout(() => setInputFocused(false), 300)}
                      onChange={(e) => {
                        setDestination(e.target.value);
                        searchDestination(e.target.value);
                        if (!e.target.value) setSelectedDest(null);
                      }}
                      className={`h-12 text-base shadow-sm ${pendingHomeWork ? "ring-2 ring-primary" : ""}`}
                    />
                    {destination && !searching && (
                      <button
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-muted rounded-full"
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
                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    )}
                    {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
                  </div>

                  {/* Autocomplete Dropdown */}
                  {inputFocused && (destination.length > 0 && searchResults.length === 0 && !searching && !selectedDest) && (
                    <div className="absolute z-[100] w-full mt-1 bg-card border border-border rounded-xl shadow-xl px-4 py-3">
                      <p className="text-sm text-muted-foreground">No results found. Try a different search.</p>
                      {apiStatus && <p className="text-xs text-destructive mt-1">{apiStatus}</p>}
                    </div>
                  )}

                  {searchResults.length > 0 && (
                    <div className="absolute z-[100] w-full mt-1 bg-card border border-border rounded-xl shadow-xl max-h-64 overflow-y-auto">
                      {searchResults.some(r => r.isFuzzy) && (
                        <div className="px-4 py-2 bg-muted/30 border-b border-border">
                          <p className="text-xs text-muted-foreground italic">No exact match found. Showing similar places.</p>
                        </div>
                      )}
                      {searchResults.map((r, i) => (
                        <button
                          key={r.place_id || i}
                          className="w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b border-border last:border-0"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setDestination("");
                            handleSelectDest(r);
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <MapPin className="w-4 h-4 mt-1 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <p className="text-base font-medium text-foreground truncate">{r.main_text}</p>
                              {r.secondary_text && <p className="text-xs text-muted-foreground truncate">{r.secondary_text}</p>}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {inputFocused && searchResults.length === 0 && destination.length === 0 && (
                     <div className="absolute z-[100] w-full mt-1 bg-card border border-border rounded-xl shadow-xl max-h-[300px] overflow-y-auto">
                       <div className="px-4 py-3 border-b border-border">
                         <p className="text-sm font-semibold text-muted-foreground mb-3">Quick Search</p>
                         <div className="flex flex-wrap gap-2">
                           {[ { label: "Restaurant", icon: UtensilsCrossed }, { label: "Hospital", icon: Hospital }, { label: "Mall", icon: ShoppingBag }, { label: "Station", icon: TrainFront } ].map((chip) => (
                             <button key={chip.label} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-sm font-medium hover:bg-accent transition-colors" onMouseDown={(e) => { e.preventDefault(); setDestination(chip.label); searchDestination(chip.label); }}>
                               <chip.icon className="w-3.5 h-3.5" /> {chip.label}
                             </button>
                           ))}
                         </div>
                       </div>
                       {savedDests.length > 0 && (
                         <>
                           <div className="px-4 py-2 bg-muted/20 border-b border-border">
                             <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                               <History className="w-3 h-3" /> Recent Searches
                             </p>
                           </div>
                           {savedDests.map((d) => (
                             <div key={d.id} className="flex items-center gap-1 hover:bg-accent transition-colors border-b border-border last:border-0">
                               <button className="flex-1 text-left px-4 py-3" onMouseDown={(e) => {
                                 e.preventDefault();
                                 setSelectedDest({ name: d.name, lat: d.lat, lng: d.lng });
                                 setDestination(d.name.split(",")[0]);
                                 setInputFocused(false);
                                 if (pendingHomeWork) {
                                   setHomeWork(pendingHomeWork, { name: d.name, lat: d.lat, lng: d.lng });
                                   toast.success(`${pendingHomeWork === "home" ? "Home" : "Work"} saved!`);
                                   setPendingHomeWork(null);
                                 }
                               }}>
                                 <div className="flex items-center gap-3">
                                   {d.name.startsWith("🏠") ? <Home className="w-4 h-4 text-primary shrink-0" /> : d.name.startsWith("🏢") ? <Briefcase className="w-4 h-4 text-primary shrink-0" /> : d.is_favorite ? <Star className="w-4 h-4 text-accent-foreground shrink-0" /> : <History className="w-4 h-4 text-muted-foreground shrink-0" />}
                                   <div className="min-w-0">
                                     <p className="text-sm font-medium text-foreground truncate">{d.name.split(",")[0]}</p>
                                   </div>
                                 </div>
                               </button>
                               <button className="p-3 hover:text-accent-foreground text-muted-foreground" onMouseDown={(e) => { e.preventDefault(); toggleFavorite(d.id, d.is_favorite); }}>
                                 <Star className={`w-4 h-4 ${d.is_favorite ? "text-accent-foreground fill-current" : ""}`} />
                               </button>
                             </div>
                           ))}
                         </>
                       )}
                     </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Transport Mode */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Transport</Label>
                    <Select value={transportMode} onValueChange={setTransportMode}>
                      <SelectTrigger className="h-11">
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
                  
                  {/* Check-In Frequency */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Check-In Timer</Label>
                    <Select value={settings.journeyCheckInFrequency?.toString() || "none"} onValueChange={(val) => updateSetting("journeyCheckInFrequency", val === "none" ? null : parseInt(val))}>
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">Every 15 mins</SelectItem>
                        <SelectItem value="30">Every 30 mins</SelectItem>
                        <SelectItem value="45">Every 45 mins</SelectItem>
                        <SelectItem value="60">Every 60 mins</SelectItem>
                        <SelectItem value="none">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Additional Guardians Checklist */}
                {availableGuardians.length > 0 && (
                  <div className="space-y-3 bg-muted/30 p-3 rounded-lg border border-border">
                    <Label className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
                       <Users className="w-4 h-4" /> Sharing With
                    </Label>
                    <p className="text-[11px] text-muted-foreground leading-snug">Primary Guardian is always notified. Select additional trackers below.</p>
                    <div className="space-y-2 mt-2">
                      {availableGuardians.map((guardian) => (
                        <div key={guardian.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`guardian-${guardian.id}`}
                            checked={settings.journeyTrackingGuardians.includes(guardian.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                updateSetting("journeyTrackingGuardians", [...settings.journeyTrackingGuardians, guardian.id]);
                              } else {
                                updateSetting("journeyTrackingGuardians", settings.journeyTrackingGuardians.filter(id => id !== guardian.id));
                              }
                            }}
                          />
                          <label
                            htmlFor={`guardian-${guardian.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {guardian.guardian_name} <span className="text-xs text-muted-foreground">({guardian.relation || 'Guardian'})</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Route Info */}
                {eta !== null && selectedDest && (
                  <div className="flex items-center justify-center p-3 text-sm font-medium bg-primary/10 text-primary rounded-lg border border-primary/20">
                    <Clock className="w-4 h-4 mr-2" /> ETA: {eta} mins
                  </div>
                )}

                <Button
                  onClick={handleStartJourney}
                  disabled={!selectedDest || !originPos || eta === null || loading}
                  className="w-full h-12 text-md font-semibold mt-4 shadow-lg shadow-primary/20"
                >
                  <Navigation className="w-4 h-4 mr-2" />
                  {loading ? "Calculating..." : "Start Journey"}
                </Button>

                {journeyReports.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-border">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
                        <History className="w-4 h-4" /> Past Journeys
                      </h2>
                      <Button variant="ghost" size="sm" onClick={handleDeleteAllReports} className="text-xs text-muted-foreground hover:text-destructive h-auto py-1">
                        Clear All
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {journeyReports.slice(0,3).map((r) => (
                        <JourneyReportCard key={r.id} report={r} onDelete={handleDeleteReport} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Alert Overlays */}
      {routeDeviation && !routeDeviationDismissed && (
        <JourneyAlertOverlay
          type="deviation"
          message={`You have deviated from the expected route to ${activeJourney?.destination_name || "your destination"}.`}
          onDismiss={() => setRouteDeviationDismissed(true)}
        />
      )}

      <JourneyCheckInPopup
        open={showCheckIn}
        onRespond={respondCheckIn}
        onDismiss={() => setShowCheckIn(false)}
      />

      <JourneyAutoSosOverlay
        open={pendingAutoSos}
        onCancel={cancelAutoSos}
        onTrigger={handleAutoSosTrigger}
        destinationName={activeJourney?.destination_name}
      />
    </AppLayout>
  );
};

export default MapMyJourney;
