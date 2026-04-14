import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Ambulance, AlertTriangle, CreditCard, Navigation, Phone,
  MessageCircle, MapPin, User, Info, Pencil, Check
} from "lucide-react";
import PhoneInput from "@/components/PhoneInput";
import { supabase } from "@/integrations/supabase/client";

type TabMode = "emergency" | "book";

interface AmbulanceBookingProps {
  wardUserId?: string;
  wardName?: string;
  wardLocation?: { lat: number; lng: number } | null;
  wardPhone?: string;
}

const AmbulanceBooking = ({ wardUserId, wardName, wardLocation, wardPhone }: AmbulanceBookingProps) => {
  const isGuardianMode = !!wardUserId;
  const [mode, setMode] = useState<TabMode>("emergency");
  const [showForm, setShowForm] = useState(false);
  const [progress, setProgress] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [locationDetected, setLocationDetected] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [editingLocation, setEditingLocation] = useState(false);
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [sending, setSending] = useState(false);

  const [patientName, setPatientName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [emergencyType, setEmergencyType] = useState("");

  // Pre-fill guardian mode data
  useEffect(() => {
    if (isGuardianMode) {
      if (wardName) setPatientName(wardName);
      if (wardPhone) setContactNumber(wardPhone);
      if (wardLocation) {
        setLocation(wardLocation);
        setLocationDetected(true);
        setManualLat(wardLocation.lat.toString());
        setManualLng(wardLocation.lng.toString());
      }
    }
  }, [isGuardianMode, wardName, wardPhone, wardLocation]);

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

  const detectLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationDetected(true);
      },
      () => setLocationDetected(false)
    );
  };

  const applyManualLocation = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (!isNaN(lat) && !isNaN(lng)) {
      setLocation({ lat, lng });
      setLocationDetected(true);
      setEditingLocation(false);
    }
  };

  const fetchWardHealthCard = async (): Promise<string> => {
    if (!wardUserId) return "";
    try {
      const [profileRes, healthRes, medsRes, guardiansRes, tokenRes] = await Promise.all([
        supabase.from("profiles").select("full_name, date_of_birth, gender, phone").eq("id", wardUserId).maybeSingle(),
        supabase.from("health_profile").select("blood_group, allergies, chronic_conditions, current_medications, family_doctor_name, family_doctor_phone, emergency_notes").eq("user_id", wardUserId).maybeSingle(),
        supabase.from("medications").select("name, dosage").eq("user_id", wardUserId),
        supabase.from("guardians").select("guardian_name, guardian_phone, relation, is_primary").eq("user_id", wardUserId).eq("status", "accepted"),
        supabase.from("emergency_share_tokens").select("token").eq("user_id", wardUserId).eq("is_active", true).maybeSingle(),
      ]);

      const health = healthRes.data;
      const meds = medsRes.data;
      const guardians = guardiansRes.data;
      const token = tokenRes.data?.token;

      const lines: string[] = ["\n═══ EMERGENCY HEALTH CARD ═══"];

      if (health?.blood_group) lines.push(`Blood Group: ${health.blood_group}`);
      if (health?.allergies?.length) lines.push(`Allergies: ${health.allergies.join(", ")}`);
      if (health?.chronic_conditions?.length) lines.push(`Conditions: ${health.chronic_conditions.join(", ")}`);
      if (meds?.length) lines.push(`Medications: ${meds.map(m => `${m.name} ${m.dosage}`).join(", ")}`);
      else if (health?.current_medications?.length) lines.push(`Medications: ${health.current_medications.join(", ")}`);
      if (health?.family_doctor_name) {
        lines.push(`Family Doctor: ${health.family_doctor_name}${health.family_doctor_phone ? ` (${health.family_doctor_phone})` : ""}`);
      }
      if (health?.emergency_notes) lines.push(`Notes: ${health.emergency_notes}`);
      if (guardians?.length) {
        lines.push("Emergency Contacts:");
        guardians.forEach(g => {
          lines.push(`  - ${g.guardian_name}${g.relation ? ` (${g.relation})` : ""} ${g.guardian_phone}${g.is_primary ? " [Primary]" : ""}`);
        });
      }
      if (token) {
        lines.push(`Emergency Profile: https://iamgood.lovable.app/e/${token}`);
      }

      return lines.length > 1 ? lines.join("\n") : "";
    } catch (err) {
      console.error("Failed to fetch ward health card:", err);
      return "";
    }
  };

  const sendWhatsApp = async () => {
    setSending(true);
    try {
      const locStr = location ? `https://maps.google.com/?q=${location.lat},${location.lng}` : "Location not available";
      let healthCard = "";
      if (isGuardianMode) {
        healthCard = await fetchWardHealthCard();
      }
      const msg = encodeURIComponent(
        `🚑 AMBULANCE REQUEST\n\nPatient: ${patientName || "N/A"}\nContact: ${contactNumber || "N/A"}\nEmergency: ${emergencyType || "Not specified"}\nLocation: ${locStr}${healthCard}`
      );
      window.open(`https://wa.me/917045868482?text=${msg}`, "_blank");
    } finally {
      setSending(false);
    }
  };

  const callHelpline = () => {
    window.open("tel:+917045868482", "_self");
  };

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

      <div className="flex rounded-lg border border-border overflow-hidden">
        <button
          onClick={() => setMode("emergency")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
            mode === "emergency"
              ? "bg-background text-foreground shadow-sm"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <AlertTriangle className="w-4 h-4" /> Emergency
        </button>
        <button
          onClick={() => setMode("book")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
            mode === "book"
              ? "bg-background text-foreground shadow-sm"
              : "bg-muted text-muted-foreground"
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
              Request an ambulance by sharing your location via WhatsApp
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Location section */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <MapPin className="w-4 h-4" /> {isGuardianMode ? `${wardName}'s Location` : "Your Location"}
              </h3>

              {isGuardianMode ? (
                <div className="space-y-2">
                  {!editingLocation ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 p-2.5 rounded-md border border-border bg-muted/50 text-sm">
                        {location
                          ? `📍 ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
                          : "Location not available"}
                      </div>
                      <Button variant="outline" size="icon" onClick={() => setEditingLocation(true)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs">Latitude</Label>
                          <Input value={manualLat} onChange={e => setManualLat(e.target.value)} placeholder="19.0760" className="text-base" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs">Longitude</Label>
                          <Input value={manualLng} onChange={e => setManualLng(e.target.value)} placeholder="72.8777" className="text-base" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditingLocation(false)}>Cancel</Button>
                        <Button size="sm" className="flex-1" onClick={applyManualLocation}>
                          <Check className="w-4 h-4 mr-1" /> Apply
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <Button onClick={detectLocation} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                    <Navigation className="w-4 h-4 mr-2" /> Detect My Location
                  </Button>
                  {locationDetected && location && (
                    <p className="text-xs text-success flex items-center gap-1">
                      ✅ Location detected: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Patient Details</h3>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Patient Name</Label>
                <Input
                  placeholder="Enter patient name"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="text-base"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Contact Number</Label>
                <PhoneInput value={contactNumber} onChange={setContactNumber} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Emergency Type (Optional)</Label>
                <Input
                  placeholder="e.g., Chest pain, Accident"
                  value={emergencyType}
                  onChange={(e) => setEmergencyType(e.target.value)}
                  className="text-base"
                />
              </div>
            </div>

            <Button
              onClick={sendWhatsApp}
              disabled={sending}
              className="w-full bg-success hover:bg-success/90 text-success-foreground font-semibold py-5"
              size="lg"
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              {sending ? "Preparing..." : "Send Request via WhatsApp"}
            </Button>

            {isGuardianMode && (
              <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                <Info className="w-3 h-3" /> Emergency Health Card will be attached automatically
              </p>
            )}

            <div className="text-center space-y-2">
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <AlertTriangle className="w-3 h-3" /> If no response on WhatsApp, call the helpline
              </p>
              <Button
                onClick={callHelpline}
                variant="destructive"
                className="w-full font-semibold py-5"
                size="lg"
              >
                <Phone className="w-5 h-5 mr-2" /> Call Helpline: +91 7045868482
              </Button>
            </div>

            <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-1">
              <p className="text-xs font-semibold">How it works:</p>
              <ol className="text-xs text-muted-foreground space-y-0.5 list-decimal list-inside">
                {isGuardianMode ? (
                  <>
                    <li>Verify {wardName}'s location (edit if needed)</li>
                    <li>Confirm patient details</li>
                    <li>Send request via WhatsApp with health card attached</li>
                    <li>If no response, call the 24/7 helpline</li>
                  </>
                ) : (
                  <>
                    <li>Detect your current location</li>
                    <li>Fill in patient details</li>
                    <li>Send request via WhatsApp to ambulance service</li>
                    <li>If no response, call the 24/7 helpline</li>
                  </>
                )}
              </ol>
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
              Pre-book an ambulance with transparent pricing
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="text-sm font-semibold">Pricing</h3>
              <div className="flex justify-between text-sm">
                <span>First 5 km</span>
                <span className="font-bold">₹1,500</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>After 5 km</span>
                <span className="font-bold">₹300/km</span>
              </div>
              <div className="flex justify-between text-sm border-t border-border pt-2 mt-2">
                <span>Oxygen / Equipment</span>
                <span className="font-bold">As applicable</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Pickup Location</Label>
                <div className="flex gap-2">
                  <Input placeholder="Enter pickup address" className="flex-1 text-base" />
                  {!isGuardianMode && (
                    <Button variant="outline" size="icon" onClick={detectLocation}>
                      <Navigation className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Drop Location (Hospital)</Label>
                <Input placeholder="Enter hospital / destination" className="text-base" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Contact Number</Label>
                <PhoneInput value={isGuardianMode ? contactNumber : ""} onChange={isGuardianMode ? setContactNumber : () => {}} />
              </div>
            </div>

            <Badge variant="outline" className="w-full justify-center py-2 text-xs">
              <Info className="w-3 h-3 mr-1" /> Pro subscription required for pre-booking
            </Badge>

            <Button
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-5"
              size="lg"
              disabled
            >
              Book & Pay via Razorpay
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Payment integration coming soon
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AmbulanceBooking;
