import { useEffect, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { Phone, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const EmergencyModeOverlay = () => {
  const { emergencyMode, cancelSOS } = useApp();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!emergencyMode) {
      setCountdown(5);
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [emergencyMode]);

  if (!emergencyMode) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-sos flex flex-col items-center justify-center text-sos-foreground p-6">
      <div className="text-center space-y-6">
        <div className="w-24 h-24 rounded-full border-4 border-sos-foreground flex items-center justify-center mx-auto animate-sos-pulse">
          <span className="text-4xl font-bold">{countdown}</span>
        </div>

        <h1 className="text-3xl font-bold">EMERGENCY SOS</h1>

        {countdown > 0 ? (
          <>
            <p className="text-xl">
              Alerting guardians in {countdown} seconds...
            </p>
            <Button
              onClick={cancelSOS}
              variant="outline"
              size="lg"
              className="bg-transparent border-2 border-sos-foreground text-sos-foreground hover:bg-sos-foreground hover:text-sos text-lg px-8 py-6"
            >
              <X className="w-5 h-5 mr-2" />
              Cancel SOS
            </Button>
          </>
        ) : (
          <div className="space-y-4">
            <p className="text-xl font-semibold">🚨 Alert Sent to Guardians</p>
            <p className="text-lg opacity-90">
              Your live location and medical data have been shared.
            </p>
            <div className="flex gap-3 justify-center mt-6">
              <a href="tel:112">
                <Button
                  variant="outline"
                  className="bg-transparent border-2 border-sos-foreground text-sos-foreground hover:bg-sos-foreground hover:text-sos"
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Call 112
                </Button>
              </a>
              <Button
                variant="outline"
                className="bg-transparent border-2 border-sos-foreground text-sos-foreground hover:bg-sos-foreground hover:text-sos"
                onClick={() => {
                  if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition((pos) => {
                      const { latitude, longitude } = pos.coords;
                      window.open(`https://www.google.com/maps?q=${latitude},${longitude}`, "_blank");
                    });
                  }
                }}
              >
                <MapPin className="w-4 h-4 mr-2" />
                Share Location
              </Button>
            </div>
            <Button
              onClick={cancelSOS}
              variant="ghost"
              className="text-sos-foreground/80 hover:text-sos-foreground mt-4"
            >
              I'm Safe — Cancel Alert
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmergencyModeOverlay;
