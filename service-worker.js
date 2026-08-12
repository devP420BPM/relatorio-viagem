const CACHE='relatorio-viagem-v1.5.0';
const CORE=['./','./index.html','./manifest.json','./assets/css/app.css','./assets/js/config.js','./assets/js/app.js','./assets/js/api.js','./assets/js/install.js','./assets/js/pdf.js','./assets/pdf/relatorio-viagem-template.pdf','./assets/icons/icon-192.png','./assets/icons/icon-512.png','./assets/icons/icon-maskable-512.png','./assets/icons/apple-touch-icon.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  const url=new URL(e.request.url);
  if(url.origin!==self.location.origin) return;
  e.respondWith(fetch(e.request).then(resp=>{
    if(resp && resp.ok){const copy=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}
    return resp;
  }).catch(()=>caches.match(e.request)));
});
