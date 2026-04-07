import { useState, useRef, useCallback, useEffect } from "react";
import { loadGoogleMapsAPI } from "@/lib/googleMaps";

export interface PlaceResult {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
  lat?: number;
  lng?: number;
  source: "google" | "nominatim" | "saved";
}

interface UsePlaceAutocompleteOptions {
  /** User's current location for bias */
  origin: { lat: number; lng: number } | null;
  /** Minimum characters before searching (default 2) */
  minChars?: number;
  /** Debounce ms (default 180) */
  debounceMs?: number;
  /** Country restriction (default "in") */
  country?: string;
}

export function usePlaceAutocomplete({
  origin,
  minChars = 2,
  debounceMs = 180,
  country = "in",
}: UsePlaceAutocompleteOptions) {
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [ready, setReady] = useState(false);

  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const sessionToken = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const placesDiv = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController | null>(null);
  const searchIdRef = useRef(0); // monotonic counter to ignore stale results

  // Coordinate cache: place_id → {lat, lng}
  const coordCache = useRef<Map<string, { lat: number; lng: number }>>(new Map());

  // Init Google Places
  useEffect(() => {
    loadGoogleMapsAPI()
      .then(() => {
        autocompleteService.current = new google.maps.places.AutocompleteService();
        if (!placesDiv.current) placesDiv.current = document.createElement("div");
        placesService.current = new google.maps.places.PlacesService(placesDiv.current);
        sessionToken.current = new google.maps.places.AutocompleteSessionToken();
        setReady(true);
      })
      .catch(() => {
        console.warn("Google Places failed to load — will use Nominatim only");
      });
  }, []);

  /** Refresh session token (call after a place is selected) */
  const refreshSession = useCallback(() => {
    if (typeof google !== "undefined" && google.maps?.places) {
      sessionToken.current = new google.maps.places.AutocompleteSessionToken();
    }
  }, []);

  /** Google Places autocomplete — returns predictions */
  const googleSearch = useCallback(
    (query: string, searchId: number): Promise<PlaceResult[]> => {
      if (!autocompleteService.current) return Promise.resolve([]);

      return new Promise((resolve) => {
        const timeout = setTimeout(() => resolve([]), 4000);

        const request: google.maps.places.AutocompletionRequest = {
          input: query,
          sessionToken: sessionToken.current!,
          componentRestrictions: { country },
          ...(origin && {
            locationBias: {
              center: { lat: origin.lat, lng: origin.lng },
              radius: 50000,
            } as any,
          }),
        };

        // Try newer API shape first, fall back to legacy
        try {
          autocompleteService.current!.getPlacePredictions(
            request,
            (predictions, status) => {
              clearTimeout(timeout);
              if (searchId !== searchIdRef.current) {
                resolve([]);
                return;
              }
              if (
                status === google.maps.places.PlacesServiceStatus.OK &&
                predictions
              ) {
                resolve(
                  predictions.slice(0, 6).map((p) => ({
                    place_id: p.place_id,
                    description: p.description,
                    main_text: p.structured_formatting.main_text,
                    secondary_text: p.structured_formatting.secondary_text || "",
                    source: "google" as const,
                  }))
                );
              } else {
                resolve([]);
              }
            }
          );
        } catch {
          clearTimeout(timeout);
          resolve([]);
        }
      });
    },
    [origin, country]
  );

  /** Nominatim fallback — only used when Google returns nothing */
  const nominatimSearch = useCallback(
    async (query: string, signal: AbortSignal): Promise<PlaceResult[]> => {
      const params = new URLSearchParams({
        format: "json",
        q: query,
        limit: "6",
        countrycodes: country,
        addressdetails: "1",
      });
      if (origin) {
        const delta = 0.45;
        params.set(
          "viewbox",
          `${origin.lng - delta},${origin.lat + delta},${origin.lng + delta},${origin.lat - delta}`
        );
        params.set("bounded", "0");
      }

      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?${params}`,
        {
          headers: { "User-Agent": "CheckiN-App/1.0" },
          signal,
        }
      );
      const data: any[] = await res.json();

      if (!data.length) return [];

      // Sort by distance from origin
      const withDist = data.map((d: any) => {
        const lat = parseFloat(d.lat);
        const lng = parseFloat(d.lon);
        let dist = Infinity;
        if (origin) {
          const R = 6371;
          const dLat = ((lat - origin.lat) * Math.PI) / 180;
          const dLng = ((lng - origin.lng) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos((origin.lat * Math.PI) / 180) *
              Math.cos((lat * Math.PI) / 180) *
              Math.sin(dLng / 2) ** 2;
          dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        }
        return { ...d, _lat: lat, _lng: lng, _dist: dist };
      });
      withDist.sort((a, b) => a._dist - b._dist);

      return withDist.slice(0, 5).map((d: any) => ({
        place_id: `nom_${d.place_id || Math.random()}`,
        description: d.display_name,
        main_text: d.display_name.split(",")[0],
        secondary_text: d.display_name.split(",").slice(1, 3).join(",").trim(),
        lat: d._lat,
        lng: d._lng,
        source: "nominatim" as const,
      }));
    },
    [origin, country]
  );

  /** Main search function — call on every input change */
  const search = useCallback(
    (query: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();

      if (query.length < minChars) {
        setResults([]);
        setSearching(false);
        return;
      }

      setSearching(true);
      const searchId = ++searchIdRef.current;

      timerRef.current = setTimeout(async () => {
        const controller = new AbortController();
        abortRef.current = controller;

        try {
          // 1. Try Google first (fast, best quality)
          const googleResults = await googleSearch(query, searchId);
          if (searchId !== searchIdRef.current) return;

          if (googleResults.length > 0) {
            setResults(googleResults);
            setSearching(false);
            return;
          }

          // 2. Fallback to Nominatim only if Google had no results
          if (controller.signal.aborted) return;
          const nomResults = await nominatimSearch(query, controller.signal);
          if (searchId !== searchIdRef.current) return;

          setResults(nomResults);
        } catch (e: any) {
          if (e?.name === "AbortError") return;
          console.warn("[PlaceAutocomplete] search error:", e);
          setResults([]);
        } finally {
          if (searchId === searchIdRef.current) setSearching(false);
        }
      }, debounceMs);
    },
    [minChars, debounceMs, googleSearch, nominatimSearch]
  );

  /** Clear results */
  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();
    searchIdRef.current++;
    setResults([]);
    setSearching(false);
  }, []);

  /** Resolve coordinates for a result (handles Google place_id → getDetails) */
  const resolveCoords = useCallback(
    (result: PlaceResult): Promise<{ lat: number; lng: number } | null> => {
      // Already have coords (Nominatim or cached)
      if (result.lat != null && result.lng != null) {
        return Promise.resolve({ lat: result.lat, lng: result.lng });
      }

      // Check cache
      const cached = coordCache.current.get(result.place_id);
      if (cached) return Promise.resolve(cached);

      // Need Google Place Details
      if (!placesService.current) return Promise.resolve(null);

      return new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(null), 5000);
        placesService.current!.getDetails(
          {
            placeId: result.place_id,
            fields: ["geometry", "name", "formatted_address"],
            sessionToken: sessionToken.current!,
          },
          (place, status) => {
            clearTimeout(timeout);
            if (
              status === google.maps.places.PlacesServiceStatus.OK &&
              place?.geometry?.location
            ) {
              const coords = {
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng(),
              };
              coordCache.current.set(result.place_id, coords);
              // After getDetails, refresh session token (per Google billing best practice)
              refreshSession();
              resolve(coords);
            } else {
              resolve(null);
            }
          }
        );
      });
    },
    [refreshSession]
  );

  return {
    results,
    searching,
    ready,
    search,
    clear,
    resolveCoords,
    refreshSession,
  };
}
