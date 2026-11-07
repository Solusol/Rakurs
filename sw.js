/* Лимб · офлайн-кэш. Версия и список файлов подставляются stamp.py */
const V='9a6ab976';
const CACHE='limb-'+V;
const ASSETS=["index.html", "app.js?v=9a6ab976", "styles.css?v=9a6ab976", "content.js?v=9a6ab976", "lz-string.min.js?v=9a6ab976", "docx.umd.js?v=9a6ab976", "manifest.webmanifest", "assets/backgrounds/main-dark.webp", "assets/backgrounds/wall-texture.webp", "assets/logo.svg", "assets/logo-base.svg", "assets/logo-indigo.svg", "assets/logo-terra.svg", "favicon.ico", "assets/frames/article-panel.webp", "assets/icons/pointing-hand-active.webp", "assets/icons/pointing-hand-inactive.webp", "assets/icons/app-192.png", "assets/icons/app-512.png", "assets/fonts/amatic-normal-400-cyrillic.woff2", "assets/fonts/amatic-normal-400-latin.woff2", "assets/fonts/angst.woff2", "assets/fonts/badscript-normal-400-cyrillic.woff2", "assets/fonts/badscript-normal-400-latin.woff2", "assets/fonts/beermoney.woff", "assets/fonts/bicubik.woff2", "assets/fonts/bitter-italic-400-cyrillic.woff2", "assets/fonts/bitter-italic-400-latin.woff2", "assets/fonts/bitter-normal-400-cyrillic.woff2", "assets/fonts/bitter-normal-400-latin.woff2", "assets/fonts/boozy.woff2", "assets/fonts/comfortaa-normal-400-cyrillic.woff2", "assets/fonts/comfortaa-normal-400-latin.woff2", "assets/fonts/didact-normal-400-cyrillic.woff2", "assets/fonts/didact-normal-400-latin.woff2", "assets/fonts/druzhok.woff2", "assets/fonts/first-time-writing.woff2", "assets/fonts/roboto-serif-italic-cyrillic.woff2", "assets/fonts/roboto-serif-italic-latin.woff2", "assets/fonts/roboto-serif-normal-cyrillic.woff2", "assets/fonts/roboto-serif-normal-latin.woff2"];
self.addEventListener('install', e=>{
  e.waitUntil((async()=>{ const c=await caches.open(CACHE); await Promise.all(ASSETS.map(async u=>{ try{ await c.add(new Request(u,{cache:'reload'})); }catch(err){} })); await self.skipWaiting(); })());
});
self.addEventListener('activate', e=>{
  e.waitUntil((async()=>{ const keys=await caches.keys(); await Promise.all(keys.filter(k=>k.startsWith('limb-') && k!==CACHE).map(k=>caches.delete(k))); await self.clients.claim();
    const cs=await self.clients.matchAll({type:'window'}); cs.forEach(c=>c.postMessage({type:'limb-sw', v:V})); })());
});
self.addEventListener('message', e=>{ if(e.data==='skip') self.skipWaiting(); });
self.addEventListener('fetch', e=>{
  const req=e.request; if(req.method!=='GET') return;
  const url=new URL(req.url);
  const isFont = /fonts\.googleapis\.com|fonts\.gstatic\.com/.test(url.host);
  if(url.origin!==location.origin && !isFont) return;
  if(req.mode==='navigate'){
    // the page itself: network first, cached copy when offline
    e.respondWith((async()=>{ try{ const r=await fetch(req); const c=await caches.open(CACHE); c.put('index.html', r.clone()); return r; }catch(err){ return (await caches.match('index.html')) || Response.error(); } })());
    return;
  }
  e.respondWith((async()=>{
    const hit=await caches.match(req, {ignoreVary:true}); if(hit) return hit;
    try{ const r=await fetch(req); if(r && (r.ok || r.type==='opaque')){ const c=await caches.open(CACHE); c.put(req, r.clone()); } return r; }
    catch(err){ return hit || Response.error(); }
  })());
});
