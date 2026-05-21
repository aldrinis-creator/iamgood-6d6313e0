import { useEffect, useState, useCallback, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatISTDateTime } from "@/lib/istTime";
import { speak, stopSpeaking, ensureAudioReady } from "@/lib/audioAlerts";

export interface BriefingData {
  userName: string;
  dateStr: string;
  timeStr: string;
  hasCheckins: boolean;
  medications: string[];
  refills: string[];
  appointments: string[];
}

let _briefingVisible = false;
export const isBriefingVisible = () => _briefingVisible;

export const showMorningBriefing = (data: BriefingData) => {
  const event = new CustomEvent<BriefingData>("SHOW_MORNING_BRIEFING", { detail: data });
  window.dispatchEvent(event);
};

export const hideMorningBriefing = () => {
  const event = new CustomEvent("HIDE_MORNING_BRIEFING");
  window.dispatchEvent(event);
};

const MorningBriefingOverlay = () => {
  const [visible, setVisible] = useState(false);
  const [data, setData] = useState<BriefingData | null>(null);
  const autoDismissRef = useRef<ReturnType<typeof setTimeout>>();

  const dismiss = useCallback(() => {
    if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    stopSpeaking();
    setVisible(false);
    _briefingVisible = false;
    setTimeout(() => setData(null), 300);
  }, []);

  const handleShow = useCallback(async (e: Event) => {
    const detail = (e as CustomEvent<BriefingData>).detail;
    setData(detail);
    setVisible(true);
    _briefingVisible = true;
    
    // Unlock audio context explicitly before speaking
    await ensureAudioReady();

    // Construct the spoken text
    let speech = `Hello ${detail.userName}. Today is ${detail.dateStr}, ${detail.timeStr}. We like to remind you the following: `;
    
    if (detail.hasCheckins) {
      speech += "Please Check-in at the appointed times. ";
    }
    
    if (detail.medications.length > 0) {
      speech += "Take your Medications that are due as per the set time. ";
    }
    
    if (detail.refills.length > 0) {
      speech += `Please refill your Medication Stocks for ${detail.refills.join(', ')}. `;
    }
    
    if (detail.appointments.length > 0) {
      speech += `You have an appointment today at ${detail.appointments[0]}. `;
    }
    
    speech += "Don't forget to drink adequate water. We wish you a great day.";

    try {
      await speak(speech);
      // Wait 30 seconds after audio finishes
      autoDismissRef.current = setTimeout(() => {
        dismiss();
      }, 30000);
    } catch {
      // Fallback if speak fails: wait 30 seconds
      autoDismissRef.current = setTimeout(() => {
        dismiss();
      }, 30000);
    }
  }, [dismiss]);

  const handleHide = useCallback(() => dismiss(), [dismiss]);

  useEffect(() => {
    window.addEventListener("SHOW_MORNING_BRIEFING", handleShow as EventListener);
    window.addEventListener("HIDE_MORNING_BRIEFING", handleHide);
    return () => {
      window.removeEventListener("SHOW_MORNING_BRIEFING", handleShow as EventListener);
      window.removeEventListener("HIDE_MORNING_BRIEFING", handleHide);
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    };
  }, [handleShow, handleHide]);

  if (!visible || !data) return null;

  return (
    <Dialog open={visible} onOpenChange={(open) => !open && dismiss()}>
      <DialogContent className="sm:max-w-md bg-gradient-to-br from-indigo-50 to-white dark:from-slate-900 dark:to-slate-800 border-2 border-indigo-200 dark:border-indigo-800 shadow-2xl p-6 rounded-2xl max-w-[90vw] mx-auto overflow-hidden animate-in zoom-in-95 fade-in-0 duration-300">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center shadow-inner">
            <span className="text-3xl">🌅</span>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
              Good Morning, {data.userName}
            </h2>
            <p className="text-xl font-medium text-indigo-600 dark:text-indigo-400">
              {data.dateStr} • {data.timeStr}
            </p>
          </div>

          <div className="w-full text-left bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-xl p-5 shadow-sm space-y-4 border border-slate-100 dark:border-slate-700">
            <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200 mb-3">
              Today's Reminders:
            </h3>
            
            <ul className="space-y-3 text-lg text-slate-600 dark:text-slate-300">
              {data.hasCheckins && (
                <li className="flex items-start gap-3">
                  <span className="text-indigo-500 mt-1">✓</span>
                  <span>Please <strong>Check-in</strong> at the appointed times.</span>
                </li>
              )}
              
              {data.medications.length > 0 && (
                <li className="flex items-start gap-3">
                  <span className="text-indigo-500 mt-1">💊</span>
                  <span>Take your <strong>Medications</strong> that are due as per the set time.</span>
                </li>
              )}

              {data.refills.length > 0 && (
                <li className="flex items-start gap-3">
                  <span className="text-amber-500 mt-1">⚠️</span>
                  <span>Please refill your Medication Stocks for: <br/><strong>{data.refills.join(', ')}</strong></span>
                </li>
              )}

              {data.appointments.length > 0 && (
                <li className="flex items-start gap-3">
                  <span className="text-indigo-500 mt-1">📅</span>
                  <span>You have an appointment today at <strong>{data.appointments[0]}</strong>.</span>
                </li>
              )}

              <li className="flex items-start gap-3">
                <span className="text-blue-500 mt-1">💧</span>
                <span>Don't forget to drink adequate water.</span>
              </li>
            </ul>
          </div>

          <p className="text-xl italic font-medium text-slate-500 dark:text-slate-400">
            We wish you a great day.
          </p>

          <div className="w-full space-y-2 mt-4">
            <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">
              This message will close automatically in 30 seconds, or you can tap Dismiss.
            </p>
            <Button 
              onClick={() => dismiss()} 
              className="w-full h-14 text-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition-all active:scale-95"
            >
              Dismiss
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MorningBriefingOverlay;
