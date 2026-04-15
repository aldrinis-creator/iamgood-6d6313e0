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

async function hmacVerify(secret: string, payload: string, signature: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (computed.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonRes({ error: "Method not allowed" }, 405);
  }

  const webhookSecret = Deno.env.get("PAYMENT_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("PAYMENT_WEBHOOK_SECRET not configured");
    return jsonRes({ error: "Server misconfigured" }, 500);
  }

  try {
    const body = await req.json();
    const {
      user_id,
      plan_type,
      billing_cycle,
      amount_paise,
      razorpay_payment_id,
      razorpay_order_id,
      signature,
      coupon_code,
    } = body;

    if (!user_id || !plan_type || !billing_cycle || !signature) {
      return jsonRes({ error: "Missing required fields" }, 400);
    }

    if (!["basic", "pro"].includes(plan_type)) {
      return jsonRes({ error: "Invalid plan_type" }, 400);
    }

    if (!["monthly", "yearly"].includes(billing_cycle)) {
      return jsonRes({ error: "Invalid billing_cycle" }, 400);
    }

    const signPayload = JSON.stringify({
      amount_paise: amount_paise || 0,
      billing_cycle,
      plan_type,
      razorpay_order_id: razorpay_order_id || "",
      razorpay_payment_id: razorpay_payment_id || "",
      user_id,
    });

    const valid = await hmacVerify(webhookSecret, signPayload, signature);
    if (!valid) {
      return jsonRes({ error: "Invalid signature" }, 403);
    }

    const now = new Date();
    const expiresAt = new Date(now);
    if (billing_cycle === "monthly") {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    } else {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Mark any existing active subscription as expired
    await supabase
      .from("subscriptions")
      .update({ status: "expired", updated_at: now.toISOString() })
      .eq("user_id", user_id)
      .eq("status", "active");

    // Insert new subscription with optional coupon_code
    const { error } = await supabase.from("subscriptions").insert({
      user_id,
      plan_type,
      billing_cycle,
      amount_paise: amount_paise || 0,
      razorpay_payment_id: razorpay_payment_id || null,
      razorpay_order_id: razorpay_order_id || null,
      starts_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      status: "active",
      coupon_code: coupon_code || null,
    });

    if (error) {
      console.error("Insert error:", error);
      return jsonRes({ error: "Failed to record subscription" }, 500);
    }

    // Increment coupon used_count if a coupon was used
    if (coupon_code) {
      const { error: couponErr } = await supabase.rpc("increment_coupon_usage", {
        _code: coupon_code,
      });
      if (couponErr) {
        console.error("Failed to increment coupon usage:", couponErr);
      }
    }

    return jsonRes({ success: true });
  } catch (e) {
    console.error("Webhook error:", e);
    return jsonRes({ error: "Internal server error" }, 500);
  }
});
