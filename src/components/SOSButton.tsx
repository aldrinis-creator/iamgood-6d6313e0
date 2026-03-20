import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import SOSDialog from "@/components/SOSDialog";

const SOSButton = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-50 w-16 h-16 rounded-full bg-sos text-sos-foreground shadow-lg flex items-center justify-center animate-sos-pulse active:scale-95 transition-transform"
        aria-label="Emergency SOS"
      >
        <div className="text-center">
          <AlertTriangle className="w-6 h-6 mx-auto" />
          <span className="text-[10px] font-bold">SOS</span>
        </div>
      </button>
      <SOSDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
};

export default SOSButton;
