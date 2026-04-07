import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Clock, Coffee, AlertTriangle, Calendar } from "lucide-react";
import { format } from "date-fns";

interface JourneyReport {
  id: string;
  started_at: string;
  ended_at: string;
  origin_name: string | null;
  destination_name: string;
  transport_mode: string | null;
  total_distance_m: number;
  total_duration_min: number;
  break_duration_min: number;
  deviation_count: number;
  max_deviation_m: number;
}

const JourneyReportCard = ({ report }: { report: JourneyReport }) => {
  const distKm = (report.total_distance_m / 1000).toFixed(1);
  const durMin = Math.round(report.total_duration_min);
  const breakMin = Math.round(report.break_duration_min);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold">{report.destination_name.split(",")[0]}</p>
            {report.origin_name && (
              <p className="text-xs text-muted-foreground">From: {report.origin_name.split(",")[0]}</p>
            )}
          </div>
          {report.transport_mode && (
            <span className="text-xs bg-muted px-2 py-0.5 rounded-full capitalize">{report.transport_mode}</span>
          )}
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="w-3 h-3" />
          {format(new Date(report.started_at), "dd MMM yyyy, hh:mm a")} → {format(new Date(report.ended_at), "hh:mm a")}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1.5 text-sm">
            <MapPin className="w-3.5 h-3.5 text-primary" />
            <span>{distKm} km</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span>{durMin} min</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <Coffee className="w-3.5 h-3.5 text-muted-foreground" />
            <span>{breakMin} min break</span>
          </div>
          {report.deviation_count > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{report.deviation_count}× ({Math.round(report.max_deviation_m)}m max)</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default JourneyReportCard;
