// service-worker.js
self.addEventListener('install', event => {
    event.waitUntil(
      caches.open('app-cache').then(cache => {
        return cache.addAll([
          './',
          './index.html',
          './styles.css',
          './script.js',
          './icons/notai-192x192.png',
          './icons/notai-512x512.png',
          
        ]);
      })
    );
  });
  
  self.addEventListener('fetch', event => {
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request);
      })
    );
  });