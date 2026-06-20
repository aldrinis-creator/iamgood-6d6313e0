import { useEffect } from "react";
import { Phone, PhoneOff, User } from "lucide-react";
import { startCallRinger, stopCallRinger } from "@/lib/callRinger";

interface Props {
  open: boolean;
  wardName: string;
  wardPhone?: string | null;
  onDismiss: () => void;
}

const normalizePhone = (raw: string) => {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (raw.startsWith("+")) return raw;
  return `+${digits}`;
};

const IncomingCallOverlay = ({ open, wardName, wardPhone, onDismiss }: Props) => {
  useEffect(() => {
    if (!open) return;
    startCallRinger();
    // Auto-stop after 45s
    const t = window.setTimeout(() => {
      stopCallRinger();
      onDismiss();
    }, 45000);
    return () => {
      window.clearTimeout(t);
      stopCallRinger();
    };
  }, [open, onDismiss]);

  if (!open) return null;

  const handleAnswer = () => {
    stopCallRinger();
    if (wardPhone) {
      const tel = normalizePhone(wardPhone);
      const a = document.createElement("a");
      a.href = `tel:${tel}`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    onDismiss();
  };

  const handleDismiss = () => {
    stopCallRinger();
    onDismiss();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-b from-primary to-primary/80 flex flex-col items-center justify-between py-16 px-6 animate-in fade-in">
      <div className="flex flex-col items-center text-white">
        <p className="text-sm opacity-80 mb-2">Incoming call</p>
        <div className="w-32 h-32 rounded-full bg-white/20 flex items-center justify-center mb-6 animate-pulse">
          <User className="w-16 h-16 text-white" />
        </div>
        <h2 className="text-2xl font-bold mb-1">{wardName}</h2>
        <p className="text-sm opacity-80">is calling you…</p>
      </div>

      <div className="flex items-center gap-12">
        <button
          onClick={handleDismiss}
          className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          aria-label="Dismiss call"
        >
          <PhoneOff className="w-7 h-7 text-white" />
        </button>
        <button
          onClick={handleAnswer}
          disabled={!wardPhone}
          className="w-16 h-16 rounded-full bg-success flex items-center justify-center shadow-lg active:scale-95 transition-transform disabled:opacity-50"
          aria-label="Call back"
        >
          <Phone className="w-7 h-7 text-white" />
        </button>
      </div>
      <p className="text-white/70 text-xs">
        {wardPhone ? "Tap green to call back" : "Open the ward profile to call back"}
      </p>
    </div>
  );
};

export default IncomingCallOverlay;
