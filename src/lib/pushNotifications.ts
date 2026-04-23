const VAPID_PUBLIC_KEY = "BJq2e6gs1zTIdmNLo6v4DWL4trzwEedK_ghxuB9wb63nlh_y1ShYf2RS_IKdDdPu59tQJ3pLk5XHed6pGZ141lw";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}

export const isPushSupported = (): boolean => {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
};

export const getPushPermission = (): NotificationPermission | "unsupported" => {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
};

export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!("serviceWorker" in navigator)) return null;
  try {
    // Use the unified Workbox SW registered in main.tsx — no separate /sw-push.js
    const reg = await navigator.serviceWorker.ready;
    return reg;
  } catch (err) {
    console.error("SW ready failed:", err);
    return null;
  }
};

export const subscribeToPush = async (): Promise<PushSubscription | null> => {
  const reg = await registerServiceWorker();
  if (!reg) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  try {
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    return subscription;
  } catch (err) {
    console.error("Push subscription failed:", err);
    return null;
  }
};

export const getExistingSubscription = async (): Promise<PushSubscription | null> => {
  const reg = await navigator.serviceWorker?.ready;
  if (!reg) return null;
  return reg.pushManager.getSubscription();
};

export const unsubscribeFromPush = async (): Promise<boolean> => {
  const subscription = await getExistingSubscription();
  if (!subscription) return true;
  return subscription.unsubscribe();
};
