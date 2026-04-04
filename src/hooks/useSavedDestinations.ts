import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface SavedDestination {
  id: string;
  name: string;
  lat: number;
  lng: number;
  place_id: string | null;
  last_used_at: string;
  use_count: number;
  is_favorite: boolean;
}

export function useSavedDestinations() {
  const { user } = useAuth();
  const [destinations, setDestinations] = useState<SavedDestination[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDestinations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("saved_destinations")
      .select("*")
      .eq("user_id", user.id)
      .order("is_favorite", { ascending: false })
      .order("last_used_at", { ascending: false })
      .limit(10);
    setDestinations((data as SavedDestination[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchDestinations();
  }, [fetchDestinations]);

  const saveDestination = useCallback(
    async (dest: { name: string; lat: number; lng: number; place_id?: string }) => {
      if (!user) return;
      // Round coords to avoid floating point uniqueness issues
      const lat = Math.round(dest.lat * 1e6) / 1e6;
      const lng = Math.round(dest.lng * 1e6) / 1e6;

      // Check if exists
      const { data: existing } = await supabase
        .from("saved_destinations")
        .select("id, use_count")
        .eq("user_id", user.id)
        .eq("lat", lat)
        .eq("lng", lng)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("saved_destinations")
          .update({ use_count: existing.use_count + 1, last_used_at: new Date().toISOString(), name: dest.name })
          .eq("id", existing.id);
      } else {
        await supabase.from("saved_destinations").insert({
          user_id: user.id,
          name: dest.name,
          lat,
          lng,
          place_id: dest.place_id || null,
        });
      }
      fetchDestinations();
    },
    [user, fetchDestinations]
  );

  const toggleFavorite = useCallback(
    async (id: string, current: boolean) => {
      await supabase.from("saved_destinations").update({ is_favorite: !current }).eq("id", id);
      fetchDestinations();
    },
    [fetchDestinations]
  );

  const removeDestination = useCallback(
    async (id: string) => {
      await supabase.from("saved_destinations").delete().eq("id", id);
      fetchDestinations();
    },
    [fetchDestinations]
  );

  return { destinations, loading, saveDestination, toggleFavorite, removeDestination };
}
