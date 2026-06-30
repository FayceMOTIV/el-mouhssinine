/* Service worker — Web Push pour le backoffice El Mouhssinine */
self.addEventListener('push', function (event) {
  let data = { title: 'El Mouhssinine', body: '', url: '/' };
  try {
    if (event.data) data = Object.assign(data, event.data.json());
  } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/elm-logo.png',
      badge: '/elm-logo.png',
      data: { url: data.url || '/' },
      vibrate: [100, 50, 100],
    }),
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
