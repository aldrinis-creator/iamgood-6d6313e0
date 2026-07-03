import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { SleepSchedule } from "@/hooks/useUserSettings";

interface NapModeDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (schedule: SleepSchedule, durationMins: number) => void;
  defaultDurationMins: number;
}

const NapModeDialog = ({ open, onClose, onSave, defaultDurationMins }: NapModeDialogProps) => {
  const [durationMins, setDurationMins] = useState<number>(defaultDurationMins);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    if (open) {
      setDurationMins(defaultDurationMins);
      setCurrentTime(new Date());
    }
  }, [open, defaultDurationMins]);

  const handleSave = () => {
    const now = new Date();
    const fromStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    
    now.setMinutes(now.getMinutes() + durationMins);
    const toStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    onSave({ from: fromStr, to: toStr }, durationMins);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg text-foreground">
            <span className="text-xl">💤</span>
            Nap Mode
          </DialogTitle>
        </DialogHeader>

        {currentTime && (
          <div className="bg-primary/10 rounded-lg p-3 mt-2 flex items-center justify-between border border-primary/20">
            <span className="text-sm font-medium text-t1 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Daily Nap Start Time
            </span>
            <span className="text-sm font-bold text-primary">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}

        <p className="text-sm text-t2 mt-3">
          How long would you like to nap? During this time, you won't receive check-in reminders or alerts. This will repeat daily.
        </p>

        <div className="grid grid-cols-2 gap-3 mt-3">
          {[15, 30, 60, 120].map((mins) => (
            <Button
              key={mins}
              variant={durationMins === mins ? "default" : "outline"}
              className={durationMins === mins ? "bg-navy-card text-t1 border border-primary" : "text-t2 border-white/10 hover:text-t1"}
              onClick={() => setDurationMins(mins)}
            >
              {mins === 60 ? "1 Hour" : mins === 120 ? "2 Hours" : `${mins} Mins`}
            </Button>
          ))}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <Button variant="outline" className="text-t2 border-white/10" onClick={onClose}>Cancel</Button>
          <Button className="bg-primary text-primary-foreground" onClick={handleSave}>Take a Nap</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NapModeDialog;
