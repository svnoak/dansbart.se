// This service worker immediately unregisters itself and clears all caches.
// It exists to replace any previously installed service worker from the old site.
self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function () {
  self.clients.matchAll({ type: 'window' }).then(function (clients) {
    clients.forEach(function (client) {
      client.navigate(client.url);
    });
  });
  self.registration.unregister();
  caches.keys().then(function (names) {
    names.forEach(function (name) {
      caches.delete(name);
    });
  });
});