import { Card, CardContent } from "@/components/ui/card";
import { Activity, Pill, TrendingUp } from "lucide-react";

const HealthDashboard = () => {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 text-center">
          <Activity className="w-8 h-8 text-primary mx-auto mb-2" />
          <p className="text-2xl font-bold text-primary">72</p>
          <p className="text-xs text-muted-foreground">Wellness Score</p>
          <div className="flex items-center justify-center gap-1 mt-1">
            <TrendingUp className="w-3 h-3 text-success" />
            <span className="text-xs text-success">+5%</span>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-success/5 border-success/20">
        <CardContent className="p-4 text-center">
          <Pill className="w-8 h-8 text-success mx-auto mb-2" />
          <p className="text-2xl font-bold text-success">85%</p>
          <p className="text-xs text-muted-foreground">Meds Adherence</p>
          <p className="text-xs text-muted-foreground mt-1">2 of 3 taken today</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default HealthDashboard;
