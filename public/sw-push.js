// Service Worker for Push Notifications
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Medication Reminder";
  const options = {
    body: data.body || "Time to take your medication",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: data.tag || "medication-reminder",
    data: { url: data.url || "/" },
    vibrate: [200, 100, 200],
    requireInteraction: true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
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
