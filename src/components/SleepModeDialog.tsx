import { useState } from "react";
import { Moon, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SleepSchedule, DEFAULT_SLEEP_SCHEDULE } from "@/hooks/useUserSettings";

interface SleepModeDialogProps {
  open: boolean;
  onClose: () => void;
  currentSchedule?: SleepSchedule;
  isActive: boolean;
  onSave: (schedule: SleepSchedule) => void;
}

const SleepModeDialog = ({ open, onClose, currentSchedule, isActive, onSave }: SleepModeDialogProps) => {
  const [from, setFrom] = useState(currentSchedule?.from || DEFAULT_SLEEP_SCHEDULE.from);
  const [to, setTo] = useState(currentSchedule?.to || DEFAULT_SLEEP_SCHEDULE.to);

  const handleSave = () => {
    onSave({ from, to });
  };

  // Convert 24h to display
  const formatTime = (time24: string) => {
    const [h, m] = time24.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Moon className="w-5 h-5" />
            Sleep Mode Settings
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Set your sleep/rest hours. During this time, you won't receive check-in reminders or alerts.
        </p>

        <div className="grid grid-cols-2 gap-4 mt-2">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1 text-sm">
              <Clock className="w-3.5 h-3.5" /> From
            </Label>
            <Input
              type="time"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1 text-sm">
              <Clock className="w-3.5 h-3.5" /> To
            </Label>
            <Input
              type="time"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="text-sm"
            />
          </div>
        </div>

        <div className="bg-primary/5 rounded-lg p-3 mt-2 space-y-1">
          <p className="text-sm font-medium">
            Current setting: {from} to {to}
          </p>
          {isActive && (
            <p className="text-sm text-success flex items-center gap-1">
              ✓ Sleep mode is currently active
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Settings</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SleepModeDialog;
