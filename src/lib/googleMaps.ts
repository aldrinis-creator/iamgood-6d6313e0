/// <reference types="google.maps" />

let loadPromise: Promise<void> | null = null;

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "AIzaSyBRtFaGdJzYpSjC8_0h6FdeJ0W8OqLjeFc";

export function loadGoogleMapsAPI(): Promise<void> {
  if (!GOOGLE_MAPS_API_KEY) {
    return Promise.reject(new Error("VITE_GOOGLE_MAPS_API_KEY not configured"));
  }

  if (loadPromise) return loadPromise;

  if ((window as any).google?.maps) {
    return Promise.resolve();
  }

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=streetview,places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Failed to load Google Maps API"));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
