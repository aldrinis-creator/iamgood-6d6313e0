import { useState, useRef, useCallback, useEffect } from "react";
import { loadGoogleMapsAPI } from "@/lib/googleMaps";

export interface PlaceResult {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
  lat?: number;
  lng?: number;
  source: "google" | "textsearch" | "geocoding" | "nominatim" | "saved";
}

interface UsePlaceAutocompleteOptions {
  origin: { lat: number; lng: number } | null;
  minChars?: number;
  debounceMs?: number;
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
  const [apiStatus, setApiStatus] = useState<string | null>(null); // diagnostic message

  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const sessionToken = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const placesDiv = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController | null>(null);
  const searchIdRef = useRef(0);
  const coordCache = useRef<Map<string, { lat: number; lng: number }>>(new Map());
  const googleAvailableRef = useRef(true); // track if Google Places works

  // Init Google Places + test availability
  useEffect(() => {
    loadGoogleMapsAPI()
      .then(() => {
        autocompleteService.current = new google.maps.places.AutocompleteService();
        if (!placesDiv.current) placesDiv.current = document.createElement("div");
        placesService.current = new google.maps.places.PlacesService(placesDiv.current);
        sessionToken.current = new google.maps.places.AutocompleteSessionToken();
        setReady(true);

        // Test query to detect REQUEST_DENIED early
        autocompleteService.current.getPlacePredictions(
          { input: "test", sessionToken: sessionToken.current!, componentRestrictions: { country } },
          (_predictions, status) => {
            if (status === google.maps.places.PlacesServiceStatus.REQUEST_DENIED) {
              googleAvailableRef.current = false;
              setApiStatus("Google Places API unavailable — using fallback search");
              console.warn("[PlaceAutocomplete] Google Places REQUEST_DENIED — API key may not have Places API enabled or billing active");
            } else if (status === google.maps.places.PlacesServiceStatus.OVER_QUERY_LIMIT) {
              setApiStatus("Search limit reached, try again shortly");
            } else {
              googleAvailableRef.current = true;
              setApiStatus(null);
            }
            // Refresh token after test query
            sessionToken.current = new google.maps.places.AutocompleteSessionToken();
          }
        );
      })
      .catch(() => {
        console.warn("Google Places failed to load — will use fallback search");
        setApiStatus("Google Maps unavailable — using fallback search");
      });
  }, [country]);

  const refreshSession = useCallback(() => {
    if (typeof google !== "undefined" && google.maps?.places) {
      sessionToken.current = new google.maps.places.AutocompleteSessionToken();
    }
  }, []);

