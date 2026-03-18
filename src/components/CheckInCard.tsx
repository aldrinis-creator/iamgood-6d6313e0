import { useState, useEffect } from "react";
import { Heart, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useApp } from "@/contexts/AppContext";

const CheckInCard = () => {
  const { userName } = useApp();
  const [isCheckInTime, setIsCheckInTime] = useState(true);
  const [checkedIn, setCheckedIn] = useState(false);
  const [timeLeft, setTimeLeft] = useState("09:42");

  const checkInTimes = ["7:00 AM", "12:00 PM", "7:00 PM"];

  const getNextCheckIn = () => {
    const now = new Date();
    const hours = now.getHours();
    if (hours < 7) return "7:00 AM";
    if (hours < 12) return "12:00 PM";
    if (hours < 19) return "7:00 PM";
    return "7:00 AM (Tomorrow)";
  };

  useEffect(() => {
    if (checkedIn) return;
    const interval = setInterval(() => {
      const mins = Math.floor(Math.random() * 10);
      const secs = Math.floor(Math.random() * 60);
      setTimeLeft(`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [checkedIn]);

  const handleCheckIn = () => {
    setCheckedIn(true);
    setIsCheckInTime(false);
  };

  return (
    <Card className="border border-border bg-card shadow-sm">
      <CardContent className="p-4">
        {!checkedIn ? (
          <div className="text-center space-y-3">
            <p className="text-accessible font-semibold text-foreground">
              {userName}, did you Check-In today?
            </p>
            <button
              onClick={handleCheckIn}
              className="relative w-28 h-28 mx-auto flex items-center justify-center animate-pulse-heart"
              aria-label="Check in - I'm okay"
              style={{
                background: 'radial-gradient(circle, hsl(0 0% 100%) 30%, hsl(0 84% 60% / 0.15) 60%, transparent 80%)',
              }}
            >
              <Heart className="w-16 h-16 text-sos fill-current drop-shadow-lg" />
            </button>
            <p className="text-sm text-muted-foreground">
              Tap the heart to Check-iN
            </p>
            <p className="text-sm text-muted-foreground">
              Next check-in: {getNextCheckIn()} • <span className="font-semibold text-sos">{timeLeft}</span> remaining
            </p>
          </div>
        ) : (
          <div className="text-center space-y-3">
            <div
              className="relative w-24 h-24 mx-auto flex items-center justify-center"
              style={{
                background: 'radial-gradient(circle, hsl(0 0% 100%) 30%, hsl(160 84% 39% / 0.15) 60%, transparent 80%)',
              }}
            >
              <Heart className="w-12 h-12 text-success fill-current" />
            </div>
            <p className="text-accessible font-semibold text-success">✓ Checked In!</p>
            <p className="text-sm text-muted-foreground">
              Next Check-iN: {getNextCheckIn()}
            </p>
          </div>
        )}

        <div className="mt-4 flex gap-2 justify-center">
          {checkInTimes.map((time) => (
            <span
              key={time}
              className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium"
            >
              {time}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default CheckInCard;
