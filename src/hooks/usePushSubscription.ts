import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  isPushSupported,
  getPushPermission,
  subscribeToPush,
  unsubscribeFromPush,
  getExistingSubscription,
} from "@/lib/pushNotifications";
import { storeAuthForSW } from "@/lib/offlineQueue";
import { toast } from "sonner";

const usePushSubscription = () => {
  const { session } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const supported = isPushSupported();
  const permission = getPushPermission();

  const checkSubscription = useCallback(async () => {
    if (!session?.user?.id || !supported) {
      setLoading(false);
      return;
    }

    const existing = await getExistingSubscription();
    if (existing) {
      // Verify it's in DB too
      const { data } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("endpoint", existing.endpoint)
        .maybeSingle();
      setIsSubscribed(!!data);
    } else {
      setIsSubscribed(false);
    }
    setLoading(false);
  }, [session?.user?.id, supported]);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  const subscribe = async () => {
    if (!session?.user?.id) return;
    setLoading(true);

    const subscription = await subscribeToPush();
    if (!subscription) {
      toast.error("Push notification permission denied or not supported");
      setLoading(false);
      return;
    }

    const json = subscription.toJSON();
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: session.user.id,
        endpoint: json.endpoint!,
        p256dh: json.keys!.p256dh,
        auth: json.keys!.auth,
      },
      { onConflict: "user_id,endpoint" }
    );

    if (error) {
      toast.error("Failed to save push subscription");
    } else {
      toast.success("Push notifications enabled!");
      setIsSubscribed(true);
      // Store auth in IndexedDB for service worker actions
      try {
        const accessToken = session.access_token;
        if (accessToken) {
          await storeAuthForSW(session.user.id, accessToken);
        }
      } catch (e) {
        console.warn("Failed to store auth for SW:", e);
      }
    }
    setLoading(false);
  };

  const unsubscribe = async () => {
    if (!session?.user?.id) return;
    setLoading(true);

    const existing = await getExistingSubscription();
    if (existing) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", session.user.id)
        .eq("endpoint", existing.endpoint);
    }

    await unsubscribeFromPush();
    setIsSubscribed(false);
    toast.info("Push notifications disabled");
    setLoading(false);
  };

  return { isSubscribed, loading, supported, permission, subscribe, unsubscribe };
};

export default usePushSubscription;
