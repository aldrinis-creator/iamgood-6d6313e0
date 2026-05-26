import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface WardInactivityPopupProps {
  open: boolean;
  wardName: string;
  onDismiss: () => void;
}

const WardInactivityPopup = ({ open, wardName, onDismiss }: WardInactivityPopupProps) => {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onDismiss(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <DialogTitle className="text-center">No activity for 1 hour</DialogTitle>
          <DialogDescription className="text-center">
            Hello! We have not had any active signal from your Ward{" "}
            <span className="font-semibold text-foreground">{wardName}</span>{" "}
            for the past one hour. Please check on them.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onDismiss} className="w-full">Dismiss</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WardInactivityPopup;
