import { useState, useEffect } from "react";
import { Wind, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const API_KEY = "AIzaSyCQuBmmLMKvQwqD4ydUL8DA8sZ7sIQtLX8";

interface AQIData {
  aqi: number;
  aqiDisplay: string;
  category: string;
  dominantPollutant: string;
}

const AQIWidget = () => {
  const [aqiData, setAqiData] = useState<AQIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLoading(false);
      setError(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(`https://airquality.googleapis.com/v1/currentConditions:lookup?key=${API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
              },
            }),
          });
          const data = await res.json();
          const uaqi = data.indexes?.find((idx: any) => idx.code === "uaqi");
          if (uaqi) {
            setAqiData(uaqi);
          } else {
            setError(true);
          }
        } catch {
          setError(true);
        } finally {
          setLoading(false);
        }
      },
      () => {
        setError(true);
        setLoading(false);
        toast.error("Location access needed for Air Quality index");
      }
    );
  }, []);

  if (error) return null;

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
            <Wind className={cn("w-4 h-4", aqiData?.aqi && aqiData.aqi < 50 ? "text-emerald-400" : aqiData?.aqi && aqiData.aqi < 100 ? "text-yellow-400" : "text-red-400")} />
          )}
          <span className="text-sm font-semibold tracking-wide text-primary-foreground">
            {loading ? "AQI" : aqiData?.aqiDisplay || "--"}
          </span>
        </button>
      </PopoverTrigger>
      {!loading && aqiData && (
        <PopoverContent align="end" className="w-[280px] p-4 space-y-3">
          <div className="flex items-center gap-3 border-b border-border pb-3">
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-white",
              aqiData.aqi < 50 ? "bg-emerald-500" : aqiData.aqi < 100 ? "bg-yellow-500" : "bg-red-500"
            )}>
              {aqiData.aqiDisplay}
            </div>
            <div>
              <p className="font-semibold">{aqiData.category}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Current Air Quality</p>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            <p><strong>Primary Pollutant:</strong> {aqiData.dominantPollutant.toUpperCase()}</p>
            <p className="mt-2 text-xs">
              {aqiData.aqi < 50 
                ? "Air quality is considered satisfactory, and air pollution poses little or no risk."
                : aqiData.aqi < 100 
                ? "Air quality is acceptable. However, there may be a risk for some people, particularly those who are unusually sensitive to air pollution."
                : "Members of sensitive groups may experience health effects. The general public is less likely to be affected."}
            </p>
          </div>
        </PopoverContent>
      )}
    </Popover>
  );
};

export default AQIWidget;
