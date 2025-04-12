// service-worker.js

let cacheList = [
  './',
  './styles.css',
  './script.js',
  './icons/notai-192x192.png',
  './icons/notai-512x512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];
let cacheName = 'app-cache';


self.addEventListener('install', event => {
    event.waitUntil(
      caches.open('app-cache').then(cache => {
        return cache.addAll(cacheList);
      })
    );
  });
  
  self.addEventListener('fetch', event => {
    //check if the request is in the cachelist
    let isInCacheList ;
    if(cacheList.includes(event.request.url)){
      isInCacheList = true;
    }
    else{
      isInCacheList = false;
    }
    //if the request is in the cachelist, return the cached response
    if (isInCacheList) {
      event.respondWith(
        caches.match(event.request).then(response => {
          //settimeout to update cachelist everytime
          setTimeout(() => {
            //check if cachelist is in cache
            caches.open(cacheName).then(cache => {
              cache.add(event.request).then(() => {
                console.log('Cache updated');
              });
            });
          }, 1000); 
          
          //if response is found in cache, return it, if not, fetch from network and cache it then return it
          return response || fetch(event.request).then(response => {
            return caches.open(cacheName).then(cache => {
              cache.put(event.request, response.clone());
              return response;
            });
          });
        })
      );
    }
    else{
      //if the request is not in the cachelist, return the network response
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request);
      })
    );
    }

    
  });