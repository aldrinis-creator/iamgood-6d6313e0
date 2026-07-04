import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import HealthPassport from "@/components/HealthPassport";
import AppLayout from "@/components/AppLayout";

const HealthPassportPage = () => {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Button>
        <HealthPassport />
      </div>
    </AppLayout>
  );
};

export default HealthPassportPage;
