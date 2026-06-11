import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Droplet, Loader2, MapPin, Phone, RefreshCw, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGuardianWard } from "@/contexts/GuardianWardContext";
import BloodGroupGrid from "@/components/blood-banks/BloodGroupGrid";
import BloodBankCard from "@/components/blood-banks/BloodBankCard";
import {
  BLOOD_COMPONENTS,
  type BloodBank,
  type BloodComponent,
  type BloodGroup,
  cleanField,
  nearestBanks,
} from "@/lib/bloodBanks";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";

const PAGE_SIZE = 5;

const BloodBanks = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { selectedWard } = useGuardianWard();
  const isGuardian = profile?.role === "guardian";

  const [bloodGroup, setBloodGroup] = useState<BloodGroup | null>(null);
  const [component, setComponent] = useState<BloodComponent>("Whole Blood");
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [originLabel, setOriginLabel] = useState<string>("");
  const [locating, setLocating] = useState(false);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [banks, setBanks] = useState<BloodBank[]>([]);
  const [showMore, setShowMore] = useState(false);

  // Default blood group from ward (guardian) or self (user)
  useEffect(() => {
    const lookupId = isGuardian ? selectedWard?.userId : user?.id;
    if (!lookupId) return;
    supabase
      .from("profiles")
      .select("blood_group")
      .eq("id", lookupId)
      .maybeSingle()
      .then(({ data }) => {
        const bg = (data as any)?.blood_group as BloodGroup | null;
        if (bg) setBloodGroup(bg);
      });
  }, [isGuardian, selectedWard?.userId, user?.id]);

  // Request browser location once
  useEffect(() => {
    if (origin || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setOriginLabel("Using your current location");
        setLocating(false);
      },
      () => {
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  }, [origin]);

  // Fetch nearby banks whenever origin changes
  useEffect(() => {
    if (!origin) return;
    let cancelled = false;
    setLoadingBanks(true);
    // Bounding box ~1.5° latitude (~165 km) and adjusted longitude — fast first cut,
    // then exact Haversine sort client-side.
    const dLat = 1.5;
    const dLng = 1.5 / Math.max(Math.cos((origin.lat * Math.PI) / 180), 0.1);
    supabase
      .from("blood_banks" as any)
      .select("id,name,address,district,state,category,phone,email,lat,lng,geocode_status")
      .gte("lat", origin.lat - dLat)
      .lte("lat", origin.lat + dLat)
      .gte("lng", origin.lng - dLng)
      .lte("lng", origin.lng + dLng)
      .not("lat", "is", null)
      .limit(500)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          toast.error("Could not load blood banks");
          setBanks([]);
        } else {
          const cleaned: BloodBank[] = ((data as any[]) || []).map((b) => ({
            ...b,
            phone: cleanField(b.phone),
            email: cleanField(b.email),
          }));
          setBanks(cleaned);
        }
        setLoadingBanks(false);
      });
    return () => {
      cancelled = true;
    };
  }, [origin]);

  const sorted = useMemo(
    () => (origin ? nearestBanks(banks, origin, showMore ? 15 : PAGE_SIZE) : []),
    [banks, origin, showMore],
  );

  const retryLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Location not available on this device");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setOriginLabel("Using your current location");
        setLocating(false);
      },
      () => {
        toast.error("Could not get location. Please enable it in your browser settings.");
        setLocating(false);
      },
    );
  };

  return (
    <AppLayout>
      <div className="p-4 space-y-4 pb-24">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Droplet className="w-5 h-5 text-red-600 fill-red-600" />
            Need Blood?
          </h1>
        </div>

        {/* Emergency call banner */}
        <Card className="border-red-600/30 bg-red-600/5">
          <CardContent className="p-3 flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-red-600 shrink-0" />
            <div className="flex-1 text-xs">
              <p className="font-semibold text-red-600">Life-threatening emergency?</p>
              <p className="text-muted-foreground">Call 112 first — we'll help you find blood next.</p>
            </div>
            <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => window.open("tel:112")}>
              <Phone className="w-4 h-4 mr-1" /> 112
            </Button>
          </CardContent>
        </Card>

        {/* Step 1: blood group */}
        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            1. Blood group
            {bloodGroup && (
              <span className="ml-2 text-[10px] normal-case font-normal text-muted-foreground">
                {isGuardian ? "(from ward's profile)" : "(from your profile)"} — tap to change
              </span>
            )}
          </p>
          <BloodGroupGrid value={bloodGroup} onChange={setBloodGroup} />
        </section>

        {/* Step 2: component */}
        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            2. Component
          </p>
          <div className="flex gap-2">
            {BLOOD_COMPONENTS.map((c) => {
              const active = c === component;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setComponent(c)}
                  className={cn(
                    "flex-1 h-10 rounded-full text-sm font-medium border transition-colors",
                    active
                      ? "bg-red-600 text-white border-red-600"
                      : "bg-background text-foreground border-input hover:bg-accent",
                  )}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </section>

        {/* Step 3: list */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              3. Nearest blood banks
            </p>
            <Button variant="ghost" size="sm" onClick={retryLocation} disabled={locating}>
              <RefreshCw className={cn("w-3.5 h-3.5 mr-1", locating && "animate-spin")} />
              {locating ? "Locating…" : "Refresh"}
            </Button>
          </div>

          {originLabel && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {originLabel}
            </p>
          )}

          {!origin && !locating && (
            <Card>
              <CardContent className="p-4 text-center text-sm space-y-2">
                <p className="text-muted-foreground">
                  We need your location to find the nearest blood banks.
                </p>
                <Button size="sm" onClick={retryLocation}>
                  <MapPin className="w-4 h-4 mr-1" /> Use my location
                </Button>
              </CardContent>
            </Card>
          )}

          {(locating || loadingBanks) && (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Finding nearby blood banks…
            </div>
          )}

          {origin && !loadingBanks && sorted.length === 0 && (
            <Card>
              <CardContent className="p-4 text-center text-sm text-muted-foreground space-y-2">
                <p>No blood banks have been geo-located near you yet.</p>
                <p className="text-xs">
                  Our directory of 6,000+ centres is being geocoded in the background. Try again
                  shortly, or call 1910 (national blood helpline).
                </p>
                <Button size="sm" variant="outline" onClick={() => window.open("tel:1910")}>
                  <Phone className="w-4 h-4 mr-1" /> Call 1910
                </Button>
              </CardContent>
            </Card>
          )}

          {sorted.length > 0 && (
            <div className="space-y-2">
              {sorted.map((b) => (
                <BloodBankCard key={b.id} bank={b} />
              ))}
              {!showMore && banks.length > PAGE_SIZE && (
                <Button variant="outline" className="w-full" onClick={() => setShowMore(true)}>
                  Show more
                </Button>
              )}
            </div>
          )}

          <p className="text-[11px] text-center text-muted-foreground pt-2">
            Stock availability is not real-time. Always call ahead to confirm{" "}
            {bloodGroup ? `${bloodGroup} ${component.toLowerCase()}` : "availability"}.
          </p>
        </section>
      </div>
    </AppLayout>
  );
};

export default BloodBanks;
