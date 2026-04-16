import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Star, Crown, ExternalLink, Gift, Tag, Loader2, CheckCircle2, ArrowRight, Shield, Pill, Heart, Printer } from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { printReceipt } from "@/lib/receiptPdf";
import { cn } from "@/lib/utils";

const plans = [
  {
    key: "basic",
    name: "Basic",
    icon: Shield,
    monthly: 99,
    yearly: 999,
    features: [
      "SOS Emergency Alert",
      "2 Guardians",
      "Emergency Profile",
      "Messaging",
      "Basic Vitals - Using the Mobile",
      "Services (Ambulance included)",
      "Appointments",
      "Map My Journey 5/month",
    ],
    excluded: [
      "3 Daily Check-iNs",
      "Medication Manager",
      "Advanced Wearable Vitals",
      "Basic Activity Tracking",
      "AQI Suite",
      "Medical Vault",
    ],
  },
  {
    key: "premium",
    name: "Premium",
    icon: Star,
    monthly: 199,
    yearly: 1999,
    popular: true,
    features: [
      "Everything in Basic",
      "3 Guardians",
      "3 Daily Check-iNs",
      "Medication Manager",
      "Advanced Vitals - using external Wearable",
      "Basic Activity Tracking - using the Mobile",
      "AQI Suite",
      "AI Health Tools - No Medical Vault",
      "Basic Inactivity Alerts",
    ],
    excluded: [
      "Up to 5 Guardians",
      "Medical Vault",
      "Wellness AI Insights",
      "Safety Zones & Fall Detection",
      "Health Vitals (ECG, HR, SpO2, BP)",
      "Multiple sports modes & Gesture control"
    ],
  },
  {
    key: "premium-plus",
    name: "Premium Plus",
    icon: Crown,
    monthly: 999,
    yearly: 9999,
    badge: "Includes Smart Ring",
    features: [
      "Everything in Premium",
      "Up to 5 Guardians",
      "Unlimited Check-iNs",
      "Medical Vault",
      "Wellness AI Insights",
      "Safety Zones",
      "Fall Detection",
      "Health Vitals (ECG, HR, SpO2, BP, EDA)",
      "Step counting & Multiple sports modes",
      "Gesture control",
    ],
    excluded: [],
  },
];

interface CouponResult {
  code: string;
  discount_type: string;
  discount_value: number;
  discounts: Record<string, number>; // planKey -> discounted price
}

