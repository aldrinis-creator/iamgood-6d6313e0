import { useState, useEffect, useRef } from "react";
import { Wind, Loader2, Thermometer, MapPin, Search, Droplets, CloudRain, Sun } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const API_KEY = "AIzaSyCQuBmmLMKvQwqD4ydUL8DA8sZ7sIQtLX8";
const MAX_SEARCHES_PER_DAY = 5;

interface Pollutant {
  code: string;
  displayName: string;
  fullName: string;
  concentration: { value: number; units: string };
}

interface AQIData {
  aqi: number;
  aqiDisplay: string;
  category: string;
  dominantPollutant: string;
  pollutants: Pollutant[];
  elderlyRecommendation?: string;
  temp?: number;
  locationName?: string;
}

const AQIWidget = ({ role = "user" }: { role?: "user" | "guardian" }) => {
  const [aqiData, setAqiData] = useState<AQIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchesLeft, setSearchesLeft] = useState(MAX_SEARCHES_PER_DAY);

  // Initialize rate limiting
  useEffect(() => {
    const trackerStr = localStorage.getItem("aqi_search_tracker");
    const today = new Date().toISOString().split("T")[0];
    if (trackerStr) {
      const tracker = JSON.parse(trackerStr);
      if (tracker.date === today) {
        setSearchesLeft(Math.max(0, MAX_SEARCHES_PER_DAY - tracker.count));
      } else {
        localStorage.setItem("aqi_search_tracker", JSON.stringify({ date: today, count: 0 }));
      }
    } else {
      localStorage.setItem("aqi_search_tracker", JSON.stringify({ date: today, count: 0 }));
    }
  }, []);

  const incrementSearchTracker = () => {
    const today = new Date().toISOString().split("T")[0];
    const trackerStr = localStorage.getItem("aqi_search_tracker");
    let count = 0;
    if (trackerStr) {
      const tracker = JSON.parse(trackerStr);
      count = tracker.date === today ? tracker.count : 0;
    }
    const newCount = count + 1;
    localStorage.setItem("aqi_search_tracker", JSON.stringify({ date: today, count: newCount }));
    setSearchesLeft(Math.max(0, MAX_SEARCHES_PER_DAY - newCount));
  };

  const fetchEnvironmentData = async (lat: number, lng: number, locationName?: string) => {
    try {
      // 1. Fetch detailed Air Quality
      const aqiRes = await fetch(`https://airquality.googleapis.com/v1/currentConditions:lookup?key=${API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: { latitude: lat, longitude: lng },
          extraComputations: ["POLLUTANT_CONCENTRATION", "HEALTH_RECOMMENDATIONS"],
        }),
      });
      const data = await aqiRes.json();
      
      const uaqi = data.indexes?.find((idx: any) => idx.code === "uaqi");
      if (!uaqi) throw new Error("No AQI data");

      // 2. Fetch Temperature via free Open-Meteo
      let temp: number | undefined;
      try {
        const tempRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`);
        const tempData = await tempRes.json();
        temp = tempData?.current_weather?.temperature;
      } catch (e) {
        console.warn("Temperature fetch failed", e);
      }

      setAqiData({
        aqi: uaqi.aqi,
        aqiDisplay: uaqi.aqiDisplay,
        category: uaqi.category,
        dominantPollutant: uaqi.dominantPollutant,
        pollutants: data.pollutants || [],
        elderlyRecommendation: data.healthRecommendations?.elderly,
        temp,
        locationName: locationName || "Current Location"
      });
      setError(false);
    } catch {
      setError(true);
      if (!aqiData) toast.error("Failed to load air quality data");
    } finally {
      setLoading(false);
      setSearchLoading(false);
    }
  };

  const fetchDefaultLocation = () => {
    if (!navigator.geolocation) {
      setLoading(false);
      setError(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => fetchEnvironmentData(pos.coords.latitude, pos.coords.longitude),
      () => {
        setError(true);
        setLoading(false);
        toast.error("Location access needed for Air Quality index");
      }
    );
  };

  useEffect(() => {
    fetchDefaultLocation();
  }, []);

  // 10-minute inactivity revert
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    // If we're looking at a custom location, start a 10-minute timer to revert to Current Location
    if (aqiData?.locationName && aqiData.locationName !== "Current Location") {
      timeoutRef.current = setTimeout(() => {
        toast("Returning to Current Location due to inactivity.");
        setLoading(true);
        fetchDefaultLocation();
      }, 10 * 60 * 1000); // 10 minutes
    }
    
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [aqiData?.locationName, searchQuery]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    if (searchesLeft <= 0) {
      toast.error("You have reached your daily limit of 5 manual AQI checks.");
      return;
    }

    setSearchLoading(true);
    incrementSearchTracker();

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`);
      const data = await res.json();
      if (!data || data.length === 0) {
        toast.error("Location not found");
        setSearchLoading(false);
        return;
      }
      
      const loc = data[0];
      await fetchEnvironmentData(parseFloat(loc.lat), parseFloat(loc.lon), loc.display_name.split(",")[0]);
      setSearchQuery("");
    } catch {
      toast.error("Failed to search location");
      setSearchLoading(false);
    }
  };

  const renderPollutant = (code: string) => {
    const p = aqiData?.pollutants?.find((x) => x.code === code);
    return (
      <div className="flex justify-between items-center bg-muted/40 p-2 rounded-md">
        <span className="text-xs font-semibold uppercase">{p?.displayName || code}</span>
        <span className="text-xs font-mono">{p ? `${p.concentration.value.toFixed(1)}` : "--"}</span>
      </div>
    );
  };

  if (error && !aqiData) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-all",
            loading ? "opacity-50 cursor-wait" : ""
          )}
          aria-label="Air Quality Index"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-primary-foreground" />
          ) : (
            <>
              <Wind className={cn("w-4 h-4", aqiData?.aqi && aqiData.aqi < 50 ? "text-emerald-400" : aqiData?.aqi && aqiData.aqi < 100 ? "text-yellow-400" : "text-red-400")} />
              {aqiData?.temp !== undefined && (
                <span className="text-sm font-semibold tracking-wide text-primary-foreground mr-1">
                  {Math.round(aqiData.temp)}°
                </span>
              )}
            </>
          )}
          <span className="text-sm font-semibold tracking-wide text-primary-foreground">
            {loading ? "AQI" : aqiData?.aqiDisplay || "--"}
          </span>
        </button>
      </PopoverTrigger>
      {!loading && aqiData && (
        <PopoverContent align="end" className="w-[320px] p-0 overflow-hidden divide-y divide-border">
          
          {/* Header & Main Readout */}
          <div className="p-4 bg-card">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <p
                className={cn("text-xs text-muted-foreground truncate font-medium", role === "guardian" && "cursor-pointer underline")}
                onClick={() => { if (role === "guardian") toast.info("Subscribe as a User"); }}
              >{aqiData.locationName}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-14 h-14 rounded-full flex flex-col items-center justify-center text-white shrink-0 shadow-inner",
                aqiData.aqi < 50 ? "bg-emerald-500" : aqiData.aqi < 100 ? "bg-yellow-500" : "bg-red-500"
              )}>
                <span className="text-xl font-bold leading-none">{aqiData.aqiDisplay}</span>
                <span className="text-[10px] opacity-90 font-medium">AQI</span>
              </div>
              <div>
                <p className="font-bold text-base leading-tight">{aqiData.category}</p>
                {aqiData.temp !== undefined && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Thermometer className="w-3.5 h-3.5" />
                    {aqiData.temp}°C
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Health Recommendation */}
          {aqiData.elderlyRecommendation && (
            <div className="px-4 py-3 bg-muted/30">
              <p className="text-xs leading-relaxed text-muted-foreground">
                <strong className="text-foreground">Seniors Advisory:</strong> {aqiData.elderlyRecommendation}
              </p>
            </div>
          )}

          {/* Detailed Pollutants */}
          <div className="p-4">
            <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider flex justify-between">
              Pollutants <span>(µg/m³ or ppb)</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              {renderPollutant("pm25")}
              {renderPollutant("pm10")}
              {renderPollutant("co")}
              {renderPollutant("so2")}
              {renderPollutant("no2")}
              {renderPollutant("o3")}
            </div>
          </div>

          {/* Search Bar */}
          {role !== "guardian" && (
          <div className="p-3 bg-muted/20">
            <form onSubmit={handleSearch} className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <p className="text-xs text-muted-foreground font-medium">Search Location</p>
                <p className="text-[10px] text-muted-foreground">{searchesLeft}/5 left today</p>
              </div>
              <div className="flex gap-2">
                <Input 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g., London, Tokyo..." 
                  className="h-8 text-xs"
                  disabled={searchLoading || searchesLeft <= 0}
                />
                <Button 
                  type="submit" 
                  size="sm" 
                  className="h-8 px-3" 
                  disabled={searchLoading || searchesLeft <= 0 || !searchQuery.trim()}
                >
                  {searchLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </form>
          </div>
          )}
          
        </PopoverContent>
      )}
    </Popover>
  );
};

export default AQIWidget;
