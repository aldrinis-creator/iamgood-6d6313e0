import { useState, useRef, useCallback, useEffect } from "react";
import { loadGoogleMapsAPI } from "@/lib/googleMaps";

export interface PlaceResult {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
  lat?: number;
  lng?: number;
  source: "google" | "textsearch" | "photon" | "nominatim" | "saved" | "fuzzy";
  isFuzzy?: boolean;
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
  const [apiStatus, setApiStatus] = useState<string | null>(null);

  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const sessionToken = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const placesDiv = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController | null>(null);
  const searchIdRef = useRef(0);
  const coordCache = useRef<Map<string, { lat: number; lng: number }>>(new Map());
  const googleAvailableRef = useRef(true);

  useEffect(() => {
    loadGoogleMapsAPI()
      .then(() => {
        autocompleteService.current = new google.maps.places.AutocompleteService();
        if (!placesDiv.current) placesDiv.current = document.createElement("div");
        placesService.current = new google.maps.places.PlacesService(placesDiv.current);
        sessionToken.current = new google.maps.places.AutocompleteSessionToken();
        setReady(true);

        autocompleteService.current.getPlacePredictions(
          { input: "test", sessionToken: sessionToken.current!, componentRestrictions: { country } },
          (_predictions, status) => {
            if (status === google.maps.places.PlacesServiceStatus.REQUEST_DENIED) {
              googleAvailableRef.current = false;
              setApiStatus("Google Places API unavailable — using fallback search");
              console.warn("[PlaceAutocomplete] Google Places REQUEST_DENIED");
            } else if (status === google.maps.places.PlacesServiceStatus.OVER_QUERY_LIMIT) {
              setApiStatus("Search limit reached, try again shortly");
            } else {
              googleAvailableRef.current = true;
              setApiStatus(null);
            }
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

  /** Tier 2: Google Places New API (searchByText) — modern Promise-based, no callback hang */
  const newPlacesSearch = useCallback(
    async (query: string, searchId: number): Promise<PlaceResult[]> => {
      try {
        // Check if the new Places API is available
        const PlaceClass = (google?.maps?.places as any)?.Place;
        if (!PlaceClass?.searchByText) {
          console.log(`[PlaceSearch] Tier 2 (Places New) — API not available, skipping`);
          return [];
        }

        const request: any = {
          textQuery: query,
          fields: ["displayName", "location", "formattedAddress", "id"],
          maxResultCount: 6,
          region: country,
        };

        if (origin) {
          request.locationBias = {
            center: { lat: origin.lat, lng: origin.lng },
            radius: 50000,
          };
        }

        const response = await Promise.race([
          PlaceClass.searchByText(request),
          new Promise<null>((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
        ]);

        if (searchId !== searchIdRef.current) return [];
        if (!response || !(response as any).places?.length) {
          console.log(`[PlaceSearch] Tier 2 (Places New) "${query}" → 0 results`);
          return [];
        }

        const places = (response as any).places;
        const mapped: PlaceResult[] = places.slice(0, 6).map((p: any) => ({
          place_id: p.id || `newp_${Math.random()}`,
          description: p.formattedAddress || p.displayName || query,
          main_text: p.displayName || p.formattedAddress?.split(",")[0] || query,
          secondary_text: p.formattedAddress?.split(",").slice(1, 3).join(",").trim() || "",
          lat: p.location?.lat?.() ?? p.location?.lat,
          lng: p.location?.lng?.() ?? p.location?.lng,
          source: "textsearch" as const,
        }));
        console.log(`[PlaceSearch] Tier 2 (Places New) "${query}" → ${mapped.length} results`);
        return mapped;
      } catch (e: any) {
        if (e?.message === "timeout") {
          console.log(`[PlaceSearch] Tier 2 (Places New) "${query}" → timeout (8s)`);
        } else {
          console.log(`[PlaceSearch] Tier 2 (Places New) "${query}" → error: ${e?.message || e}`);
        }
        return [];
      }
    },
    [origin, country]
  );

  /** Tier 3: Photon geocoder (by Komoot) — free, better POI coverage */
  const photonSearch = useCallback(
    async (query: string, signal: AbortSignal): Promise<PlaceResult[]> => {
      try {
        const params = new URLSearchParams({
          q: query,
          lang: "en",
          limit: "6",
        });
        if (origin) {
          params.set("lat", String(origin.lat));
          params.set("lon", String(origin.lng));
        }

        const res = await fetch(`https://photon.komoot.io/api/?${params}`, {
          signal,
          headers: { "User-Agent": "CheckiN-App/1.0" },
        });
        const data = await res.json();

        if (!data?.features?.length) {
          console.log(`[PlaceSearch] Tier 3 (Photon) "${query}" → 0 results`);
          return [];
        }

        const mapped: PlaceResult[] = data.features.slice(0, 6).map((f: any) => {
          const props = f.properties || {};
          const nameParts = [props.name, props.street, props.city, props.state].filter(Boolean);
          const mainText = props.name || props.street || query;
          const secondaryText = [props.city, props.state, props.country].filter(Boolean).join(", ");

          return {
            place_id: `photon_${props.osm_id || Math.random()}`,
            description: nameParts.join(", "),
            main_text: mainText,
            secondary_text: secondaryText,
            lat: f.geometry?.coordinates?.[1],
            lng: f.geometry?.coordinates?.[0],
            source: "photon" as const,
          };
        });

        console.log(`[PlaceSearch] Tier 3 (Photon) "${query}" → ${mapped.length} results`);
        return mapped;
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        console.log(`[PlaceSearch] Tier 3 (Photon) "${query}" → error: ${e?.message || e}`);
        return [];
      }
    },
    [origin]
  );

  /** Tier 4: Nominatim with India context + city-context retry */
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

      // Always try with "India" context first
      const queryWithContext = query.toLowerCase().includes("india") ? query : `${query} India`;
      let data = await doSearch(queryWithContext);

      // If contextualized query failed, try original
      if (!data.length && queryWithContext !== query) {
        data = await doSearch(query);
      }

      // If still no results, retry with city context from reverse geocoding
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

  /** Tier 5: Fuzzy partial search — retry with first word + location bias */
  const fuzzySearch = useCallback(
    async (query: string, signal: AbortSignal): Promise<PlaceResult[]> => {
      const words = query.trim().split(/\s+/);
      if (words.length < 1) return [];

      // Try progressively: first word, first two words, etc. (but shorter than original)
      const attempts: string[] = [];
      if (words.length >= 2) attempts.push(words[0]);
      if (words.length >= 3) attempts.push(words.slice(0, 2).join(" "));

      for (const partial of attempts) {
        if (signal.aborted) return [];
        try {
          const params = new URLSearchParams({ q: partial, lang: "en", limit: "6" });
          if (origin) {
            params.set("lat", String(origin.lat));
            params.set("lon", String(origin.lng));
          }
          const res = await fetch(`https://photon.komoot.io/api/?${params}`, {
            signal,
            headers: { "User-Agent": "CheckiN-App/1.0" },
          });
          const data = await res.json();
          if (data?.features?.length) {
            const mapped: PlaceResult[] = data.features.slice(0, 6).map((f: any) => {
              const props = f.properties || {};
              const mainText = props.name || props.street || partial;
              const secondaryText = [props.city, props.state, props.country].filter(Boolean).join(", ");
              return {
                place_id: `fuzzy_${props.osm_id || Math.random()}`,
                description: [props.name, props.street, props.city, props.state].filter(Boolean).join(", "),
                main_text: mainText,
                secondary_text: secondaryText,
                lat: f.geometry?.coordinates?.[1],
                lng: f.geometry?.coordinates?.[0],
                source: "fuzzy" as const,
                isFuzzy: true,
              };
            });
            console.log(`[PlaceSearch] Tier 5 (Fuzzy) "${partial}" → ${mapped.length} results`);
            return mapped;
          }
        } catch (e: any) {
          if (e?.name === "AbortError") throw e;
        }
      }
      console.log(`[PlaceSearch] Tier 5 (Fuzzy) "${query}" → 0 results`);
      return [];
    },
    [origin]
  );

  /** Main search — 5-tier fallback */
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
          // Phase 1: Tier 1 (Autocomplete) + Tier 2 (Places New API) in parallel
          const [googleResults, newPlacesResults] = await Promise.all([
            googleSearch(query, searchId),
            newPlacesSearch(query, searchId),
          ]);
          if (searchId !== searchIdRef.current) return;

          const seenDescriptions = new Set(googleResults.map(r => r.description));
          const uniqueNewResults = newPlacesResults.filter(r => !seenDescriptions.has(r.description));
          const mergedResults = [...googleResults, ...uniqueNewResults].slice(0, 8);

          if (mergedResults.length > 0) {
            console.log(`[PlaceSearch] Phase 1 merged: ${googleResults.length} autocomplete + ${uniqueNewResults.length} new places`);
            setResults(mergedResults);
            setSearching(false);
            return;
          }

          if (controller.signal.aborted) return;

          // Tier 3: Photon geocoder
          const photonResults = await photonSearch(query, controller.signal);
          if (searchId !== searchIdRef.current) return;
          if (photonResults.length > 0) {
            setResults(photonResults);
            setSearching(false);
            return;
          }

          if (controller.signal.aborted) return;

          // Tier 4: Nominatim with India context + city retry
          const nomResults = await nominatimSearch(query, controller.signal);
          if (searchId !== searchIdRef.current) return;
          console.log(`[PlaceSearch] Tier 4 (Nominatim) "${query}" → ${nomResults.length} results`);

          if (nomResults.length > 0) {
            setResults(nomResults);
            setSearching(false);
            return;
          }

          if (controller.signal.aborted) return;

          // Tier 5: Fuzzy partial search
          const fuzzyResults = await fuzzySearch(query, controller.signal);
          if (searchId !== searchIdRef.current) return;
          setResults(fuzzyResults);
        } catch (e: any) {
          if (e?.name === "AbortError") return;
          console.warn("[PlaceAutocomplete] search error:", e);
          setResults([]);
        } finally {
          if (searchId === searchIdRef.current) setSearching(false);
        }
      }, debounceMs);
    },
    [minChars, debounceMs, googleSearch, newPlacesSearch, photonSearch, nominatimSearch, fuzzySearch]
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
