import { useNavigate } from "react-router-dom";
import { ArrowLeft, Droplet, Stethoscope, UserPlus, BriefcaseMedical, Hospital, ChevronRight } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Tile = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  desc: string;
  route?: string;
};

const tiles: Tile[] = [
  { icon: Droplet, label: "Blood Tests", desc: "At-home blood sample collection" },
  { icon: Stethoscope, label: "Nurse-on-Call", desc: "Trained nurse visits at home" },
  { icon: UserPlus, label: "Attendant-at-Home", desc: "Personal care attendant" },
  { icon: BriefcaseMedical, label: "Doctor-on-Call", desc: "Doctor consultation at home" },
  { icon: Hospital, label: "Nearest Hospital Finder", desc: "Hospitals & dental clinics within 5 km", route: "/nearest-hospitals" },
];

const PersonalHealthcare = () => {
  const navigate = useNavigate();

  const handleClick = (t: Tile) => {
    if (t.route) navigate(t.route);
    else toast("Coming soon with Orange Labs");
  };

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/my-health")} className="gap-1">
          <ArrowLeft className="w-4 h-4" /> Personal Healthcare
        </Button>

        <div className="space-y-2">
          {tiles.map((t) => (
            <Card
              key={t.label}
              className="cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => handleClick(t)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <t.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.desc}</p>
                </div>
                {t.route ? (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <Badge variant="secondary" className="text-[10px]">Soon</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground text-center pt-2">
          At-home diagnostic and clinical services powered by Orange Labs (coming soon).
        </p>
      </div>
    </AppLayout>
  );
};

export default PersonalHealthcare;
