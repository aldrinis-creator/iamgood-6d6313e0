import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonRes(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const PLAN_PRICES: Record<string, Record<string, number>> = {
  basic: { monthly: 99, yearly: 999 },
  pro: { monthly: 199, yearly: 1999 },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonRes({ error: "Method not allowed" }, 405);
  }

  try {
    const { code, plan_type, billing_cycle } = await req.json();

    if (!code || !plan_type || !billing_cycle) {
      return jsonRes({ valid: false, reason: "Missing required fields" }, 400);
    }

    if (!["basic", "pro"].includes(plan_type)) {
      return jsonRes({ valid: false, reason: "Invalid plan" }, 400);
    }

    if (!["monthly", "yearly"].includes(billing_cycle)) {
      return jsonRes({ valid: false, reason: "Invalid billing cycle" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: coupon, error } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", code.trim().toUpperCase())
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error("DB error:", error);
      return jsonRes({ valid: false, reason: "Server error" }, 500);
    }

    if (!coupon) {
      return jsonRes({ valid: false, reason: "Invalid coupon code" });
    }

    // Check expiry
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return jsonRes({ valid: false, reason: "Coupon has expired" });
    }

    // Check usage limit
    if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
      return jsonRes({ valid: false, reason: "Coupon usage limit reached" });
    }

    // Check applicable plan
    if (!coupon.applicable_plans.includes(plan_type)) {
      return jsonRes({
        valid: false,
        reason: `Coupon not applicable for ${plan_type} plan`,
      });
    }

    // Calculate discounted price
    const originalPrice = PLAN_PRICES[plan_type][billing_cycle];
    let discountedPrice: number;

    if (coupon.discount_type === "percentage") {
      discountedPrice = Math.round(
        originalPrice * (1 - coupon.discount_value / 100)
      );
    } else {
      discountedPrice = Math.max(0, originalPrice - Number(coupon.discount_value));
    }

    return jsonRes({
      valid: true,
      discount_type: coupon.discount_type,
      discount_value: Number(coupon.discount_value),
      original_price: originalPrice,
      discounted_price: discountedPrice,
    });
  } catch (e) {
    console.error("Validate coupon error:", e);
    return jsonRes({ valid: false, reason: "Internal server error" }, 500);
  }
});
