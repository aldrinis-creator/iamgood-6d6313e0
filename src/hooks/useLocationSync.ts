import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useUserSettings } from "@/hooks/useUserSettings";

/**
 * Periodically saves the user's geolocation to user_settings
 * so guardians can view the ward's location on their dashboard.
 * Runs every 5 minutes and on initial mount.
 */
export default function useLocationSync() {
  const { session } = useAuth();
  const { settings } = useUserSettings();
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || !settings.shareLocation) return;

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
            .then(() => {});
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
