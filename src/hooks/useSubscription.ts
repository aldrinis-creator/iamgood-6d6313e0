import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useSubscription() {
  const { user } = useAuth();

  const { data: subscription, isLoading: loading } = useQuery({
    queryKey: ["subscription", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions" as any)
        .select("*")
        .eq("user_id", user!.id)
        .eq("status", "active")
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as {
        id: string;
        plan_type: string;
        billing_cycle: string;
        status: string;
        expires_at: string;
        starts_at: string;
        amount_paise: number;
        coupon_code: string | null;
        razorpay_payment_id: string | null;
        is_trial: boolean | null;
      } | null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const isTrial = !!subscription?.is_trial;
  const trialDaysLeft = isTrial && subscription
    ? Math.max(
        0,
        Math.ceil((new Date(subscription.expires_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      )
    : 0;

  return {
    subscription,
    loading,
    isActive: !!subscription,
    // Treat legacy 'pro' as 'premium' for backwards compat
    isPro: subscription?.plan_type === "premium" || subscription?.plan_type === "pro",
    isPremium: subscription?.plan_type === "premium" || subscription?.plan_type === "pro",
    isPremiumPlus: subscription?.plan_type === "premium-plus",
    isBasic: subscription?.plan_type === "basic",
    plan: subscription?.plan_type === "pro" ? "premium" : (subscription?.plan_type ?? null),
    isTrial,
    trialDaysLeft,
  };
}
