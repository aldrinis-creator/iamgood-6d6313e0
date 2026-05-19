import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ArrowRight } from "lucide-react";

interface Props {
  title?: string;
  message?: string;
}

const GuardianBlockedSection = ({
  title = "Not available for Guardian accounts",
  message = "This section is only for Ward (user) accounts. Your Guardian profile only needs basic contact details — manage them in Guardian Settings.",
}: Props) => {
  const navigate = useNavigate();
  return (
    <Card className="border-success/30 bg-success/5">
      <CardContent className="p-5 text-center space-y-3">
        <div className="mx-auto w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
          <ShieldCheck className="w-6 h-6 text-success" />
        </div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button onClick={() => navigate("/guardian-settings")} className="w-full">
          Open Guardian Settings <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
};

export default GuardianBlockedSection;
