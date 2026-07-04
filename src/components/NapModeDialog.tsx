import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SleepSchedule } from "@/hooks/useUserSettings";

interface NapModeDialogProps {
  open: boolean;
  onClose: () => void;
  currentSchedule: SleepSchedule | null;
  isActive: boolean;
  onSave: (schedule: SleepSchedule) => void;
}

const NapModeDialog = ({ open, onClose, currentSchedule, isActive, onSave }: NapModeDialogProps) => {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    if (open) {
      if (currentSchedule) {
        setFrom(currentSchedule.from);
        setTo(currentSchedule.to);
      } else {
        const now = new Date();
        const fromStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        now.setMinutes(now.getMinutes() + 60); // Default to 1 hour
        const toStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        setFrom(fromStr);
        setTo(toStr);
      }
    }
  }, [open, currentSchedule]);

  const handleSave = () => {
    onSave({ from, to });
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

        <p className="text-sm text-t2 mt-1">
          Set your daily nap hours. During this time, you won't receive check-in reminders or alerts. This will repeat daily.
        </p>

        <div className="grid grid-cols-2 gap-4 mt-2">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1 text-sm text-t1">
              <Clock className="w-3.5 h-3.5 text-primary" /> From
            </Label>
            <Input
              type="time"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="text-sm bg-navy-card border-white/10 text-t1"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1 text-sm text-t1">
              <Clock className="w-3.5 h-3.5 text-primary" /> To
            </Label>
            <Input
              type="time"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="text-sm bg-navy-card border-white/10 text-t1"
            />
          </div>
        </div>

        <div className="bg-primary/5 rounded-lg p-3 mt-4 space-y-1 border border-primary/10">
          <p className="text-sm font-medium text-t1">
            Current setting: {from} to {to}
          </p>
          {isActive && (
            <p className="text-sm text-success flex items-center gap-1">
              ✓ Nap mode is currently active
            </p>
          )}
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
