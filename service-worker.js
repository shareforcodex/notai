// service-worker.js
self.addEventListener('install', event => {
    event.waitUntil(
      caches.open('app-cache').then(cache => {
        return cache.addAll([
          './',
          './index.html',
          './styles.css',
          './js/main.js',
          './js/editor/index.js',
          './js/editor/bootstrap.js',
          './js/editor/core.js',
          './js/editor/events.js',
          './js/editor/ai.js',
          './js/editor/comments.js',
          './js/editor/formatting.js',
          './js/editor/auth.js',
          './js/editor/library.js',
          './js/editor/notes.js',
          './js/editor/media.js',
          './js/utils.js',
          './js/constants.js',
          './js/state.js',
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
