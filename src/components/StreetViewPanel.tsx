/// <reference types="google.maps" />
import { useEffect, useRef, useState } from "react";
import { loadGoogleMapsAPI } from "@/lib/googleMaps";
import { Loader2 } from "lucide-react";

interface StreetViewPanelProps {
  lat: number;
  lng: number;
  heading?: number;
  height?: number;
}

const StreetViewPanel = ({ lat, lng, heading = 0, height = 250 }: StreetViewPanelProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load Google Maps API
  useEffect(() => {
    loadGoogleMapsAPI()
      .then(() => setLoading(false))
      .catch(() => setError("Failed to load Google Maps. Check your API key."));
  }, []);

  // Initialize panorama
  useEffect(() => {
    if (loading || error || !containerRef.current || !(window as any).google?.maps) return;

    const svService = new google.maps.StreetViewService();
    const position = new google.maps.LatLng(lat, lng);

    svService.getPanorama({ location: position, radius: 100 }, (data, status) => {
      if (status === google.maps.StreetViewStatus.OK && data?.location?.latLng) {
        if (!panoramaRef.current) {
          panoramaRef.current = new google.maps.StreetViewPanorama(containerRef.current!, {
            position: data.location.latLng,
            pov: { heading, pitch: 0 },
            zoom: 1,
            addressControl: false,
            showRoadLabels: true,
            motionTracking: false,
            motionTrackingControl: false,
          });
        } else {
          panoramaRef.current.setPosition(data.location.latLng);
          panoramaRef.current.setPov({ heading, pitch: 0 });
        }
        setError(null);
      } else {
        setError("No Street View available at this location");
      }
    });
  }, [loading, error, lat, lng]);

  // Update heading
  useEffect(() => {
    if (panoramaRef.current) {
      panoramaRef.current.setPov({ heading, pitch: 0 });
    }
  }, [heading]);

  if (error) {
    return (
      <div
        className="flex items-center justify-center bg-muted rounded-lg text-xs text-muted-foreground"
        style={{ height }}
      >
        {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className="flex items-center justify-center bg-muted rounded-lg"
        style={{ height }}
      >
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="rounded-lg overflow-hidden border border-border"
      style={{ height, width: "100%" }}
    />
  );
};

export default StreetViewPanel;
