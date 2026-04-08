import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Star, Crown, ExternalLink, Gift } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useQueryClient } from "@tanstack/react-query";

const plans = [
  {
    key: "free",
    name: "Free",
    icon: Gift,
    monthly: 0,
    yearly: 0,
    features: [
      "SOS Emergency Alert",
      "1 Guardian",
      "Emergency Profile",
      "Emergency First Aid Guides",
      "Basic Vitals (manual)",
    ],
    excluded: [
      "Medication Manager",
      "Activity Tracking",
      "Medical Vault",
      "AI Health Tools",
      "Advanced Vitals",
    ],
  },
  {
    key: "basic",
    name: "Basic",
    icon: Star,
    monthly: 99,
    yearly: 999,
    features: [
      "Everything in Free",
      "3 Daily Check-iNs",
      "Medication Manager",
      "Basic Activity Tracking",
      "Medical Vault (view)",
      "Basic Inactivity Alerts",
    ],
    excluded: ["AI Health Tools", "5 Guardians", "Advanced Vitals", "Priority Ambulance"],
  },
  {
    key: "pro",
    name: "Pro",
    icon: Crown,
    monthly: 199,
    yearly: 1999,
    popular: true,
    features: [
      "Everything in Basic",
      "Unlimited Check-iNs",
      "Up to 5 Guardians",
      "AI Symptom Checker",
      "Document Analyzer",
      "Face Scan & Vitals",
      "Nutrition Advisor (AI)",
      "Priority Ambulance",
      "Wellness AI Insights",
      "PDF Export / Sharing",
      "Journey Geofencing",
    ],
    excluded: [],
  },
];

const Subscription = () => {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { subscription, isActive, loading } = useSubscription();
  const queryClient = useQueryClient();

  useEffect(() => {
    const status = searchParams.get("status");
    if (status === "success") {
      toast.success("Payment successful! Your subscription is now active.");
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      setSearchParams({}, { replace: true });
    } else if (status === "cancelled") {
      toast.info("Payment was cancelled.");
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, queryClient]);

  const handleChoosePlan = (planKey: string) => {
    if (!user || planKey === "free") return;
    const callbackUrl = encodeURIComponent(`${window.location.origin}/subscription?status=success`);
    const cancelUrl = encodeURIComponent(`${window.location.origin}/subscription?status=cancelled`);
    const url = `https://futurewave.in/pay?plan=${planKey}&billing=${billing}&user_id=${user.id}&app_callback=${callbackUrl}&cancel_url=${cancelUrl}`;
    window.location.href = url;
  };

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold">Choose Your Plan</h1>
          <p className="text-sm text-muted-foreground">
            Upgrade for advanced safety features and peace of mind.
          </p>
        </div>

        {isActive && subscription && (
          <Card className="border-2 border-success bg-success/5">
            <CardContent className="py-3 px-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">
                  Active: {subscription.plan_type === "pro" ? "Pro" : "Basic"} ({subscription.billing_cycle})
                </p>
                <p className="text-xs text-muted-foreground">
                  Expires {new Date(subscription.expires_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              <Badge variant="secondary" className="bg-success/20 text-success border-0">Active</Badge>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-center">
          <div className="bg-muted rounded-lg p-1 flex">
            <button
              onClick={() => setBilling("monthly")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                billing === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                billing === "yearly" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              Yearly <span className="text-xs opacity-75">(Save 16%)</span>
            </button>
          </div>
        </div>

        {plans.map((plan) => {
          const isCurrentPlan =
            (plan.key === "free" && !isActive) ||
            (isActive && subscription?.plan_type === plan.key);
          const isFree = plan.key === "free";
          return (
            <Card key={plan.key} className={plan.popular ? "border-2 border-primary relative" : ""}>
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs px-3 py-1 rounded-full">
                  Most Popular
                </span>
              )}
              {isCurrentPlan && (
                <span className="absolute -top-3 right-4 bg-success text-white text-xs px-3 py-1 rounded-full">
                  Current Plan
                </span>
              )}
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="flex items-center gap-2">
                  <plan.icon className="w-5 h-5 text-primary" />
                  {plan.name}
                </CardTitle>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">
                    {isFree ? "Free" : `₹${billing === "monthly" ? plan.monthly : plan.yearly}`}
                  </span>
                  {!isFree && (
                    <span className="text-sm text-muted-foreground">
                      /{billing === "monthly" ? "mo" : "yr"}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-success shrink-0" />
                      {f}
                    </div>
                  ))}
                  {plan.excluded.map((f) => (
                    <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground line-through">
                      <span className="w-4 h-4 shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>
                {isFree ? (
                  <Button className="w-full" variant="outline" size="lg" disabled>
                    {isCurrentPlan ? "Current Plan" : "Free Forever"}
                  </Button>
                ) : (
                  <Button
                    className={`w-full ${plan.popular ? "bg-primary" : ""}`}
                    variant={plan.popular ? "default" : "outline"}
                    size="lg"
                    disabled={isCurrentPlan || loading}
                    onClick={() => handleChoosePlan(plan.key)}
                  >
                    {isCurrentPlan ? (
                      "Current Plan"
                    ) : (
                      <span className="flex items-center gap-2">
                        {plan.popular ? "Go Pro" : "Choose Basic"}
                        <ExternalLink className="w-4 h-4" />
                      </span>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}

        <p className="text-xs text-center text-muted-foreground px-4">
          You'll be redirected to our secure payment page at futurewave.in to complete your purchase.
        </p>
      </div>
    </AppLayout>
  );
};

export default Subscription;
