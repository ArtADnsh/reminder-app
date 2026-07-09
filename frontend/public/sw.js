self.addEventListener('push', function (event) {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch (e) {
    payload = { title: 'یادآور جدید', body: event.data.text() };
  }

  const title = payload.title || 'یادآور جدید';
  const options = {
    body: payload.body || 'شما یک پیام جدید دارید.',
    icon: '/vite.svg', // Fallback icon (replace with your app's actual icon)
    data: {
      url: payload.url || '/'
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 1. Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      
      // 2. If the user is on the site but a different page, just focus the first available client and navigate
      if (windowClients.length > 0 && 'focus' in windowClients[0]) {
        const client = windowClients[0];
        client.navigate(targetUrl);
        return client.focus();
      }

      // 3. If no window is open, open a brand new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
