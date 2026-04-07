import { AlertTriangle, Flag, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface JourneyAlertOverlayProps {
  type: "arriving" | "deviation";
  message: string;
  onDismiss: () => void;
}

const JourneyAlertOverlay = ({ type, message, onDismiss }: JourneyAlertOverlayProps) => {
  const isDeviation = type === "deviation";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-2xl shadow-2xl w-[90%] max-w-sm mx-auto p-6 text-center space-y-4">
        <div className="flex justify-end">
          <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex flex-col items-center gap-3">
          {isDeviation ? (
            <AlertTriangle className="w-12 h-12 text-destructive" />
          ) : (
            <Flag className="w-12 h-12 text-primary" />
          )}
          <h2 className="text-xl font-bold">
            {isDeviation ? "⚠️ Route Deviation" : "🏁 Arriving Soon"}
          </h2>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <Button onClick={onDismiss} className="w-full" variant={isDeviation ? "destructive" : "default"}>
          Acknowledged
        </Button>
      </div>
    </div>
  );
};

export default JourneyAlertOverlay;
