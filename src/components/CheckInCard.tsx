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
    <Card className="border-2 border-success/30 bg-success/5">
      <CardContent className="p-4">
        {!checkedIn ? (
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Check-iN Window Active</span>
            </div>
            <p className="text-accessible font-medium text-foreground">
              {userName}, are you Okay?
            </p>
            <button
              onClick={handleCheckIn}
              className="w-20 h-20 rounded-full bg-success text-success-foreground mx-auto flex items-center justify-center animate-pulse-heart shadow-lg"
              aria-label="Check in - I'm okay"
            >
              <Heart className="w-10 h-10 fill-current" />
            </button>
            <p className="text-sm text-muted-foreground">
              Tap the heart to Check-iN • <span className="font-semibold text-sos">{timeLeft}</span> remaining
            </p>
          </div>
        ) : (
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-full bg-success text-success-foreground mx-auto flex items-center justify-center">
              <Heart className="w-8 h-8 fill-current" />
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
