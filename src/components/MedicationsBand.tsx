import { Pill, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import useRefillDue from "@/hooks/useRefillDue";
import useMedicationDue from "@/hooks/useMedicationDue";

/**
 * Always-visible Medications shortcut band on the Ward's Home dashboard.
 * Calm accent normally; warning colours + "!" marker when a dose is pending
 * or a refill is running low. Taps through to the medications list.
 */
const MedicationsBand = () => {
  const navigate = useNavigate();
  const refillDue = useRefillDue();
  const medDue = useMedicationDue();
  const alert = refillDue || medDue;

  const label = alert
    ? medDue
      ? "A tablet is still due today"
      : "Refill running low"
    : "Today's tablets";

  return (
    <button
      onClick={() => navigate("/my-health?tool=Tablets")}
      aria-label="Medications"
      className={`w-full rounded-2xl py-5 px-5 flex items-center gap-4 shadow-md active:scale-[0.98] transition-transform border ${
        alert
          ? "bg-destructive/10 border-destructive/50"
          : "bg-primary/10 border-primary/30"
      }`}
    >
      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
          alert ? "bg-destructive/20" : "bg-primary/20"
        }`}
      >
        <Pill className={`w-7 h-7 ${alert ? "text-destructive" : "text-primary"}`} />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-xl font-bold flex items-center gap-2">
          Medications
          {alert && (
            <span className="min-w-[20px] h-[20px] px-1 text-[12px] font-bold bg-destructive text-destructive-foreground rounded-full flex items-center justify-center animate-pulse">
              !
            </span>
          )}
        </p>
        <p className={`text-base ${alert ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
          {label}
        </p>
      </div>
      <ChevronRight className={`w-5 h-5 shrink-0 ${alert ? "text-destructive" : "text-muted-foreground"}`} />
    </button>
  );
};

export default MedicationsBand;
