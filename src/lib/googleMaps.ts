/// <reference types="google.maps" />

let loadPromise: Promise<void> | null = null;

// NOTE: This is a public browser key. Security is enforced via Google Cloud
// HTTP referrer restrictions + API restrictions (Maps JS, Places, Street View,
// Geocoding, Air Quality only). Safe to ship in the bundle per Google's
// recommended pattern: https://developers.google.com/maps/api-security-best-practices
const GOOGLE_MAPS_API_KEY = "AIzaSyCTaUAI6Q-yrka45TYnP4kYI5gWDjGMjaQ";

export function loadGoogleMapsAPI(): Promise<void> {
  if (!GOOGLE_MAPS_API_KEY) {
    return Promise.reject(new Error("Google Maps API key not configured"));
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
