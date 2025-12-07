// Simple Push Service Worker for Web Push (web-push)
self.addEventListener('push', function(event) {
  try {
    const data = event.data ? event.data.json() : { title: 'Socially', body: 'You have a new notification' };
    const title = data.title || 'Socially';
    const options = {
      body: data.body || '',
      icon: '/favicon.ico',
      data: data
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    console.error('Push event error:', e);
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const clickAction = event.notification?.data?.click_action || '/';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
    for (let i = 0; i < windowClients.length; i++) {
      const client = windowClients[i];
      if (client.url === clickAction && 'focus' in client) {
        return client.focus();
      }
    }
    if (clients.openWindow) {
      return clients.openWindow(clickAction);
    }
  }));
});
