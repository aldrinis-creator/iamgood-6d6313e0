import { useState, useEffect } from "react";
import { ensureAudioReady } from "@/lib/audioAlerts";
import { Volume2, VolumeX, CheckCircle2 } from "lucide-react";

const AudioUnlocker = () => {
  const [unlocked, setUnlocked] = useState(false);
  const [show, setShow] = useState(true);

  useEffect(() => {
    // If the browser already reports context running, we might be okay,
    // but we still want explicit user interaction if possible.
    // A simple check on mount isn't perfectly reliable, so we default to showing the button.
    const hasUnlocked = sessionStorage.getItem("audio_unlocked") === "true";
    if (hasUnlocked) {
      setUnlocked(true);
      setShow(false);
    }
  }, []);

  const handleUnlock = async () => {
    const isReady = await ensureAudioReady();
    if (isReady) {
      setUnlocked(true);
      sessionStorage.setItem("audio_unlocked", "true");
      // Hide after a brief success animation
      setTimeout(() => setShow(false), 2000);
    }
  };

  if (!show) return null;

  return (
    <div className={`transition-all duration-500 overflow-hidden ${unlocked ? 'bg-success/10 border-success/30' : 'bg-primary/10 border-primary/30'} border rounded-xl p-3 mb-4 flex items-center justify-between`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-full ${unlocked ? 'bg-success/20 text-success' : 'bg-primary/20 text-primary'}`}>
          {unlocked ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </div>
        <div>
          <h3 className={`text-sm font-semibold ${unlocked ? 'text-success' : 'text-primary'}`}>
            {unlocked ? "Audio Ready" : "Start My Day"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {unlocked ? "Voice alerts are active." : "Tap to enable voice alerts."}
          </p>
        </div>
      </div>
      {!unlocked ? (
        <button
          onClick={handleUnlock}
          className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
        >
          Enable Audio
        </button>
      ) : (
        <CheckCircle2 className="w-6 h-6 text-success animate-in zoom-in duration-300" />
      )}
    </div>
  );
};

export default AudioUnlocker;
