import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface NapModeDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (durationMins: number) => void;
  defaultDurationMins: number;
}

const NapModeDialog = ({ open, onClose, onSave, defaultDurationMins }: NapModeDialogProps) => {
  const [durationMins, setDurationMins] = useState<number>(defaultDurationMins);

  useEffect(() => {
    if (open) {
      setDurationMins(defaultDurationMins);
    }
  }, [open, defaultDurationMins]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg text-foreground">
            <span className="text-xl">💤</span>
            Nap Mode
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-t2">
          How long would you like to nap? During this time, you won't receive check-in reminders or alerts.
        </p>

        <div className="grid grid-cols-2 gap-3 mt-2">
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

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" className="text-t2 border-white/10" onClick={onClose}>Cancel</Button>
          <Button className="bg-primary text-primary-foreground" onClick={() => onSave(durationMins)}>Take a Nap</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NapModeDialog;
