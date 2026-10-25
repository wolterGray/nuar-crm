const DEFAULT_URL = "/";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch {
    payload = {body: event.data?.text() || "Новое уведомление"};
  }

  const title = payload.title || "NUAR CRM";
  const options = {
    body: payload.body || "Откройте CRM, чтобы посмотреть детали.",
    data: {url: payload.url || DEFAULT_URL},
    icon: "/pwa-icon-192.png",
    badge: "/pwa-icon-192.png",
    tag: payload.tag || undefined,
    renotify: Boolean(payload.renotify),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || DEFAULT_URL, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({type: "window", includeUncontrolled: true}).then(async (clients) => {
      const sameOriginClient = clients.find((client) => {
        try {
          return new URL(client.url).origin === self.location.origin;
        } catch {
          return false;
        }
      });

      if (sameOriginClient) {
        await sameOriginClient.navigate(targetUrl);
        return sameOriginClient.focus();
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
