import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";

const categories = [
  { name: "Check-iN", score: 90, max: 100, color: "bg-success" },
  { name: "Face Scan", score: 0, max: 100, color: "bg-muted", action: "Start Scan" },
  { name: "Activity", score: 65, max: 100, color: "bg-primary" },
  { name: "Wellness", score: 72, max: 100, color: "bg-success" },
  { name: "Medications", score: 85, max: 100, color: "bg-primary" },
];

const HealthPassport = () => {
  const overallScore = 78;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Health Passport</span>
          <span className="text-sm font-normal text-muted-foreground">Daily Score</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score Ring */}
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-20">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
              <circle
                cx="40" cy="40" r="34"
                fill="none"
                stroke="hsl(var(--success))"
                strokeWidth="8"
                strokeDasharray={`${(overallScore / 100) * 213.6} 213.6`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-bold">{overallScore}</span>
            </div>
          </div>
          <div>
            <p className="text-accessible font-semibold">{overallScore}/100</p>
            <p className="text-sm text-success font-medium">↗ Steady</p>
            <p className="text-xs text-muted-foreground">Updated just now</p>
          </div>
        </div>

        {/* Category Rows */}
        <div className="space-y-2">
          {categories.map((cat) => (
            <div key={cat.name} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{cat.name}</span>
                  <span className="text-sm text-muted-foreground">{cat.score}/{cat.max}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${cat.color} transition-all`}
                    style={{ width: `${cat.score}%` }}
                  />
                </div>
              </div>
              {cat.action ? (
                <button className="ml-3 text-xs text-primary font-medium flex items-center">
                  {cat.action} <ChevronRight className="w-3 h-3" />
                </button>
              ) : (
                <ChevronRight className="ml-3 w-4 h-4 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default HealthPassport;
