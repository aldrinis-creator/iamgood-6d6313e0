import { useNavigate } from "react-router-dom";
import { Crown, Star, Lock, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { PlanTier } from "@/lib/featureGating";

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName: string | null;
  requiredPlan: PlanTier;
  description?: string;
}

const PLAN_META: Record<PlanTier, { label: string; icon: typeof Crown }> = {
  free: { label: "Free Feature", icon: Star },
  basic: { label: "Basic Feature", icon: Star },
  premium: { label: "Premium Feature", icon: Crown },
  "premium-plus": { label: "Premium Plus Feature", icon: Sparkles },
};

const UpgradeDialog = ({
  open,
  onOpenChange,
  featureName,
  requiredPlan,
  description,
}: UpgradeDialogProps) => {
  const navigate = useNavigate();
  const meta = PLAN_META[requiredPlan] ?? PLAN_META.premium;
  const Icon = meta.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto">
        <DialogHeader className="items-center text-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <DialogTitle className="text-lg">{featureName}</DialogTitle>
          <Badge variant="secondary" className="gap-1 mt-1">
            <Icon className="w-3 h-3" />
            {meta.label}
          </Badge>
          {description && (
            <DialogDescription className="mt-2">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="space-y-2 pt-2">
          <Button
            className="w-full"
            onClick={() => {
              onOpenChange(false);
              navigate("/subscription");
            }}
          >
            View Plans
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Maybe Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradeDialog;