  /** Tier 1: Google Places Autocomplete */
  const googleSearch = useCallback(
    (query: string, searchId: number): Promise<PlaceResult[]> => {
      if (!autocompleteService.current || !googleAvailableRef.current) return Promise.resolve([]);

      return new Promise((resolve) => {
        const timeout = setTimeout(() => resolve([]), 4000);

        const request: google.maps.places.AutocompletionRequest = {
          input: query,
          sessionToken: sessionToken.current!,
          componentRestrictions: { country },
          ...(origin && {
            location: new google.maps.LatLng(origin.lat, origin.lng),
            radius: 50000,
          }),
        };

        try {
          autocompleteService.current!.getPlacePredictions(request, (predictions, status) => {
            clearTimeout(timeout);
            if (searchId !== searchIdRef.current) { resolve([]); return; }

            if (status === google.maps.places.PlacesServiceStatus.REQUEST_DENIED) {
              googleAvailableRef.current = false;
              setApiStatus("Google Places API unavailable — using fallback search");
              resolve([]);
              return;
            }
            if (status === google.maps.places.PlacesServiceStatus.OVER_QUERY_LIMIT) {
              setApiStatus("Search limit reached, try again shortly");
              resolve([]);
              return;
            }

            if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
              const mapped = predictions.slice(0, 6).map((p) => ({
                place_id: p.place_id,
                description: p.description,
                main_text: p.structured_formatting.main_text,
                secondary_text: p.structured_formatting.secondary_text || "",
                source: "google" as const,
              }));
              console.log(`[PlaceSearch] Tier 1 (Autocomplete) "${query}" → ${mapped.length} results`);
              resolve(mapped);
            } else {
              console.log(`[PlaceSearch] Tier 1 (Autocomplete) "${query}" → 0 results (status: ${status})`);
              resolve([]);
            }
          });
        } catch {
          clearTimeout(timeout);
          resolve([]);
        }
      });
    },
    [origin, country]
  );

  /** Tier 2: Google Places Text Search (finds building names, landmarks, residential complexes) */
  const textSearch = useCallback(
    (query: string, searchId: number): Promise<PlaceResult[]> => {
      if (!placesService.current) return Promise.resolve([]);

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.log(`[PlaceSearch] Tier 2 (TextSearch) "${query}" → timeout`);
          resolve([]);
        }, 5000);

        const request: google.maps.places.TextSearchRequest = {
          query,
          ...(origin && {
            location: new google.maps.LatLng(origin.lat, origin.lng),
            radius: 50000,
          }),
        };

        try {
          placesService.current!.textSearch(request, (results, status) => {
            clearTimeout(timeout);
            if (searchId !== searchIdRef.current) { resolve([]); return; }

            if (status === google.maps.places.PlacesServiceStatus.REQUEST_DENIED) {
              console.warn(`[PlaceSearch] Tier 2 (TextSearch) REQUEST_DENIED`);
              resolve([]);
              return;
            }

            if (status === google.maps.places.PlacesServiceStatus.OK && results) {
              const mapped = results.slice(0, 6).map((r) => ({
                place_id: r.place_id || `ts_${Math.random()}`,
                description: r.formatted_address || r.name || query,
                main_text: r.name || r.formatted_address?.split(",")[0] || query,
                secondary_text: r.formatted_address?.split(",").slice(1, 3).join(",").trim() || "",
                lat: r.geometry?.location?.lat(),
                lng: r.geometry?.location?.lng(),
                source: "textsearch" as const,
              }));
              console.log(`[PlaceSearch] Tier 2 (TextSearch) "${query}" → ${mapped.length} results`);
              resolve(mapped);
            } else {
              console.log(`[PlaceSearch] Tier 2 (TextSearch) "${query}" → 0 results (status: ${status})`);
              resolve([]);
            }
          });
        } catch {
          clearTimeout(timeout);
          resolve([]);
        }
      });
    },
    [origin]
  );

  /** Tier 3: Google Geocoding API (address-based lookup) */
  const geocodingSearch = useCallback(
    async (query: string, signal: AbortSignal): Promise<PlaceResult[]> => {
      const apiKey = "AIzaSyAFMWZxjdj-uXJciP4Uf2HGJ_8ZnbP_QIo";
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}&region=${country}&language=en`;

      try {
        const res = await fetch(url, { signal });
        const data = await res.json();

        if (data.status === "REQUEST_DENIED") {
          console.warn(`[PlaceSearch] Tier 3 (Geocoding) REQUEST_DENIED:`, data.error_message);
          return [];
        }

        if (data.status === "OK" && data.results?.length) {
          const mapped = data.results.slice(0, 5).map((r: any) => ({
            place_id: r.place_id,
            description: r.formatted_address,
            main_text: r.formatted_address.split(",")[0],
            secondary_text: r.formatted_address.split(",").slice(1, 3).join(",").trim(),
            lat: r.geometry.location.lat,
            lng: r.geometry.location.lng,
            source: "geocoding" as const,
          }));
          console.log(`[PlaceSearch] Tier 3 (Geocoding) "${query}" → ${mapped.length} results`);
          return mapped;
        }

        console.log(`[PlaceSearch] Tier 3 (Geocoding) "${query}" → 0 results (status: ${data.status})`);
        return [];
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        console.warn("[PlaceSearch] Tier 3 (Geocoding) error:", e);
        return [];
      }
    },
    [country]
  );

  /** Tier 4: Nominatim with city-context retry */
  const nominatimSearch = useCallback(
    async (query: string, signal: AbortSignal): Promise<PlaceResult[]> => {
      const doSearch = async (q: string): Promise<any[]> => {
        const params = new URLSearchParams({
          format: "json",
          q,
          limit: "6",
          countrycodes: country,
          addressdetails: "1",
        });
        if (origin) {
          const delta = 0.45;
          params.set("viewbox", `${origin.lng - delta},${origin.lat + delta},${origin.lng + delta},${origin.lat - delta}`);
          params.set("bounded", "0");
        }
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
          headers: { "User-Agent": "CheckiN-App/1.0" },
          signal,
        });
        return res.json();
      };

      let data = await doSearch(query);

      // If no results, retry with city context from reverse geocoding
      if (!data.length && origin) {
        try {
          const revRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${origin.lat}&lon=${origin.lng}&zoom=10`,
            { headers: { "User-Agent": "CheckiN-App/1.0" }, signal }
          );
          const revData = await revRes.json();
          const city = revData?.address?.city || revData?.address?.town || revData?.address?.state_district || "";
          if (city && !query.toLowerCase().includes(city.toLowerCase())) {
            data = await doSearch(`${query} ${city}`);
          }
        } catch {
          // ignore reverse geocoding failure
        }
      }

      if (!data.length) return [];

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
      withDist.sort((a: any, b: any) => a._dist - b._dist);

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

  /** Main search — 3-tier fallback */
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
          // Phase 1: Tier 1 + Tier 2 in parallel
          const [googleResults, textResults] = await Promise.all([
            googleSearch(query, searchId),
            textSearch(query, searchId),
          ]);
          if (searchId !== searchIdRef.current) return;

          // Merge: Autocomplete first, then unique Text Search results
          const seenDescriptions = new Set(googleResults.map(r => r.description));
          const uniqueTextResults = textResults.filter(r => !seenDescriptions.has(r.description));
          const mergedResults = [...googleResults, ...uniqueTextResults].slice(0, 8);

          if (mergedResults.length > 0) {
            console.log(`[PlaceSearch] Phase 1 merged: ${googleResults.length} autocomplete + ${uniqueTextResults.length} textsearch`);
            setResults(mergedResults);
            setSearching(false);
            return;
          }

          if (controller.signal.aborted) return;

          // Tier 3: Google Geocoding API (address-based)
          const geoResults = await geocodingSearch(query, controller.signal);
          if (searchId !== searchIdRef.current) return;
          if (geoResults.length > 0) {
            setResults(geoResults);
            setSearching(false);
            return;
          }

          if (controller.signal.aborted) return;

          // Tier 4: Nominatim with city-context retry
          const nomResults = await nominatimSearch(query, controller.signal);
          if (searchId !== searchIdRef.current) return;
          console.log(`[PlaceSearch] Tier 4 (Nominatim) "${query}" → ${nomResults.length} results`);

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
    [minChars, debounceMs, googleSearch, textSearch, geocodingSearch, nominatimSearch]
  );

  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();
    searchIdRef.current++;
    setResults([]);
    setSearching(false);
  }, []);

  /** Resolve coordinates for a result */
  const resolveCoords = useCallback(
    (result: PlaceResult): Promise<{ lat: number; lng: number } | null> => {
      if (result.lat != null && result.lng != null) {
        return Promise.resolve({ lat: result.lat, lng: result.lng });
      }

      const cached = coordCache.current.get(result.place_id);
      if (cached) return Promise.resolve(cached);

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
    apiStatus,
    search,
    clear,
    resolveCoords,
    refreshSession,
  };
}
