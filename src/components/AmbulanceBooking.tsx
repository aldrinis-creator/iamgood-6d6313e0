import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Ambulance, AlertTriangle, CreditCard, Navigation, Phone,
  MessageCircle, MapPin, Info, Pencil, Check, Loader2, Hospital, X, User as UserIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlaceAutocomplete, type PlaceResult } from "@/hooks/usePlaceAutocomplete";
import { toast } from "sonner";

type TabMode = "emergency" | "book";

interface AmbulanceBookingProps {
  wardUserId?: string;
  wardName?: string;
  wardLocation?: { lat: number; lng: number } | null;
  wardPhone?: string;
}

interface ContactRow {
  name: string;
  phone: string;
  role: "patient" | "guardian";
  label?: string;
}

interface DestinationSel {
  name: string;
  address?: string;
  lat: number | null;
  lng: number | null;
}

const HELPLINE = "+917045868482";

const AmbulanceBooking = ({ wardUserId, wardName, wardLocation, wardPhone }: AmbulanceBookingProps) => {
  const isGuardianMode = !!wardUserId;
  const { profile, user } = useAuth();

  const [mode, setMode] = useState<TabMode>("emergency");
  const [showForm, setShowForm] = useState(false);
  const [progress, setProgress] = useState(0);
  const [countdown, setCountdown] = useState(3);

  // Location state
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [pickupAddress, setPickupAddress] = useState("");
  const [locating, setLocating] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [editingLocation, setEditingLocation] = useState(false);
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");

  // Patient + contacts
  const [patientName, setPatientName] = useState("");
  const [emergencyType, setEmergencyType] = useState("");
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [primaryGuardianMissing, setPrimaryGuardianMissing] = useState(false);

  // Destination
  const [destination, setDestination] = useState<DestinationSel | null>(null);
  const [destQuery, setDestQuery] = useState("");
  const [showDestResults, setShowDestResults] = useState(false);
  const destInputRef = useRef<HTMLInputElement>(null);

  const [sending, setSending] = useState(false);
  const [resultMessage, setResultMessage] = useState<{ kind: "success" | "warn" | "error"; text: string } | null>(null);

  // Place autocomplete (MMJ-style)
  const { results: destResults, searching: destSearching, search: searchDest, clear: clearDest, resolveCoords } =
    usePlaceAutocomplete({ origin: location });

  // ---- Pre-fill patient name & primary contact ----
  useEffect(() => {
    if (isGuardianMode) {
      if (wardName) setPatientName(wardName);
    } else if (profile?.full_name) {
      setPatientName(profile.full_name);
    }
  }, [isGuardianMode, wardName, profile?.full_name]);

  // ---- Build contacts list ----
  useEffect(() => {
    const load = async () => {
      const rows: ContactRow[] = [];

      if (isGuardianMode) {
        // Patient = ward, Guardian = current user
        if (wardPhone) {
          rows.push({ name: wardName || "Ward", phone: wardPhone, role: "patient", label: "Patient" });
        }
        if (profile?.phone) {
          rows.push({ name: profile.full_name || "You", phone: profile.phone, role: "guardian", label: "You (Guardian)" });
        }
        // Also try to find primary guardian record of the ward (might be us, that's ok)
        if (wardUserId) {
          const { data } = await supabase
            .from("guardians")
            .select("guardian_name, guardian_phone, relation, is_primary")
            .eq("user_id", wardUserId)
            .eq("status", "accepted")
            .eq("is_primary", true)
            .maybeSingle();
          if (data && data.guardian_phone !== profile?.phone) {
            rows.push({
              name: data.guardian_name,
              phone: data.guardian_phone,
              role: "guardian",
              label: `${data.relation || "Primary Guardian"}`,
            });
          }
        }
      } else {
        // Patient = current user, Guardian = primary guardian
        if (profile?.phone) {
          rows.push({ name: profile.full_name || "You", phone: profile.phone, role: "patient", label: "You" });
        }
        if (user?.id) {
          const { data } = await supabase
            .from("guardians")
            .select("guardian_name, guardian_phone, relation, is_primary")
            .eq("user_id", user.id)
            .eq("status", "accepted")
            .eq("is_primary", true)
            .maybeSingle();
          if (data) {
            rows.push({
              name: data.guardian_name,
              phone: data.guardian_phone,
              role: "guardian",
              label: `${data.relation || "Primary Guardian"}`,
            });
            setPrimaryGuardianMissing(false);
          } else {
            setPrimaryGuardianMissing(true);
          }
        }
      }
      setContacts(rows);
    };
    load();
  }, [isGuardianMode, wardUserId, wardName, wardPhone, profile?.phone, profile?.full_name, user?.id]);

  // ---- Auto-detect / pre-fill location ----
  useEffect(() => {
    if (!showForm) return;
    if (isGuardianMode && wardLocation) {
      setLocation(wardLocation);
      setManualLat(wardLocation.lat.toString());
      setManualLng(wardLocation.lng.toString());
      reverseGeocode(wardLocation.lat, wardLocation.lng);
      setLocating(false);
      return;
    }
    detectLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm]);

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`,
        { headers: { "User-Agent": "CheckiN-App/1.0" } }
      );
      const data = await res.json();
      if (data?.display_name) setPickupAddress(data.display_name);
    } catch {
      // ignore
    }
  };

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setLocating(false);
      setLocationError("Geolocation not supported by this browser");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(loc);
        setManualLat(loc.lat.toString());
        setManualLng(loc.lng.toString());
        reverseGeocode(loc.lat, loc.lng);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setLocationError(err.code === 1 ? "Location permission denied — enter manually below" : "Could not detect location — enter manually below");
        setEditingLocation(true);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const applyManualLocation = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (!isNaN(lat) && !isNaN(lng)) {
      const loc = { lat, lng };
      setLocation(loc);
      setEditingLocation(false);
      reverseGeocode(lat, lng);
    } else {
      toast.error("Please enter valid latitude and longitude");
    }
  };

  // ---- Auto-open countdown ----
  useEffect(() => {
    if (showForm) return;
    const interval = setInterval(() => {
      setProgress((p) => {
        const next = p + 100 / 30;
        return next >= 100 ? 100 : next;
      });
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          setTimeout(() => setShowForm(true), 200);
          return 0;
        }
        return c;
      });
    }, 100);
    const sec = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => { clearInterval(interval); clearInterval(sec); };
  }, [showForm]);

  // ---- Destination search ----
  const handleDestChange = (val: string) => {
    setDestQuery(val);
    setShowDestResults(true);
    if (val.length >= 2) {
      searchDest(val);
    } else {
      clearDest();
    }
  };

  const handleSelectDestination = async (r: PlaceResult) => {
    setShowDestResults(false);
    setDestQuery(r.main_text);
    let coords: { lat: number; lng: number } | null = null;
    if (r.lat != null && r.lng != null) {
      coords = { lat: r.lat, lng: r.lng };
    } else {
      coords = await resolveCoords(r);
    }
    setDestination({
      name: r.main_text,
      address: r.description,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    });
    clearDest();
  };

  const clearDestination = () => {
    setDestination(null);
    setDestQuery("");
    clearDest();
    destInputRef.current?.focus();
  };

  // ---- Send request ----
  const submitRequest = async (forceWhatsApp = false) => {
    if (!destination) {
      toast.error("Please select a destination hospital");
      return;
    }
    if (contacts.length === 0) {
      toast.error("No contact numbers available");
      return;
    }

    setSending(true);
    setResultMessage(null);

    try {
      const { data, error } = await supabase.functions.invoke("send-ambulance-request", {
        body: {
          source: isGuardianMode ? "guardian" : "user",
          ward_user_id: isGuardianMode ? wardUserId : null,
          patient_name: patientName || "Unknown",
          pickup: {
            address: pickupAddress || (location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : ""),
            lat: location?.lat ?? null,
            lng: location?.lng ?? null,
          },
          destination: {
            name: destination.name,
            lat: destination.lat,
            lng: destination.lng,
          },
          contacts,
          emergency_type: emergencyType || undefined,
          force_channel: forceWhatsApp ? "whatsapp" : undefined,
        },
      });

      if (error) throw error;

      if (data?.success) {
        setResultMessage({
          kind: data.channel === "api" ? "success" : "warn",
          text: data.message,
        });
        toast.success(data.channel === "api" ? "Ambulance request sent" : "Sent via WhatsApp");
      } else {
        setResultMessage({ kind: "error", text: data?.message || "Both channels failed. Please call the helpline." });
        toast.error("Request failed — call helpline");
      }
    } catch (e: any) {
      console.error("Ambulance request error:", e);
      setResultMessage({ kind: "error", text: `Request failed. Please call the helpline: ${HELPLINE}` });
      toast.error("Network error — call helpline");
    } finally {
      setSending(false);
    }
  };

  const callHelpline = () => {
    window.open(`tel:${HELPLINE}`, "_self");
  };

  const canSend = useMemo(() => !!destination && contacts.length > 0 && !!location, [destination, contacts.length, location]);

  // ---- Initial countdown card ----
  if (!showForm) {
    return (
      <Card className="border-sos/30 overflow-hidden">
        <div className="h-1 bg-sos" />
        <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-sos/10 flex items-center justify-center">
            <Ambulance className="w-8 h-8 text-sos" />
          </div>
          <h2 className="text-xl font-bold">Book Ambulance</h2>
          <p className="text-sm text-muted-foreground">
            Request emergency ambulance service with live tracking and pricing.
          </p>
          <div className="w-full space-y-1">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-primary font-medium">Opening in {countdown}s...</p>
          </div>
          <Button
            className="w-full bg-sos hover:bg-sos/90 text-sos-foreground font-semibold"
            size="lg"
            onClick={() => setShowForm(true)}
          >
            Book Now
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <div className="w-12 h-12 rounded-full bg-sos mx-auto flex items-center justify-center">
          <Phone className="w-6 h-6 text-sos-foreground" />
        </div>
        <h2 className="text-xl font-bold">Book Ambulance</h2>
        <p className="text-sm text-muted-foreground">
          {isGuardianMode ? `Emergency ambulance for ${wardName}` : "Emergency or scheduled ambulance service"}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex rounded-lg border border-border overflow-hidden">
        <button
          onClick={() => setMode("emergency")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
            mode === "emergency" ? "bg-background text-foreground shadow-sm" : "bg-muted text-muted-foreground"
          }`}
        >
          <AlertTriangle className="w-4 h-4" /> Emergency
        </button>
        <button
          onClick={() => setMode("book")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
            mode === "book" ? "bg-background text-foreground shadow-sm" : "bg-muted text-muted-foreground"
          }`}
        >
          <CreditCard className="w-4 h-4" /> Book & Pay
        </button>
      </div>

      {mode === "emergency" && (
        <Card className="border-sos/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-sos flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Emergency Request
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Profile and health vitals are attached automatically
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Pickup location */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <MapPin className="w-4 h-4" /> Pickup Location
              </h3>

              {locating ? (
                <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50 border border-border text-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" /> Locating you…
                </div>
              ) : !editingLocation ? (
                <div className="flex items-start gap-2">
                  <div className="flex-1 p-2.5 rounded-md border border-border bg-muted/50 text-sm">
                    {location ? (
                      <>
                        <div className="font-medium">📍 {pickupAddress || "Detected"}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                        </div>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Location not available</span>
                    )}
                  </div>
                  <Button variant="outline" size="icon" onClick={() => setEditingLocation(true)} aria-label="Edit location">
                    <Pencil className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Latitude</Label>
                      <Input value={manualLat} onChange={e => setManualLat(e.target.value)} placeholder="19.0760" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Longitude</Label>
                      <Input value={manualLng} onChange={e => setManualLng(e.target.value)} placeholder="72.8777" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={detectLocation}>
                      <Navigation className="w-4 h-4 mr-1" /> Re-detect
                    </Button>
                    <Button size="sm" className="flex-1" onClick={applyManualLocation}>
                      <Check className="w-4 h-4 mr-1" /> Apply
                    </Button>
                  </div>
                </div>
              )}

              {locationError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {locationError}
                </p>
              )}
            </div>

            {/* Destination hospital */}
            <div className="space-y-2 relative">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Hospital className="w-4 h-4" /> Destination Hospital <span className="text-destructive">*</span>
              </h3>
              {destination ? (
                <div className="flex items-start gap-2">
                  <div className="flex-1 p-2.5 rounded-md border border-primary/40 bg-primary/5 text-sm">
                    <div className="font-medium">🏥 {destination.name}</div>
                    {destination.address && destination.address !== destination.name && (
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{destination.address}</div>
                    )}
                  </div>
                  <Button variant="outline" size="icon" onClick={clearDestination} aria-label="Clear destination">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    ref={destInputRef}
                    placeholder="Search hospital, clinic, or address"
                    value={destQuery}
                    onChange={(e) => handleDestChange(e.target.value)}
                    onFocus={() => destQuery.length >= 2 && setShowDestResults(true)}
                    className="text-base"
                  />
                  {showDestResults && (destSearching || destResults.length > 0) && (
                    <div className="absolute z-10 left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-64 overflow-y-auto">
                      {destSearching && (
                        <div className="p-3 text-xs text-muted-foreground flex items-center gap-2">
                          <Loader2 className="w-3 h-3 animate-spin" /> Searching…
                        </div>
                      )}
                      {destResults.map((r) => (
                        <button
                          key={r.place_id}
                          type="button"
                          onClick={() => handleSelectDestination(r)}
                          className="w-full text-left px-3 py-2 hover:bg-accent text-sm border-b border-border last:border-b-0"
                        >
                          <div className="font-medium">{r.main_text}</div>
                          {r.secondary_text && (
                            <div className="text-xs text-muted-foreground line-clamp-1">{r.secondary_text}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Patient + emergency type */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <UserIcon className="w-3 h-3" /> Patient Name
                </Label>
                <Input
                  placeholder="Enter patient name"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Emergency Type (optional)</Label>
                <Input
                  placeholder="e.g., Chest pain, Accident"
                  value={emergencyType}
                  onChange={(e) => setEmergencyType(e.target.value)}
                />
              </div>
            </div>

            {/* Contacts */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Contacts shared with ambulance</h3>
              <div className="space-y-1.5">
                {contacts.map((c, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-md border border-border bg-muted/30 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.phone}</div>
                    </div>
                    {c.label && <Badge variant="secondary" className="text-xs">{c.label}</Badge>}
                  </div>
                ))}
                {contacts.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">No contacts loaded</p>
                )}
              </div>
              {primaryGuardianMissing && !isGuardianMode && (
                <p className="text-xs text-warning flex items-start gap-1">
                  <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>
                    No Primary Guardian set — only your number will be shared.{" "}
                    <a href="/profile" className="underline font-medium">Set one</a>
                  </span>
                </p>
              )}
            </div>

            {/* Result banner */}
            {resultMessage && (
              <div className={`p-3 rounded-md text-sm border ${
                resultMessage.kind === "success" ? "bg-success/10 border-success/30 text-success" :
                resultMessage.kind === "warn" ? "bg-warning/10 border-warning/30 text-warning-foreground" :
                "bg-destructive/10 border-destructive/30 text-destructive"
              }`}>
                {resultMessage.text}
              </div>
            )}

            {/* Send button */}
            <Button
              onClick={() => submitRequest(false)}
              disabled={sending || !canSend}
              className="w-full bg-sos hover:bg-sos/90 text-sos-foreground font-semibold py-5"
              size="lg"
            >
              {sending ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Sending…</>
              ) : (
                <><Ambulance className="w-5 h-5 mr-2" /> Send Ambulance Request</>
              )}
            </Button>

            {/* WhatsApp manual fallback */}
            <Button
              onClick={() => submitRequest(true)}
              disabled={sending || !canSend}
              variant="outline"
              className="w-full"
            >
              <MessageCircle className="w-4 h-4 mr-2" /> Send via WhatsApp instead
            </Button>

            <div className="text-center space-y-2">
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <AlertTriangle className="w-3 h-3" /> If no response, call the helpline
              </p>
              <Button onClick={callHelpline} variant="destructive" className="w-full font-semibold py-5" size="lg">
                <Phone className="w-5 h-5 mr-2" /> Call Helpline: +91 7045868482
              </Button>
            </div>

            <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-1">
              <p className="text-xs font-semibold flex items-center gap-1">
                <Info className="w-3 h-3" /> Pay-on-arrival pricing
              </p>
              <p className="text-xs text-muted-foreground">
                ₹1,500 for first 5 km · ₹300/km after · Oxygen/equipment as applicable. No payment required to dispatch.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {mode === "book" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" /> Book & Pay
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Pre-book a scheduled ambulance with locked pricing
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="text-sm font-semibold">Pricing</h3>
              <div className="flex justify-between text-sm">
                <span>First 5 km</span><span className="font-bold">₹1,500</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>After 5 km</span><span className="font-bold">₹300/km</span>
              </div>
              <div className="flex justify-between text-sm border-t border-border pt-2 mt-2">
                <span>Oxygen / Equipment</span><span className="font-bold">As applicable</span>
              </div>
            </div>

            <Badge variant="outline" className="w-full justify-center py-2 text-xs">
              <Info className="w-3 h-3 mr-1" /> Pre-paid scheduled bookings — coming soon
            </Badge>

            <Button className="w-full" size="lg" disabled>
              Book & Pay via Razorpay
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              For emergencies, use the Emergency tab — no payment required to dispatch.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AmbulanceBooking;
