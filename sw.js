/* Ракурс: версия доставки оформления. */
const V='20261113-tags-1';
const CACHE='limb-'+V;
const ASSETS=["index.html","beta-ui.js?v=20261113-tags-1&rk_ui=20261113f","beta.js?v=20261113-tags-1","app.js?v=20261113-tags-1","styles.css?v=20261107-restore-3","cloud.js?v=20261109-beta-1","cloud-config.js?v=20261107-restore-3","account-menu.js?v=20261109-logout-1","supabase.js?v=20261107-restore-3","sounds.js?v=20261107-restore-3","content.js?v=9a6ab976","lz-string.min.js?v=9a6ab976","docx.umd.js?v=9a6ab976","drag-highlights.css","manifest.webmanifest","assets/backgrounds/main-dark.webp","assets/backgrounds/wall-texture.webp","assets/logo.svg","assets/logo-base.svg","assets/logo-indigo.svg","assets/logo-terra.svg","favicon.ico","assets/frames/article-panel.webp","assets/icons/pointing-hand-active.webp","assets/icons/pointing-hand-inactive.webp","assets/icons/app-192.png","assets/icons/app-512.png","assets/fonts/amatic-normal-400-cyrillic.woff2","assets/fonts/amatic-normal-400-latin.woff2","assets/fonts/angst.woff2","assets/fonts/badscript-normal-400-cyrillic.woff2","assets/fonts/badscript-normal-400-latin.woff2","assets/fonts/beermoney.woff","assets/fonts/bicubik.woff2","assets/fonts/bitter-italic-400-cyrillic.woff2","assets/fonts/bitter-italic-400-latin.woff2","assets/fonts/bitter-normal-400-cyrillic.woff2","assets/fonts/bitter-normal-latin.woff2","assets/fonts/boozy.woff2","assets/fonts/comfortaa-normal-400-cyrillic.woff2","assets/fonts/comfortaa-normal-400-latin.woff2","assets/fonts/didact-normal-400-cyrillic.woff2","assets/fonts/didact-normal-400-latin.woff2","assets/fonts/druzhok.woff2","assets/fonts/first-time-writing.woff2","assets/fonts/roboto-serif-italic-cyrillic.woff2","assets/fonts/roboto-serif-italic-latin.woff2","assets/fonts/roboto-serif-normal-cyrillic.woff2","assets/fonts/roboto-serif-normal-latin.woff2"];
self.addEventListener('install',e=>{e.waitUntil((async()=>{const c=await caches.open(CACHE);await Promise.all(ASSETS.map(async u=>{try{await c.add(new Request(u,{cache:'reload'}));}catch(err){}}));await self.skipWaiting();})());});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('limb-')&&k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim();const clients=await self.clients.matchAll({type:'window'});clients.forEach(c=>c.postMessage({type:'limb-sw',v:V}));})());});
self.addEventListener('message',e=>{if(e.data==='skip')self.skipWaiting();});
self.addEventListener('fetch',e=>{
 const req=e.request;if(req.method!=='GET')return;const url=new URL(req.url);
 const font=/^(fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.host);
 if(url.origin!==self.location.origin&&!font)return;
 const beta=url.origin===self.location.origin&&url.pathname.endsWith('/beta.js');
 if(beta){
  const fresh=new Request(req,{cache:'reload'});
  e.respondWith((async()=>{const c=await caches.open(CACHE);try{const r=await fetch(fresh);if(r.ok){await c.put(req,r.clone());return r;}return(await c.match(req,{ignoreVary:true}))||r;}catch(err){return(await c.match(req,{ignoreVary:true}))||Response.error();}})());return;
 }
 const ui=url.origin===self.location.origin&&url.pathname.endsWith('/beta-ui.js');
 if(ui){
  url.searchParams.set('rk_ui','20261113f');
  const fresh=new Request(url.href,{cache:'reload',credentials:req.credentials});
  e.respondWith((async()=>{const c=await caches.open(CACHE);try{const r=await fetch(fresh);if(r.ok){await c.put(fresh,r.clone());return r;}return(await c.match(fresh))||r;}catch(err){return(await c.match(fresh))||Response.error();}})());return;
 }
 if(req.mode==='navigate'){e.respondWith((async()=>{const c=await caches.open(CACHE);try{const r=await fetch(req,{cache:'no-cache'});if(r.ok){await c.put('index.html',r.clone());return r;}return(await c.match('index.html'))||r;}catch(err){return(await c.match('index.html'))||Response.error();}})());return;}
 e.respondWith((async()=>{const c=await caches.open(CACHE);const hit=await c.match(req,{ignoreVary:true});if(hit)return hit;try{const r=await fetch(req);if(r&&(r.ok||r.type==='opaque'))await c.put(req,r.clone());return r;}catch(err){return Response.error();}})());
});
