import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useUserSettings } from "@/hooks/useUserSettings";
import { haversineDistance } from "@/lib/haversine";

const ZONE_ALERT_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Periodically saves the user's geolocation to user_settings
 * so guardians can view the ward's location on their dashboard.
 * Also checks safe zones and alerts guardians on zone exit.
 * Runs every 5 minutes and on initial mount.
 */
export default function useLocationSync() {
  const { session } = useAuth();
  const { settings } = useUserSettings();
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const lastZoneAlertRef = useRef<string | null>(null); // ISO timestamp

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    // If sharing is OFF, wipe any previously stored lastLocation so the
    // Guardian app can't keep displaying a stale dot, then stop.
    if (!settings.shareLocation) {
      (async () => {
        const { data } = await supabase
          .from("user_settings" as any)
          .select("settings")
          .eq("user_id", userId)
          .maybeSingle();
        const current = (data as any)?.settings || {};
        if (current?.lastLocation || current?.lastLocationAt) {
          const { lastLocation, lastLocationAt, ...rest } = current;
          await supabase
            .from("user_settings" as any)
            .upsert(
              {
                user_id: userId,
                settings: rest,
                updated_at: new Date().toISOString(),
              } as any,
              { onConflict: "user_id" }
            );
        }
      })();
      return;
    }

    const checkSafeZones = async (latitude: number, longitude: number) => {
      try {
        // Fetch enabled safe zones
        const { data: zones } = await supabase
          .from("safe_zones" as any)
          .select("*")
          .eq("user_id", userId)
          .eq("enabled", true);

        if (!zones || zones.length === 0) return;

        // Check if user is outside ALL enabled zones
        const isInsideAny = (zones as any[]).some((zone) =>
          haversineDistance(latitude, longitude, zone.lat, zone.lng) <= zone.radius_m
        );

        if (isInsideAny) {
          // Reset cooldown when back inside
          lastZoneAlertRef.current = null;
          return;
        }

        // Check cooldown
        if (lastZoneAlertRef.current) {
          const elapsed = Date.now() - new Date(lastZoneAlertRef.current).getTime();
          if (elapsed < ZONE_ALERT_COOLDOWN_MS) return;
        }

        // Check if there's an active journey (don't alert during journeys)
        const { data: activeJourney } = await supabase
          .from("journeys")
          .select("id")
          .eq("user_id", userId)
          .eq("status", "active")
          .maybeSingle();

        if (activeJourney) return;

        // Find the nearest zone name for the alert message
        const nearest = (zones as any[]).reduce((prev, curr) => {
          const prevDist = haversineDistance(latitude, longitude, prev.lat, prev.lng);
          const currDist = haversineDistance(latitude, longitude, curr.lat, curr.lng);
          return currDist < prevDist ? curr : prev;
        });

        // Get user profile name
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", userId)
          .maybeSingle();

        const userName = profile?.full_name || "Your ward";

        // Get all accepted guardians
        const { data: guardians } = await supabase
          .from("guardians")
          .select("guardian_user_id")
          .eq("user_id", userId)
          .eq("status", "accepted")
          .not("guardian_user_id", "is", null);

        if (!guardians || guardians.length === 0) return;

        // Filter by user's locationSharingGuardianIds if set
        const selectedIds = settings.locationSharingGuardianIds;
        const filteredGuardians = selectedIds && selectedIds.length > 0
          ? guardians.filter((g) => {
              // Match by guardian row id (from guardians table)
              return selectedIds.includes(g.guardian_user_id!);
            })
          : guardians;

        if (filteredGuardians.length === 0) return;

        // Insert notifications for selected guardians
        const notifications = filteredGuardians.map((g) => ({
          user_id: g.guardian_user_id!,
          title: "⚠️ Outside Safe Zone",
          message: `${userName} has left the "${nearest.name}" safe zone area.`,
          type: "zone_exit",
          read: false,
        }));

        await supabase.rpc("insert_notifications_deduped", {
          p_notifications: notifications,
        });
        lastZoneAlertRef.current = new Date().toISOString();
      } catch {
        // Silently ignore errors in background check
      }
    };

    const saveLocation = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          supabase
            .from("user_settings" as any)
            .upsert(
              {
                user_id: userId,
                settings: {
                  ...settings,
                  lastLocation: { lat: latitude, lng: longitude },
                  lastLocationAt: new Date().toISOString(),
                },
                updated_at: new Date().toISOString(),
              } as any,
              { onConflict: "user_id" }
            )
            .then(() => {
              // After saving location, check safe zones
              checkSafeZones(latitude, longitude);
            });
        },
        () => {}, // silently ignore permission denied
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      );
    };

    // Save immediately then every 5 minutes
    saveLocation();
    intervalRef.current = setInterval(saveLocation, 5 * 60 * 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [session?.user?.id, settings.shareLocation]);
}
