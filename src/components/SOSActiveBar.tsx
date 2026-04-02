import { useState } from "react";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/contexts/AppContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const SOSActiveBar = () => {
  const { emergencyMode, cancelSOS } = useApp();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!emergencyMode) return null;

  return (
    <>
      <div className="bg-destructive text-destructive-foreground px-4 py-3 flex items-center justify-between animate-pulse">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          <span className="font-bold text-sm">SOS ACTIVE</span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="gap-1.5 font-semibold"
          onClick={() => setConfirmOpen(true)}
        >
          <ShieldCheck className="w-4 h-4" />
          I'm Safe
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you safe?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel your active SOS alert and notify your guardians that you are safe.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep SOS Active</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                cancelSOS();
                setConfirmOpen(false);
              }}
            >
              Yes, I'm Safe
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default SOSActiveBar;
