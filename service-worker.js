const CACHE='relatorio-viagem-v1.0.0';
const CORE=['./','./index.html','./manifest.json','./assets/css/app.css','./assets/js/config.js','./assets/js/app.js','./assets/js/api.js','./assets/js/pdf.js','./assets/pdf/relatorio-viagem-template.pdf'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(resp=>{const copy=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return resp;}).catch(()=>cached)));
});
