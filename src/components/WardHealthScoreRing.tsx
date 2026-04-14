import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface WardHealthScoreRingProps {
  wardUserId: string;
}

const WardHealthScoreRing = ({ wardUserId }: WardHealthScoreRingProps) => {
  const [score, setScore] = useState<number | null>(null);

  const fetchScore = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("health_passport_scores")
      .select("overall")
      .eq("user_id", wardUserId)
      .eq("score_date", today)
      .maybeSingle();
    setScore(data?.overall ?? null);
  }, [wardUserId]);

  useEffect(() => {
    fetchScore();
    const interval = setInterval(fetchScore, 60000);
    return () => clearInterval(interval);
  }, [fetchScore]);

  if (score === null) return null;

  const color = score >= 70
    ? "hsl(var(--success))"
    : score >= 40
    ? "hsl(38 92% 50%)"
    : "hsl(var(--destructive))";

  const label = score >= 70 ? "Great" : score >= 40 ? "Steady" : "Needs Attention";
  const circumference = 2 * Math.PI * 18; // r=18

  return (
    <div className="flex items-center gap-2">
      <div className="relative w-12 h-12 shrink-0">
        <svg className="w-12 h-12 -rotate-90" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r="18" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
          <circle
            cx="22" cy="22" r="18"
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeDasharray={`${(score / 100) * circumference} ${circumference}`}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold">{score}</span>
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground leading-tight">Health</p>
        <p className={`text-xs font-semibold leading-tight ${
          score >= 70 ? "text-success" : score >= 40 ? "text-amber-500" : "text-destructive"
        }`}>
          {label}
        </p>
      </div>
    </div>
  );
};

export default WardHealthScoreRing;
