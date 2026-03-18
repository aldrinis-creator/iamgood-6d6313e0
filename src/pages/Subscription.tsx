import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Star, Crown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import AppLayout from "@/components/AppLayout";

const plans = [
  {
    name: "Basic",
    icon: Star,
    monthly: 99,
    yearly: 999,
    features: [
      "3 Daily Check-iNs",
      "SOS Emergency Alert",
      "1 Guardian",
      "Medical Vault",
      "Basic Inactivity Alerts",
    ],
    excluded: ["Advanced Geofencing", "Priority Ambulance", "AI Fall Detection", "5 Guardians", "Weekly Reports"],
  },
  {
    name: "Pro",
    icon: Crown,
    monthly: 199,
    yearly: 1999,
    popular: true,
    features: [
      "Unlimited Check-iNs",
      "SOS Emergency Alert",
      "Up to 5 Guardians",
      "Medical Vault + PDF Export",
      "Advanced Geofencing",
      "Priority Ambulance Booking",
      "AI Fall Detection",
      "AI Inactivity Detection",
      "Weekly Safety Reports",
    ],
    excluded: [],
  },
];

const Subscription = () => {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("");

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold">Choose Your Plan</h1>
          <p className="text-sm text-muted-foreground">
            Upgrade for advanced safety features and peace of mind.
          </p>
        </div>

        {/* Billing Toggle */}
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

        {/* Plans */}
        {plans.map((plan) => (
          <Card key={plan.name} className={plan.popular ? "border-2 border-primary relative" : ""}>
            {plan.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs px-3 py-1 rounded-full">
                Most Popular
              </span>
            )}
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2">
                <plan.icon className="w-5 h-5 text-primary" />
                {plan.name}
              </CardTitle>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold">
                  ₹{billing === "monthly" ? plan.monthly : plan.yearly}
                </span>
                <span className="text-sm text-muted-foreground">
                  /{billing === "monthly" ? "mo" : "yr"}
                </span>
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
              <Button
                className={`w-full ${plan.popular ? "bg-primary" : ""}`}
                variant={plan.popular ? "default" : "outline"}
                size="lg"
                onClick={() => {
                  setSelectedPlan(plan.name);
                  setShowCheckout(true);
                }}
              >
                {plan.popular ? "Go Pro" : "Choose Basic"}
              </Button>
            </CardContent>
          </Card>
        ))}

        {/* Mock Razorpay Checkout */}
        <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Razorpay Checkout</DialogTitle>
              <DialogDescription>
                Complete your {selectedPlan} subscription
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 p-4 bg-muted rounded-lg">
              <div className="flex justify-between text-sm">
                <span>Plan</span>
                <span className="font-semibold">{selectedPlan} ({billing})</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Amount</span>
                <span className="font-semibold">
                  ₹{selectedPlan === "Pro"
                    ? billing === "monthly" ? "199" : "1,999"
                    : billing === "monthly" ? "99" : "999"
                  }
                </span>
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-xs text-muted-foreground text-center">
                  🔒 Secured by Razorpay • This is a demo checkout
                </p>
              </div>
              <Button className="w-full bg-primary" size="lg" onClick={() => setShowCheckout(false)}>
                Pay Now (Demo)
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default Subscription;
