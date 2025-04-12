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
          'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
          'https://corsp.suisuy.eu.org?https://cdn.jsdelivr.net/npm/marked/marked.min.js',
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