const Subscription = () => {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { subscription, isActive, loading } = useSubscription();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [showSuccess, setShowSuccess] = useState(false);
  const [successPlan, setSuccessPlan] = useState<string | null>(null);
  const [successBilling, setSuccessBilling] = useState<string | null>(null);

  const [couponOpen, setCouponOpen] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<CouponResult | null>(null);

  useEffect(() => {
    const status = searchParams.get("status");
    if (status === "success") {
      setSuccessPlan(searchParams.get("plan"));
      setSuccessBilling(searchParams.get("billing"));
      setShowSuccess(true);
      toast.success("Payment successful! Your subscription is now active.");
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
    } else if (status === "cancelled") {
      toast.info("Payment was cancelled.");
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, queryClient]);

  // Re-validate coupon when billing cycle changes
  useEffect(() => {
    if (appliedCoupon) {
      validateCouponForAllPlans(appliedCoupon.code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billing]);

  const validateCouponForAllPlans = async (code: string) => {
    const discounts: Record<string, number> = {};
    let lastValid: { discount_type: string; discount_value: number } | null = null;

    for (const planKey of ["basic", "premium", "premium-plus"]) {
      const { data } = await supabase.functions.invoke("validate-coupon", {
        body: { code, plan_type: planKey, billing_cycle: billing },
      });
      if (data?.valid) {
        discounts[planKey] = data.discounted_price;
        lastValid = { discount_type: data.discount_type, discount_value: data.discount_value };
      }
    }

    if (lastValid && Object.keys(discounts).length > 0) {
      setAppliedCoupon({
        code,
        discount_type: lastValid.discount_type,
        discount_value: lastValid.discount_value,
        discounts,
      });
    } else {
      setAppliedCoupon(null);
    }
  };

  const handleApplyCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;

    setCouponLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("validate-coupon", {
        body: { code, plan_type: "premium", billing_cycle: billing },
      });

      if (error || !data?.valid) {
        toast.error(data?.reason || "Invalid coupon code");
        setAppliedCoupon(null);
        setCouponLoading(false);
        return;
      }

      await validateCouponForAllPlans(code);

      const label =
        data.discount_type === "percentage"
          ? `${data.discount_value}% off`
          : `₹${data.discount_value} off`;
      toast.success(`Coupon applied! ${label}`);
    } catch {
      toast.error("Failed to validate coupon");
      setAppliedCoupon(null);
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
  };

  const getDisplayPrice = (plan: typeof plans[0]) => {
    const original = billing === "monthly" ? plan.monthly : plan.yearly;
    if (appliedCoupon && appliedCoupon.discounts[plan.key] !== undefined) {
      return { original, discounted: appliedCoupon.discounts[plan.key] };
    }
    return { original, discounted: null };
  };

  const handleChoosePlan = (planKey: string) => {
    if (!user || planKey === "free") return;
    const callbackUrl = encodeURIComponent(`${window.location.origin}/subscription?status=success&plan=${planKey}&billing=${billing}`);
    const cancelUrl = encodeURIComponent(`${window.location.origin}/subscription?status=cancelled`);
    let url = `https://futurewave.in/pay?plan=${planKey}&billing=${billing}&user_id=${user.id}&app_callback=${callbackUrl}&cancel_url=${cancelUrl}`;
    if (appliedCoupon && appliedCoupon.discounts[planKey] !== undefined) {
      url += `&coupon=${encodeURIComponent(appliedCoupon.code)}`;
    }
    window.location.href = url;
  };

  const handleDismissSuccess = () => {
    setShowSuccess(false);
    setSearchParams({}, { replace: true });
  };

  const planLabel = successPlan === "premium" ? "Premium" : successPlan === "premium-plus" ? "Premium Plus" : successPlan === "basic" ? "Basic" : successPlan;
  const billingLabel = successBilling === "yearly" ? "Yearly" : "Monthly";
  const planData = plans.find((p) => p.key === successPlan);
  const paidAmount = planData
    ? successBilling === "yearly" ? planData.yearly : planData.monthly
    : null;

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        {showSuccess ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="border-2 border-success overflow-hidden">
              <div className="bg-success/10 p-6 text-center space-y-3">
                <CheckCircle2 className="w-16 h-16 text-success mx-auto" />
                <h1 className="text-2xl font-bold">Payment Successful!</h1>
                <p className="text-muted-foreground">
                  Welcome to Check-iN <span className="font-semibold text-foreground">{planLabel}</span>
                </p>
              </div>
              <CardContent className="pt-5 space-y-5">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-muted rounded-lg p-3 text-center">
                    <p className="text-muted-foreground text-xs">Plan</p>
                    <p className="font-semibold">{planLabel}</p>
                  </div>
                  <div className="bg-muted rounded-lg p-3 text-center">
                    <p className="text-muted-foreground text-xs">Billing</p>
                    <p className="font-semibold">{billingLabel}</p>
                  </div>
                  {paidAmount !== null && (
                    <div className="bg-muted rounded-lg p-3 text-center">
                      <p className="text-muted-foreground text-xs">Amount</p>
                      <p className="font-semibold">₹{paidAmount}</p>
                    </div>
                  )}
                  {subscription?.expires_at && (
                    <div className="bg-muted rounded-lg p-3 text-center">
                      <p className="text-muted-foreground text-xs">Valid Until</p>
                      <p className="font-semibold">
                        {new Date(subscription.expires_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Next Steps</h3>
                  <div className="space-y-2">
                    <button onClick={() => navigate("/settings")} className="flex items-center gap-3 w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors">
                      <Shield className="w-5 h-5 text-primary shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Set Up Guardians</p>
                        <p className="text-xs text-muted-foreground">Add family members for safety alerts</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto" />
                    </button>
                    <button onClick={() => navigate("/my-health")} className="flex items-center gap-3 w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors">
                      <Pill className="w-5 h-5 text-primary shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Configure Medications</p>
                        <p className="text-xs text-muted-foreground">Set up reminders & schedules</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto" />
                    </button>
                    <button onClick={() => navigate("/my-health")} className="flex items-center gap-3 w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors">
                      <Heart className="w-5 h-5 text-primary shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Explore Health Tools</p>
                        <p className="text-xs text-muted-foreground">AI symptom checker, vitals & more</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <Button size="lg" className="w-full" onClick={() => navigate("/dashboard")}>
                    Go to Dashboard
                  </Button>
                  {subscription && (
                    <Button
                      variant="secondary"
                      size="lg"
                      className="w-full gap-2"
                      onClick={() =>
                        printReceipt({
                          id: subscription.id,
                          plan_type: subscription.plan_type,
                          billing_cycle: subscription.billing_cycle,
                          amount_paise: subscription.amount_paise,
                          starts_at: subscription.starts_at,
                          expires_at: subscription.expires_at,
                          coupon_code: subscription.coupon_code,
                          razorpay_payment_id: subscription.razorpay_payment_id,
                          userName: user?.user_metadata?.full_name || undefined,
                        })
                      }
                    >
                      <Printer className="w-4 h-4" /> Download Receipt
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="w-full" onClick={handleDismissSuccess}>
                    View Plans
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
        <>
        {/* HUGE 30-DAY TRIAL BANNER */}
        <div className="bg-gradient-to-r from-primary to-primary/80 rounded-2xl p-6 text-primary-foreground shadow-lg mb-6 backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 opacity-10">
            <Gift className="w-48 h-48" />
          </div>
          <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-left">
              <h2 className="text-2xl font-bold tracking-tight">Try Premium Free for 30 Days</h2>
              <p className="text-primary-foreground/90 font-medium">Access all features effortlessly. Cancel anytime.</p>
            </div>
            <Button variant="secondary" className="font-bold py-6 px-6 shadow-xl hover:scale-105 transition-transform" onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}>
              Start Your Free Trial
            </Button>
          </div>
        </div>

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

        {/* Coupon Code Section */}
        <Collapsible open={couponOpen} onOpenChange={setCouponOpen}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-1.5 text-sm text-primary mx-auto hover:underline">
              <Tag className="w-4 h-4" />
              {appliedCoupon ? "Coupon applied" : "Have a promo code?"}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            {appliedCoupon ? (
              <div className="flex items-center justify-between bg-success/10 border border-success/30 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-success" />
                  <span className="text-sm font-medium text-success">
                    {appliedCoupon.code} —{" "}
                    {appliedCoupon.discount_type === "percentage"
                      ? `${appliedCoupon.discount_value}% off`
                      : `₹${appliedCoupon.discount_value} off`}
                  </span>
                </div>
                <button
                  onClick={handleRemoveCoupon}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="Enter promo code"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
                />
                <Button
                  size="sm"
                  onClick={handleApplyCoupon}
                  disabled={couponLoading || !couponCode.trim()}
                >
                  {couponLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
                </Button>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const isCurrentPlan = isActive && subscription?.plan_type === plan.key;
            const { original, discounted } = getDisplayPrice(plan);

            return (
              <Card key={plan.key} className={cn("relative flex flex-col", plan.popular ? "border-2 border-primary" : "")}>
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs px-3 py-1 rounded-full z-10 font-medium">
                    Most Popular
                  </span>
                )}
                {/* @ts-ignore - badge exists on Premium Plus */}
                {plan.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs px-3 py-1 rounded-full z-10 font-bold whitespace-nowrap">
                    {/* @ts-ignore */}
                    {plan.badge}
                  </span>
                )}
                {isCurrentPlan && (
                  <span className="absolute -top-3 right-4 bg-success text-white text-xs px-3 py-1 rounded-full z-10">
                    Current Plan
                  </span>
                )}
                <CardHeader className="pb-2 pt-5">
                  <CardTitle className="flex items-center gap-2">
                    <plan.icon className="w-5 h-5 text-primary" />
                    {plan.name}
                  </CardTitle>
                  <div className="flex items-baseline gap-1 mt-2">
                    {discounted !== null ? (
                      <>
                        <span className="text-lg line-through text-muted-foreground">₹{original}</span>
                        <span className="text-3xl font-bold text-success">₹{discounted}</span>
                      </>
                    ) : (
                      <span className="text-3xl font-bold">₹{original}</span>
                    )}
                    <span className="text-sm text-muted-foreground font-medium">
                      /{billing === "monthly" ? "mo" : "yr"}
                    </span>
                  </div>
                  {/* @ts-ignore */}
                  {plan.key === "premium-plus" && (
                    <p className="text-[10px] text-muted-foreground leading-tight mt-1">
                      Includes 1-Year Free Content Subscription & One-Time Wearable Charge. Data charges applicable after Year 1.
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-4 flex-1 flex flex-col pt-2">
                  <div className="space-y-2.5 flex-1">
                    {plan.features.map((f) => (
                      <div key={f} className="flex items-start gap-2 text-sm leading-snug">
                        <Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </div>
                    ))}
                    {plan.excluded.map((f) => (
                      <div key={f} className="flex items-start gap-2 text-sm text-muted-foreground line-through opacity-70 leading-snug">
                        <span className="w-4 h-4 shrink-0 mt-0.5 border border-muted-foreground/30 rounded-sm" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                  <Button
                    className={cn("w-full mt-4", plan.popular ? "bg-primary" : "")}
                    variant={plan.popular ? "default" : "outline"}
                    size="lg"
                    disabled={isCurrentPlan || loading}
                    onClick={() => handleChoosePlan(plan.key)}
                  >
                    {isCurrentPlan ? (
                      "Current Plan"
                    ) : (
                      <span className="flex items-center gap-2">
                        {plan.key === "premium-plus" ? "Get Smart Ring Bundle" : `Choose ${plan.name}`}
                        <ExternalLink className="w-4 h-4" />
                      </span>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="text-xs text-center text-muted-foreground mt-6 max-w-md mx-auto italic">
          *Ambulance booking service is standard for all packages at set prices according to your location.
        </p>

        <p className="text-xs text-center text-muted-foreground px-4">
          You'll be redirected to our secure payment page at futurewave.in to complete your purchase.
        </p>
        </>
        )}
      </div>
    </AppLayout>
  );
};

export default Subscription;
