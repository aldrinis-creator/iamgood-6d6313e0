import { Card, CardContent } from "@/components/ui/card";
import { Phone } from "lucide-react";

const TeleConsult = () => {
  return (
    <Card>
      <CardContent className="p-8 flex flex-col items-center justify-center text-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Phone className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">Tele-Consult</h2>
        <p className="text-sm text-muted-foreground">Soon to come</p>
      </CardContent>
    </Card>
  );
};

export default TeleConsult;
