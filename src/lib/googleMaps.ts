/// <reference types="google.maps" />

let loadPromise: Promise<void> | null = null;

export function loadGoogleMapsAPI(): Promise<void> {
  if (loadPromise) return loadPromise;

  const apiKey = "AIzaSyDCeS7oubdcbYDt46e1vXeP3vrfLJGaOCw";

  if ((window as any).google?.maps) {
    return Promise.resolve();
  }

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=streetview`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps API"));
    document.head.appendChild(script);
  });

  return loadPromise;
}
