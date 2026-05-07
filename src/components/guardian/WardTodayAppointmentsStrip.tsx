import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, isToday, parseISO } from "date-fns";

interface Props {
  wardUserId: string;
  wardName: string;
}

interface Appt {
  id: string;
  title: string;
  start_date: string;
  start_time: string;
  created_by: string | null;
}

const WardTodayAppointmentsStrip = ({ wardUserId, wardName }: Props) => {
  const navigate = useNavigate();
  const [appts, setAppts] = useState<Appt[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);
      const { data } = await supabase
        .from("appointments")
        .select("id, title, start_date, start_time, created_by")
        .eq("user_id", wardUserId)
        .eq("start_date", todayStr)
        .order("start_time", { ascending: true });
      if (!cancelled && data) setAppts(data as Appt[]);
    };
    load();

    const channel = supabase
      .channel(`appts-${wardUserId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `user_id=eq.${wardUserId}` },
        () => load()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [wardUserId]);

  if (!appts.length) return null;

  const next = appts.find((a) => isToday(parseISO(a.start_date))) || appts[0];

  return (
    <Card
      className="cursor-pointer hover:border-primary/40 transition-colors"
      onClick={() => navigate("/guardian/appointments")}
    >
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <CalendarDays className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold truncate">Today's Appointments</p>
            <Badge variant="secondary" className="text-xs shrink-0">{appts.length}</Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            Next: {next.title} · {next.start_time?.slice(0, 5)}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" tabIndex={-1}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </CardContent>
    </Card>
  );
};

export default WardTodayAppointmentsStrip;
