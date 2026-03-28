import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface JourneyData {
  id: string;
  destination_name: string;
  destination_lat: number;
  destination_lng: number;
  origin_name: string | null;
  origin_lat: number | null;
  origin_lng: number | null;
  transport_mode: string;
  estimated_duration_min: number | null;
  status: string;
  started_at: string;
  ended_at: string | null;
}

interface JourneyUpdate {
  id: string;
  lat: number | null;
  lng: number | null;
  check_in_response: string | null;
  created_at: string;
}

// Haversine distance in meters
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Distance from a point to the nearest point on a polyline (in meters)
function distanceToRoute(lat: number, lng: number, route: [number, number][]): number {
  if (route.length === 0) return Infinity;
  let minDist = Infinity;
  for (let i = 0; i < route.length; i++) {
    const d = haversine(lat, lng, route[i][0], route[i][1]);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

const GEOFENCE_THRESHOLD_M = 500;

export function useJourneyTracker() {
  const { session } = useAuth();
  const [activeJourney, setActiveJourney] = useState<JourneyData | null>(null);
  const [updates, setUpdates] = useState<JourneyUpdate[]>([]);
  const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number } | null>(null);
  const [distanceRemaining, setDistanceRemaining] = useState<number | null>(null);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [arrivingSoon, setArrivingSoon] = useState(false);
  const [routeDeviation, setRouteDeviation] = useState(false);
  const [expectedRoute, setExpectedRoute] = useState<[number, number][]>([]);

  const watchId = useRef<number | null>(null);
  const lastSaveTime = useRef(0);
  const checkInTimer = useRef<ReturnType<typeof setInterval>>();
  const autoEndTimer = useRef<ReturnType<typeof setTimeout>>();
  const arrivedAt = useRef<number | null>(null);
  const deviationNotifiedAt = useRef<number>(0);

  // Fetch active journey on mount
  useEffect(() => {
    if (!session?.user?.id) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("journeys")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setActiveJourney(data as JourneyData);
        // Fetch existing updates
        const { data: upd } = await supabase
          .from("journey_updates")
          .select("*")
          .eq("journey_id", data.id)
          .order("created_at", { ascending: true });
        if (upd) setUpdates(upd as JourneyUpdate[]);
      }
    };
    fetch();
  }, [session?.user?.id]);

  // GPS tracking when journey is active
  useEffect(() => {
    if (!activeJourney || activeJourney.status !== "active") return;
    if (!navigator.geolocation) return;

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setCurrentPos({ lat, lng });

        // Distance to destination
        const dist = haversine(lat, lng, activeJourney.destination_lat, activeJourney.destination_lng);
        setDistanceRemaining(dist);

        // Arriving soon < 500m
        if (dist < 500 && !arrivingSoon) {
          setArrivingSoon(true);
          notifyGuardians("🏁 Arriving Soon", `User is approaching ${activeJourney.destination_name}`);
        }

        // Auto-end: within 200m for 10 minutes
        if (dist < 200) {
          if (!arrivedAt.current) arrivedAt.current = Date.now();
          if (!autoEndTimer.current) {
            autoEndTimer.current = setTimeout(() => {
              endJourney("auto_completed");
            }, 10 * 60 * 1000);
          }
        } else {
          arrivedAt.current = null;
          if (autoEndTimer.current) {
            clearTimeout(autoEndTimer.current);
            autoEndTimer.current = undefined;
          }
        }

        // Geofence: detect deviation >500m from expected route
        if (expectedRoute.length > 0 && dist > 200) {
          const routeDist = distanceToRoute(lat, lng, expectedRoute);
          const now2 = Date.now();
          if (routeDist > GEOFENCE_THRESHOLD_M) {
            if (!routeDeviation) setRouteDeviation(true);
            // Notify guardians max once every 5 minutes
            if (now2 - deviationNotifiedAt.current > 5 * 60 * 1000) {
              deviationNotifiedAt.current = now2;
              notifyGuardians(
                "⚠️ Route Deviation",
                `User has deviated ${Math.round(routeDist)}m from the expected route to ${activeJourney.destination_name}.`,
                "route_deviation"
              );
            }
          } else {
            if (routeDeviation) {
              setRouteDeviation(false);
              notifyGuardians("✅ Back on Route", `User is back on the expected route to ${activeJourney.destination_name}.`, "route_deviation");
            }
          }
        }

        // Save location every 15s for near-real-time guardian tracking
        const now = Date.now();
        if (now - lastSaveTime.current >= 15000) {
          lastSaveTime.current = now;
          saveLocationUpdate(lat, lng);
        }
      },
      (err) => console.error("Geolocation error:", err),
      { enableHighAccuracy: true, maximumAge: 10000 }
    );

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
  }, [activeJourney?.id, activeJourney?.status]);

  // Check-in timer
  useEffect(() => {
    if (!activeJourney || activeJourney.status !== "active") return;

    const intervalMs = (activeJourney.estimated_duration_min ?? 60) <= 60
      ? 15 * 60 * 1000
      : 30 * 60 * 1000;

    checkInTimer.current = setInterval(() => {
      setShowCheckIn(true);
    }, intervalMs);

    return () => {
      if (checkInTimer.current) clearInterval(checkInTimer.current);
    };
  }, [activeJourney?.id, activeJourney?.status, activeJourney?.estimated_duration_min]);

  const saveLocationUpdate = async (lat: number, lng: number, response?: string) => {
    if (!activeJourney || !session?.user?.id) return;
    const { data } = await supabase.from("journey_updates").insert({
      journey_id: activeJourney.id,
      user_id: session.user.id,
      lat,
      lng,
      check_in_response: response || null,
    }).select().single();
    if (data) setUpdates((prev) => [...prev, data as JourneyUpdate]);
  };

  const notifyGuardians = useCallback(async (title: string, message: string, type: string = "journey") => {
    if (!session?.user?.id) return;
    const { data: guardians } = await supabase
      .from("guardians")
      .select("id")
      .eq("user_id", session.user.id);
    if (!guardians?.length) return;
    await supabase.from("notifications").insert(
      guardians.map((g) => ({
        user_id: session.user.id,
        guardian_id: g.id,
        title,
        message,
        type,
      }))
    );
  }, [session?.user?.id]);

  const startJourney = async (params: {
    destination_name: string;
    destination_lat: number;
    destination_lng: number;
    origin_name: string;
    origin_lat: number;
    origin_lng: number;
    transport_mode: string;
    estimated_duration_min: number;
  }) => {
    if (!session?.user?.id) return null;
    const { data, error } = await supabase.from("journeys").insert({
      user_id: session.user.id,
      ...params,
    }).select().single();
    if (error || !data) return null;
    const journey = data as JourneyData;
    setActiveJourney(journey);
    setUpdates([]);
    setArrivingSoon(false);
    setRouteDeviation(false);
    deviationNotifiedAt.current = 0;
    arrivedAt.current = null;
    lastSaveTime.current = 0;

    await notifyGuardians(
      "🗺️ Journey Started",
      `User started a journey to ${params.destination_name} by ${params.transport_mode}. ETA: ${params.estimated_duration_min} min.`
    );

    // Save initial location
    saveLocationUpdate(params.origin_lat, params.origin_lng);

    return journey;
  };

  const endJourney = async (status: "completed" | "auto_completed" = "completed") => {
    if (!activeJourney) return;
    await supabase
      .from("journeys")
      .update({ status, ended_at: new Date().toISOString() })
      .eq("id", activeJourney.id);

    await notifyGuardians(
      status === "auto_completed" ? "✅ Journey Auto-Completed" : "✅ Journey Completed",
      `User has ${status === "auto_completed" ? "arrived at" : "ended journey at"} ${activeJourney.destination_name}.`
    );

    setActiveJourney(null);
    setUpdates([]);
    setCurrentPos(null);
    setDistanceRemaining(null);
    setArrivingSoon(false);
    setRouteDeviation(false);
    setExpectedRoute([]);
    deviationNotifiedAt.current = 0;
    arrivedAt.current = null;
    if (autoEndTimer.current) clearTimeout(autoEndTimer.current);
    if (checkInTimer.current) clearInterval(checkInTimer.current);
  };

  const respondCheckIn = async (response: string) => {
    setShowCheckIn(false);
    if (currentPos) {
      await saveLocationUpdate(currentPos.lat, currentPos.lng, response);
      await notifyGuardians("💬 Journey Check-in", `User responded: "${response}"`);
    }
  };

  return {
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
  };
}
