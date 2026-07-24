import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useApp } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { useUserSettings } from "@/hooks/useUserSettings";
import { haversineDistance } from "@/lib/haversine";
import { useQueryClient } from "@tanstack/react-query";

const NORMAL_INTERVAL_MS = 5 * 60 * 1000; // 5 min
const SOS_INTERVAL_MS = 30 * 1000; // 30 sec
const SOS_FAST_CAP_MS = 15 * 60 * 1000; // 15 min hard cap on accelerated cadence

/**
 * Periodically saves the user's geolocation to user_settings
 * so guardians can view the ward's location on their dashboard.
 * Also checks safe zones and alerts guardians on zone exit.
 *
 * Cadence:
 * - Normal: every 5 minutes.
 * - During active SOS (emergencyMode === true): every 30 seconds, capped at 15 min,
 *   then reverts to 5 min to protect battery (resets when SOS clears and re-fires).
 */
export default function useLocationSync() {
  const { session } = useAuth();
  const { settings } = useUserSettings();
  const { emergencyMode } = useApp();
  const queryClient = useQueryClient();
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const sosStartedAtRef = useRef<number | null>(null);
  const wasInsideRef = useRef<boolean>(localStorage.getItem('isInsideSafeZone') !== 'false');
  const farAlertSentRef = useRef<boolean>(localStorage.getItem('farFromSafeZoneAlerted') === 'true');

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    // Reset safety zone state for the current active user sync session using persistent localStorage state
    wasInsideRef.current = localStorage.getItem('isInsideSafeZone') !== 'false';
    farAlertSentRef.current = localStorage.getItem('farFromSafeZoneAlerted') === 'true';

    // If sharing is OFF, wipe any previously stored lastLocation so the
    // Guardian app can't keep displaying a stale dot, then stop.
    // However, during active SOS, we bypass this to ensure coordinates are saved.
    if (!settings.shareLocation && !emergencyMode) {
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
          queryClient.setQueryData(["user_settings", userId], rest);
        }
      })();
      return;
    }

    const checkSafeZones = async (latitude: number, longitude: number) => {
      try {
        const { data: zones } = await supabase
          .from("safe_zones" as any)
          .select("*")
          .eq("user_id", userId)
          .eq("enabled", true);

        if (!zones || zones.length === 0) return;

        const isInsideAny = (zones as any[]).some((zone) =>
          haversineDistance(latitude, longitude, zone.lat, zone.lng) <= zone.radius_m
        );

        if (isInsideAny) {
          const wasOutside = wasInsideRef.current === false;
          wasInsideRef.current = true;
          localStorage.removeItem('isInsideSafeZone');

          if (wasOutside) {
            // Returned to a safe zone — notify guardians (best-effort)
            try {
              const nearest = (zones as any[]).reduce((prev, curr) => {
                const prevDist = haversineDistance(latitude, longitude, prev.lat, prev.lng);
                const currDist = haversineDistance(latitude, longitude, curr.lat, curr.lng);
                return currDist < prevDist ? curr : prev;
              });

              const { data: profile } = await supabase
                .from("profiles")
                .select("full_name")
                .eq("id", userId)
                .maybeSingle();
              const userName = profile?.full_name || "Your ward";

              const { data: guardians } = await supabase
                .from("guardians")
                .select("guardian_user_id, guardian_phone")
                .eq("user_id", userId)
                .eq("status", "accepted")
                .not("guardian_user_id", "is", null);

              if (guardians && guardians.length > 0) {
                const selectedIds = settings.locationSharingGuardianIds;
                const filteredGuardians = selectedIds && selectedIds.length > 0
                  ? guardians.filter((g) => selectedIds.includes(g.guardian_user_id!))
                  : guardians;

                if (filteredGuardians.length > 0) {
                  const notifications: any[] = filteredGuardians.map((g) => ({
                    user_id: g.guardian_user_id!,
                    title: "✅ Back in Safe Zone",
                    message: `${userName} has returned to the "${nearest.name}" safe zone area.`,
                    type: "zone_return",
                    read: false,
                  }));

                  // If we had previously alerted "far from safe zone", tell guardians
                  // the ward is back inside so the popup can flip green.
                  if (farAlertSentRef.current) {
                    for (const g of filteredGuardians) {
                      notifications.push({
                        user_id: g.guardian_user_id!,
                        title: "✅ Ward back in safe zone",
                        message: `${userName} is back inside the "${nearest.name}" safe zone.`,
                        type: "zone_far_return",
                        read: false,
                      });
                    }
                  }

                  await supabase.rpc("insert_notifications_deduped", {
                    p_notifications: notifications,
                  });

                  const phones = Array.from(
                    new Set(
                      filteredGuardians
                        .map((g: any) => (g.guardian_phone || "").toString().trim())
                        .filter((p: string) => p.length > 0)
                    )
                  );
                  if (phones.length > 0) {
                    await supabase.functions.invoke("msg91-whatsapp-safezone-return", {
                      body: {
                        wardName: userName,
                        zoneName: nearest.name,
                        occurredAt: new Date().toISOString(),
                        phones,
                      },
                    });
                  }
                }
              }
            } catch (e) {
              console.error("safe_zone_return WhatsApp invoke failed", e);
            }
          }

          // Clear the far-away flag whenever we're back inside any safe zone.
          if (farAlertSentRef.current) {
            farAlertSentRef.current = false;
            localStorage.removeItem('farFromSafeZoneAlerted');
          }
          return;
        }


        const wasInside = wasInsideRef.current;

        // Distance beyond the nearest safe zone's edge (metres). Negative if inside
        // (guarded above), positive when outside.
        const nearest = (zones as any[]).reduce((prev, curr) => {
          const prevEdge = haversineDistance(latitude, longitude, prev.lat, prev.lng) - prev.radius_m;
          const currEdge = haversineDistance(latitude, longitude, curr.lat, curr.lng) - curr.radius_m;
          return currEdge < prevEdge ? curr : prev;
        });
        const distanceBeyondEdgeM = Math.max(
          0,
          haversineDistance(latitude, longitude, nearest.lat, nearest.lng) - nearest.radius_m
        );

        // If we've been outside all along AND haven't crossed the 1 km threshold,
        // nothing new to report.
        if (!wasInside && (farAlertSentRef.current || distanceBeyondEdgeM <= 1000)) {
          return;
        }

        // Suppress zone alerts while on an active journey (same rule as before).
        const { data: activeJourney } = await supabase
          .from("journeys")
          .select("id")
          .eq("user_id", userId)
          .eq("status", "active")
          .maybeSingle();

        if (activeJourney) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", userId)
          .maybeSingle();

        const userName = profile?.full_name || "Your ward";

        const { data: guardians } = await supabase
          .from("guardians")
          .select("guardian_user_id, guardian_phone")
          .eq("user_id", userId)
          .eq("status", "accepted")
          .not("guardian_user_id", "is", null);

        if (!guardians || guardians.length === 0) return;

        const selectedIds = settings.locationSharingGuardianIds;
        const filteredGuardians = selectedIds && selectedIds.length > 0
          ? guardians.filter((g) => selectedIds.includes(g.guardian_user_id!))
          : guardians;

        if (filteredGuardians.length === 0) return;

        const notifications: any[] = [];

        // First exit (was inside, now outside): existing zone_exit alert.
        if (wasInside) {
          wasInsideRef.current = false;
          localStorage.setItem('isInsideSafeZone', 'false');

          for (const g of filteredGuardians) {
            notifications.push({
              user_id: g.guardian_user_id!,
              title: "⚠️ Outside Safe Zone",
              message: `${userName} has left the "${nearest.name}" safe zone area.`,
              type: "zone_exit",
              read: false,
            });
          }
        }

        // Far-away escalation (>1 km beyond nearest edge), fires once per excursion.
        if (!farAlertSentRef.current && distanceBeyondEdgeM > 1000) {
          farAlertSentRef.current = true;
          localStorage.setItem('farFromSafeZoneAlerted', 'true');

          const km = (distanceBeyondEdgeM / 1000).toFixed(1);
          for (const g of filteredGuardians) {
            notifications.push({
              user_id: g.guardian_user_id!,
              title: "🚨 Ward far from safe zone",
              message: `${userName} is about ${km} km from the "${nearest.name}" safe zone.`,
              type: "zone_far",
              read: false,
            });
          }
        }

        if (notifications.length > 0) {
          await supabase.rpc("insert_notifications_deduped", {
            p_notifications: notifications,
          });
        }

        // Fire WhatsApp alert to guardians on the initial exit (unchanged).
        if (wasInside === true) {
          try {
            const phones = Array.from(
              new Set(
                filteredGuardians
                  .map((g: any) => (g.guardian_phone || "").toString().trim())
                  .filter((p: string) => p.length > 0)
              )
            );
            if (phones.length > 0) {
              await supabase.functions.invoke("msg91-whatsapp-safezone", {
                body: {
                  wardName: userName,
                  zoneName: nearest.name,
                  occurredAt: new Date().toISOString(),
                  phones,
                },
              });
            }
          } catch (e) {
            console.error("safe_zone WhatsApp invoke failed", e);
          }
        }

      } catch {
        // Silently ignore errors in background check
      }
    };

    const saveLocation = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          
          // Fetch the latest settings from the database first to prevent overwriting
          // other settings updated on other tabs/devices while GPS was resolving.
          supabase
            .from("user_settings" as any)
            .select("settings")
            .eq("user_id", userId)
            .maybeSingle()
            .then(({ data }) => {
              const currentSettings = (data as any)?.settings || {};
              const updatedSettings = {
                ...currentSettings,
                lastLocation: { lat: latitude, lng: longitude },
                lastLocationAt: new Date().toISOString(),
              };

              supabase
                .from("user_settings" as any)
                .upsert(
                  {
                    user_id: userId,
                    settings: updatedSettings,
                    updated_at: new Date().toISOString(),
                  } as any,
                  { onConflict: "user_id" }
                )
                .then(() => {
                  // Keep local React Query cache in sync to prevent local settings
                  // updates from writing stale locations back to the database.
                  queryClient.setQueryData(["user_settings", userId], updatedSettings);
                  checkSafeZones(latitude, longitude);
                });
            });
        },
        () => {},
        // During SOS use high-accuracy + fresh fix; otherwise stay battery-friendly.
        emergencyMode
          ? { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          : { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      );
    };

    // Track SOS window for the 15-minute battery cap.
    if (emergencyMode) {
      if (sosStartedAtRef.current === null) sosStartedAtRef.current = Date.now();
    } else {
      sosStartedAtRef.current = null;
    }

    const sosWithinCap =
      emergencyMode &&
      sosStartedAtRef.current !== null &&
      Date.now() - sosStartedAtRef.current < SOS_FAST_CAP_MS;

    const cadence = sosWithinCap ? SOS_INTERVAL_MS : NORMAL_INTERVAL_MS;

    // Immediate save (especially important the moment SOS becomes active)
    saveLocation();
    intervalRef.current = setInterval(() => {
      // If we crossed the SOS cap mid-flight, downgrade cadence.
      if (
        emergencyMode &&
        sosStartedAtRef.current !== null &&
        Date.now() - sosStartedAtRef.current >= SOS_FAST_CAP_MS &&
        cadence === SOS_INTERVAL_MS
      ) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(saveLocation, NORMAL_INTERVAL_MS);
      }
      saveLocation();
    }, cadence);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [session?.user?.id, settings.shareLocation, emergencyMode]);
}
