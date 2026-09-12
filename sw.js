const C="showcue-v21-cuepad-direct-controls-1";
const A=["./","./index.html","./manifest.webmanifest","./assets/apple-touch-icon.png","./assets/icon-192.png","./assets/icon-512.png"];
self.addEventListener("install",function(e){e.waitUntil(caches.open(C).then(function(c){return c.addAll(A);}).then(function(){return self.skipWaiting();}));});
self.addEventListener("activate",function(e){e.waitUntil(caches.keys().then(function(k){return Promise.all(k.filter(function(x){return x!==C;}).map(function(x){return caches.delete(x);}));}).then(function(){return self.clients.claim();}));});
self.addEventListener("fetch",function(e){e.respondWith(caches.match(e.request).then(function(r){return r||fetch(e.request);}));});
