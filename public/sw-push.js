// Service Worker for Push Notifications + Offline SOS Sync + Emergency Profile Cache
const SUPABASE_URL = "https://magnrdegcegxdtgapyez.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hZ25yZGVnY2VneGR0Z2FweWV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTI5MTYsImV4cCI6MjA4OTQyODkxNn0.GEsHJs4uD-UVrdlgepE6nbjZBmjDICGZ4sR6a3zMv48";

const EMERGENCY_CACHE = "emergency-profile-v1";

// Cache emergency profile pages and their API data on fetch
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Cache navigation requests to /e/:token (emergency profile pages)
  const isEmergencyPage = url.pathname.startsWith("/e/") && event.request.mode === "navigate";
  // Cache Supabase REST API calls made by the emergency profile page
  const isEmergencyApi = url.origin === SUPABASE_URL && url.pathname.startsWith("/rest/v1/");

  if (isEmergencyPage || isEmergencyApi) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clone and cache successful responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(EMERGENCY_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Serve from cache when offline
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            // For navigation, try serving the app shell
            if (isEmergencyPage) {
              return caches.match("/index.html") || new Response("Offline – emergency profile unavailable", {
                status: 503,
                headers: { "Content-Type": "text/plain" },
              });
            }
            return new Response("{}", { status: 503, headers: { "Content-Type": "application/json" } });
          });
        })
    );
    return;
  }
});

// Cache the app shell on install for offline navigation fallback
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(EMERGENCY_CACHE).then((cache) => cache.addAll(["/index.html"])).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== EMERGENCY_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// IndexedDB helpers for service worker context
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("checkin-offline", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("sos_queue")) db.createObjectStore("sos_queue", { keyPath: "id", autoIncrement: true });
      if (!db.objectStoreNames.contains("auth_store")) db.createObjectStore("auth_store", { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAuth() {
  try {
    const db = await openDB();
    const tx = db.transaction("auth_store", "readonly");
    return await new Promise((resolve) => {
      const req = tx.objectStore("auth_store").get("session");
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

async function dequeueAllSOS() {
  try {
    const db = await openDB();
    const tx = db.transaction("sos_queue", "readwrite");
    const store = tx.objectStore("sos_queue");
    return await new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => { store.clear(); resolve(req.result); };
      req.onerror = () => resolve([]);
    });
  } catch { return []; }
}

// Push notification handler
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Check-iN";
  const isMedication = data.type === "medication";

  const options = {
    body: data.body || "You have a notification",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: data.tag || "checkin-notification",
    data: {
      url: data.url || "/",
      type: data.type || "general",
      medication_id: data.medication_id || null,
      log_id: data.log_id || null,
      user_id: data.user_id || null,
    },
    vibrate: [200, 100, 200],
    requireInteraction: true,
    actions: isMedication
      ? [
          { action: "taken", title: "✅ Taken" },
          { action: "snooze", title: "⏰ Snooze 15min" },
        ]
      : [],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click
self.addEventListener("notificationclick", (event) => {
  const { action } = event;
  const data = event.notification.data || {};
  event.notification.close();

  if (action === "taken" && data.medication_id && data.user_id) {
    // Mark medication as taken via API
    event.waitUntil(
      (async () => {
        const auth = await getAuth();
        const headers = {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        };
        if (auth && auth.accessToken) {
          headers["Authorization"] = `Bearer ${auth.accessToken}`;
        }
        try {
          await fetch(`${SUPABASE_URL}/rest/v1/medication_logs`, {
            method: "POST",
            headers: { ...headers, Prefer: "return=minimal" },
            body: JSON.stringify({
              medication_id: data.medication_id,
              user_id: data.user_id,
              status: "taken",
              taken_at: new Date().toISOString(),
              scheduled_at: new Date().toISOString(),
            }),
          });
        } catch (err) {
          console.error("Failed to mark medication taken:", err);
        }
      })()
    );
    return;
  }

  if (action === "snooze") {
    // Re-show notification after 15 minutes
    event.waitUntil(
      new Promise((resolve) => {
        setTimeout(() => {
          self.registration.showNotification("💊 Medication Reminder (Snoozed)", {
            body: "Time to take your medication!",
            icon: "/favicon.ico",
            tag: "med-snooze",
            vibrate: [200, 100, 200],
            requireInteraction: true,
            data: data,
            actions: [
              { action: "taken", title: "✅ Taken" },
              { action: "snooze", title: "⏰ Snooze 15min" },
            ],
          }).then(resolve);
        }, 15 * 60 * 1000);
      })
    );
    return;
  }

  // Default: open the app
  const url = data.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

// Notification close tracking
self.addEventListener("notificationclose", (event) => {
  console.log("[SW] Notification dismissed:", event.notification.tag);
});

// Background Sync for offline SOS
self.addEventListener("sync", (event) => {
  if (event.tag === "sos-sync") {
    event.waitUntil(syncQueuedSOS());
  }
});

async function syncQueuedSOS() {
  const items = await dequeueAllSOS();
  if (!items.length) return;

  const auth = await getAuth();
  const headers = {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    Prefer: "return=minimal",
  };
  if (auth && auth.accessToken) {
    headers["Authorization"] = `Bearer ${auth.accessToken}`;
  }

  for (const item of items) {
    try {
      const { id, queued_at, ...payload } = item;
      await fetch(`${SUPABASE_URL}/rest/v1/sos_events`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      console.log("[SW] Synced queued SOS event");
    } catch (err) {
      console.error("[SW] Failed to sync SOS:", err);
    }
  }
}
