if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    registrations.forEach(function(reg) {
      reg.unregister();
    });
  });
  caches.keys().then(function(names) {
    names.forEach(function(name) {
      caches.delete(name);
    });
  });
}