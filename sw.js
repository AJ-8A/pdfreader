const CACHE="docuview-shell-v2";
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(["/pdfreader/","/pdfreader/index.html","/pdfreader/styles.css","/pdfreader/app.js","/pdfreader/manifest.json","/pdfreader/icon.svg"])).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin===location.origin)event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request)));
});