// Clear cache script for development
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister();
      console.log('Service worker unregistered');
    }
  });
}

// Clear all storage
if ('caches' in window) {
  caches.keys().then(function(names) {
    for (let name of names) {
      caches.delete(name);
      console.log('Cache deleted:', name);
    }
  });
}

// Clear localStorage and sessionStorage
localStorage.clear();
sessionStorage.clear();

console.log('Cache cleared. Please refresh the page.');