import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Clock, Coffee, AlertTriangle, Calendar, Trash2 } from "lucide-react";
import { formatISTDateTime, formatISTTime } from "@/lib/istTime";
import { Button } from "@/components/ui/button";

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

const JourneyReportCard = ({ report, onDelete }: { report: JourneyReport, onDelete?: (id: string) => void }) => {
  const distKm = (report.total_distance_m / 1000).toFixed(1);
  const durMin = Math.round(report.total_duration_min);
  const breakMin = Math.round(report.break_duration_min);

  return (
    <Card className="group relative">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="pr-8">
            <p className="text-sm font-semibold">{report.destination_name.split(",")[0]}</p>
            {report.origin_name && (
              <p className="text-xs text-muted-foreground">From: {report.origin_name.split(",")[0]}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            {report.transport_mode && (
              <span className="text-xs bg-muted px-2 py-0.5 rounded-full capitalize">{report.transport_mode}</span>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onDelete(report.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="w-3 h-3" />
          {formatISTDateTime(report.started_at)} → {formatISTTime(report.ended_at)}
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
