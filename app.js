(function(){
'use strict';
/* several independent projects live side by side; «main» is Лимб with the built-in text, others start empty */
const PROJ_KEY='wsblankProjects';
function loadProjects(){ let r=null; try{ r=JSON.parse(localStorage.getItem(PROJ_KEY)||'null'); }catch(e){} if(!r || !r.list) r={cur:'main', list:[{id:'main', name:'Ракурс', builtin:true}]}; if(!r.list.find(x=>x.id==='main')) r.list.unshift({id:'main', name:'Ракурс', builtin:true}); if(!r.list.find(x=>x.id===r.cur)) r.cur='main'; return r; }
function saveProjects(r){ r.updated=Date.now(); try{ localStorage.setItem(PROJ_KEY, JSON.stringify(r)); }catch(e){} try{ if(window.RK_CLOUD) RK_CLOUD.pushProjects(r); }catch(e){} }
const PROJ=loadProjects(); const CUR_PROJ=PROJ.list.find(x=>x.id===PROJ.cur);
function blankContent(){ return {sections:[{id:'text',title:'Текст',pages:[]},{id:'extra',title:'Экстры',pages:[]},{id:'ref',title:'Материалы',pages:[]}], seeds:{}, characters:[]}; }
const C = blankContent(); // Only the current project data; no shipped story or seed notes.
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const HEAD_TYPES = new Set(['h2','h3','h4','pov','time']);
const TYPE_LABEL = {h2:'Заголовок',h3:'Подзаголовок',h4:'Подзаголовок',pov:'Персонаж (POV)',time:'Время',table:'Таблица',p:'Абзац',dialog:'Реплика',callout:'Заметка-врезка',quote:'Цитата',list:'Список',olist:'Нумерованный список',hr:'Разделитель',media:'Фото / видео',profile:'Профайл'};
const SPLIT_TYPES = new Set(['p','dialog','h2','h3','h4','pov','time']);
const NOEDIT_TYPES = new Set(['hr','media']);
const GRID_TYPES = new Set(['table','profile']);
const TEXT_TYPES = new Set(['p','dialog','h2','h3','h4','pov','time','callout','quote']);
const TEMPLATES = {
  p:'', dialog:'— ', h2:'Заголовок', h3:'Подзаголовок', pov:'ИМЯ', time:'00:00', callout:'Заметка', quote:'Цитата', hr:'',
  list:'<ul><li>Пункт</li></ul>', olist:'<ol><li>Пункт</li></ol>',
  table:'<table><tbody><tr><th>Колонка 1</th><th>Колонка 2</th><th>Колонка 3</th></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></tbody></table>',
  profile:'<table><tbody>'+['Имя','Возраст','Роль в группе','Внешность','Характер','Речь','Связи','Статус'].map(k=>`<tr><th>${k}</th><td>&nbsp;</td></tr>`).join('')+'</tbody></table>'
};

/* ---------- indexes ---------- */
const PAGES = [], PAGE = {}, BLOCK = {}, PAGE_OF = {};
if(!C.sections.find(s=>s.id==='arch')) C.sections.push({id:'arch', title:'Архив', pages:[]});
/* Story blocks are created explicitly by the author. */
C.sections.forEach(s => s.pages.forEach(p => { p.section = s; p.homeSec = s.id; PAGES.push(p); PAGE[p.id] = p; p.blocks.forEach(b => { BLOCK[b.id] = b; PAGE_OF[b.id] = p.id; }); }));
/* three top-level groups: the work itself (chapters + extras), the story base (world, characters, editing rules) and the archive (retired pages) */
const GROUPS=[{id:'work', title:'Текст', secs:['text','extra']},{id:'base', title:'База истории', secs:['ref']},{id:'archive', title:'Архив', secs:['arch']}];
const SEC_LABEL={text:'Главы', extra:'Экстры', ref:'Материалы', arch:'Снято с работы'};
function movePageToSec(p, sec){ const old=p.section; if(old===sec) return; old.pages.splice(old.pages.indexOf(p),1); PAGES.splice(PAGES.indexOf(p),1); p.section=sec; const last=sec.pages[sec.pages.length-1]; sec.pages.push(p); PAGES.splice(last?PAGES.indexOf(last)+1:PAGES.length, 0, p); }
function applyMoves(){ D.moved=D.moved||{}; PAGES.slice().forEach(p=>{ if(p.user) return; const target=C.sections.find(x=>x.id===(D.moved[p.id]||p.homeSec)); if(target && p.section!==target) movePageToSec(p, target); }); }
function toggleArchive(p){ const inArch=p.section.id==='arch';
  if(p.user){ const u=D.pages.find(x=>x.id===p.id); if(!u) return; if(inArch){ u.sec=u.homeSec||'ref'; } else { u.homeSec=u.sec||'text'; u.sec='arch'; } registerUserPages(); }
  else { D.moved=D.moved||{}; if(inArch) delete D.moved[p.id]; else D.moved[p.id]='arch'; applyMoves(); }
  save(); buildToc(); renderPage(p); toast(inArch?'Страница возвращена из архива':'Страница убрана в архив'); }
function groupOf(sec){ const id=typeof sec==='string'?sec:sec.id; return GROUPS.find(g=>g.secs.includes(id))||GROUPS[GROUPS.length-1]; }
function secLabel(sec){ return SEC_LABEL[sec.id]||sec.title; }
function isArchive(p){ return groupOf(p.section).id!=='work'; }
function showSub(p){ return !!p.sub && !isArchive(p); }
function pageHeadings(p){ return pageBlocks(p).filter(b=>!b.deleted && (b.t==='h2'||b.t==='h3')).map(b=>({id:b.id, t:b.t, text:blockText(b.h).trim()})).filter(h=>h.text); }
function tocHTML(p, inPane){ const hs=pageHeadings(p); if(hs.length<4) return ''; return `<nav class="page-toc"><div class="toc-t">Содержание</div>${hs.map(h=>`<div class="ti ${h.t}"><a href="#/${p.id}@${h.id}" data-b="${h.id}">${esc(h.text)}</a>${inPane?'':`<button class="side-open" data-b="${h.id}" title="Открыть этот раздел во второй панели">⧉</button>`}</div>`).join('')}</nav>`; }
function gtag(g){ return `<span class="gtag ${g.id}">${g.title}</span>`; }

/* ---------- user data ---------- */
const KEY = CUR_PROJ.id==='main' ? 'wsblank1' : 'wsblank1:'+CUR_PROJ.id;
const emptyData = () => ({ v:1, edits:{}, notes:{}, anns:{}, pageNotes:{}, ins:{}, del:{}, types:{}, pages:[], seeded:[], updated:0 });
let D = emptyData();
let storageOK = false;

const cookieStore = {
  read(){
    try{
      const m = document.cookie.match(new RegExp('(?:^|; )'+KEY+'n=(\\d+)'));
      if(!m) return null;
      let out=''; for(let i=0;i<+m[1];i++){ const c=document.cookie.match(new RegExp('(?:^|; )'+KEY+i+'=([^;]*)')); if(!c) return null; out+=c[1]; }
      const json = LZString.decompressFromEncodedURIComponent(out);
      return json ? JSON.parse(json) : null;
    }catch(e){ return null; }
  },
  write(obj){
    try{
      const enc = LZString.compressToEncodedURIComponent(JSON.stringify(obj));
      const CH=3800, n=Math.ceil(enc.length/CH), exp='; max-age=31536000; path=/; SameSite=Lax';
      if(n>3){ return false; }
      for(let i=0;i<n;i++) document.cookie = KEY+i+'='+enc.slice(i*CH,(i+1)*CH)+exp;
      document.cookie = KEY+'n='+n+exp;
      for(let i=n;i<50;i++) document.cookie = KEY+i+'=; max-age=0; path=/';
      return true;
    }catch(e){ return false; }
  },
  clear(){ try{ for(let i=0;i<50;i++) document.cookie = KEY+i+'=; max-age=0; path=/'; document.cookie = KEY+'n=; max-age=0; path=/'; }catch(e){} },
  test(){
    try{ document.cookie = KEY+'t=1; path=/; SameSite=Lax'; const ok = /(?:^|; )limbws1t=1/.test(document.cookie); document.cookie = KEY+'t=; max-age=0; path=/'; return ok; }catch(e){ return false; }
  }
};
// Primary storage: the browser's persistent key-value storage (guarded: inside a sandboxed preview frame access throws, then cookies are used).
const LS = (()=>{ try{ const st=window.localStorage; if(!st) return null; st.setItem(KEY+'t','1'); st.removeItem(KEY+'t'); return st; }catch(e){ return null; } })();
const store = {
  kind: LS ? 'local' : 'cookie',
  read(){
    if(LS){ try{ const raw=LS.getItem(KEY); if(raw){ const json=LZString.decompressFromUTF16(raw); if(json) return JSON.parse(json); } }catch(e){ console.warn('read failed', e); } }
    const c=cookieStore.read(); if(c && LS){ try{ LS.setItem(KEY, LZString.compressToUTF16(JSON.stringify(c))); cookieStore.clear(); }catch(e){} }
    return c;
  },
  write(obj){
    if(LS){ try{ LS.setItem(KEY, LZString.compressToUTF16(JSON.stringify(obj))); return true; }catch(e){ console.warn('write failed', e); } }
    return cookieStore.write(obj);
  },
  test(){ return !!LS || cookieStore.test(); }
};
const LOCAL_HINT='Данные хранятся только в этом браузере на этом устройстве. Облачной синхронизации нет — для переноса и на случай потери делай резервную копию.';
function backupAge(){ if(!D.lastBackup) return null; return Math.floor((Date.now()-D.lastBackup)/864e5); }
function backupLine(){ const a=backupAge(); if(a==null) return isEmptyData(D)?'':'копия ещё не делалась'; if(a===0) return 'копия: сегодня'; if(a===1) return 'копия: вчера'; return 'копия: '+a+' дн. назад'; }
function backupStale(){ const a=backupAge(); return (a==null && !isEmptyData(D)) || (a!=null && a>7); }
function setStoreState(cls, text){
  const now=new Date(text==='init'&&D.updated?D.updated:Date.now()).toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'});
  const el=$('#storageState'); if(el){ el.className='store '+cls+(backupStale()?' warn':''); el.hidden=false; const bl=backupLine();
    el.textContent = cls==='bad' ? 'Сохранение не работает' : cls==='saving' ? 'Сохраняется…' : ('На этом устройстве · '+now+(bl?' · '+bl:'')); el.title=LOCAL_HINT; }
  const m=$('#saveStateM'); if(m){ m.className='save-state only-mobile '+(cls==='bad'?'bad':'ok'); m.textContent=cls==='bad'?'без автосохранения':cls==='saving'?'сохраняется…':'сохранено'; m.hidden=false; m.title=LOCAL_HINT; }
  const ind=$('#saveState'); if(!ind) return;
  if(cls==='bad'){ ind.className='save-state bad'; ind.textContent='без автосохранения'; ind.title=text; }
  else if(cls==='saving'){ ind.className='save-state saving'; ind.textContent='сохраняется…'; ind.title=LOCAL_HINT; }
  else { ind.className='save-state ok'; ind.textContent='сохранено · '+now; ind.title=LOCAL_HINT; }
  ind.hidden=false;
}
let lastWriteOK=true;
let saveT=null, dirty=false;
function flush(){ clearTimeout(saveT); saveT=null; if(!dirty) return; dirty=false; if(storageOK){ const ok = store.write(D); lastWriteOK=ok; if(ok){ try{ if(window.RK_CLOUD) RK_CLOUD.push(KEY, D); }catch(e){} } if(ok) setStoreState('ok','Сохранено в браузере · '+new Date().toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'})); else setStoreState('bad','Не удалось сохранить в браузере — сохрани файл проекта'); } }
function save(){
  if(tabReadOnly){ if(Date.now()-(save._ro||0)>5000 && document.hasFocus()){ save._ro=Date.now(); toast('Это окно только для чтения: проект редактируется в другом окне'); } return; }
  D.updated = Date.now(); dirty=true; TEXTS=null; if(curPage) cacheBase(curPage); if(storageOK) setStoreState('saving');
  clearTimeout(saveT); saveT = setTimeout(flush, 250);
  refreshBadges();
}
window.addEventListener('pagehide', ()=>{ try{ autoVersion(); }catch(e){} flush(); }); setInterval(()=>{ try{ autoVersion(); }catch(e){} }, 10*60*1000); window.addEventListener('blur', flush); window.addEventListener('beforeunload', flush);
document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='hidden') flush(); });
/* ---------- one editing window at a time ---------- */
const TAB_ID = Math.random().toString(36).slice(2);
const LOCK_KEY = KEY+'lock';
let tabReadOnly=false;
function readLock(){ try{ const raw=LS&&LS.getItem(LOCK_KEY); return raw?JSON.parse(raw):null; }catch(e){ return null; } }
function writeLock(){ try{ LS&&LS.setItem(LOCK_KEY, JSON.stringify({id:TAB_ID, ts:Date.now()})); }catch(e){} }
function releaseLock(){ const l=readLock(); if(l && l.id===TAB_ID){ try{ LS.removeItem(LOCK_KEY); }catch(e){} } }
function lockHeldByOther(){ const l=readLock(); return !!(l && l.id!==TAB_ID && Date.now()-l.ts<15000); }
function setReadOnly(on){
  tabReadOnly=on; document.body.classList.toggle('tab-readonly', on); const b=$('#tabBanner'); if(b) b.hidden=!on;
  if(on){ if(mode==='edit') setMode('read'); } else { writeLock(); }
  for(const v of RK_CHARACTER_VIEWS)if(v.root.isConnected)v.refresh();
}
function reloadFromStore(){ const saved=store.read(); if(!saved) return; D=Object.assign(emptyData(), saved); D.anns=D.anns||{}; D.pages=D.pages||[]; D.types=D.types||{}; registerUserPages(); for(const k in D.ins) D.ins[k].forEach(b=>{ BLOCK[b.id]=b; PAGE_OF[b.id]=PAGE_OF[k]||(k.startsWith('top:')?k.slice(4):null); }); TEXTS=null; buildToc(); route(); }
function takeOver(){ reloadFromStore(); writeLock(); setReadOnly(false); toast('Редактирование перенесено в это окно'); }
function initTabLock(){
  if(!LS) return;
  if(lockHeldByOther()) setReadOnly(true); else writeLock();
  $('#tabTake').onclick=takeOver;
  setInterval(()=>{ if(tabReadOnly){ if(!lockHeldByOther()){ takeOver(); } } else { const l=readLock(); if(l && l.id!==TAB_ID && Date.now()-l.ts<15000){ flush(); setReadOnly(true); } else writeLock(); } }, 4000);
  window.addEventListener('storage', e=>{ if(e.key===LOCK_KEY){ const l=readLock(); if(l && l.id!==TAB_ID && !tabReadOnly){ flush(); setReadOnly(true); } } else if(e.key===KEY && tabReadOnly){ reloadFromStore(); } });
  window.addEventListener('pagehide', releaseLock);
}
function isEmptyDataLegacy(d){ return !(d.pages||[]).length && !Object.keys(d.anns||{}).length && !Object.keys(d.edits).length && !Object.keys(d.notes).length && !Object.keys(d.pageNotes).length && !Object.keys(d.ins).length && !Object.keys(d.del).length; }

/* ---------- housekeeping: drop data for blocks that no longer exist (e.g. a chapter text was replaced) ---------- */
function cleanupOrphans(){
  let n=0;
  D.types=D.types||{}; ['edits','notes','del','types'].forEach(k=>{ for(const id in D[k]){ if(!BLOCK[id]){ delete D[k][id]; n++; } } });
  for(const id in D.anns){ const a=D.anns[id]; if(!a.pid && BLOCK[a.b1]) a.pid=PAGE_OF[a.b1]; if(!BLOCK[a.b1] || !BLOCK[a.b2]){ if(a.text && a.text.trim() && a.pid && PAGE[a.pid]){ a.lost=true; } else { delete D.anns[id]; n++; } } }
  for(const k in D.ins){ if(!k.startsWith('top:') && !BLOCK[k]){ delete D.ins[k]; n++; } }
  // junk left by a mangled editing session: empty inserted paragraphs without notes, and «edits» identical to the original
  const hasNote=id=>!!D.notes[id] || Object.values(D.anns).some(a=>a.b1===id);
  const isJunk=b=>{ const t=blockText(b.h).trim(); return (t===''||t==='+') && !NOEDIT_TYPES.has(b.t) && !GRID_TYPES.has(b.t) && !hasNote(b.id); };
  let changed=true, guard=0;
  while(changed && guard++<50){ changed=false;
    for(const k of Object.keys(D.ins)){ const list=D.ins[k]; if(!list) continue;
      for(let i=0;i<list.length;i++){ const b=list[i]; if(!isJunk(b)) continue;
        const kids=D.ins[b.id]||[]; delete D.ins[b.id]; list.splice(i,1,...kids); delete BLOCK[b.id]; delete PAGE_OF[b.id]; n++; changed=true; i--; }
      if(!list.length) delete D.ins[k]; } }
  for(const id in D.edits){ if(BLOCK[id] && canon(D.edits[id])===canon(BLOCK[id].h)){ delete D.edits[id]; n++; } }
  if(n) save();
}
/* ---------- content revisions: when a chapter is re-synced from the source, drop old text edits for it (notes stay) ---------- */
function pageHasTextLayer(p){ const ids=new Set(p.blocks.map(b=>b.id)); if(D.ins['top:'+p.id]) return true; for(const k in D.edits) if(ids.has(k)) return true; for(const k in D.del) if(ids.has(k)) return true; for(const k in D.ins) if(ids.has(k)) return true; return false; }
/* keep a compressed copy of the source text of every page the author has changed, so an update of the source can never take her version away */
function cacheBase(p){ if(!p || p.user) return; D.base=D.base||{}; const rev=p.rev||''; const c=D.base[p.id]; if(c && c.rev===rev) return; if(!pageHasTextLayer(p)) return; D.base[p.id]={rev, title:p.title, sub:p.sub||'', z:LZString.compressToUTF16(JSON.stringify(p.blocks.map(b=>[b.id,b.t,b.h])))}; }
function materialize(blocks, data, pid){ const fake={id:pid, blocks}; return pageBlocksWith(fake, data).filter(b=>!b.deleted).map(b=>({id:b.id,t:b.t,h:b.h})); }
function applyRevisions(){
  D.pageRev=D.pageRev||{}; D.base=D.base||{}; let n=0; const changed=[];
  PAGES.forEach(p=>{ if(!p.rev) return; if(D.pageRev[p.id]===p.rev) return;
    const ids=new Set(p.blocks.map(b=>b.id));
    if(pageHasTextLayer(p)){
      // the author's version of the old text goes to the version history as a complete snapshot
      const c=D.base[p.id]; let full=null;
      if(c && c.z){ try{ const old=JSON.parse(LZString.decompressFromUTF16(c.z)).map(x=>({id:x[0],t:x[1],h:x[2]})); full=materialize(old, D, p.id); }catch(e){} }
      if(!full){ const old=[]; for(const k in D.edits) if(ids.has(k)) old.push({id:k,t:(D.types||{})[k]||'p',h:D.edits[k]}); full=materialize(old, D, p.id); }
      const vz=LZString.compressToUTF16(JSON.stringify({full, pageNote:D.pageNotes[p.id]||''}));
      versionsOf(p.id).push({ts:Date.now(), name:'моя версия до обновления главы', auto:false, z:vz, n:full.length, c:full.reduce((a,b)=>a+blockText(b.h).length,0), full:true});
      changed.push(p.title);
    }
    [D.edits,D.del,D.types].forEach(o=>{ for(const k in o) if(ids.has(k)){ delete o[k]; n++; } });
    for(const k in D.ins){ if(k==='top:'+p.id || ids.has(k)){ D.ins[k].forEach(b=>{ delete BLOCK[b.id]; }); delete D.ins[k]; n++; } }
    delete D.base[p.id];
    D.pageRev[p.id]=p.rev; n++; });
  if(n) save();
  if(changed.length) setTimeout(()=>toast(`Обновлён текст: ${changed.join(', ')}. Твоя прежняя версия сохранена в «Версиях»`), 800);
}
/* ---------- version history (per page) ---------- */
function pageBlocksWith(p, data){
  const out=[]; const push=(b, inserted)=>{ const deleted=!inserted && !!data.del[b.id]; const edited=data.edits[b.id]; out.push({id:b.id, t:(!inserted && data.types && data.types[b.id])||b.t, h: edited!==undefined?edited:b.h, inserted, deleted}); (data.ins[b.id]||[]).forEach(ib=>push(ib,true)); };
  (data.ins['top:'+p.id]||[]).forEach(ib=>push(ib,true)); p.blocks.forEach(b=>push(b,false)); return out;
}
function versionsOf(pid){ D.versions=D.versions||{}; return D.versions[pid]=D.versions[pid]||[]; }
function pageSnapStr(){ return pageScope().snap; }
function saveVersion(name, auto){
  if(!curPage) return false; const list=versionsOf(curPage.id); const snap=pageSnapStr();
  const z=LZString.compressToUTF16(JSON.stringify({layer:snap, pageNote:D.pageNotes[curPage.id]||''}));
  if(list.length && list[list.length-1].z===z && auto) return false; // nothing changed
  const blocks=pageBlocks(curPage).filter(b=>!b.deleted); const chars=blocks.reduce((a,b)=>a+blockText(b.h).length,0);
  list.push({ts:Date.now(), name:name||'', auto:!!auto, z, n:blocks.length, c:chars});
  while(list.length>30){ const i=list.findIndex(v=>v.auto); if(i<0) break; list.splice(i,1); }
  save(); return true;
}
function autoVersion(){ if(!curPage || mode!=='edit'||['character','location'].includes(wsType(curPage))) return; saveVersion('', true); }
function parseVersion(v){ const raw=LZString.decompressFromUTF16(v.z); if(!raw) return null; const o=JSON.parse(raw); if(o.layer||o.full) return o; return {layer:raw, pageNote:null}; }
function restoreVersion(i){ const list=versionsOf(curPage.id); const v=list[i]; if(!v) return; const o=parseVersion(v); if(!o) return; saveVersion('перед восстановлением', true);
  if(o.full) replacePageText(curPage, o.full); else applySnapshot(o.layer);
  if(o.pageNote!=null){ if(o.pageNote) D.pageNotes[curPage.id]=o.pageNote; else delete D.pageNotes[curPage.id]; const ta=$('#view .page-note textarea'); if(ta){ ta.value=o.pageNote; ta.classList.toggle('has',!!o.pageNote.trim()); } }
  save(); rerender(); histReset(); renderVersions(); toast('Версия восстановлена'); }
/* replace the visible text of a page with the given blocks (used for complete snapshots and backups): source paragraphs are marked deleted, the text lives as inserted blocks */
function replacePageText(p, blocks){
  const pid=p.id; const ids=new Set(p.blocks.map(b=>b.id));
  [D.edits,D.del,D.types,D.notes].forEach(o=>{ for(const k in o) if(ids.has(k)) delete o[k]; });
  for(const k in D.ins){ if(k==='top:'+pid || ids.has(k)){ D.ins[k].forEach(b=>{ delete BLOCK[b.id]; }); delete D.ins[k]; } }
  const map={}; const fresh=blocks.map((b,i)=>{ const nid='r'+Date.now().toString(36)+i.toString(36); map[b.id]=nid; return {id:nid,t:b.t,h:b.h}; });
  for(const k in D.anns){ const a=D.anns[k]; if(map[a.b1]) a.b1=map[a.b1]; if(map[a.b2]) a.b2=map[a.b2]; }
  for(const k in D.notes){ if(map[k]){ D.notes[map[k]]=D.notes[k]; delete D.notes[k]; } }
  p.blocks.forEach(b=>{ D.del[b.id]=1; });
  if(fresh.length) D.ins['top:'+pid]=fresh; fresh.forEach(b=>{ BLOCK[b.id]=b; PAGE_OF[b.id]=pid; });
}
function deleteVersion(i){ const list=versionsOf(curPage.id); list.splice(i,1); save(); renderVersions(); }
function fmtDate(ts){ const d=new Date(ts); return d.toLocaleDateString('ru',{day:'numeric',month:'short'})+' · '+d.toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'}); }
function openVersions(){ if(!curPage) return; $('#verPreview').hidden=true; $('#verList').hidden=false; $('#versionsModal').hidden=false; renderVersions(); }
function renderVersions(){
  const list=versionsOf(curPage.id); const el=$('#verListItems'); const cur=pageBlocks(curPage).filter(b=>!b.deleted); const curC=cur.reduce((a,b)=>a+blockText(b.h).length,0);
  $('#verNow').textContent=`Сейчас: ${cur.length} абз. · ${curC.toLocaleString('ru')} зн.`;
  if(!list.length){ el.innerHTML='<div class="muted">Версий этой страницы пока нет. Они появляются сами, когда ты выходишь из правки, и по кнопке «Сохранить версию».</div>'; return; }
  el.innerHTML=[...list].map((v,i)=>({v,i})).reverse().map(({v,i})=>`<div class="ver"><div class="vt"><b>${esc(v.name||(v.auto?'Автосохранение':'Версия'))}</b><small>${fmtDate(v.ts)} · ${v.n} абз. · ${(v.c||0).toLocaleString('ru')} зн.${v.c!=null?` (${v.c-curC>=0?'+':''}${(v.c-curC).toLocaleString('ru')} к текущей)`:''}</small></div><button class="btn" data-a="view" data-i="${i}">Посмотреть</button><button class="btn" data-a="restore" data-i="${i}">Восстановить</button><button class="icon-btn" data-a="del" data-i="${i}" title="Удалить версию">✕</button></div>`).join('');
  el.onclick=e=>{ const b=e.target.closest('button[data-a]'); if(!b) return; const i=+b.dataset.i; if(b.dataset.a==='restore'){ if(!b.dataset.armed){ b.dataset.armed='1'; b.textContent='Точно? Ещё раз'; setTimeout(()=>{ b.dataset.armed=''; b.textContent='Восстановить'; },3000); return; } restoreVersion(i); } else if(b.dataset.a==='del') deleteVersion(i); else previewVersion(i); };
}
/* ---------- diff helpers ---------- */
function lcsOps(A, B, eq){ const n=A.length, m=B.length; if(n*m>4e6) return null; const dp=new Uint16Array((n+1)*(m+1)); const W=m+1;
  for(let i=n-1;i>=0;i--) for(let j=m-1;j>=0;j--) dp[i*W+j] = eq(A[i],B[j]) ? dp[(i+1)*W+j+1]+1 : Math.max(dp[(i+1)*W+j], dp[i*W+j+1]);
  const ops=[]; let i=0,j=0; while(i<n && j<m){ if(eq(A[i],B[j])){ ops.push(['=',A[i],B[j]]); i++; j++; } else if(dp[(i+1)*W+j]>=dp[i*W+j+1]){ ops.push(['-',A[i]]); i++; } else { ops.push(['+',null,B[j]]); j++; } }
  while(i<n) ops.push(['-',A[i++]]); while(j<m) ops.push(['+',null,B[j++]]); return ops; }
function wordDiffHTML(a, b){ const ta=a.split(/(\s+)/), tb=b.split(/(\s+)/); const ops=lcsOps(ta,tb,(x,y)=>x===y); const same=ops?ops.filter(o=>o[0]==='='&&o[1].trim()).length:0; const words=Math.max(ta.filter(x=>x.trim()).length, tb.filter(x=>x.trim()).length);
  if(!ops || same/Math.max(1,words)<0.5) return `<del>${esc(a)}</del><br><ins>${esc(b)}</ins>`;
  let out=''; ops.forEach(o=>{ if(o[0]==='=') out+=esc(o[1]); else if(o[0]==='-') out+=`<del>${esc(o[1])}</del>`; else out+=`<ins>${esc(o[2])}</ins>`; }); return out; }
function blockDiffHTML(oldBlocks, newBlocks){
  const A=oldBlocks.map(b=>({t:b.t, x:blockText(b.h).trim()})), B=newBlocks.map(b=>({t:b.t, x:blockText(b.h).trim()}));
  const ops=lcsOps(A,B,(x,y)=>x.x===y.x); if(!ops) return '<p class="muted">Текст слишком большой для сравнения.</p>';
  // pair runs of removed/added of equal length as «changed» paragraphs
  const out=[]; let i=0;
  while(i<ops.length){ if(ops[i][0]==='='){ out.push({k:'=',x:ops[i][1].x,t:ops[i][1].t}); i++; continue; }
    const rem=[], add=[]; while(i<ops.length && ops[i][0]!=='='){ if(ops[i][0]==='-') rem.push(ops[i][1]); else add.push(ops[i][2]); i++; }
    const k=Math.min(rem.length, add.length); for(let j=0;j<k;j++) out.push({k:'~',a:rem[j].x,b:add[j].x,t:add[j].t}); for(let j=k;j<rem.length;j++) out.push({k:'-',x:rem[j].x,t:rem[j].t}); for(let j=k;j<add.length;j++) out.push({k:'+',x:add[j].x,t:add[j].t}); }
  const changed=out.filter(o=>o.k!=='=').length; if(!changed) return '<p class="muted">Эта версия совпадает с текущим текстом.</p>';
  let html=`<div class="diff-sum">Отличий: ${changed} абз. · <del>убрано в текущей</del> · <ins>добавлено в текущей</ins></div>`; let hidden=0;
  const flush=()=>{ if(hidden){ html+=`<div class="diff-skip">… ${hidden} абз. без изменений …</div>`; hidden=0; } };
  out.forEach((o,idx)=>{ if(o.k==='='){ const near = (out[idx-1]&&out[idx-1].k!=='=') || (out[idx+1]&&out[idx+1].k!=='='); if(near){ flush(); html+=`<p class="ctx">${esc(o.x)}</p>`; } else hidden++; return; } flush();
    if(o.k==='~') html+=`<p class="chg">${wordDiffHTML(o.a,o.b)}</p>`; else if(o.k==='-') html+=`<p class="rem"><del>${esc(o.x)}</del></p>`; else html+=`<p class="add"><ins>${esc(o.x)}</ins></p>`; });
  flush(); return html;
}
function versionBlocks(v){ const o=parseVersion(v); if(!o) return null; if(o.full) return o.full; const data=JSON.parse(o.layer); data.types=data.types||{}; data.ins=data.ins||{}; return pageBlocksWith(curPage, data).filter(b=>!b.deleted).map(b=>({id:b.id,t:b.t,h:b.h})); }
function restoreAsCopy(i){ const v=versionsOf(curPage.id)[i]; const blocks=versionBlocks(v); if(!blocks) return; const p=curPage;
  const id='np'+Date.now().toString(36); const title=`${p.title} — вариант от ${fmtDate(v.ts)}`; const sec=p.section.id==='arch'?'arch':p.section.id;
  D.pages.push({id, title, sub:p.sub||'', sec}); registerUserPages();
  const fresh=blocks.map((b,k)=>({id:'r'+Date.now().toString(36)+k.toString(36), t:b.t, h:b.h})); D.ins['top:'+id]=fresh; fresh.forEach(b=>{ BLOCK[b.id]=b; PAGE_OF[b.id]=id; });
  save(); buildToc(); $('#versionsModal').hidden=true; nav('#/'+id); toast('Версия открыта как отдельная страница-вариант; основной текст не тронут'); }
function previewVersion(i){
  const v=versionsOf(curPage.id)[i]; if(!v) return; const o=parseVersion(v); if(!o) return; let blocks;
  if(o.full) blocks=o.full; else { const data=JSON.parse(o.layer); data.types=data.types||{}; data.ins=data.ins||{}; blocks=pageBlocksWith(curPage, data).filter(b=>!b.deleted); }
  $('#verPreviewTitle').textContent=`${v.name||(v.auto?'Автосохранение':'Версия')} · ${fmtDate(v.ts)}`;
  const plain=(o.pageNote?`<div class="ver-pnote">${esc(o.pageNote)}</div>`:'')+blocks.map(b=>HEAD_TYPES.has(b.t)?`<div class="h">${b.h}</div>`:GRID_TYPES.has(b.t)?`<div>${b.h}</div>`:`<p>${b.h}</p>`).join('');
  const body=$('#verPreviewBody'); body.innerHTML=plain; body.classList.remove('diff');
  const cmp=$('#verCompare'); cmp.textContent='Сравнить с текущим'; cmp.onclick=()=>{ if(body.classList.contains('diff')){ body.innerHTML=plain; body.classList.remove('diff'); cmp.textContent='Сравнить с текущим'; } else { const cur=pageBlocks(curPage).filter(b=>!b.deleted); body.innerHTML=blockDiffHTML(blocks, cur); body.classList.add('diff'); cmp.textContent='Показать текст версии'; } };
  $('#verList').hidden=true; $('#verPreview').hidden=false;
  $('#verBack').onclick=()=>{ $('#verPreview').hidden=true; $('#verList').hidden=false; };
  $('#verRestoreThis').onclick=()=>{ restoreVersion(i); $('#verPreview').hidden=true; $('#verList').hidden=false; };
  $('#verCopy').onclick=()=>restoreAsCopy(i);
}
/* ---------- split view (second page alongside) ---------- */
function setBarH(){ document.documentElement.style.setProperty('--barh', $('.bar').offsetHeight+'px'); }
function setPaneMin(on){ prefs.paneMin=!!on; savePrefs(); document.body.classList.toggle('pane-min', !!on); }
function applySide(){ document.body.classList.toggle('side-hidden', !!prefs.sideHidden); const b=$('#btnHideSide'); b.title=prefs.sideHidden?'Показать оглавление':'Скрыть оглавление'; b.classList.toggle('on', !!prefs.sideHidden); }
function wsPanePages(){
 const out=[],seen=new Set();
 function branch(parent){wsChildren(parent).forEach(p=>{if(seen.has(p.id)||!wsUser(p))return;seen.add(p.id);out.push(p);if(wsType(p)==='folder')branch(p.id);});}
 branch('');PAGES.forEach(p=>{if(wsUser(p)&&!seen.has(p.id)){seen.add(p.id);out.push(p);}});return out;
}
function wsPaneSelect(){
 const sel=$('#view2Select');if(!sel)return null;const pages=wsPanePages();
 const selected=pages.some(p=>p.id===prefs.split)?prefs.split:(pages.find(p=>!curPage||p.id!==curPage.id)||pages[0]||{}).id||'';
 const entries=pages.map(p=>({id:p.id,title:p.title,kind:wsType(p),depth:wsPath(p).length,label:wsPath(p).map(x=>x.title).concat(p.title).join(' / ')}));
 const key=JSON.stringify(entries);
 if(sel.dataset.wsOptions!==key){sel.replaceChildren();entries.forEach(x=>{const o=document.createElement('option');o.value=x.id;o.textContent=x.label;o.dataset.title=x.title;o.dataset.kind=x.kind;o.dataset.depth=x.depth;sel.appendChild(o);});if(!entries.length){const o=document.createElement('option');o.value='';o.textContent='В проекте пока нет блоков';sel.appendChild(o);}sel.dataset.wsOptions=key;}
 sel.hidden=false;sel.disabled=!pages.length;sel.setAttribute('aria-label','Блок текущего проекта');sel.value=selected;
 if(prefs.split!==selected){prefs.split=selected;savePrefs();}sel.dispatchEvent(new Event('rk-pane-sync'));return PAGE[selected]||null;
}
function toggleSplit(on){
 if(on===undefined)on=!document.body.classList.contains('split');
 document.body.classList.toggle('split',on);$('#btnSplit').classList.toggle('on',on);
 if(on){prefs.paneTab='page';wsPaneSelect();savePrefs();renderPane();}
 else{prefs.split='';savePrefs();$('#view2Body').replaceChildren();}
}
function toggleFocus(on){ if(on===undefined) on=!document.body.classList.contains('focus-mode'); document.body.classList.toggle('focus-mode', on); prefs.focus=on; savePrefs(); const b=$('#btnFocus'); b.classList.toggle('on', on); b.title = on ? 'Вернуть панели' : 'Только текст: скрыть оглавление и вторую панель'; }
function setPaneTab(){prefs.paneTab='page';savePrefs();const sel=$('#view2Select');if(sel)sel.hidden=false;renderPane();}
function paneNotes(host){
  const p=curPage; if(!p||p.special){ host.innerHTML='<div class="pane-empty">Открой главу слева — здесь будут её заметки.</div>'; return; }
  const all=allNotes().filter(n=>n.p===p); const open=all.filter(n=>!n.done), done=all.filter(n=>n.done); const showD=!!prefs.paneDone;
  let html=`<div class="pane-title">Заметки · ${esc(p.title)} <small>${open.length} в работе${done.length?` · ${done.length} решено`:''}</small></div>`;
  if(!all.length){ host.innerHTML=html+'<div class="pane-empty">Заметок на этой странице нет. Выдели фрагмент в тексте — появится кнопка «Заметка к выделенному».</div>'; return; }
  const list=showD?all:open;
  html+=`<div class="notes-list pane">${list.map((n,i)=>`<div class="nl${n.done?' done':''}" data-i="${i}">${n.quote?`<div class="q">«${esc(n.quote)}»</div>`:''}<div class="t">${esc(n.text)}</div><div class="m">${n.kind?`<span class="kind k-${n.kind}">${kindLabel(n.kind)}</span>`:''}<span>${esc(n.label)}</span><span class="sp"></span><button class="link" data-a="go">К месту</button>${n.pageNote?'':`<button class="link" data-a="done">${n.done?'Вернуть':'Решено'}</button>`}</div></div>`).join('')}</div>
    ${done.length?`<button class="link-btn dim" id="paneDoneToggle">${showD?'Скрыть решённые':`Показать решённые (${done.length})`}</button>`:''}`;
  host.innerHTML=html;
  host.querySelector('.notes-list').onclick=e=>{ const b=e.target.closest('button[data-a]'); const row=e.target.closest('.nl'); if(!row) return; const n=list[+row.dataset.i];
    if(b&&b.dataset.a==='done'){ n.obj.done=!n.obj.done; save(); rerender(); renderPane(); return; }
    if(n.bid){ const el=document.getElementById('b-'+n.bid); if(el){ el.scrollIntoView({block:'center',behavior:'smooth'}); el.classList.add('flash'); setTimeout(()=>el.classList.remove('flash'),1500); } if(n.ann){ const m=document.querySelector(`mark.ann[data-ann="${n.ann}"]`); if(m){ m.classList.add('hot'); setTimeout(()=>m.classList.remove('hot'),2500); } } } else window.scrollTo({top:0,behavior:'smooth'}); };
  const dt=host.querySelector('#paneDoneToggle'); if(dt) dt.onclick=()=>{ prefs.paneDone=!prefs.paneDone; savePrefs(); renderPane(); };
}
function paneChars(host){
  const p=curPage; if(!p||p.special||groupOf(p.section).id!=='work'){ host.innerHTML='<div class="pane-empty">Открой главу слева — здесь будут персонажи, которые в ней появляются.</div>'; return; }
  const {res}=mentions(); const list=charList().filter(ch=>res[ch.short].byChapter[p.id]).sort((a,b)=>res[b.short].byChapter[p.id]-res[a.short].byChapter[p.id]); const cards=baseCards(); const c=charsData();
  let html=`<div class="pane-title">Персонажи · ${esc(p.title)} <small>${list.length}</small></div>`;
  if(!list.length){ host.innerHTML=html+'<div class="pane-empty">В этой главе известные имена не встречаются.</div>'; return; }
  html+=list.map(ch=>{ const r=res[ch.short]; const card=cards[ch.name]||Object.values(cards).find(k=>k.name.includes(ch.short)); const pick=card?card.fields.filter(f=>/^(Речь|Характер|Жесты|Голос|Профайл|Эмоции)/i.test(f.k)).slice(0,3):[]; const know=(c.know[ch.short]||{})[p.id];
    return `<div class="pc" style="--lc:${ch.color}"><div class="pc-h"><b>${esc(ch.short)}</b><span class="muted">${r.byChapter[p.id]} упом.</span><a class="link" href="#/${p.id}@${r.first[p.id]}" data-local="1">к первому →</a><button class="link" data-know="${esc(ch.short)}">${know?'знает: '+esc(know):'что узнал в этой главе?'}</button></div>
      ${pick.length?`<dl class="cc-fields small">${pick.map(f=>`<dt>${esc(f.k)}</dt><dd>${esc(f.v.length>220?f.v.slice(0,220)+'…':f.v)}</dd>`).join('')}</dl>`:''}
      ${c.rel[ch.short]?`<div class="pc-rel">${esc(c.rel[ch.short])}</div>`:''}</div>`; }).join('');
  html+=`<a class="link-btn dim" href="#/characters">Все карточки персонажей →</a>`;
  host.innerHTML=html;
  host.querySelectorAll('[data-local]').forEach(a=>a.onclick=e=>{ e.preventDefault(); const bid=a.getAttribute('href').split('@')[1]; const el=document.getElementById('b-'+bid); if(el){ el.scrollIntoView({block:'center',behavior:'smooth'}); el.classList.add('flash'); setTimeout(()=>el.classList.remove('flash'),1500); } });
  host.querySelectorAll('[data-know]').forEach(b=>b.onclick=()=>{ const k=b.dataset.know; const cur=(c.know[k]||{})[p.id]||''; const v=prompt(`${k} · ${p.title}\nЧто знает / понял к этой главе:`, cur); if(v===null) return; c.know[k]=c.know[k]||{}; if(v.trim()) c.know[k][p.id]=v.trim(); else delete c.know[k][p.id]; save(); renderPane(); });
}
function paneChrono(host){
  const c=chrono(); const chapters=storyChapters();
  let html=`<div class="pane-title">Хронология <small>${chapters.length} глав</small></div><div class="chrono compact">`;
  chapters.forEach(ch=>{ const d=parseKey(c.dates[ch.id])||parseDate(ch.title); const tags=(c.chapterLines[ch.id]||[]).map(id=>c.lines.find(l=>l.id===id)).filter(Boolean).map(l=>`<span class="ltag" style="--lc:${l.color}">${esc(l.name)}</span>`).join('');
    html+=`<a class="ch-item${curPage===ch?' cur':''}" href="#/${ch.id}"><div class="ch-main"><span class="ch-title">${esc(ch.title)}</span>${ch.sub?`<span class="ch-pov">${esc(ch.sub)}</span>`:''}</div><div class="ch-meta">${d?`<span class="ch-d">${dateLabel(d)}</span>`:''}${tags}</div></a>`;
    c.marks.filter(m=>m.pid===ch.id).forEach(m=>{ html+=`<div class="ch-item mark"><div class="ch-main"><span class="mk">⚑</span><span class="ch-title">${esc(m.title)}</span></div>${m.note?`<div class="ch-meta"><span class="mk-note">${esc(m.note)}</span></div>`:''}</div>`; }); });
  html+=`</div><a class="link-btn dim" href="#/chrono">Открыть хронологию и линии →</a>`;
  host.innerHTML=html; const cur=host.querySelector('.ch-item.cur'); if(cur) cur.scrollIntoView({block:'center'});
}
function renderPaneLegacy(focusBid){
  const tab=prefs.paneTab||'page'; const host=$('#view2Body');
  if(tab==='notes'){ paneNotes(host); return; } if(tab==='chars'){ paneChars(host); return; } if(tab==='chrono'){ paneChrono(host); return; }
  const p=PAGE[prefs.split]; if(!p){ host.innerHTML=''; return; }
  const blocks=pageBlocks(p).filter(b=>!b.deleted); const order={}; blocks.forEach((b,i)=>order[b.id]=i);
  const wrap=document.createElement('div'); wrap.className='blocks';
  blocks.forEach(b=>{ const el=document.createElement('div'); el.className='blk '+b.t+(HEAD_TYPES.has(b.t)?'':' noteable'); el.innerHTML=`<div class="body ${b.t==='table'?'scroll':''}">${b.h}</div><div class="noteslot"></div>`;
    // highlights (single-block) and read-only cards
    const body=el.querySelector('.body'); const text=body.textContent;
    Object.values(D.anns).forEach(a=>{ if(a.b1!==b.id||a.b2!==b.id||!a.text||a.done) return; let r=null; if(text.slice(a.o1,a.o2)===a.q) r=[a.o1,a.o2]; else { const i=text.indexOf(a.q); if(i>=0) r=[i,i+a.q.length]; } if(r&&r[1]>r[0]) wrapRange(body, r[0], r[1], a.id); });
    const slot=el.querySelector('.noteslot'); const n=noteOf(b.id); if(n && !n.done) slot.appendChild(noteCard(n,'Заметка к абзацу'));
    Object.values(D.anns).filter(a=>a.b1===b.id && a.text && !a.done).sort((a,b)=>a.o1-b.o1).forEach(a=>{ const c=noteCard({text:a.text,quote:a.q,kind:a.kind}, a.by?('Заметка редактора · '+esc(a.by)):'Заметка к фрагменту'); if(a.by) c.classList.add('editor'); slot.appendChild(c); });
    wrap.appendChild(el); });
  host.innerHTML=`<div class="pane-title">${gtag(groupOf(p.section))} ${esc(secLabel(p.section))} · ${esc(p.title)}${showSub(p)?' · '+esc(p.sub):''}</div>${isArchive(p)?tocHTML(p,true):''}`; host.appendChild(wrap);
  blocks.forEach((b,i)=>{ wrap.children[i].id='p2-'+b.id; });
  host.querySelectorAll('.page-toc a').forEach(a=>a.onclick=e=>{ e.preventDefault(); const el=document.getElementById('p2-'+a.dataset.b); if(el){ el.scrollIntoView({block:'start',behavior:'smooth'}); el.classList.add('flash'); setTimeout(()=>el.classList.remove('flash'),1500); } });
  host.querySelectorAll('mark.ann').forEach(m=>m.style.cursor='default');
  if(focusBid){ const el=document.getElementById('p2-'+focusBid); if(el) setTimeout(()=>{ el.scrollIntoView({block:'start'}); el.classList.add('flash'); },60); }
}
/* ---------- built-in notes (e.g. editor's comments shipped with the content) ---------- */
function applySeeds(){
  const seeds=C.seeds||{}; D.seeded=D.seeded||[]; D.seedIds=D.seedIds||[]; let n=0;
  // remember ids of everything already seeded (legacy states without seedIds)
  for(const key in seeds){ if(D.seeded.includes(key)) (seeds[key].anns||[]).forEach(a=>{ if(!D.seedIds.includes(a.id)) D.seedIds.push(a.id); }); }
  for(const key in seeds){
    if(D.seeded.includes(key)) continue;
    const sd=seeds[key];
    (sd.anns||[]).forEach(a=>{
      if(!BLOCK[a.b1] || !BLOCK[a.b2]) return;
      const ex=D.anns[a.id];
      if(ex && BLOCK[ex.b1] && BLOCK[ex.b2]) return;            // already there and still anchored
      if(!ex && D.seedIds.includes(a.id)) return;               // was removed on purpose
      D.anns[a.id]={id:a.id,b1:a.b1,o1:a.o1,b2:a.b2,o2:a.o2,q:a.q,text:ex?ex.text:a.text,by:a.by||'',ts:Date.parse(a.ts)||Date.now()}; n++;
      if(!D.seedIds.includes(a.id)) D.seedIds.push(a.id);
    });
    if(sd.pageNote && sd.page && !D.pageNotes[sd.page]) D.pageNotes[sd.page]=sd.pageNote;
    D.seeded.push(key);
  }
  if(n) save();
}

/* ---------- user pages (new chapters) ---------- */
function registerUserPages(){
  D.pages = D.pages||[];
  C.sections.forEach(sec=>{ for(let i=sec.pages.length-1;i>=0;i--){ const p=sec.pages[i]; if(p.user && !D.pages.find(u=>u.id===p.id)){ sec.pages.splice(i,1); PAGES.splice(PAGES.indexOf(p),1); delete PAGE[p.id]; } } });
  D.pages.forEach(u=>{
    const sec = C.sections.find(x=>x.id===(u.sec||'text')) || C.sections[0];
    let p=PAGE[u.id];
    if(!p){ p={id:u.id, title:u.title, sub:u.sub||'', kind:sec.id==='text'?'chapter':'doc', user:true, blocks:[], section:sec}; const last=sec.pages[sec.pages.length-1]; sec.pages.push(p); PAGES.splice(last?PAGES.indexOf(last)+1:PAGES.length, 0, p); PAGE[p.id]=p; }
    else if(p.section!==sec){ const old=p.section; old.pages.splice(old.pages.indexOf(p),1); PAGES.splice(PAGES.indexOf(p),1); p.section=sec; p.kind=sec.id==='text'?'chapter':'doc'; const last=sec.pages[sec.pages.length-1]; sec.pages.push(p); PAGES.splice(last?PAGES.indexOf(last)+1:PAGES.length, 0, p); p.title=u.title; p.sub=u.sub||''; }
    else { p.title=u.title; p.sub=u.sub||''; }
  });
}
function openChapterDialogLegacy(p, secId){
  const m=$('#chapterModal'); m.hidden=false; m.dataset.page=p?p.id:'';
  const sec = p ? p.section.id : (secId||'text');
  $('#chSec').value = sec;
  const kind = sec==='text'?'Глава':sec==='extra'?'Экстра':'Материал';
  $('#chTitleH').textContent = p ? kind : (sec==='text'?'Новая глава':sec==='extra'?'Новая экстра':'Новый материал');
  $('#chTitle').placeholder = sec==='text' ? '23. 16 декабря' : sec==='extra' ? 'Название экстры' : 'Название материала';
  $('#chSub').placeholder = sec==='text' ? 'Минхо' : sec==='extra' ? 'экстра' : 'подзаголовок (необязательно)';
  $('#chTitle').value = p?p.title:''; $('#chSub').value = p?(p.sub||''):'';
  $('#chDelete').hidden = !p; $('#chDelete').textContent='Удалить'; $('#chDelete').dataset.armed='';
  $('#chSave').textContent = p?'Сохранить':'Создать';
  setTimeout(()=>$('#chTitle').focus(),30);
}
function saveChapterDialog(){
  const m=$('#chapterModal'); const title=$('#chTitle').value.trim(); const sub=$('#chSub').value.trim();
  if(!title){ $('#chTitle').focus(); return; }
  const pid=m.dataset.page; const sec=$('#chSec').value||'text';
  if(pid){ const u=D.pages.find(x=>x.id===pid); if(u){ u.title=title; u.sub=sub; u.sec=sec; } registerUserPages(); save(); buildToc(); m.hidden=true; route(); }
  else { const id='np'+Date.now().toString(36); D.pages.push({id,title,sub,sec}); registerUserPages(); save(); buildToc(); m.hidden=true; setMode('edit'); nav('#/'+id); setTimeout(()=>{ if(curPage&&curPage.id===id&&!pageBlocks(curPage).length) insertBlock('top:'+id, null); },60); }
}
function deleteUserPage(pid){
  D.pages=(D.pages||[]).filter(x=>x.id!==pid);
  const keys=Object.keys(D.ins).filter(k=>k==='top:'+pid || PAGE_OF[k]===pid);
  keys.forEach(k=>{ D.ins[k].forEach(b=>{ delete D.notes[b.id]; delete D.edits[b.id]; delete BLOCK[b.id]; delete PAGE_OF[b.id]; }); delete D.ins[k]; });
  delete D.pageNotes[pid];
  for(const k in D.anns){ if(PAGE_OF[D.anns[k].b1]===pid || D.anns[k].b1.startsWith(pid)) delete D.anns[k]; }
  registerUserPages(); save(); buildToc(); nav('#/'); 
}

/* ---------- block model (original + user layer) ---------- */
function pageBlocks(p){
 if(!p)return [];
  // returns [{id, t, h, orig, inserted, deleted}]
  const out = [];
  const push = (b, inserted) => {
    const deleted = !inserted && !!D.del[b.id];
    const edited = D.edits[b.id];
    out.push({ id:b.id, t:(!inserted && D.types && D.types[b.id]) || b.t, h: edited!==undefined ? edited : b.h, orig:b.h, inserted, deleted, edited: edited!==undefined });
    (D.ins[b.id]||[]).forEach(ib => push(ib, true));
  };
  (D.ins['top:'+p.id]||[]).forEach(ib => push(ib, true));
  p.blocks.forEach(b => push(b, false));
  return out;
}
function findIns(id){ for(const k in D.ins){ const i = D.ins[k].findIndex(b=>b.id===id); if(i>=0) return {k,i}; } return null; }
function blockText(h){ const d=document.createElement('div'); d.innerHTML=String(h).replace(/<br\s*\/?>/gi,'\n').replace(/<\/(p|div|tr|li|figcaption)>/gi,'\n').replace(/<li[^>]*>/gi,'• ').replace(/<\/(td|th)>/gi,' '); return d.textContent.replace(/\u00a0/g,' ').replace(/[ \t]+\n/g,'\n').trim(); }
const NOTE_KINDS=[['logic','Логика'],['character','Характер'],['style','Стиль'],['fact','Проверить факт']];
function kindLabel(k){ const x=NOTE_KINDS.find(y=>y[0]===k); return x?x[1]:''; }
let showDone=false;
function noteOf(id){ const n=D.notes[id]; return n && n.text && n.text.trim() ? n : null; }
function annsOf(id){ return Object.values(D.anns||{}).filter(a=>a.b1===id && a.text && a.text.trim()).sort((a,b)=>(a.o1-b.o1)||(a.ts-b.ts)); }
function notesOf(id){ const out=[]; const n=noteOf(id); if(n) out.push({text:n.text, quote:n.quote||'', kind:'para'}); annsOf(id).forEach(a=>out.push({text:a.text, quote:a.q||'', kind:'ann', id:a.id, by:a.by||''})); return out; }
function hasNotes(id){ return !!noteOf(id) || annsOf(id).length>0; }
function pageStats(p){
  let notes=0, edits=0, done=0;
  const cnt=n=>{ if(!n) return; if(n.done) done++; else notes++; };
  p.blocks.forEach(b=>{ cnt(noteOf(b.id)); if(D.edits[b.id]!==undefined || D.del[b.id]) edits++; });
  for(const k in D.ins){ if(k==='top:'+p.id || PAGE_OF[k]===p.id){ edits += D.ins[k].length; D.ins[k].forEach(b=>{ cnt(noteOf(b.id)); }); } }
  for(const k in (D.anns||{})){ const a=D.anns[k]; if(a.text && a.text.trim() && (a.lost ? a.pid===p.id : PAGE_OF[a.b1]===p.id)) cnt(a); }
  if(D.pageNotes[p.id] && D.pageNotes[p.id].trim()) notes++;
  return {notes, edits, done};
}

/* ---------- state & routing ---------- */
let mode='read', curPage=null;
/* ---------- fonts & sizes ---------- */
const FONTS=[
  {id:'literata', label:'Literata', note:'печатный, по умолчанию', k:1, ff:"'Literata',Georgia,serif"},
  {id:'roboto',   label:'Roboto Serif', note:'печатный', k:0.97, ff:"'Roboto Serif',Georgia,serif"},
  {id:'bitter',   label:'Bitter', note:'печатный, брусковый', k:0.97, ff:"'Bitter',Georgia,serif"},
  {id:'didact',   label:'Didact Gothic', note:'гротеск', k:1, ff:"'Didact Gothic',sans-serif"},
  {id:'comfortaa',label:'Comfortaa', note:'округлый гротеск', k:0.94, ff:"'Comfortaa',sans-serif"},
  {id:'badscript',label:'Bad Script', note:'рукописный', k:1.12, ff:"'Bad Script',cursive"},
  {id:'amatic',   label:'Amatic SC', note:'рукописный, узкий', k:1.35, ff:"'Amatic SC',cursive"},
  {id:'beer',     label:'Beer Money', note:'рукописный', k:1.22, ff:"'Beer Money',cursive"},
  {id:'ftw',      label:'First Time Writing', note:'рукописный', k:1.2, ff:"'First Time Writing',cursive"}
];
const UIFONTS=[
  {id:'beer',     label:'Beer Money', ff:"'Beer Money',cursive"},
  {id:'boozy',    label:'Boozy', ff:"'Boozy',cursive"},
  {id:'angst',    label:'Angst', ff:"'Angst',Georgia,serif"},
  {id:'bicubik',  label:'Bicubik', ff:"'Bicubik',sans-serif"},
  {id:'druzhok',  label:'Druzhok', ff:"'Druzhok',Georgia,serif"},
  {id:'amatic',   label:'Amatic SC', ff:"'Amatic SC',cursive"},
  {id:'badscript',label:'Bad Script', ff:"'Bad Script',cursive"},
  {id:'ftw',      label:'First Time Writing', ff:"'First Time Writing',cursive"},
  {id:'comfortaa',label:'Comfortaa', ff:"'Comfortaa',sans-serif"}
];
const SIZES=[{px:15,label:'Мелкий'},{px:16,label:'Компактный'},{px:17,label:'Обычный'},{px:18.5,label:'Крупный'},{px:20,label:'Очень крупный'},{px:22,label:'Огромный'}];
const PREF_KEY='wsblank1prefs';
let prefs={font:'literata', size:17, theme:'dark', split:''};
function loadPrefs(){ try{ const raw=LS && LS.getItem(PREF_KEY); if(raw) Object.assign(prefs, JSON.parse(raw)); }catch(e){} }
function savePrefs(){ try{ if(LS) LS.setItem(PREF_KEY, JSON.stringify(prefs)); }catch(e){} }
function applyTheme(){ document.body.dataset.theme=prefs.theme==='light'?'light':'dark'; const b=$('#btnTheme'); if(b) b.title = prefs.theme==='light' ? 'Тёмная тема' : 'Светлая тема'; savePrefs(); }
function applyFont(){
  const f=FONTS.find(x=>x.id===((CUR_PROJ.look&&CUR_PROJ.look.font)||prefs.font))||FONTS[0];
  document.body.dataset.font=f.id;
  document.body.style.fontSize=(prefs.size*f.k).toFixed(1)+'px';
  savePrefs();
  $$('#fontMenu button').forEach(b=>b.classList.toggle('on', b.dataset.v===f.id));
  $$('#sizeMenu button').forEach(b=>b.classList.toggle('on', +b.dataset.v===prefs.size));
}
function buildPrefMenus(){
  const fm=document.createElement('div'); fm.id='fontMenu'; fm.className='popmenu'; fm.hidden=true;
  fm.innerHTML=FONTS.map(f=>`<button type="button" data-v="${f.id}" data-font="${f.id}"><span class="pv" style="font-family:${f.ff}">${f.label}</span><span class="nt">${f.note}</span></button>`).join('');
  fm.addEventListener('mousedown',e=>e.preventDefault());
  fm.addEventListener('click',e=>{ const b=e.target.closest('button[data-v]'); if(!b) return; prefs.font=b.dataset.v; if(CUR_PROJ.look){ CUR_PROJ.look.font=b.dataset.v; saveProjects(PROJ); } applyFont(); hidePopmenus(); });
  const sm=document.createElement('div'); sm.id='sizeMenu'; sm.className='popmenu'; sm.hidden=true;
  sm.innerHTML=SIZES.map(z=>`<button type="button" data-v="${z.px}"><span class="pv" style="font-size:${z.px}px">Aa</span><span class="nt">${z.label} · ${z.px}</span></button>`).join('');
  sm.addEventListener('mousedown',e=>e.preventDefault());
  sm.addEventListener('click',e=>{ const b=e.target.closest('button[data-v]'); if(!b) return; prefs.size=+b.dataset.v; applyFont(); hidePopmenus(); });
  document.body.append(fm, sm);
}
function hidePopmenus(){ $$('.popmenu').forEach(m=>m.hidden=true); }
function togglePopmenu(m, anchor){
  const was=!m.hidden; hidePopmenus(); hideInsertMenu(); if(was) return;
  m.hidden=false; const r=anchor.getBoundingClientRect(); const w=m.offsetWidth, h=m.offsetHeight;
  let left=r.right-w, top=r.bottom+8; if(left<8) left=8; if(top+h>innerHeight-8) top=Math.max(8,r.top-h-8);
  m.style.left=left+'px'; m.style.top=top+'px';
}
function nav(hash){ try{ location.hash = hash; }catch(e){ route(hash); } }
function route(h){
  h = (h ?? location.hash ?? '').replace(/^#\/?/,'');
  closeSide();
  if(!h || h==='home'){ renderHome(); return; }
  const [pid, bid] = h.split('@');
  if(PAGE[pid]) renderPage(PAGE[pid], bid); else renderHome();
}
window.addEventListener('hashchange', ()=>route());

/* ---------- TOC ---------- */
function buildTocLegacy(){
  const toc=$('#toc'); toc.innerHTML='';
  GROUPS.forEach(g=>{
    const box=document.createElement('div'); box.className='toc-group '+g.id; box.innerHTML=`<h3>${g.title}</h3>`; toc.appendChild(box);
    const secs=C.sections.filter(s=>g.secs.includes(s.id));
    if(g.id==='archive'){ if(!secs.some(s=>s.pages.length)){ box.innerHTML+='<div class="toc-hint">Сюда уходит снятое с работы — кнопка «В архив» на странице</div>'; } else secs.forEach(s=>s.pages.forEach(p=>{ const a=document.createElement('a'); a.href='#/'+p.id; a.dataset.page=p.id; a.innerHTML=`<span class="t">${esc(p.title)}</span><span class="badges"></span>`; box.appendChild(a); })); return; }
    secs.forEach(s=>{
      if(secs.length>1){ const h=document.createElement('h4'); h.textContent=secLabel(s); box.appendChild(h); }
      s.pages.forEach(p=>{
        const a=document.createElement('a'); a.href='#/'+p.id; a.dataset.page=p.id;
        a.innerHTML = `<span class="t">${esc(p.title)}${showSub(p)?`<br><span class="sub">${esc(p.sub)}</span>`:''}</span><span class="badges"></span>`;
        box.appendChild(a);
      });
      { const b=document.createElement('button'); b.className='toc-new'; b.textContent=s.id==='text'?'+ Новая глава':s.id==='extra'?'+ Новая экстра':'+ Новый материал'; b.onclick=()=>{ closeSide(); openChapterDialog(null, s.id); }; box.appendChild(b); }
    });
  });
  refreshBadges();
}
function badgesHTML(st){ return st.notes?`<span class="badge n" title="заметки">${st.notes}</span>`:''; }
function refreshBadges(){
  let total=0; PAGES.forEach(p=>{ total+=pageStats(p).notes; }); const nc=$('#noteCount'); if(nc) nc.textContent=total;
  updateClearBtn();
  $$('#toc a').forEach(a=>{ const p=PAGE[a.dataset.page]; if(p) a.querySelector('.badges').innerHTML = badgesHTML(pageStats(p)); a.classList.toggle('on', curPage && a.dataset.page===curPage.id); });
}
function openSide(){ $('#side').classList.add('open'); $('#sideShade').classList.add('on'); }
function closeSide(){ $('#side').classList.remove('open'); $('#sideShade').classList.remove('on'); }

/* ---------- search ---------- */
let TEXTS=null;
const fold=x=>x.replace(/ё/g,'е').replace(/Ё/g,'Е');
const searchOpts={scopes:{work:true, base:true, notes:true}, yo:false, replace:false};
function scopeOfPage(p){ return groupOf(p.section).id==='work'?'work':'base'; }
function ensureTexts(){ if(TEXTS) return; TEXTS=[]; PAGES.forEach(p=>{ const sc=scopeOfPage(p); pageBlocks(p).forEach(b=>{ if(b.deleted) return; if(GRID_TYPES.has(b.t)||NOEDIT_TYPES.has(b.t)) { TEXTS.push({id:b.id,pid:p.id,x:blockText(b.h),l:null,sc,noRepl:true}); return; } TEXTS.push({id:b.id,pid:p.id,x:blockText(b.h),l:null,sc}); }); const pn=D.pageNotes[p.id]; if(pn) TEXTS.push({id:'',pid:p.id,x:'Заметка к странице: '+pn,l:null,sc:'notes'}); }); Object.values(D.anns).forEach(a=>{ const pid=a.lost?a.pid:PAGE_OF[a.b1]; if(a.text && pid && PAGE[pid]) TEXTS.push({id:a.lost?'':a.b1,pid,x:'Заметка: '+a.text,l:null,sc:'notes'}); }); TEXTS.forEach(t=>{ t.l=t.x.toLowerCase(); t.f=fold(t.l); }); }
function searchHits(q, limit){ ensureTexts(); const needle=searchOpts.yo?fold(q):q; const hits=[]; for(const t of TEXTS){ if(!searchOpts.scopes[t.sc]) continue; const hay=searchOpts.yo?t.f:t.l; let i=hay.indexOf(needle); if(i<0) continue; hits.push({t,i}); if(limit && hits.length>=limit) break; } return hits; }
function matchRegex(q){ let e=q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); if(searchOpts.yo) e=e.replace(/[её]/gi, m=>/[ЕЁ]/.test(m)?'[ЕЁ]':'[её]'); return new RegExp(e,'gi'); }
function replaceInHTML(html, q, to){
  const d=document.createElement('div'); d.innerHTML=html; const re=matchRegex(q); let n=0;
  const w=document.createTreeWalker(d, NodeFilter.SHOW_TEXT); const nodes=[]; let nd; while(nd=w.nextNode()) nodes.push(nd);
  nodes.forEach(node=>{ const v=node.nodeValue; if(!re.test(v)) { re.lastIndex=0; return; } re.lastIndex=0;
    node.nodeValue=v.replace(re, m=>{ n++; if(m[0]===m[0].toUpperCase() && m[0]!==m[0].toLowerCase() && q[0]===q[0].toLowerCase()) return to[0].toUpperCase()+to.slice(1); return to; }); });
  return {html:d.innerHTML, n};
}
function runReplace(onlyPage){
  const q=$('#search').value.trim(); const to=$('#replWith').value; if(q.length<2) return;
  const hits=searchHits(q.toLowerCase(), 0).filter(h=>h.t.id && h.t.sc!=='notes' && !h.t.noRepl && (!onlyPage || (curPage && h.t.pid===curPage.id)));
  const byPage={}; hits.forEach(h=>{ (byPage[h.t.pid]=byPage[h.t.pid]||new Set()).add(h.t.id); });
  const undo=[]; let total=0, pages=0;
  for(const pid in byPage){ const p=PAGE[pid]; const views=pageBlocks(p); let touched=false;
    views.forEach(b=>{ if(!byPage[pid].has(b.id) || b.deleted) return; const r=replaceInHTML(b.h, q, to); if(!r.n) return; undo.push({pid, id:b.id, prev:b.h}); setModelHTML(b, r.html); total+=r.n; touched=true; });
    if(touched) pages++; }
  if(!total){ toast('Заменять нечего'); return; }
  save(); if(curPage && byPage[curPage.id]) rerender(); doSearch($('#search').value);
  toast(`Заменено: ${total} (${pages} стр.)`, {label:'Отменить', fn:()=>{ undo.forEach(u=>{ const p=PAGE[u.pid]; if(!p) return; const b=pageBlocks(p).find(x=>x.id===u.id); if(b) setModelHTML(b, u.prev); }); save(); if(curPage) rerender(); doSearch($('#search').value); toast('Замена отменена'); }});
}
function updateReplInfo(){ const q=$('#search').value.trim(); const el=$('#replInfo'); if(!el) return; if(q.length<2||!searchOpts.replace){ el.textContent=''; return; } const hits=searchHits(q.toLowerCase(),0).filter(h=>h.t.id && h.t.sc!=='notes' && !h.t.noRepl); const here=curPage?hits.filter(h=>h.t.pid===curPage.id).length:0; el.textContent=`Совпадений в тексте: ${hits.length}${curPage?` · на этой странице: ${here}`:''}. Заметки и таблицы не трогаются.`; $('#replPage').disabled=!here; $('#replAll').disabled=!hits.length; }
function doSearch(q){
  const res=$('#searchResults'), toc=$('#toc'), tools=$('#searchTools');
  q=q.trim().toLowerCase();
  if(q.length<2){ res.hidden=true; toc.hidden=false; tools.hidden=true; return; }
  tools.hidden=false; updateReplInfo();
  const hits=searchHits(q, 80);
  res.hidden=false; toc.hidden=true;
  if(!hits.length){ res.innerHTML='<div class="empty">Ничего не найдено</div>'; return; }
  const to=searchOpts.replace?$('#replWith').value:'';
  res.innerHTML = hits.map(({t,i})=>{
    const s=Math.max(0,i-60), e=Math.min(t.x.length,i+q.length+80);
    const repl = (searchOpts.replace && t.id && t.sc!=='notes' && !t.noRepl && to) ? `<ins>${esc(to)}</ins>` : '';
    const snip = (s>0?'…':'')+esc(t.x.slice(s,i))+'<mark class="'+(repl?'old':'')+'">'+esc(t.x.slice(i,i+q.length))+'</mark>'+repl+esc(t.x.slice(i+q.length,e))+(e<t.x.length?'…':'');
    return `<a class="r" href="#/${t.pid}${t.id?'@'+t.id:''}"><div class="where">${esc(PAGE[t.pid].title)}</div><div class="snip">${snip}</div></a>`;
  }).join('');
}

/* ---------- home ---------- */
function renderHomeLegacy(){
  curPage=null; refreshBadges(); $('#timeline').innerHTML=''; tlMarks=[]; $('#btnCopy').hidden=true; $('#btnVersions').hidden=true; document.body.classList.remove('has-page');
  $('#crumb').innerHTML=esc(CUR_PROJ.name)+' <small>рабочее пространство</small>'; document.body.dataset.group=''; requestAnimationFrame(setBarH);
  const v=$('#view'); v.className='view home';
  let html = `<div class="page-head"><h1>Ракурс</h1><div class="sub">рабочее пространство${CUR_PROJ.builtin&&!PROJ.setup?'':' · '+esc(CUR_PROJ.name)}</div></div>`;
  GROUPS.forEach(g=>{
    const secs=C.sections.filter(s=>g.secs.includes(s.id));
    if(g.id==='archive' && !secs.some(s=>s.pages.length)) return;
    html += `<section class="home-group ${g.id}"><h2 class="g-title">${gtag(g)}</h2>`;
    if(g.id==='archive'){ html += `<div class="list">`; secs.forEach(s=>s.pages.forEach(p=>{ html += `<a class="card" href="#/${p.id}"><span class="t">${esc(p.title)}</span><span class="badges">${badgesHTML(pageStats(p))}</span></a>`; })); html += '</div></section>'; return; }
    secs.forEach(s=>{
      if(secs.length>1) html += `<h3>${esc(secLabel(s))}</h3>`;
      html += `<div class="list ${s.id==='text'?'cards-2':''}">`;
      s.pages.forEach(p=>{ const st=pageStats(p); html += `<a class="card" href="#/${p.id}"><span class="t">${esc(p.title)}${showSub(p)?`<span class="sub">${esc(p.sub)}</span>`:''}</span><span class="badges">${badgesHTML(st)}</span></a>`; });
      html += `<button class="card card-new" data-a="newchapter" data-sec="${s.id}"><span class="t">${s.id==='text'?'+ Новая глава':s.id==='extra'?'+ Новая экстра':'+ Новый материал'}</span></button>`;
      html += '</div>';
    });
    html += '</section>';
  });
  v.innerHTML=html; window.scrollTo(0,0);
  v.querySelectorAll('[data-a=newchapter]').forEach(nb=>{ nb.onclick=()=>openChapterDialog(null, nb.dataset.sec); });
}

/* ---------- page ---------- */
let numbering = {};
function renderPageLegacy(p, focusId){
  if(curPage && curPage!==p && mode==='edit') autoVersion();
  curPage=p; refreshBadges(); $('#btnCopy').hidden=false; $('#btnVersions').hidden=false; document.body.classList.add('has-page'); lastFocusId=null;
  const g=groupOf(p.section); document.body.dataset.group=g.id; requestAnimationFrame(setBarH);
  $('#crumb').innerHTML = `${gtag(g)} ${esc(p.title)} <small>${esc(secLabel(p.section))}</small>`;
  if(document.body.classList.contains('split') && (prefs.paneTab||'page')!=='page') setTimeout(renderPane, 0);
  const v=$('#view'); v.className='view';
  v.innerHTML='';
  const head=document.createElement('div'); head.className='page-head';
  head.innerHTML = `<div class="kicker">${gtag(g)}<span class="sep">·</span>${esc(secLabel(p.section))}</div><h1>${esc(p.title)}</h1>${showSub(p)?`<div class="sub">${esc(p.sub)}</div>`:''}<div class="head-tools">${p.user?'<button class="link-btn" data-a="chprops">Название, подзаголовок, раздел</button>':''}<button class="link-btn" data-a="showdone" hidden></button><button class="link-btn dim" data-a="archive">${p.section.id==='arch'?'Вернуть из архива':'В архив'}</button></div>
    <div class="page-note"><textarea placeholder="Заметка к странице" rows="1">${esc(D.pageNotes[p.id]||'')}</textarea></div>${isArchive(p)?tocHTML(p):''}`;
  v.appendChild(head);
  const cp=head.querySelector('[data-a=chprops]'); if(cp) cp.onclick=()=>openChapterDialog(p);
  const ab=head.querySelector('[data-a=archive]'); ab.onclick=()=>{ if(!ab.dataset.armed){ ab.dataset.armed='1'; const t=ab.textContent; ab.textContent=t+' — точно?'; setTimeout(()=>{ ab.dataset.armed=''; ab.textContent=t; },3000); return; } toggleArchive(p); };
  head.querySelectorAll('.page-toc .side-open').forEach(b=>b.onclick=()=>{ toggleSplit(true); prefs.split=p.id; $('#view2Select').value=p.id; savePrefs(); renderPane(b.dataset.b); });
  const sd=head.querySelector('[data-a=showdone]'); updateClearBtn();
  sd.onclick=()=>{ showDone=!showDone; rerender(); updateClearBtn(); };
  const ta=head.querySelector('textarea'); ta.classList.toggle('has', !!(D.pageNotes[p.id]||'').trim());
  const grow=()=>{ ta.style.height='auto'; ta.style.height=(ta.scrollHeight+2)+'px'; };
  ta.addEventListener('input',()=>{ const t=ta.value; if(t.trim()) D.pageNotes[p.id]=t; else delete D.pageNotes[p.id]; ta.classList.toggle('has',!!t.trim()); save(); grow(); });
  setTimeout(grow,0);

  document.body.classList.toggle('special-page', !!p.special);
  if(p.special){ $('#btnVersions').hidden=true; $('#btnCopy').hidden=true; const host=document.createElement('div'); host.className='special'; v.appendChild(host); if(p.special==='chrono') renderChrono(p, host); else renderChars(p, host); $('#timeline').innerHTML=''; tlMarks=[]; if(focusId){ const el=document.getElementById('b-'+focusId); if(el) el.scrollIntoView({block:'center'}); } else window.scrollTo(0,0); return; }
  const visibleIds=new Set(pageBlocks(p).filter(b=>!b.deleted).map(b=>b.id));
  const lostAnns=Object.values(D.anns).filter(a=>a.text && a.text.trim() && (!a.done||showDone) && ((a.lost && a.pid===p.id) || (!a.lost && PAGE_OF[a.b1]===p.id && !visibleIds.has(a.b1))));
  if(lostAnns.length){ const box=document.createElement('div'); box.className='lost-box'; box.innerHTML=`<div class="lost-t">Заметки без места в тексте (${lostAnns.length}) — абзац, к которому они были привязаны, удалён или переписан</div>`;
    lostAnns.forEach(a=>{ const c=noteCard({text:a.text, quote:a.q, kind:a.kind, done:a.done}, a.by?('Заметка редактора · '+esc(a.by)):'Заметка к фрагменту', ()=>{ a.done=!a.done; save(); rerender(); }); c.classList.add('lost'); if(a.by) c.classList.add('editor');
      const ab=document.createElement('button'); ab.className='anchor-btn'; ab.textContent='Привязать к выделению'; ab.onclick=e=>{ e.stopPropagation(); startAnchor(a.id); };
      const db=document.createElement('button'); db.className='anchor-btn'; db.textContent='Удалить'; db.onclick=e=>{ e.stopPropagation(); delete D.anns[a.id]; save(); rerender(); };
      c.querySelector('.meta').append(ab, db); box.appendChild(c); });
    v.appendChild(box); }
  const wrap=document.createElement('div'); wrap.className='blocks'; v.appendChild(wrap);
  if(mode==='edit'){ wrap.contentEditable='true'; wrap.spellcheck=true; bindEditor(wrap); histReset(); }
  renderBlocks(wrap, p);

  buildTimeline(p);
  if(focusId){ const el=document.getElementById('b-'+focusId); if(el){ setTimeout(()=>{ el.scrollIntoView({block:'center'}); el.classList.add('flash'); },50); } }
  else window.scrollTo(0,0);
}
let tlMarks=[], tlTicking=false;
function buildTimeline(p){
  const tl=$('#timeline'); tl.innerHTML=''; tlMarks=[];
  const blocks=pageBlocks(p).filter(b=>!b.deleted);
  let marks = blocks.filter(b=>b.t==='time');
  if(marks.length<2) marks = blocks.filter(b=>b.t==='h2');
  if(marks.length<2) marks = blocks.filter(b=>b.t==='h3');
  if(marks.length<2) return;
  marks.forEach(b=>{ const a=document.createElement('a'); a.href='#/'+p.id+'@'+b.id; a.textContent=blockText(b.h).slice(0,40); a.onclick=e=>{ e.preventDefault(); const el=document.getElementById('b-'+b.id); if(el){ const y=el.getBoundingClientRect().top+window.scrollY-($('.bar').offsetHeight+12); window.scrollTo({top:y,behavior:'smooth'}); } }; tl.appendChild(a); tlMarks.push({id:'b-'+b.id, a}); });
  updateTimeline();
}
function updateTimeline(){
  if(!tlMarks.length) return;
  const limit=$('.bar').offsetHeight+40; let cur=tlMarks[0];
  for(const m of tlMarks){ const el=document.getElementById(m.id); if(!el) continue; if(el.getBoundingClientRect().top<=limit) cur=m; else break; }
  tlMarks.forEach(m=>m.a.classList.toggle('on', m===cur));
  cur.a.scrollIntoView({block:'nearest',inline:'center',behavior:'smooth'});
}
window.addEventListener('scroll', ()=>{ if(tlTicking) return; tlTicking=true; requestAnimationFrame(()=>{ updateTimeline(); tlTicking=false; }); }, {passive:true});
function renderBlocks(wrap, p){
  wrap.querySelectorAll('.blk').forEach(e=>e.remove());
  numbering={}; ORDER={}; VIEW={}; let n=0;
  const list=pageBlocks(p); list.forEach((b,i)=>{ ORDER[b.id]=i; VIEW[b.id]=b; });
  list.forEach(b=>{
    if(!HEAD_TYPES.has(b.t) && !b.deleted) numbering[b.id]=++n;
    wrap.appendChild(makeBlockEl(b));
  });
}
function makeBlockEl(b){
  const el=document.createElement('div');
  el.className='blk '+b.t+(b.inserted?' inserted':'')+(b.deleted?' deleted':'')+(b.edited?' edited':'')+(HEAD_TYPES.has(b.t)?'':' noteable');
  el.id='b-'+b.id; el.dataset.id=b.id;
  const num = numbering[b.id];
  el.innerHTML = `<span class="num" aria-hidden="true">${num||''}</span><div class="body ${b.t==='table'?'scroll':''}">${b.h}</div><div class="toolslot"></div><div class="noteslot"></div>`;
  if(hasNotes(b.id)) el.classList.add('has-note');
  if(b.deleted){ const st=document.createElement('div'); st.className='stub'; st.innerHTML=`<span>Абзац удалён</span><button class="link" data-a="restore">вернуть</button>`; st.querySelector('button').onclick=()=>{ delete D.del[b.id]; save(); rerender(); }; el.insertBefore(st, el.querySelector('.toolslot')); }
  if(mode==='edit'){ el.querySelector('.num').contentEditable='false'; el.querySelector('.toolslot').contentEditable='false'; el.querySelector('.noteslot').contentEditable='false'; if(b.deleted) el.contentEditable='false';
    const bd=el.querySelector(':scope > .body'); if(!b.deleted && TEXT_TYPES.has(b.t) && !GRID_TYPES.has(b.t) && !bd.childNodes.length) bd.appendChild(document.createElement('br')); }
  if(mode==='edit' && !b.deleted) wireEdit(el, b);
  if(!b.deleted) paintAnns(el);
  renderNote(el);
  return el;
}
function rerender(keepFocus){ if(!curPage) return; const sh=$('#noteSheet'); if(sh && !sh.hidden){ const bid=sh.dataset.bid; setTimeout(()=>{ if(!document.getElementById('b-'+bid)) closeNoteSheet(); else { const fake=$('#noteSheetBody .sheet-blk'); if(fake) renderNote(fake); } },0); } if(document.body.classList.contains('split') && (prefs.split===curPage.id || (prefs.paneTab||'page')!=='page')) renderPane(); const wrap=$('#view .blocks'); if(wrap){ const y=window.scrollY; renderBlocks(wrap, curPage); buildTimeline(curPage); window.scrollTo(0,y); if(keepFocus){ const el=document.getElementById('b-'+keepFocus); if(el){ const body=el.querySelector(':scope > .body'); if(body && body.isContentEditable){ focusWrap(); placeCaretEnd(body); } } } } refreshBadges(); }
function focusWrap(){ const w=$('#view .blocks'); if(w && w.isContentEditable && document.activeElement!==w) w.focus({preventScroll:true}); }
function placeCaretEnd(el){ const r=document.createRange(); r.selectNodeContents(el); r.collapse(false); const s=getSelection(); s.removeAllRanges(); s.addRange(r); }
function placeCaretStart(el){ const r=document.createRange(); r.selectNodeContents(el); r.collapse(true); const s=getSelection(); s.removeAllRanges(); s.addRange(r); }

/* ---------- notes ---------- */
let ORDER={}, VIEW={};
function noteCard(n, label, onDone){
  const box=document.createElement('div'); box.className='note view'+(n.done?' done':'');
  const kind=n.kind?`<span class="kind k-${n.kind}">${kindLabel(n.kind)}</span>`:'';
  box.innerHTML=(n.quote?`<div class="q">«${esc(n.quote)}»</div>`:'')+`<p class="txt">${esc(n.text)}</p><div class="meta">${kind}<span>${label}</span>${onDone?`<button class="done-btn" title="${n.done?'Вернуть в работу':'Отметить решённой'}">${n.done?'↶ вернуть':'✓ решено'}</button>`:''}</div>`;
  box.addEventListener('mousedown',e=>e.stopPropagation());
  const db=box.querySelector('.done-btn'); if(db) db.onclick=e=>{ e.stopPropagation(); onDone(); };
  return box;
}
function noteEditor(prev, q, onSave, onCancel, onDelete, kind0){
  const box=document.createElement('div'); box.className='note'; let kind=kind0||'';
  box.innerHTML=(q?`<div class="q">«${esc(q)}»</div>`:'')+`<textarea>${esc(prev||'')}</textarea>
    <div class="row"><button class="btn primary" data-a="save">Сохранить</button><button class="link" data-a="cancel">Отмена</button><span class="sp"></span>${onDelete?'<button class="link" data-a="del">Удалить</button>':''}</div>`;
  ['click','mousedown','mouseup','keydown'].forEach(ev=>box.addEventListener(ev,e=>e.stopPropagation()));
  box.querySelectorAll('.kind-btn').forEach(b=>b.onclick=()=>{ kind = kind===b.dataset.k ? '' : b.dataset.k; box.querySelectorAll('.kind-btn').forEach(x=>x.classList.toggle('on', x.dataset.k===kind)); });
  const ta=box.querySelector('textarea');
  box.querySelector('[data-a=save]').onclick=()=>onSave(ta.value.trim(), kind);
  box.querySelector('[data-a=cancel]').onclick=onCancel;
  const del=box.querySelector('[data-a=del]'); if(del) del.onclick=onDelete;
  ta.addEventListener('keydown',e=>{ if((e.metaKey||e.ctrlKey)&&e.key==='Enter') onSave(ta.value.trim(), kind); if(e.key==='Escape') onCancel(); });
  setTimeout(()=>{ ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); },0);
  return box;
}
// editing = null | {kind:'para', q} | {kind:'ann', id}
const isMobile=()=>matchMedia('(max-width:760px)').matches;
function openNoteSheet(bid, editing){
  const el=document.getElementById('b-'+bid); if(!el) return; const sheet=$('#noteSheet'); const host=$('#noteSheetBody'); host.innerHTML='';
  const fake=document.createElement('div'); fake.className='blk sheet-blk'; fake.dataset.id=bid; fake.innerHTML='<div class="noteslot"></div>'; host.appendChild(fake);
  sheet.hidden=false; document.body.classList.add('sheet-open');
  $('#noteSheetTitle').textContent='Заметки к абзацу '+(numbering[bid]||'');
  renderNote(fake, editing);
  sheet.dataset.bid=bid;
}
function closeNoteSheet(){ $('#noteSheet').hidden=true; document.body.classList.remove('sheet-open'); $('#noteSheetBody').innerHTML=''; }
function renderNote(el, editing){
  const id=el.dataset.id, slot=el.querySelector('.noteslot'); slot.innerHTML='';
  const n=noteOf(id); const anns=Object.values(D.anns||{}).filter(a=>a.b1===id).sort((a,b)=>(a.o1-b.o1)||(a.ts-b.ts));
  el.classList.toggle('has-note', !!n || anns.some(a=>a.text&&a.text.trim()));
  if(!el.classList.contains('sheet-blk')){ let ind=el.querySelector(':scope > .note-ind'); const cnt=(n&&(!n.done||showDone)?1:0)+anns.filter(a=>a.text&&a.text.trim()&&(!a.done||showDone)).length;
    if(cnt){ if(!ind){ ind=document.createElement('button'); ind.className='note-ind'; ind.type='button'; ind.contentEditable='false'; ind.title='Заметки к абзацу'; ind.addEventListener('mousedown',e=>e.preventDefault()); ind.addEventListener('click',e=>{ e.stopPropagation(); openNoteSheet(id); }); el.appendChild(ind); } ind.textContent=cnt; }
    else if(ind) ind.remove();
    if(editing && isMobile()){ openNoteSheet(id, editing); editing=null; } }
  const num=numbering[id]||'';
  // paragraph note
  if(editing && editing.kind==='para'){
    const q = editing.q!==undefined ? editing.q : ((n&&n.quote)||'');
    slot.appendChild(noteEditor(n?n.text:'', q,
      (t,k)=>{ if(t) D.notes[id]={text:t,quote:q||'',ts:Date.now(),kind:k||'',done:n?!!n.done:false}; else delete D.notes[id]; save(); renderNote(el); },
      ()=>renderNote(el),
      n?()=>{ delete D.notes[id]; save(); renderNote(el); }:null, n?n.kind:''));
  } else if(n && (!n.done || showDone)){
    const c=noteCard(n, 'Заметка к абзацу '+num, ()=>{ n.done=!n.done; save(); renderNote(el); }); c.addEventListener('click',e=>{ e.stopPropagation(); renderNote(el,{kind:'para'}); }); slot.appendChild(c);
  }
  // range notes
  anns.forEach(a=>{
    if(editing && editing.kind==='ann' && editing.id===a.id){
      slot.appendChild(noteEditor(a.text, a.q,
        (t,k)=>{ if(t){ a.text=t; a.kind=k||''; a.ts=a.ts||Date.now(); } else delete D.anns[a.id]; save(); rerender(); },
        ()=>{ if(!a.text) { delete D.anns[a.id]; rerender(); } else renderNote(el); },
        a.text?()=>{ delete D.anns[a.id]; save(); rerender(); }:null, a.kind));
    } else if(a.text && a.text.trim() && (!a.done || showDone)){
      const lost=annLost(a);
      const c=noteCard({text:a.text, quote:a.q, kind:a.kind, done:a.done}, (a.by?('Заметка редактора · '+esc(a.by)):'Заметка к фрагменту')+(lost?' · <b class="lost">фрагмент изменён — нужна перепривязка</b>':''), ()=>{ a.done=!a.done; save(); rerender(); }); c.dataset.ann=a.id; if(a.by) c.classList.add('editor'); if(lost){ c.classList.add('lost'); const ab=document.createElement('button'); ab.className='anchor-btn'; ab.textContent='Привязать к выделению'; ab.onclick=e=>{ e.stopPropagation(); startAnchor(a.id); }; c.querySelector('.meta').appendChild(ab); }
      c.addEventListener('click',e=>{ e.stopPropagation(); renderNote(el,{kind:'ann', id:a.id}); });
      c.addEventListener('mouseenter',()=>$$(`mark.ann[data-ann="${a.id}"]`).forEach(m=>m.classList.add('hot')));
      c.addEventListener('mouseleave',()=>$$(`mark.ann[data-ann="${a.id}"]`).forEach(m=>m.classList.remove('hot')));
      slot.appendChild(c);
    }
  });
}
function updateClearBtn(){ const sd=document.querySelector('[data-a=showdone]'); if(!sd || !curPage) return; const st=pageStats(curPage); sd.hidden=!st.done; sd.textContent = showDone ? `Скрыть решённые заметки (${st.done})` : `Показать решённые заметки (${st.done})`; }
function clearPageNotes(p){
  const ids=new Set(pageBlocks(p).map(b=>b.id));
  const backup={notes:{},anns:{},pageNote:D.pageNotes[p.id]};
  for(const k in D.notes) if(ids.has(k)){ backup.notes[k]=D.notes[k]; delete D.notes[k]; }
  for(const k in D.anns) if(ids.has(D.anns[k].b1)){ backup.anns[k]=D.anns[k]; delete D.anns[k]; }
  delete D.pageNotes[p.id];
  save(); if(curPage===p) renderPage(p);
  toast('Все заметки страницы убраны', {label:'Отменить', fn:()=>{ Object.assign(D.notes, backup.notes); Object.assign(D.anns, backup.anns); if(backup.pageNote) D.pageNotes[p.id]=backup.pageNote; save(); if(curPage===p) renderPage(p); }});
}
/* ---------- all notes of the project ---------- */
let notesFilter={kind:'', done:false};
function allNotes(){
  const out=[];
  PAGES.forEach(p=>{
    const blocks=pageBlocks(p).filter(b=>!b.deleted); const pos={}; blocks.forEach((b,i)=>pos[b.id]=i);
    if(D.pageNotes[p.id] && D.pageNotes[p.id].trim()) out.push({p, pos:-1, text:D.pageNotes[p.id], quote:'', label:'Заметка к странице', kind:'', done:false, pageNote:true});
    blocks.forEach(b=>{ const n=noteOf(b.id); if(n) out.push({p, pos:pos[b.id], bid:b.id, text:n.text, quote:n.quote||'', label:'К абзацу', kind:n.kind||'', done:!!n.done, obj:n}); });
    Object.values(D.anns).forEach(a=>{ if(!a.text || !a.text.trim()) return; if(a.lost || (PAGE_OF[a.b1]===p.id && pos[a.b1]===undefined)){ if((a.lost?a.pid:PAGE_OF[a.b1])!==p.id) return; out.push({p, pos:-0.5, ann:a.id, text:a.text, quote:a.q, label:'Без места — нужна перепривязка', kind:a.kind||'', done:!!a.done, obj:a, by:a.by}); return; } if(PAGE_OF[a.b1]!==p.id) return; out.push({p, pos:(pos[a.b1]??0)+(a.o1||0)/1e6, bid:a.b1, ann:a.id, text:a.text, quote:a.q, label:(a.by?('Редактор · '+a.by):'К фрагменту')+(annLost(a)?' · фрагмент изменён':''), kind:a.kind||'', done:!!a.done, obj:a, by:a.by}); });
  });
  return out.sort((x,y)=>PAGES.indexOf(x.p)-PAGES.indexOf(y.p) || x.pos-y.pos);
}
function openNotes(){ $('#notesModal').hidden=false; renderNotesList(); }
function renderNotesList(){
  const all=allNotes(); const open=all.filter(n=>!n.done).length, done=all.length-open;
  const list=all.filter(n=>(notesFilter.done?n.done:!n.done) && (!notesFilter.kind || n.kind===notesFilter.kind));
  $('#notesCounts').textContent=`${open} в работе · ${done} решено`;
  const f=$('#notesFilters'); f.innerHTML=`<button class="chip${!notesFilter.kind?' on':''}" data-k="">Все</button>`+NOTE_KINDS.map(([k,l])=>`<button class="chip k-${k}${notesFilter.kind===k?' on':''}" data-k="${k}">${l}</button>`).join('')+`<span class="sp"></span><button class="chip${notesFilter.done?' on':''}" data-done="1">${notesFilter.done?'Показаны решённые':'Решённые'}</button>`;
  f.onclick=e=>{ const b=e.target.closest('button'); if(!b) return; if(b.dataset.done){ notesFilter.done=!notesFilter.done; } else notesFilter.kind=b.dataset.k; renderNotesList(); };
  const el=$('#notesList');
  if(!list.length){ el.innerHTML=`<div class="muted">${notesFilter.done?'Решённых заметок нет.':'Открытых заметок нет.'}</div>`; return; }
  let html='', lastP=null;
  list.forEach((n,i)=>{ if(n.p!==lastP){ lastP=n.p; html+=`<h4>${gtag(groupOf(n.p.section))} ${esc(n.p.title)}</h4>`; }
    html+=`<div class="nl${n.done?' done':''}" data-i="${i}">${n.quote?`<div class="q">«${esc(n.quote)}»</div>`:''}<div class="t">${esc(n.text)}</div><div class="m">${n.kind?`<span class="kind k-${n.kind}">${kindLabel(n.kind)}</span>`:''}<span>${esc(n.label)}</span><span class="sp"></span><button class="link" data-a="go">К месту</button>${n.pageNote?'':`<button class="link" data-a="done">${n.done?'Вернуть':'Решено'}</button>`}</div></div>`; });
  el.innerHTML=html;
  el.onclick=e=>{ const b=e.target.closest('button[data-a]'); const row=e.target.closest('.nl'); if(!row) return; const n=list[+row.dataset.i];
    if(b && b.dataset.a==='done'){ n.obj.done=!n.obj.done; save(); renderNotesList(); if(curPage===n.p) rerender(); return; }
    $('#notesModal').hidden=true; nav('#/'+n.p.id+(n.bid?'@'+n.bid:'')); if(n.ann){ setTimeout(()=>{ if(n.done) { showDone=true; rerender(); } const m=document.querySelector(`mark.ann[data-ann="${n.ann}"]`); if(m) m.classList.add('hot'); setTimeout(()=>{ if(m) m.classList.remove('hot'); }, 2500); }, 350); } };
  $('#notesClearPage').hidden=!curPage; if(curPage) $('#notesClearPage').textContent=`Убрать все заметки со страницы «${curPage.title}»`;
}
function editNote(el, quote){ renderNote(el, {kind:'para', q:quote}); }
function openAnn(id){ const a=D.anns[id]; if(!a) return; const el=document.getElementById('b-'+a.b1); if(!el) return; renderNote(el,{kind:'ann',id}); const box=el.querySelector('.noteslot .note'); if(box) box.scrollIntoView({block:'nearest',behavior:'smooth'}); }
// --- highlighting selected fragments inside blocks (read mode only)
function locateAnn(a, id, text){
  if(a.b1===id && a.b2===id){
    if(text.slice(a.o1,a.o2)===a.q) return [a.o1,a.o2];
    const i=text.indexOf(a.q); if(i>=0 && a.q.length>=3){ a.o1=i; a.o2=i+a.q.length; return [i,a.o2]; }
    return null; // the quoted fragment is gone or changed: the note is shown as «needs re-anchoring», never glued to a similar phrase
  }
  if(a.b1===id) return [Math.min(a.o1,text.length), text.length];
  if(a.b2===id) return [0, Math.min(a.o2,text.length)];
  const i1=ORDER[a.b1], i2=ORDER[a.b2], i=ORDER[id];
  if(i1!=null && i2!=null && i!=null && i>i1 && i<i2) return [0,text.length];
  return null;
}
function annLost(a){
  if(!BLOCK[a.b1] || !BLOCK[a.b2]) return true;
  if(a.b1!==a.b2) return false;
  const el=document.getElementById('b-'+a.b1); const text = el ? el.querySelector('.body').textContent : blockText(VIEW[a.b1]?VIEW[a.b1].h:BLOCK[a.b1].h);
  return !(text.slice(a.o1,a.o2)===a.q || (a.q.length>=3 && text.indexOf(a.q)>=0));
}
let pendingAnchor=null;
function startAnchor(id){ pendingAnchor=id; document.body.classList.add('anchoring'); toast('Выдели фрагмент, к которому привязать заметку, и нажми «Привязать сюда»', {label:'Отмена', fn:cancelAnchor}); }
function cancelAnchor(){ pendingAnchor=null; document.body.classList.remove('anchoring'); bubble.textContent='Заметка к выделенному'; }
function paintAnns(el){
  const id=el.dataset.id, body=el.querySelector('.body'); const text=body.textContent;
  const idx=ORDER[id];
  for(const k in (D.anns||{})){
    const a=D.anns[k]; if(!a.text && a.b1!==id) continue; if(a.done && !showDone) continue;
    const spans = a.b1===id || a.b2===id || (ORDER[a.b1]<idx && idx<ORDER[a.b2]);
    if(!spans) continue;
    const r=locateAnn(a,id,text); if(r && r[1]>r[0]) wrapRange(body, r[0], r[1], a.id);
  }
}
function wrapRange(body, s, e, annId){
  const walker=document.createTreeWalker(body, NodeFilter.SHOW_TEXT); let pos=0, n; const nodes=[];
  while((n=walker.nextNode())){ const len=n.nodeValue.length; const ns=pos, ne=pos+len; pos=ne; if(ne<=s||ns>=e||!len) continue; nodes.push({n, from:Math.max(s,ns)-ns, to:Math.min(e,ne)-ns}); }
  nodes.forEach(({n,from,to})=>{ let t=n; if(from>0) t=t.splitText(from); if(to-from < t.nodeValue.length) t.splitText(to-from); const m=document.createElement('mark'); m.className='ann'; m.dataset.ann=annId; t.parentNode.insertBefore(m,t); m.appendChild(t); });
}
function textOffset(body, node, off){ const r=document.createRange(); r.selectNodeContents(body); try{ r.setEnd(node, off); }catch(e){ return 0; } return r.toString().length; }
function closestBody(node){ const el = node.nodeType===1 ? node : node.parentElement; return el ? el.closest('.blk .body') : null; }
// selection bubble
const bubble=document.createElement('button'); bubble.id='selBubble'; bubble.type='button'; bubble.textContent='Заметка к выделенному'; bubble.hidden=true; document.body.appendChild(bubble);
let pendingSel=null, selT=null;
function hideBubble(){ bubble.hidden=true; pendingSel=null; }
function checkSelection(){
  if(mode==='edit'){ const info=selInfo(); if(info){ $$('.blk.focus').forEach(x=>x!==info.e1&&x.classList.remove('focus')); info.e1.classList.add('focus'); lastFocusId=info.id1; } updateFmtbar(); }
  const sel=getSelection(); if(!sel || sel.isCollapsed || !sel.rangeCount){ hideBubble(); return; }
  const r=sel.getRangeAt(0); const bd1=closestBody(r.startContainer), bd2=closestBody(r.endContainer);
  if(!bd1 || !bd2 || bd1.closest('#view2') || bd2.closest('#view2')){ hideBubble(); return; }
  const e1=bd1.closest('.blk'), e2=bd2.closest('.blk'); if(!e1.classList.contains('noteable') && !e2.classList.contains('noteable')){ hideBubble(); return; }
  const q=sel.toString().replace(/\s+/g,' ').trim(); if(!q){ hideBubble(); return; }
  pendingSel={b1:e1.dataset.id, o1:textOffset(bd1, r.startContainer, r.startOffset), b2:e2.dataset.id, o2:textOffset(bd2, r.endContainer, r.endOffset), q:q.slice(0,600)};
  if(pendingSel.b1===pendingSel.b2 && pendingSel.o2<=pendingSel.o1){ hideBubble(); return; }
  // exact quote for single block
  if(pendingSel.b1===pendingSel.b2) pendingSel.q = bd1.textContent.slice(pendingSel.o1, pendingSel.o2);
  const rects=r.getClientRects(); const rect=rects.length?rects[0]:r.getBoundingClientRect();
  bubble.hidden=false; bubble.textContent = pendingAnchor ? 'Привязать заметку сюда' : 'Заметка к выделенному';
  const w=bubble.offsetWidth; let left=rect.left+rect.width/2-w/2; left=Math.max(8, Math.min(left, innerWidth-w-8));
  let top=rect.top-42; if(top<$('.bar').offsetHeight+6) top=rect.bottom+8;
  bubble.style.left=left+'px'; bubble.style.top=top+'px';
}
document.addEventListener('keydown', e=>{ if(e.key==='Escape' && pendingAnchor) cancelAnchor(); });
document.addEventListener('selectionchange', ()=>{ clearTimeout(selT); selT=setTimeout(checkSelection,120); });
window.addEventListener('scroll', ()=>{ if(!bubble.hidden) checkSelection(); }, {passive:true});
bubble.addEventListener('mousedown', e=>e.preventDefault());
bubble.addEventListener('click', ()=>{ const p=pendingSel; hideBubble(); if(!p) return; try{ getSelection().removeAllRanges(); }catch(e){}
  if(pendingAnchor){ const a=D.anns[pendingAnchor]; cancelAnchor(); if(a){ Object.assign(a, {b1:p.b1,o1:p.o1,b2:p.b2,o2:p.o2,q:p.q, pid:PAGE_OF[p.b1]}); delete a.lost; save(); rerender(); toast('Заметка привязана к новому фрагменту'); } return; }
  const id='a'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
  D.anns[id]=Object.assign({id, text:'', ts:Date.now(), pid:PAGE_OF[p.b1]}, p);
  const el=document.getElementById('b-'+p.b1); if(el){ renderNote(el,{kind:'ann',id}); }
});
document.addEventListener('click', e=>{
  const m=e.target.closest && e.target.closest('mark.ann'); if(!m || m.closest('#view2')) return;
  const sel=getSelection(); if(sel && !sel.isCollapsed) return;
  e.stopPropagation(); e.preventDefault(); openAnn(m.dataset.ann);
}, true);

/* ---------- editing ---------- */
function setMode(m){
  if(m==='edit' && tabReadOnly){ toast('Это окно только для чтения — нажми «Перенести редактирование сюда»'); return; }
  if(mode==='edit' && m!=='edit') autoVersion();
  mode=m; document.body.classList.toggle('mode-edit', m==='edit'); document.body.classList.toggle('mode-read', m==='read');
  $$('.seg-btn').forEach(b=>b.classList.toggle('on', b.dataset.mode===m));
  if(curPage) renderPage(curPage); 
}
function wireEdit(el, b){
  const body=el.querySelector(':scope > .body');
  if(NOEDIT_TYPES.has(b.t)){ body.contentEditable='false'; if(b.t==='media'){ const cap=body.querySelector('figcaption'); if(cap){ cap.contentEditable='true'; cap.spellcheck=true; } } }
  if(NOEDIT_TYPES.has(b.t)){ el.addEventListener('click', e=>{ if(!e.target.closest('.note,figcaption')) { lastFocusId=b.id; $$('.blk.focus').forEach(x=>x!==el&&x.classList.remove('focus')); el.classList.add('focus'); updateFmtbar(); } }); }
}
/* ---------- unified editor (the whole page is one editable area) ---------- */
function blkOf(node){ const el=node && (node.nodeType===1?node:node.parentElement); const b = el ? el.closest('.blk') : null; return b && !b.closest('#view2') ? b : null; }
function bodyOf(el){ return el ? el.querySelector(':scope > .body') : null; }
function normEdge(container, offset, isEnd){ // snap a range edge that sits on the container / block level onto a body
  const wrap=$('#view .blocks'); if(!wrap) return null;
  let el=null;
  if(container===wrap){ const kids=[...wrap.children].filter(x=>x.classList.contains('blk') && !x.classList.contains('deleted') && bodyOf(x)); if(!kids.length) return null;
    if(isEnd){ el=null; for(const k of kids){ if([...wrap.children].indexOf(k)<offset) el=k; } if(!el) el=kids[0]; }
    else { el=kids.find(k=>[...wrap.children].indexOf(k)>=offset)||kids[kids.length-1]; } }
  else if(container.nodeType===1 && container.classList && container.classList.contains('blk')) el=container;
  else if(container.nodeType===1 && container.closest && container.closest('.blk') && !container.closest('.body')) el=container.closest('.blk');
  if(!el) return null; const body=bodyOf(el); if(!body) return null;
  return isEnd ? {node:body, off:body.childNodes.length, el, body} : {node:body, off:0, el, body};
}
function selInfo(){
  const sel=getSelection(); if(!sel||!sel.rangeCount) return null; let r=sel.getRangeAt(0);
  let e1=blkOf(r.startContainer), e2=blkOf(r.endContainer);
  let body1=e1?bodyOf(e1):null, body2=e2?bodyOf(e2):null;
  const bad1=!e1||!body1||!body1.contains(r.startContainer), bad2=!e2||!body2||!body2.contains(r.endContainer);
  if(bad1||bad2){
    const n1=bad1?normEdge(r.startContainer, r.startOffset, false):null, n2=bad2?normEdge(r.endContainer, r.endOffset, true):null;
    if((bad1&&!n1)||(bad2&&!n2)) return null;
    const nr=document.createRange();
    if(bad1) nr.setStart(n1.node,n1.off); else nr.setStart(r.startContainer,r.startOffset);
    if(bad2) nr.setEnd(n2.node,n2.off); else nr.setEnd(r.endContainer,r.endOffset);
    r=nr; e1=blkOf(r.startContainer); e2=blkOf(r.endContainer); body1=bodyOf(e1); body2=bodyOf(e2);
    if(!e1||!e2||!body1||!body2) return null;
  }
  return {r, sel, e1, e2, body1, body2, id1:e1.dataset.id, id2:e2.dataset.id, o1:textOffset(body1,r.startContainer,r.startOffset), o2:textOffset(body2,r.endContainer,r.endOffset), multi:e1!==e2, collapsed:r.collapsed};
}
function serRange(rg){ const d=document.createElement('div'); d.appendChild(rg.cloneContents()); return cleanHTML(d.innerHTML); }
function htmlBefore(body, node, off){ const r=document.createRange(); r.setStart(body,0); r.setEnd(node,off); return serRange(r); }
function htmlAfter(body, node, off){ const r=document.createRange(); r.setStart(node,off); r.setEnd(body, body.childNodes.length); return serRange(r); }
function textLenHTML(h){ const d=document.createElement('div'); d.innerHTML=h; return d.textContent.length; }
function relocateAnns(b){ const txt=blockText(b.h); for(const k in D.anns){ const a=D.anns[k]; if(a.b1===b.id && a.b2===b.id && a.q){ const i=txt.indexOf(a.q); if(i>=0){ a.o1=i; a.o2=i+a.q.length; } } } }
function canon(h){ const d=document.createElement('div'); d.innerHTML=String(h==null?'':h); return d.innerHTML.replace(/\u00a0/g,' ').trim(); }
function setModelHTML(b, h){
  if(b.inserted){ const f=findIns(b.id); if(f) D.ins[f.k][f.i].h=h; }
  else { const orig=BLOCK[b.id]?BLOCK[b.id].h:b.orig; if(canon(h)===canon(orig)){ delete D.edits[b.id]; h=orig; } else D.edits[b.id]=h; }
  if(b!==BLOCK[b.id]) b.h=h; b.edited = !b.inserted && D.edits[b.id]!==undefined; relocateAnns(b);
  autoType(b);
}
function setType(b, t){
  if(b.inserted){ const f=findIns(b.id); if(f) D.ins[f.k][f.i].t=t; }
  else { if(t===BLOCK[b.id].t) delete D.types[b.id]; else D.types[b.id]=t; }
  if(b!==BLOCK[b.id]) b.t=t;
}
function autoType(b){ // «— » at the start makes a line a реплика and back
  if(b.t!=='p' && b.t!=='dialog') return; const isD=blockText(b.h).startsWith('—'); const want=isD?'dialog':'p'; if(want!==b.t) setType(b, want);
}
/* history (undo / redo) — page-scoped snapshots of the data layer */
let HIST=[], REDO=[], histTypingAt=0;
function pageScope(){ const pid=curPage.id; const ids=new Set(pageBlocks(curPage).map(b=>b.id)); const pick=o=>{ const r={}; for(const k in o) if(ids.has(k)) r[k]=o[k]; return r; };
  const ins={}; for(const k in D.ins){ if(k==='top:'+pid || ids.has(k)) ins[k]=D.ins[k]; }
  const anns={}; for(const k in D.anns){ if(ids.has(D.anns[k].b1)) anns[k]=D.anns[k]; }
  return {ids, pid, snap: JSON.stringify({edits:pick(D.edits), del:pick(D.del), types:pick(D.types||{}), notes:pick(D.notes), ins, anns})}; }
function histReset(){ HIST=[]; REDO=[]; histTypingAt=0; }
function pushHistory(kind){
  if(!curPage) return; const now=Date.now();
  if(kind==='typing' && now-histTypingAt<1500 && HIST.length){ histTypingAt=now; return; }
  histTypingAt = kind==='typing' ? now : 0;
  const info=selInfo(); const sc=pageScope();
  HIST.push({snap:sc.snap, caret:info?{id:info.id1,off:info.o1}:null}); if(HIST.length>150) HIST.shift(); REDO=[];
}
function applySnapshot(snapStr){
  const sc=pageScope(); const pid=sc.pid; const ids=sc.ids; const snap=JSON.parse(snapStr);
  // clear page-scoped data
  [D.edits,D.del,D.types,D.notes].forEach(o=>{ for(const k in o) if(ids.has(k)) delete o[k]; });
  for(const k in D.ins){ if(k==='top:'+pid || ids.has(k)) delete D.ins[k]; }
  for(const k in D.anns){ if(ids.has(D.anns[k].b1)) delete D.anns[k]; }
  Object.assign(D.edits, snap.edits); Object.assign(D.del, snap.del); Object.assign(D.types, snap.types); Object.assign(D.notes, snap.notes); Object.assign(D.ins, snap.ins); Object.assign(D.anns, snap.anns);
  for(const k in snap.ins) snap.ins[k].forEach(b=>{ BLOCK[b.id]=b; PAGE_OF[b.id]=pid; });
  save(); rerender();
}
function undo(){ if(!HIST.length){ toast('Отменять нечего'); return; } const info=selInfo(); const cur=pageScope().snap; const h=HIST.pop(); REDO.push({snap:cur, caret:info?{id:info.id1,off:info.o1}:h.caret}); applySnapshot(h.snap); if(h.caret && document.getElementById('b-'+h.caret.id)) setCaret(h.caret.id, h.caret.off); histTypingAt=0; }
function redo(){ if(!REDO.length) return; const info=selInfo(); const cur=pageScope().snap; const r=REDO.pop(); HIST.push({snap:cur, caret:info?{id:info.id1,off:info.o1}:r.caret}); applySnapshot(r.snap); if(r.caret && document.getElementById('b-'+r.caret.id)) setCaret(r.caret.id, r.caret.off); histTypingAt=0; }
function insertModel(afterKey, html, type){
  const id='u'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  const nb={id, t: type || (String(html||'').trim().startsWith('—')?'dialog':'p'), h: html||''};
  (D.ins[afterKey] = D.ins[afterKey]||[]).unshift(nb);
  BLOCK[nb.id]=nb; PAGE_OF[nb.id]=curPage.id; return id;
}
function removeModelBlock(b){
  if(b.inserted){ const f=findIns(b.id); if(f){ const kids=D.ins[b.id]||[]; delete D.ins[b.id]; D.ins[f.k].splice(f.i,1,...kids); if(!D.ins[f.k].length) delete D.ins[f.k]; } }
  else D.del[b.id]=1;
}
function moveAnns(fromId, toId, shift, minOff){
  for(const k in D.anns){ const a=D.anns[k]; if(a.b1!==fromId && a.b2!==fromId) continue; if(minOff!=null && a.b1===fromId && a.o1<minOff) continue;
    if(a.b1===fromId){ a.b1=toId; a.o1=Math.max(0,a.o1+shift); } if(a.b2===fromId){ a.b2=toId; a.o2=Math.max(0,a.o2+shift); } }
  if(D.notes[fromId] && !D.notes[toId]){ D.notes[toId]=D.notes[fromId]; delete D.notes[fromId]; }
}
function setCaret(id, off){
  const el=document.getElementById('b-'+id); const body=bodyOf(el); if(!body) return;
  focusWrap();
  const walker=document.createTreeWalker(body, NodeFilter.SHOW_TEXT); let pos=0,n,last=null; const r=document.createRange(); let placed=false;
  while((n=walker.nextNode())){ const len=n.nodeValue.length; if(pos+len>=off){ r.setStart(n, Math.max(0,off-pos)); placed=true; break; } pos+=len; last=n; }
  if(!placed){ if(last) r.setStart(last,last.nodeValue.length); else r.setStart(body,0); }
  r.collapse(true); const s=getSelection(); s.removeAllRanges(); s.addRange(r);
  const rc=el.getBoundingClientRect(); const top=$('.bar').offsetHeight; if(rc.top<top+20 || rc.bottom>innerHeight-20) el.scrollIntoView({block:'center'});
}
function neighbour(b, dir){ const all=pageBlocks(curPage).filter(x=>!x.deleted); const i=all.findIndex(x=>x.id===b.id); return i<0?null:all[i+dir]||null; }
function commitBlock(id){
  const b=VIEW[id]; const el=document.getElementById('b-'+id); const body=bodyOf(el); if(!b||!body) return;
  const h=cleanHTML(body.innerHTML); if(canon(h)===canon(b.h)) return;
  const t0=b.t; setModelHTML(b,h);
  el.classList.toggle('edited', !!b.edited);
  if(b.t!==t0){ el.classList.remove(t0); el.classList.add(b.t); }
  save();
}
/* text the browser dropped directly into a .blk (next to an empty .body) is moved back into the body */
function adoptStrays(wrap, dirty){
  const sel=getSelection(); let caretBody=null;
  wrap.querySelectorAll(':scope > .blk').forEach(el=>{
    const body=el.querySelector(':scope > .body'); if(!body || el.classList.contains('deleted')) return;
    const strays=[...el.childNodes].filter(n=>!(n.nodeType===1 && (n===body || n.classList.contains('num') || n.classList.contains('toolslot') || n.classList.contains('noteslot') || n.classList.contains('stub') || n.classList.contains('note-ind'))));
    if(!strays.length) return;
    const had=sel&&sel.rangeCount&&strays.some(n=>n.contains(sel.anchorNode));
    if(body.childNodes.length===1 && body.firstChild.nodeName==='BR') body.firstChild.remove();
    strays.forEach(n=>{ if(n.nodeType===3 || /^(B|STRONG|I|EM|S|U|A|BR|SPAN|FONT)$/.test(n.nodeName)) body.appendChild(n); else { body.append(...n.childNodes); n.remove(); } });
    if(dirty) dirty.add(el.dataset.id); if(had) caretBody=body;
  });
  if(caretBody) placeCaretEnd(caretBody);
}
function structureOK(wrap){
  const seen=new Set();
  for(const ch of wrap.children){
    if(ch.classList.contains('tools')) continue;
    if(!ch.classList.contains('blk')) return false;
    const id=ch.dataset.id; if(!id || seen.has(id) || !VIEW[id]) return false; seen.add(id);
    if(ch.classList.contains('deleted')) continue;
    if(ch.querySelectorAll(':scope > .body').length!==1) return false;
    if(!ch.querySelector(':scope > .noteslot')) return false;
  }
  return true;
}
function syncFromDOM(wrap){
  const info=selInfo(); const caret=info?{id:info.id1, off:info.o1}:null;
  // sanity: if the DOM looks mangled (lots of stray nodes), discard it and redraw from the data instead of inventing blocks
  let strays=0; for(const ch of wrap.children){ if(!ch.classList.contains('blk') && !ch.classList.contains('tools')) strays++; else if(ch.classList.contains('blk') && ch.querySelectorAll(':scope > .body').length!==1) strays++; }
  if(strays>8){ rerender(); if(caret && document.getElementById('b-'+caret.id)) setCaret(caret.id, caret.off); toast('Действие отменено: страница перерисована'); return; }
  const seen=new Set(); let prevKey='top:'+curPage.id;
  const model=pageBlocks(curPage);
  for(const ch of [...wrap.children]){
    if(ch.classList.contains('tools')) continue;
    const id=ch.dataset.id; const known = ch.classList.contains('blk') && id && VIEW[id] && !seen.has(id);
    const bodies=[...ch.querySelectorAll(':scope > .body')];
    if(known){
      seen.add(id); const b=VIEW[id];
      if(b.deleted){ prevKey=id; continue; }
      if(!bodies.length){ const t=cleanHTML(ch.innerHTML); if(blockText(t)) setModelHTML(b,t); else { removeModelBlock(b); continue; } }
      else setModelHTML(b, cleanHTML(bodies[0].innerHTML));
      prevKey=id;
      bodies.slice(1).forEach(x=>{ const h=cleanHTML(x.innerHTML); if(blockText(h).trim()) prevKey=insertModel(prevKey, h, TEXT_TYPES.has(b.t)&&!HEAD_TYPES.has(b.t)?undefined:'p'); });
    } else {
      const src = bodies.length ? bodies : [ch];
      src.forEach(x=>{ const h=cleanHTML(x.innerHTML!==undefined?x.innerHTML:x.textContent); if(blockText(h).trim()) prevKey=insertModel(prevKey, h); });
    }
  }
  model.forEach(b=>{ if(!b.deleted && !seen.has(b.id)) removeModelBlock(b); });
  save(); rerender();
  if(caret){ if(document.getElementById('b-'+caret.id)) setCaret(caret.id, caret.off); }
}
function deleteSelection(info){
  const b1=VIEW[info.id1], b2=VIEW[info.id2]; if(!b1||!b2) return false;
  if(!TEXT_TYPES.has(b1.t)){ toast('Выдели текст внутри таблицы или списка отдельно'); return false; }
  const all=pageBlocks(curPage).filter(x=>!x.deleted); const i1=all.findIndex(x=>x.id===b1.id), i2=all.findIndex(x=>x.id===b2.id); if(i1<0||i2<0||i2<i1) return false;
  pushHistory('op');
  const hb=htmlBefore(info.body1, info.r.startContainer, info.r.startOffset);
  const lenHb=textLenHTML(hb);
  for(let i=i1+1;i<i2;i++){ const x=all[i]; for(const k in D.anns){ if(D.anns[k].b1===x.id) delete D.anns[k]; } removeModelBlock(x); }
  if(TEXT_TYPES.has(b2.t)){
    const ha=htmlAfter(info.body2, info.r.endContainer, info.r.endOffset);
    moveAnns(b2.id, b1.id, lenHb-info.o2);
    removeModelBlock(b2); setModelHTML(b1, hb+ha);
  } else { setModelHTML(b1, hb); }
  save(); rerender(); setCaret(b1.id, lenHb); return true;
}
function splitAt(info){
  const b=VIEW[info.id1]; if(!b || !SPLIT_TYPES.has(b.t)) return false;
  pushHistory('op');
  const hb=htmlBefore(info.body1, info.r.startContainer, info.r.startOffset), ha=htmlAfter(info.body1, info.r.endContainer, info.r.endOffset);
  setModelHTML(b, hb);
  const type = HEAD_TYPES.has(b.t) ? 'p' : (ha.trim().startsWith('—') ? 'dialog' : (b.t==='dialog' && !ha ? 'dialog' : 'p'));
  const nid=insertModel(b.id, ha, type==='dialog' && !ha ? 'p' : type);
  moveAnns(b.id, nid, -info.o1, info.o1);
  save(); rerender(); setCaret(nid, 0); lastFocusId=nid; return true;
}
function backspaceAtStart(info){
  const b=VIEW[info.id1]; if(!b) return false;
  const empty = blockText(info.body1.innerHTML).trim()==='' && !info.body1.querySelector('table,img,video,iframe,li');
  if(empty){ pushHistory('op'); deleteBlock(b, true); return true; }
  if(b.t==='list'||b.t==='olist'){ pushHistory('op'); listToParagraphs(b, 0); return true; }
  if(!TEXT_TYPES.has(b.t)) return true; // keep tables intact
  if(b.t!=='p' && b.t!=='dialog' && !HEAD_TYPES.has(b.t)){ pushHistory('op'); setType(b,'p'); save(); rerender(); setCaret(b.id,0); return true; } // callout/quote → plain paragraph first
  const prev=neighbour(b,-1); if(!prev) return true;
  if(prev.t==='hr'||prev.t==='media'){ pushHistory('op'); removeModelBlock(prev); save(); rerender(); setCaret(b.id,0); return true; }
  if(!TEXT_TYPES.has(prev.t)) return true;
  pushHistory('op');
  const prevBody=bodyOf(document.getElementById('b-'+prev.id)); const junction=prevBody?prevBody.textContent.length:textLenHTML(prev.h);
  const h=cleanHTML(info.body1.innerHTML);
  moveAnns(b.id, prev.id, junction);
  setModelHTML(prev, prev.h + h); removeModelBlock(b);
  save(); rerender(); setCaret(prev.id, junction); return true;
}
function deleteAtEnd(info){
  const b=VIEW[info.id1]; if(!b || !TEXT_TYPES.has(b.t)) return true;
  const next=neighbour(b,1); if(!next) return true;
  if(next.t==='hr'||next.t==='media'){ pushHistory('op'); removeModelBlock(next); save(); rerender(); setCaret(b.id, info.o1); return true; }
  if(!TEXT_TYPES.has(next.t)) return true;
  pushHistory('op');
  const nextBody=bodyOf(document.getElementById('b-'+next.id)); const nh = nextBody ? cleanHTML(nextBody.innerHTML) : next.h;
  if(blockText(nh).trim()==='' ){ removeModelBlock(next); save(); rerender(); setCaret(b.id, info.o1); return true; }
  const junction=info.body1.textContent.length;
  moveAnns(next.id, b.id, junction);
  setModelHTML(b, cleanHTML(info.body1.innerHTML) + nh); removeModelBlock(next);
  save(); rerender(); setCaret(b.id, junction); return true;
}
function listItems2(h){ const d=document.createElement('div'); d.innerHTML=h; return [...d.querySelectorAll('li')].map(li=>cleanHTML(li.innerHTML)); }
function listToParagraphs(b, caretItem){
  const items=listItems2(b.h); if(!items.length){ removeModelBlock(b); save(); rerender(); return; }
  setType(b,'p'); setModelHTML(b, items[0]); let key=b.id; const ids=[b.id];
  items.slice(1).forEach(it=>{ key=insertModel(key, it, 'p'); ids.push(key); });
  save(); rerender(); setCaret(ids[Math.min(caretItem, ids.length-1)], 0);
}
function toggleList(kind){ // kind: 'list' | 'olist'
  const info=selInfo(); if(!info) return; const b=VIEW[info.id1]; if(!b) return;
  pushHistory('op');
  if(b.t===kind){ listToParagraphs(b, 0); return; }
  if(b.t==='list'||b.t==='olist'){ const items=listItems2(b.h); setType(b,kind); setModelHTML(b, (kind==='list'?'<ul>':'<ol>')+items.map(x=>'<li>'+x+'</li>').join('')+(kind==='list'?'</ul>':'</ol>')); save(); rerender(); setCaret(b.id, info.o1); return; }
  if(!TEXT_TYPES.has(b.t)) return;
  // merge following selected paragraphs into one list when selection spans blocks
  const all=pageBlocks(curPage).filter(x=>!x.deleted); const i1=all.findIndex(x=>x.id===info.id1), i2=all.findIndex(x=>x.id===info.id2);
  const group = info.multi && i2>i1 ? all.slice(i1, i2+1).filter(x=>TEXT_TYPES.has(x.t)) : [b];
  const items=group.map(x=>x.h||'');
  setType(b,kind); setModelHTML(b, (kind==='list'?'<ul>':'<ol>')+items.map(x=>'<li>'+(x||'<br>')+'</li>').join('')+(kind==='list'?'</ul>':'</ol>'));
  group.slice(1).forEach(x=>{ for(const k in D.anns){ if(D.anns[k].b1===x.id) delete D.anns[k]; } removeModelBlock(x); });
  save(); rerender(); setCaret(b.id, info.o1);
}
function applyStyle(t){
  const info=selInfo(); if(!info) return; pushHistory('op');
  const all=pageBlocks(curPage).filter(x=>!x.deleted); const i1=all.findIndex(x=>x.id===info.id1), i2=all.findIndex(x=>x.id===info.id2);
  const group=all.slice(Math.min(i1,i2), Math.max(i1,i2)+1);
  group.forEach(x=>{ if(x.t==='list'||x.t==='olist'){ if(t==='p'){ setType(x,'p'); setModelHTML(x, listItems2(x.h).join('<br>')); } return; } if(!TEXT_TYPES.has(x.t)) return; setType(x,t); if(t==='p'||t==='dialog'){ const want=blockText(x.h).startsWith('—')?'dialog':'p'; if(want!==t && t==='p') setType(x,'p'); } });
  save(); rerender(); setCaret(info.id1, info.o1);
}
function rangeIn(id, from, to){ // DOM range inside a block body by text offsets
  const body=bodyOf(document.getElementById('b-'+id)); if(!body) return null;
  const pos=off=>{ const w=document.createTreeWalker(body, NodeFilter.SHOW_TEXT); let p=0,n,last=null; while((n=w.nextNode())){ const l=n.nodeValue.length; if(p+l>=off) return [n, off-p]; p+=l; last=n; } return last?[last,last.nodeValue.length]:[body,0]; };
  const r=document.createRange(); const a=pos(from), b=pos(to==null?body.textContent.length:to); r.setStart(a[0],a[1]); r.setEnd(b[0],b[1]); return r;
}
function fmtExec(cmd, val){
  const info=selInfo(); if(!info) return; pushHistory('op'); focusWrap();
  const sel=getSelection();
  if(!info.multi){ document.execCommand(cmd, false, val||null); commitBlock(info.id1); updateFmtbar(); return; }
  // apply per block, so the browser never restructures across paragraphs
  const all=pageBlocks(curPage).filter(x=>!x.deleted); const i1=all.findIndex(x=>x.id===info.id1), i2=all.findIndex(x=>x.id===info.id2);
  if(i1<0||i2<0) return;
  const lo=Math.min(i1,i2), hi=Math.max(i1,i2); const startOff = i1<=i2 ? info.o1 : info.o2, endOff = i1<=i2 ? info.o2 : info.o1;
  for(let i=lo;i<=hi;i++){ const x=all[i]; if(!TEXT_TYPES.has(x.t) && x.t!=='list' && x.t!=='olist') continue;
    const r=rangeIn(x.id, i===lo?startOff:0, i===hi?endOff:null); if(!r || r.collapsed) continue;
    sel.removeAllRanges(); sel.addRange(r); document.execCommand(cmd, false, val||null); commitBlock(x.id); }
  const r1=rangeIn(all[lo].id, startOff, null), r2=rangeIn(all[hi].id, 0, endOff);
  if(r1&&r2){ const r=document.createRange(); r.setStart(r1.startContainer,r1.startOffset); r.setEnd(r2.endContainer,r2.endOffset); sel.removeAllRanges(); sel.addRange(r); }
  updateFmtbar();
}
function insertLink(){
  const info=selInfo(); if(!info) return;
  if(info.collapsed){ toast('Сначала выдели текст для ссылки'); return; }
  const cur=info.r.startContainer.parentElement.closest('a');
  const url=prompt('Адрес ссылки', cur?cur.getAttribute('href'):'https://'); if(url===null) return;
  if(!url.trim() || url.trim()==='https://'){ fmtExec('unlink'); return; }
  fmtExec('createLink', url.trim());
}
function restoreOriginal(){ const info=selInfo(); if(!info) return; const b=VIEW[info.id1]; if(!b || !b.edited) return; pushHistory('op'); delete D.edits[b.id]; delete D.types[b.id]; save(); rerender(); setCaret(b.id, 0); }
function deletedList(){ return pageBlocks(curPage).filter(b=>b.deleted); }
function restoreDeleted(id){ pushHistory('op'); delete D.del[id]; save(); rerender(); setCaret(id,0); }
function deleteCurrentBlock(){ const info=selInfo(); const id=info?info.id1:lastFocusId; const b=VIEW[id]; if(!b) return; pushHistory('op'); const prev=neighbour(b,-1); for(const k in D.anns){ if(D.anns[k].b1===b.id) delete D.anns[k]; } removeModelBlock(b); save(); rerender(); if(prev) setCaret(prev.id, textLenHTML(prev.h)); }
function updateFmtbar(){
  const bar=$('#fmtbar'); if(!bar || mode!=='edit') return;
  const info=selInfo(); const id=info?info.id1:lastFocusId; const b=id?VIEW[id]:null;
  const q=c=>{ try{ return document.queryCommandState(c); }catch(e){ return false; } };
  bar.querySelector('[data-cmd=bold]').classList.toggle('on', q('bold'));
  bar.querySelector('[data-cmd=italic]').classList.toggle('on', q('italic'));
  bar.querySelector('[data-cmd=underline]').classList.toggle('on', q('underline'));
  bar.querySelector('[data-cmd=strikeThrough]').classList.toggle('on', q('strikeThrough'));
  bar.querySelector('[data-list=list]').classList.toggle('on', !!b && b.t==='list');
  bar.querySelector('[data-list=olist]').classList.toggle('on', !!b && b.t==='olist');
  const st=bar.querySelector('#fmtStyle'); const lbl={p:'Обычный текст',dialog:'Реплика',h2:'Заголовок',h3:'Подзаголовок',h4:'Подзаголовок',pov:'POV',time:'Время',callout:'Врезка',quote:'Цитата',list:'Список',olist:'Нумерованный',table:'Таблица',profile:'Профайл',media:'Фото / видео',hr:'Разделитель'};
  st.querySelector('span').textContent = b ? (lbl[b.t]||b.t) : 'Стиль';
  bar.querySelector('#fmtTable').hidden = !(b && GRID_TYPES.has(b.t));
  bar.querySelector('#fmtMedia').hidden = !(b && b.t==='media');
  const dl=deletedList().length; const db=bar.querySelector('#fmtDeleted'); db.hidden=!dl; if(dl) db.querySelector('span').textContent=dl;
  bar.querySelector('[data-cmd=undo]').disabled=!HIST.length; bar.querySelector('[data-cmd=redo]').disabled=!REDO.length;
}
function buildFmtMenus(){
  const mk=(id, items, onpick)=>{ const m=document.createElement('div'); m.id=id; m.className='popmenu'; m.hidden=true; m.innerHTML=items.map(([v,l,cls])=>`<button type="button" data-v="${v}" class="${cls||''}"><span class="pv">${l}</span></button>`).join(''); m.addEventListener('mousedown',e=>e.preventDefault()); m.addEventListener('click',e=>{ const b=e.target.closest('button[data-v]'); if(!b) return; hidePopmenus(); onpick(b.dataset.v); }); document.body.appendChild(m); return m; };
  mk('styleMenu', [['p','Обычный текст','st-p'],['dialog','— Реплика','st-p'],['h2','Заголовок','st-h2'],['h3','Подзаголовок','st-h3'],['time','Время','st-time'],['pov','POV','st-pov'],['callout','Врезка','st-callout'],['quote','Цитата','st-quote']], applyStyle);
  mk('tableMenu', [['addrow','+ строка ниже'],['addcol','+ столбец справа'],['delrow','− строка'],['delcol','− столбец'],['deltable','Удалить таблицу']], v=>{ const info=selInfo(); const id=info?info.id1:lastFocusId; const el=document.getElementById('b-'+id); const body=bodyOf(el); if(!body) return; if(v==='deltable'){ deleteCurrentBlock(); return; } pushHistory('op'); tableOp(body, v); commitBlock(id); });
  mk('mediaMenu', [['replace','Заменить'],['del','Удалить']], v=>{ const id=lastFocusId; if(v==='replace') openMediaDialog(id); else deleteCurrentBlock(); });
  mk('origMenu', [['show','Показать исходник'],['restore','Вернуть исходный текст']], v=>{ const info=selInfo(); const b=info?VIEW[info.id1]:null; if(!b) return; if(v==='restore') restoreOriginal(); else { const el=document.getElementById('b-'+b.id); const ex=el.querySelector('.orig'); if(ex){ ex.remove(); return; } const o=document.createElement('div'); o.className='orig'; o.contentEditable='false'; o.innerHTML=`<b>Исходник:</b> ${b.orig}`; el.querySelector('.toolslot').appendChild(o); } });
  const dm=document.createElement('div'); dm.id='deletedMenu'; dm.className='popmenu'; dm.hidden=true; dm.addEventListener('mousedown',e=>e.preventDefault()); document.body.appendChild(dm);
}
function openDeletedMenu(anchor){
  const m=$('#deletedMenu'); m.innerHTML='<div class="nt" style="padding:4px 12px 6px">Удалённые абзацы — нажми, чтобы вернуть</div>'+deletedList().map(b=>`<button type="button" data-v="${b.id}"><span class="pv del-pv">${esc(blockText(b.orig).slice(0,70))}${blockText(b.orig).length>70?'…':''}</span></button>`).join('');
  m.onclick=e=>{ const b=e.target.closest('button[data-v]'); if(!b) return; hidePopmenus(); restoreDeleted(b.dataset.v); };
  togglePopmenu(m, anchor);
}
function bindFmtbar(){
  const bar=$('#fmtbar'); if(!bar) return; buildFmtMenus();
  bar.addEventListener('mousedown', e=>{ if(e.target.closest('button')) e.preventDefault(); });
  bar.addEventListener('click', e=>{
    const btn=e.target.closest('button'); if(!btn) return; e.stopPropagation();
    if(btn.dataset.cmd==='undo') return undo();
    if(btn.dataset.cmd==='redo') return redo();
    if(btn.dataset.cmd==='link') return insertLink();
    if(btn.dataset.cmd==='clear') return fmtExec('removeFormat');
    if(btn.dataset.cmd) return fmtExec(btn.dataset.cmd);
    if(btn.dataset.list) return toggleList(btn.dataset.list);
    if(btn.id==='fmtStyle') return togglePopmenu($('#styleMenu'), btn);
    if(btn.id==='fmtTable') return togglePopmenu($('#tableMenu'), btn);
    if(btn.id==='fmtMedia') return togglePopmenu($('#mediaMenu'), btn);
    if(btn.id==='fmtDeleted') return openDeletedMenu(btn);
    if(btn.id==='fmtInsert'){ if(mode!=='edit') setMode('edit'); toggleInsertMenu(btn); }
  });
}
function insertTextAtCaret(txt){
  const sel=getSelection(); if(!sel.rangeCount) return; const r=sel.getRangeAt(0); const info=selInfo(); if(!info) return;
  r.deleteContents(); const tn=document.createTextNode(txt); r.insertNode(tn); r.setStartAfter(tn); r.collapse(true); sel.removeAllRanges(); sel.addRange(r);
  commitBlock(info.id1);
}
function selectionText(info){
  const all=pageBlocks(curPage).filter(x=>!x.deleted); const i1=all.findIndex(x=>x.id===info.id1), i2=all.findIndex(x=>x.id===info.id2);
  if(i1<0||i2<0) return info.sel.toString();
  const t1=info.body1.textContent.slice(info.o1), t2=info.body2.textContent.slice(0,info.o2);
  const mid=all.slice(i1+1,i2).map(b=>GRID_TYPES.has(b.t)?txtTable(b.h):blockText(b.h));
  return [t1,...mid,t2].join('\n\n');
}
function bindEditor(wrap){
  let dirty=new Set(), t=null;
  const flushCommits=()=>{ clearTimeout(t); t=null; adoptStrays(wrap, dirty); if(!structureOK(wrap)){ dirty.clear(); syncFromDOM(wrap); return; } dirty.forEach(id=>commitBlock(id)); dirty.clear(); updateFmtbar(); };
  wrap.addEventListener('beforeinput', e=>{
    if(e.inputType==='historyUndo'){ e.preventDefault(); undo(); return; }
    if(e.inputType==='historyRedo'){ e.preventDefault(); redo(); return; }
    const info=selInfo();
    if(info && !info.multi && /^(insert|delete)/.test(e.inputType) && !/^(insertParagraph|insertFromPaste)$/.test(e.inputType)) pushHistory('typing');
    if(!info){ if(!e.target.closest || !e.target.closest('figcaption')) { /* caret outside bodies: ignore */ } return; }
    const b=VIEW[info.id1];
    if(info.multi){
      const ty=e.inputType;
      if(/^format/.test(ty)){ const all=pageBlocks(curPage); const i1=all.findIndex(x=>x.id===info.id1), i2=all.findIndex(x=>x.id===info.id2); all.slice(Math.min(i1,i2), Math.max(i1,i2)+1).forEach(x=>dirty.add(x.id)); return; }
      e.preventDefault();
      if(!deleteSelection(info)) return;
      histTypingAt=Date.now();
      if(ty==='insertText' && e.data) insertTextAtCaret(e.data);
      if(ty==='insertParagraph'){ const i2=selInfo(); if(i2) splitAt(i2); }
      return;
    }
    dirty.add(info.id1);
    if(e.inputType==='insertParagraph'){
      if(b && b.t==='media'){ e.preventDefault(); return; }
      if(b && (b.t==='callout'||b.t==='quote')){ e.preventDefault(); document.execCommand('insertLineBreak'); return; }
      if(b && SPLIT_TYPES.has(b.t)){ e.preventDefault(); if(!info.collapsed){ info.r.deleteContents(); } const i2=selInfo()||info; splitAt(i2); return; }
      return; // lists, tables: native
    }
    if(e.inputType==='deleteContentBackward' && info.collapsed && info.o1===0){ e.preventDefault(); backspaceAtStart(info); return; }
    if(e.inputType==='deleteContentForward' && info.collapsed && info.o1===info.body1.textContent.length){ e.preventDefault(); deleteAtEnd(info); return; }
    if(/^delete/.test(e.inputType) && !info.collapsed && b && GRID_TYPES.has(b.t)){ const c1=info.r.startContainer.parentElement.closest('td,th'), c2=info.r.endContainer.parentElement.closest('td,th'); if(c1!==c2){ e.preventDefault(); } }
  });
  wrap.addEventListener('input', ()=>{ clearTimeout(t); t=setTimeout(flushCommits, 220); });
  wrap.addEventListener('blur', ()=>{ if(t) flushCommits(); });
  wrap.addEventListener('keydown', e=>{
    const info=selInfo();
    if(e.key==='Enter' && e.target.closest && e.target.closest('figcaption')){ e.preventDefault(); e.target.closest('figcaption').blur(); return; }
    if(!info) return; const b=VIEW[info.id1];
    if(e.key==='Tab' && b && GRID_TYPES.has(b.t)){
      const body=info.body1; const cell=currentCell(body); if(!cell) return; e.preventDefault();
      const cells=[...body.querySelectorAll('td,th')]; const i=cells.indexOf(cell)+(e.shiftKey?-1:1);
      const go=c=>{ const r=document.createRange(); r.selectNodeContents(c); const sel=getSelection(); sel.removeAllRanges(); sel.addRange(r); };
      if(cells[i]) go(cells[i]); else if(!e.shiftKey){ tableOp(body,'addrow'); commitBlock(b.id); const nc=[...body.querySelectorAll('td,th')][i]; if(nc) go(nc); }
      return;
    }
    if(e.key==='Tab'){ e.preventDefault(); }
    if((e.ctrlKey||e.metaKey) && !e.altKey){
      const k=e.key.toLowerCase();
      if(k==='z' && !e.shiftKey){ e.preventDefault(); undo(); return; }
      if((k==='z' && e.shiftKey) || k==='y'){ e.preventDefault(); redo(); return; }
      if(k==='b'){ e.preventDefault(); fmtExec('bold'); return; }
      if(k==='i'){ e.preventDefault(); fmtExec('italic'); return; }
      if(k==='u'){ e.preventDefault(); fmtExec('underline'); return; }
      if(k==='k'){ e.preventDefault(); insertLink(); return; }
    }
    // Enter on an empty list item leaves the list
    if(e.key==='Enter' && !e.shiftKey && b && (b.t==='list'||b.t==='olist')){
      const li=info.r.startContainer.parentElement.closest('li'); if(li && !li.textContent.trim()){ e.preventDefault(); pushHistory('op'); const items=listItems2(info.body1.innerHTML); const idx=[...info.body1.querySelectorAll('li')].indexOf(li); const before=items.slice(0,idx), after=items.slice(idx+1); const tag=b.t==='list'?'ul':'ol';
        if(before.length) setModelHTML(b, `<${tag}>`+before.map(x=>'<li>'+x+'</li>').join('')+`</${tag}>`); else { setType(b,'p'); setModelHTML(b,''); }
        let key=b.id; let nid;
        if(before.length){ nid=insertModel(key,'', 'p'); key=nid; } else nid=b.id;
        if(after.length) insertModel(key, `<${tag}>`+after.map(x=>'<li>'+x+'</li>').join('')+`</${tag}>`, b.t);
        save(); rerender(); setCaret(nid,0); }
    }
  });
  wrap.addEventListener('paste', e=>{
    e.preventDefault(); let info=selInfo(); if(!info) return;
    const txt=(e.clipboardData||window.clipboardData).getData('text/plain').replace(/\r\n?/g,'\n');
    const lines=txt.split(/\n+/).map(x=>x.trim()).filter(Boolean);
    if(!lines.length) return;
    let b=VIEW[info.id1]; pushHistory('op');
    if(info.multi){ if(!deleteSelection(info)) return; histTypingAt=Date.now(); info=selInfo(); if(!info) return; b=VIEW[info.id1]; }
    if(lines.length===1 || !TEXT_TYPES.has(b.t)){ insertTextAtCaret(lines.length===1?lines[0]:lines.join(' ')); return; }
    if(!info.collapsed) info.r.deleteContents();
    const i2=selInfo()||info;
    const hb=htmlBefore(i2.body1, i2.r.startContainer, i2.r.startOffset), ha=htmlAfter(i2.body1, i2.r.endContainer, i2.r.endOffset);
    setModelHTML(b, hb+esc(lines[0]));
    let key=b.id, lastId=b.id, lastLen=0;
    lines.slice(1).forEach((ln,i)=>{ const isLast=i===lines.length-2; const h=esc(ln)+(isLast?ha:''); key=insertModel(key, h); lastId=key; lastLen=ln.length; });
    save(); rerender(); setCaret(lastId, lastLen);
  });
  wrap.addEventListener('cut', e=>{ const info=selInfo(); if(!info || !info.multi) return; e.preventDefault(); e.clipboardData.setData('text/plain', selectionText(info)); deleteSelection(info); });
  wrap.addEventListener('drop', e=>e.preventDefault());
}
document.addEventListener('copy', e=>{
  if(!curPage) return; const info=selInfo(); if(!info || !info.multi) return;
  e.preventDefault(); const txt=selectionText(info); e.clipboardData.setData('text/plain', txt); e.clipboardData.setData('text/html', txt.split('\n\n').map(x=>'<p>'+esc(x)+'</p>').join(''));
});
function cleanHTML(h){
  const d=document.createElement('div'); d.innerHTML=h;
  d.querySelectorAll('*').forEach(n=>{ if(!/^(B|STRONG|I|EM|S|U|A|BR|TABLE|TBODY|THEAD|TR|TD|TH|P|DIV|UL|OL|LI|BLOCKQUOTE|FIGURE|FIGCAPTION|IMG|VIDEO|IFRAME)$/.test(n.tagName)){ n.replaceWith(...n.childNodes); return; }
    const keep={A:['href'],IMG:['src','alt'],VIDEO:['src','controls'],IFRAME:['src','allowfullscreen']}[n.tagName]||[];
    [...n.attributes].forEach(a=>{ if(!keep.includes(a.name)) n.removeAttribute(a.name); });
    if(n.tagName==='IFRAME' && !/^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com|player\.vimeo\.com|drive\.google\.com|rutube\.ru|vk\.com|vkvideo\.ru)\//.test(n.getAttribute('src')||'')){ n.remove(); return; } if(n.tagName==='A'){ n.target='_blank'; n.rel='noopener'; } if(n.tagName==='B'){ const s=document.createElement('strong'); s.innerHTML=n.innerHTML; n.replaceWith(s);} if(n.tagName==='I'){ const s=document.createElement('em'); s.innerHTML=n.innerHTML; n.replaceWith(s);} });
  d.querySelectorAll('div,p').forEach(n=>{ if(n.closest('table')) return; const br=document.createElement('br'); n.replaceWith(br, ...n.childNodes); });
  let out=d.innerHTML.replace(/&nbsp;/g,' ').replace(/^(\s*<br>)+|(<br>\s*)+$/g,'').replace(/^[\n\r\t]+|[\n\r\t]+$/g,''); if(!out.trim()) out='';
  return out;
}
function insertBlock(afterKey, html, focusStart, type){
  if(mode==='edit') pushHistory('op');
  const id=insertModel(afterKey, html, type || (html==null?'p':undefined)); lastFocusId=id;
  save(); rerender();
  const el=document.getElementById('b-'+id); if(el){ const body=bodyOf(el); if(body && body.isContentEditable){ setCaret(id, focusStart?0:body.textContent.length); } el.scrollIntoView({block:'center',behavior:'smooth'}); }
  return id;
}
let lastFocusId=null;
function insertTarget(){
  if(!curPage) return null;
  const list=pageBlocks(curPage).filter(b=>!b.deleted);
  if(lastFocusId && list.find(b=>b.id===lastFocusId)) return lastFocusId;
  return list.length ? list[list.length-1].id : 'top:'+curPage.id;
}
function insertFromBar(type){
  if(!curPage) return;
  if(mode!=='edit') setMode('edit');
  if(type==='media'){ openMediaDialog(null); return; }
  const key=insertTarget();
  const id=insertBlock(key, TEMPLATES[type]||'', false, type);
  const el=document.getElementById('b-'+id); if(!el) return;
  const body=el.querySelector('.body');
  focusWrap();
  if(body.isContentEditable && !GRID_TYPES.has(type)){ const r=document.createRange(); r.selectNodeContents(body); const sel=getSelection(); sel.removeAllRanges(); sel.addRange(r); }
  if(GRID_TYPES.has(type)){ const cell=body.querySelector('td'); if(cell){ const r=document.createRange(); r.selectNodeContents(cell); r.collapse(true); const sel=getSelection(); sel.removeAllRanges(); sel.addRange(r); } }
}
const ICONS = {
  p:'<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h10"/></svg>',
  dialog:'<svg viewBox="0 0 24 24"><path d="M4 12h6M14 6h6M14 12h6M14 18h6"/></svg>',
  h2:'<svg viewBox="0 0 24 24"><path d="M5 5v14M13 5v14M5 12h8M17 9l2-1.5V19"/></svg>',
  h3:'<svg viewBox="0 0 24 24"><path d="M5 7v10M12 7v10M5 12h7M16 14.5c0 1.5 1.2 2.5 2.5 2.5s2.5-1 2.5-2.5-1.2-2.5-2.5-2.5h-1l2.6-3h-4"/></svg>',
  time:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  pov:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5"/></svg>',
  callout:'<svg viewBox="0 0 24 24"><path d="M5 4h14v10l-5 5H5z M14 19v-5h5"/></svg>',
  quote:'<svg viewBox="0 0 24 24"><path d="M9.5 8C7 8.5 5.5 10.3 5.5 13v3h4.5v-4.5H7.5c0-1.4.8-2.3 2-2.7zM18.5 8c-2.5.5-4 2.3-4 5v3H19v-4.5h-2.5c0-1.4.8-2.3 2-2.7z"/></svg>',
  list:'<svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="5" cy="6" r="1" fill="currentColor"/><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="5" cy="18" r="1" fill="currentColor"/></svg>',
  olist:'<svg viewBox="0 0 24 24"><path d="M10 6h10M10 12h10M10 18h10M4 5l1.5-1V9M4 13.5c0-1 2.5-1.3 2.5 0 0 1-2.5 2-2.5 3h3M4 18h2a1 1 0 0 1 0 2H5h1a1 1 0 0 1 0 2H4"/></svg>',
  table:'<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="1"/><path d="M4 10h16M4 14.5h16M10 5v14M15 5v14"/></svg>',
  profile:'<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="14" rx="1.5"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.5-1.5 1.7-2.3 3-2.3s2.5.8 3 2.3M14.5 10h3.5M14.5 13.5h3.5"/></svg>',
  media:'<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="14" rx="1.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 3.5 3 3-2.5L20 17"/></svg>',
  hr:'<svg viewBox="0 0 24 24"><path d="M4 12h16M9 6h6M9 18h6"/></svg>'
};
const INSERT_ITEMS=[['p','Абзац'],['dialog','Реплика'],['h2','Заголовок'],['h3','Подзаголовок'],['time','Время'],['pov','POV'],['callout','Врезка'],['quote','Цитата'],['list','Список'],['olist','Нумерованный'],['table','Таблица'],['profile','Профайл'],['media','Фото / видео'],['hr','Разделитель']];
function buildInsertMenu(){
  const m=document.createElement('div'); m.id='insertMenu'; m.hidden=true; m.setAttribute('role','menu');
  m.innerHTML=INSERT_ITEMS.map(([t,l])=>`<button type="button" role="menuitem" data-t="${t}">${ICONS[t]}<span>${l}</span></button>`).join('');
  m.addEventListener('mousedown', e=>e.preventDefault());
  m.addEventListener('click', e=>{ const b=e.target.closest('button[data-t]'); if(!b) return; hideInsertMenu(); insertFromBar(b.dataset.t); });
  document.body.appendChild(m);
}
function hideInsertMenu(){ const m=$('#insertMenu'); if(m) m.hidden=true; $$('.blk.menu-open').forEach(x=>x.classList.remove('menu-open')); }
function toggleInsertMenu(anchor){
  const m=$('#insertMenu'); if(!m.hidden && m._anchor===anchor){ hideInsertMenu(); return; }
  m.hidden=false; m._anchor=anchor;
  const r=anchor.getBoundingClientRect(); const w=m.offsetWidth, h=m.offsetHeight;
  let left=r.left, top=r.bottom+8;
  if(anchor.id==='fmtInsert') left=r.right-w;
  if(left+w>innerWidth-8) left=innerWidth-w-8; if(left<8) left=8;
  if(top+h>innerHeight-8) top=Math.max(8, r.top-h-8);
  m.style.left=left+'px'; m.style.top=top+'px';
}
/* ---------- media ---------- */
let mediaTarget=null; // block id to replace, or null for insert
function openMediaDialog(blockId){
  mediaTarget=blockId; const m=$('#mediaModal'); m.hidden=false;
  $('#mdUrl').value=''; $('#mdCaption').value=''; $('#mdFile').value=''; $('#mdMsg').textContent='';
  if(blockId){ const b=VIEW[blockId]||BLOCK[blockId]; const d=document.createElement('div'); d.innerHTML=b.h; const cap=d.querySelector('figcaption'); if(cap) $('#mdCaption').value=cap.textContent; }
  setTimeout(()=>$('#mdUrl').focus(),30);
}
function mediaHTML(src, kind, caption){
  const cap=`<figcaption>${esc(caption||'')}</figcaption>`;
  if(kind==='embed') return `<figure><iframe src="${esc(src)}" allowfullscreen></iframe>${cap}</figure>`;
  if(kind==='video') return `<figure><video src="${esc(src)}" controls></video>${cap}</figure>`;
  return `<figure><img src="${esc(src)}" alt="${esc(caption||'')}">${cap}</figure>`;
}
function classifyUrl(u){
  let m;
  if((m=u.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/))) return {src:'https://www.youtube-nocookie.com/embed/'+m[1], kind:'embed'};
  if((m=u.match(/vimeo\.com\/(\d+)/))) return {src:'https://player.vimeo.com/video/'+m[1], kind:'embed'};
  if((m=u.match(/drive\.google\.com\/file\/d\/([\w-]+)/))) return {src:'https://drive.google.com/file/d/'+m[1]+'/preview', kind:'embed'};
  if((m=u.match(/rutube\.ru\/video\/([\w]+)/))) return {src:'https://rutube.ru/play/embed/'+m[1], kind:'embed'};
  if(/\.(mp4|webm|mov|m4v|ogv)(\?|$)/i.test(u)) return {src:u, kind:'video'};
  return {src:u, kind:'image'};
}
function fileToDataURL(file){
  return new Promise((res,rej)=>{
    if(!file.type.startsWith('image/')){ rej(new Error('Видео и другие файлы — только по ссылке: загрузи его на Google Диск или YouTube и вставь адрес.')); return; }
    const img=new Image(); const url=URL.createObjectURL(file);
    img.onload=()=>{ const MAX=1400; let w=img.width, h=img.height; if(Math.max(w,h)>MAX){ const k=MAX/Math.max(w,h); w=Math.round(w*k); h=Math.round(h*k); } const c=document.createElement('canvas'); c.width=w; c.height=h; c.getContext('2d').drawImage(img,0,0,w,h); URL.revokeObjectURL(url); res(c.toDataURL(file.type==='image/png'&&file.size<400000?'image/png':'image/jpeg', .82)); };
    img.onerror=()=>rej(new Error('Не удалось прочитать картинку')); img.src=url;
  });
}
async function applyMedia(){
  const url=$('#mdUrl').value.trim(), caption=$('#mdCaption').value.trim(), file=$('#mdFile').files[0];
  let html=null;
  try{
    if(file){ const data=await fileToDataURL(file); if(data.length>1200000) $('#mdMsg').textContent='Картинка тяжёлая — такие лучше хранить по ссылке'; html=mediaHTML(data,'image',caption); }
    else if(url){ const c=classifyUrl(url); html=mediaHTML(c.src,c.kind,caption); }
    else { $('#mdMsg').textContent='Вставь ссылку или выбери файл'; return; }
  }catch(e){ $('#mdMsg').textContent=e.message; return; }
  $('#mediaModal').hidden=true;
  if(mediaTarget){ const b=VIEW[mediaTarget]; if(b){ pushHistory('op'); setModelHTML(b, html); save(); rerender(); } }
  else { insertBlock(insertTarget(), html, false, 'media'); }
}
/* ---------- table tools ---------- */
function currentCell(body){ const sel=getSelection(); let n=sel && sel.rangeCount ? sel.getRangeAt(0).startContainer : null; n = n && (n.nodeType===1?n:n.parentElement); const c = n && body.contains(n) ? n.closest('td,th') : null; return c || body.querySelector('tr:last-child td, tr:last-child th'); }
function tableOp(body, op){
  const cell=currentCell(body); if(!cell) return; const row=cell.parentElement; const tbl=body.querySelector('table'); const rows=[...tbl.querySelectorAll('tr')]; const ci=[...row.children].indexOf(cell);
  if(op==='addrow'){ const nr=document.createElement('tr'); [...row.children].forEach(()=>{ const td=document.createElement('td'); td.innerHTML='&nbsp;'; nr.appendChild(td); }); row.after(nr); }
  if(op==='delrow'){ if(rows.length>1) row.remove(); }
  if(op==='addcol'){ rows.forEach(r=>{ const ref=r.children[Math.min(ci, r.children.length-1)]; const td=document.createElement(ref&&ref.tagName==='TH'?'th':'td'); td.innerHTML='&nbsp;'; if(ref) ref.after(td); else r.appendChild(td); }); }
  if(op==='delcol'){ if(row.children.length>1) rows.forEach(r=>{ if(r.children[ci]) r.children[ci].remove(); }); }
}
function deleteBlock(b, viaKey){
  const all=pageBlocks(curPage); const idx=all.findIndex(x=>x.id===b.id);
  if(b.inserted){ const f=findIns(b.id); if(f){ const kids=D.ins[b.id]||[]; delete D.ins[b.id]; D.ins[f.k].splice(f.i,1,...kids); if(!D.ins[f.k].length) delete D.ins[f.k]; } }
  else {
    D.del[b.id]=1;
  }
  save(); rerender();
  if(viaKey){ let prev=null; for(let i=idx-1;i>=0;i--){ if(!all[i].deleted){ prev=all[i]; break; } } if(prev){ const body=bodyOf(document.getElementById('b-'+prev.id)); if(body && body.isContentEditable) setCaret(prev.id, body.textContent.length); } }
}
function toggleOrig(el, b){
  const ex=el.querySelector('.orig'); if(ex){ ex.remove(); return; }
  const o=document.createElement('div'); o.className='orig';
  o.innerHTML=`<b>Исходник:</b> ${b.orig} <button class="link" data-a="revert">вернуть исходный текст</button>`;
  o.querySelector('button').onclick=()=>{ delete D.edits[b.id]; save(); rerender(b.id); };
  el.querySelector('.toolslot').appendChild(o);
}
const TYPE_CYCLE=['p','dialog','h2','h3','pov','time','callout','quote'];
function cycleType(b){
  const next=TYPE_CYCLE[(TYPE_CYCLE.indexOf(b.t)+1)%TYPE_CYCLE.length];
  if(b.inserted){ const f=findIns(b.id); if(f) D.ins[f.k][f.i].t=next; }
  else { toast('Тип исходных абзацев менять нельзя — добавь новый абзац'); return; }
  save(); rerender(b.id);
}

/* ---------- export ---------- */
function mdInline(h){
  const d=document.createElement('div'); d.innerHTML=h;
  const walk=n=>{ if(n.nodeType===3) return n.nodeValue.replace(/\u00a0/g,' '); if(n.nodeType!==1) return '';
    const inner=[...n.childNodes].map(walk).join('');
    switch(n.tagName){ case 'STRONG': case 'B': return inner.trim()?`**${inner}**`:inner; case 'EM': case 'I': return inner.trim()?`*${inner}*`:inner; case 'S': return `~~${inner}~~`; case 'A': return `[${inner}](${n.getAttribute('href')})`; case 'BR': return '  \n'; default: return inner; } };
  return walk(d).trim();
}
function tableRows(h){ const d=document.createElement('div'); d.innerHTML=h; return [...d.querySelectorAll('tr')].map(tr=>[...tr.children].map(td=>blockText(td.innerHTML).replace(/\n/g,' '))); }
function mdTable(h){ const rows=tableRows(h); if(!rows.length) return ''; const w=Math.max(...rows.map(r=>r.length)); const line=r=>'| '+Array.from({length:w},(_,i)=>(r[i]||'').replace(/\|/g,'\\|')).join(' | ')+' |'; return [line(rows[0]), '| '+Array(w).fill('---').join(' | ')+' |', ...rows.slice(1).map(line)].join('\n'); }
function txtTable(h){ return tableRows(h).map(r=>r.join('  |  ')).join('\n'); }
function listItems(h){ const d=document.createElement('div'); d.innerHTML=h; return [...d.querySelectorAll('li')].map(li=>li.textContent.trim()).filter(Boolean); }
function mediaInfo(h){ const d=document.createElement('div'); d.innerHTML=h; const el=d.querySelector('img,video,iframe'); const cap=d.querySelector('figcaption'); return {src: el?el.getAttribute('src')||'':'', kind: el&&el.tagName==='IMG'?'image':'video', cap: cap?cap.textContent.trim():''}; }

function collect(scope){
  if(scope==='page') return curPage?[curPage]:[];
  if(scope==='reader') return PAGES.filter(p=>!p.special && groupOf(p.section).id==='work');
  if(scope.startsWith('sec:')) return C.sections.find(s=>s.id===scope.slice(4)).pages.filter(p=>!p.special);
  return PAGES.filter(p=>!p.special);
}
function exportText(pages, opts){ // opts: {content, fmt('md'|'txt'), mark, orig}
  const md = opts.fmt==='md'; const L=[];
  const title = pages.length===1 ? pages[0].title : (pages.length===PAGES.length ? CUR_PROJ.name+' — все материалы' : CUR_PROJ.name);
  L.push(md?`# ${title}`:title.toUpperCase(), '');
  if(opts.content!=='text') L.push(md?`_Экспорт от ${new Date().toLocaleString('ru')}_`:`Экспорт от ${new Date().toLocaleString('ru')}`, '');
  pages.forEach(p=>{
    const blocks=pageBlocks(p).filter(b=>!b.deleted); let n=0; const nums={}; blocks.forEach(b=>{ if(!HEAD_TYPES.has(b.t)) nums[b.id]=++n; });
    const pn=(D.pageNotes[p.id]||'').trim();
    const hasAny = opts.content!=='notes' || pn || blocks.some(b=>hasNotes(b.id));
    if(!hasAny) return;
    if(pages.length>1) L.push(md?`\n## ${p.title}`:`\n\n===== ${p.title} =====`, p.sub? (md?`_${p.sub}_`:p.sub):'' , '');
    if(pn && opts.content!=='text') L.push(md?`> **Заметка к странице:** ${pn.replace(/\n/g,'\n> ')}`:`[Заметка к странице: ${pn}]`, '');
    blocks.forEach(b=>{
      const nts=notesOf(b.id); const note=nts.length?nts[0]:null; const num=nums[b.id];
      const showText = opts.content!=='notes' || note;
      if(!showText) return;
      let line;
      if(GRID_TYPES.has(b.t)) line = md?mdTable(b.h):txtTable(b.h);
      else if(b.t==='hr') line = md?'---':'* * *';
      else if(b.t==='media'){ const mm=mediaInfo(b.h); line = md ? (mm.src.startsWith('data:')?`*[Фото${mm.cap?': '+mm.cap:''}]*`:`![${mm.cap}](${mm.src})`) : `[${mm.kind==='image'?'Фото':'Видео'}${mm.cap?': '+mm.cap:''}${mm.src.startsWith('data:')?'':' — '+mm.src}]`; }
      else if(b.t==='list'||b.t==='olist'){ const items=listItems(b.h); line = items.map((it,i)=> (b.t==='olist'?`${i+1}. `:(md?'- ':'• '))+it).join('\n'); }
      else { const t = (md && !HEAD_TYPES.has(b.t))?mdInline(b.h):blockText(b.h);
        if(md){ line = b.t==='h2'?`### ${t}`: b.t==='h3'?`#### ${t}`: b.t==='h4'?`**${t}**`: b.t==='pov'?`### ${t}`: b.t==='time'?`**${t}**`: (b.t==='quote'||b.t==='callout')?'> '+t.replace(/\n/g,'\n> '): t; }
        else line = (b.t==='quote'||b.t==='callout') ? t.split('\n').map(x=>'    '+x).join('\n') : t; }
      if(opts.content==='notes' && !HEAD_TYPES.has(b.t)) line = (md?`**¶${num}** `:`¶${num} `)+line;
      if(opts.mark && !p.user && (b.edited||b.inserted)) line += md?'  \n_[изменено]_':'  [изменено]';
      L.push(line);
      if(opts.orig && b.edited) L.push(md?`> _Исходник:_ ${mdInline(b.orig).replace(/\n/g,' ')}`:`   [Исходник: ${blockText(b.orig)}]`);
      if(opts.content!=='text') nts.forEach(nt=>{
        const q=nt.quote?` («${nt.quote}»)`:''; const who=nt.by?` (${nt.by})`:'';
        L.push(md?`> **Заметка к ¶${num}${who}**${q}: ${nt.text.replace(/\n/g,'\n> ')}`:`   [Заметка к ¶${num}${who}${q}: ${nt.text}]`);
      });
      L.push('');
    });
  });
  return L.join('\n').replace(/\n{3,}/g,'\n\n').trim()+'\n';
}
function exportHTML(pages, opts){
  const parts=[`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${esc(CUR_PROJ.name)} — экспорт</title><style>@page{margin:2cm}@media print{body{max-width:none;margin:0}.note,blockquote,table,figure{break-inside:avoid}}body{font-family:Georgia,serif;max-width:720px;margin:40px auto;padding:0 20px;line-height:1.6;color:#201d19}h1{font-weight:500}h2{margin-top:2em}.pov{font-family:sans-serif;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#5f584e;margin-top:2em}.time{font-family:sans-serif;font-size:12px;letter-spacing:.08em;color:#5f584e;border-top:1px solid #ddd;padding-top:10px;margin-top:1.6em}.note{font-family:sans-serif;font-size:13px;background:#fbf3dc;border:1px solid #e3cf93;border-radius:8px;padding:8px 10px;margin:4px 0 14px}.note q{font-style:italic;color:#5f584e}.orig{font-family:sans-serif;font-size:12.5px;color:#5f584e;background:#eef2f5;padding:6px 10px;border-radius:6px;margin:2px 0 10px}.ed{border-left:3px solid #3f6a8a;padding-left:8px}table{border-collapse:collapse;font-family:sans-serif;font-size:13px}td,th{border:1px solid #ccc;padding:5px 8px;vertical-align:top}.num{color:#aaa;font-family:sans-serif;font-size:11px;margin-right:6px}</style></head><body>`];
  const title = pages.length===1 ? pages[0].title : (pages.length===PAGES.length ? CUR_PROJ.name+' — все материалы' : CUR_PROJ.name);
  parts.push(`<h1>${esc(title)}</h1>`);
  pages.forEach(p=>{
    const blocks=pageBlocks(p).filter(b=>!b.deleted); let n=0; const nums={}; blocks.forEach(b=>{ if(!HEAD_TYPES.has(b.t)) nums[b.id]=++n; });
    const pn=(D.pageNotes[p.id]||'').trim();
    if(opts.content==='notes' && !pn && !blocks.some(b=>hasNotes(b.id))) return;
    if(pages.length>1) parts.push(`<h2>${esc(p.title)}</h2>${p.sub?`<p><em>${esc(p.sub)}</em></p>`:''}`);
    if(pn && opts.content!=='text') parts.push(`<div class="note"><b>Заметка к странице:</b> ${esc(pn).replace(/\n/g,'<br>')}</div>`);
    blocks.forEach(b=>{
      const nts=notesOf(b.id); if(opts.content==='notes' && !nts.length) return;
      const cls=(opts.mark&&!p.user&&(b.edited||b.inserted))?' class="ed"':'';
      const num = (opts.content==='notes' && nums[b.id]) ? `<span class="num">¶${nums[b.id]}</span>` : '';
      if(GRID_TYPES.has(b.t)) parts.push(`<div${cls}>${b.h}</div>`);
      else if(b.t==='hr') parts.push('<hr>');
      else if(b.t==='media'||b.t==='list'||b.t==='olist') parts.push(`<div${cls}>${b.h}</div>`);
      else if(b.t==='quote'||b.t==='callout') parts.push(`<blockquote${cls}>${b.h}</blockquote>`);
      else if(b.t==='h2') parts.push(`<h3${cls}>${b.h}</h3>`);
      else if(b.t==='h3'||b.t==='h4') parts.push(`<h4${cls}>${b.h}</h4>`);
      else if(b.t==='pov') parts.push(`<div class="pov">${b.h}</div>`);
      else if(b.t==='time') parts.push(`<div class="time">${b.h}</div>`);
      else parts.push(`<p${cls}>${num}${b.h}</p>`);
      if(opts.orig && b.edited) parts.push(`<div class="orig"><b>Исходник:</b> ${b.orig}</div>`);
      if(opts.content!=='text') nts.forEach(note=>parts.push(`<div class="note"><b>Заметка к ¶${nums[b.id]||''}</b>${note.quote?` <q>«${esc(note.quote)}»</q>`:''}: ${esc(note.text).replace(/\n/g,'<br>')}</div>`));
    });
  });
  if(opts.print) parts.push(`<script>window.addEventListener('load',()=>{ setTimeout(()=>window.print(), 300); });<\/script>`);
  parts.push('</body></html>'); return parts.join('\n');
}
let docxLoading=null;
function loadDocx(){ if(window.docx) return Promise.resolve(); if(docxLoading) return docxLoading; docxLoading=new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='docx.umd.js'+(window.LIMB_V?'?v='+window.LIMB_V:''); s.onload=res; s.onerror=()=>rej(new Error('docx lib')); document.head.appendChild(s); }); return docxLoading; }
function runsFromHTML(h, d, base){
  const el=document.createElement('div'); el.innerHTML=h; const runs=[];
  const walk=(n, st)=>{ if(n.nodeType===3){ const t=n.nodeValue.replace(/\u00a0/g,' '); if(t) runs.push(new d.TextRun(Object.assign({text:t},base,st))); return; } if(n.nodeType!==1) return;
    if(n.tagName==='BR'){ runs.push(new d.TextRun(Object.assign({break:1},base))); return; }
    const s=Object.assign({},st); if(/^(STRONG|B)$/.test(n.tagName)) s.bold=true; if(/^(EM|I)$/.test(n.tagName)) s.italics=true; if(n.tagName==='S') s.strike=true;
    [...n.childNodes].forEach(c=>walk(c,s)); };
  [...el.childNodes].forEach(c=>walk(c,{})); return runs;
}
async function exportDocx(pages, opts){
  await loadDocx(); const d=window.docx; const ch=[];
  const title = pages.length===1 ? pages[0].title : (pages.length===PAGES.length ? CUR_PROJ.name+' — все материалы' : CUR_PROJ.name);
  ch.push(new d.Paragraph({text:title, heading:d.HeadingLevel.TITLE}));
  const notePara=(label, text, quote)=>new d.Paragraph({shading:{type:d.ShadingType.CLEAR, fill:'FBF3DC'}, spacing:{after:160}, children:[new d.TextRun({text:label+(quote?` («${quote}»)`:'')+': ', bold:true, size:20, font:'Arial'}), ...text.split('\n').flatMap((ln,i)=>[...(i?[new d.TextRun({break:1})]:[]), new d.TextRun({text:ln, size:20, font:'Arial'})])]});
  pages.forEach(p=>{
    const blocks=pageBlocks(p).filter(b=>!b.deleted); let n=0; const nums={}; blocks.forEach(b=>{ if(!HEAD_TYPES.has(b.t)) nums[b.id]=++n; });
    const pn=(D.pageNotes[p.id]||'').trim();
    if(opts.content==='notes' && !pn && !blocks.some(b=>hasNotes(b.id))) return;
    if(pages.length>1){ ch.push(new d.Paragraph({text:p.title, heading:d.HeadingLevel.HEADING_1, pageBreakBefore:true})); if(p.sub) ch.push(new d.Paragraph({children:[new d.TextRun({text:p.sub, italics:true})]})); }
    if(pn && opts.content!=='text') ch.push(notePara('Заметка к странице', pn));
    blocks.forEach(b=>{
      const nts=notesOf(b.id); if(opts.content==='notes' && !nts.length) return;
      const edited=opts.mark&&!p.user&&(b.edited||b.inserted);
      const border = edited ? {border:{left:{style:d.BorderStyle.SINGLE, size:12, color:'3F6A8A', space:6}}} : {};
      if(b.t==='media'){ const mm=mediaInfo(b.h); ch.push(new d.Paragraph({children:[new d.TextRun({text:`[${mm.kind==='image'?'Фото':'Видео'}${mm.cap?': '+mm.cap:''}${mm.src.startsWith('data:')?'':' — '+mm.src}]`, italics:true, size:20})]})); }
      else if(b.t==='hr'){ ch.push(new d.Paragraph({text:'* * *', alignment:d.AlignmentType.CENTER})); }
      else if(b.t==='list'||b.t==='olist'){ listItems(b.h).forEach((it,i)=>ch.push(new d.Paragraph({children:[new d.TextRun({text:(b.t==='olist'?`${i+1}. `:'• ')+it})], indent:{left:360}}))); }
      else if(GRID_TYPES.has(b.t)){
        const rows=tableRows(b.h);
        if(rows.length){ const w=Math.max(...rows.map(r=>r.length));
          ch.push(new d.Table({width:{size:100,type:d.WidthType.PERCENTAGE}, rows:rows.map((r,ri)=>new d.TableRow({children:Array.from({length:w},(_,i)=>new d.TableCell({children:[new d.Paragraph({children:[new d.TextRun({text:r[i]||'', bold:ri===0, size:18, font:'Arial'})]})]}))}))}));
          ch.push(new d.Paragraph({text:''})); }
      } else {
        const base = (b.t==='pov'||b.t==='time') ? {font:'Arial', size:18, bold:true, color:'5F584E'} : {};
        const heading = b.t==='h2'?d.HeadingLevel.HEADING_2 : (b.t==='h3'||b.t==='h4')?d.HeadingLevel.HEADING_3 : undefined;
        const runs = runsFromHTML(b.h, d, base);
        if(opts.content==='notes' && nums[b.id]) runs.unshift(new d.TextRun({text:`¶${nums[b.id]} `, color:'999999', size:16, font:'Arial'}));
        ch.push(new d.Paragraph(Object.assign({children:runs, heading, spacing:{after: HEAD_TYPES.has(b.t)?80:140, before: (b.t==='pov'||b.t==='time')?320:0}}, border)));
      }
      if(opts.orig && b.edited) ch.push(new d.Paragraph({shading:{type:d.ShadingType.CLEAR, fill:'EEF2F5'}, children:[new d.TextRun({text:'Исходник: ', bold:true, size:19, font:'Arial'}), new d.TextRun({text:blockText(b.orig), size:19, font:'Arial'})]}));
      if(opts.content!=='text') nts.forEach(note=>ch.push(notePara(`Заметка к ¶${nums[b.id]||''}`, note.text, note.quote)));
    });
  });
  const doc=new d.Document({styles:{default:{document:{run:{font:'Georgia', size:23}}}}, sections:[{children:ch}]});
  return d.Packer.toBlob(doc);
}
function download(blob, name){
  try{ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 2000); return true; }catch(e){ return false; }
}
function slug(s){ return s.replace(/[«»"']/g,'').replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'').slice(0,50); }
function exPages(){ const ws=wsPanePages(); return ws.length ? ws : PAGES.filter(p=>!p.special); }
function exDepth(p){ return wsUser(p) ? wsPath(p).length : 0; }
function exSelected(){
  const ids=new Set($$('#exScopeList input[name=exs]:checked').map(i=>i.value));
  return exPages().filter(p=>ids.has(p.id) && (wsType(p)!=='folder' || pageBlocks(p).some(b=>!b.deleted)));
}
function exSyncAll(){ const all=$$('#exScopeList input[name=exs]'); const on=all.length&&all.every(i=>i.checked); const b=$('#exScopeAll'); if(b) b.textContent=on?'Снять выбор':'Выбрать все'; }
function openExport(){
  const list=$('#exScopeList');
  list.innerHTML = `<button type="button" class="link-btn dim" id="exScopeAll">Выбрать все</button>` + exPages().map(p=>`<label class="ex-item" style="padding-left:${exDepth(p)*18}px"><input type="checkbox" name="exs" value="${p.id}"${curPage&&curPage.id===p.id?' checked':''}> ${esc(p.title)}${wsUser(p)?` <span class="muted small">· ${esc(wsLabel(p))}</span>`:''}</label>`).join('');
  exSyncAll();
  $('#exPreviewWrap').hidden=true; $('#exCopy').hidden=true; $('#exDownload').hidden=true; $('#exMsg').textContent='';
  $$('#exPresets .chip').forEach(c=>c.classList.remove('on')); $('#exPresetHint').textContent='';
  $('#exportModal').hidden=false;
}
const EX_PRESETS={
  reader:{scope:'reader', content:'text', hint:'Главы и экстры одним файлом, без заметок, без базы истории и планов.'},
  beta:{scope:'reader', content:'both', hint:'Главы и экстры с заметками к фрагментам и к страницам — для беты или редактора. База истории не включается.'},
  all:{scope:'all', content:'both', hint:'Всё, что есть: текст, экстры, база истории, заметки.'}
};
function applyPreset(id){ const pr=EX_PRESETS[id]; if(!pr) return; $$('#exPresets .chip').forEach(c=>c.classList.toggle('on', c.dataset.preset===id)); $$('#exScopeList input[name=exs]').forEach(i=>i.checked=true); exSyncAll(); $(`input[name=exc][value=${pr.content}]`).checked=true; $('#exPresetHint').textContent=pr.hint; }
let lastExport=null;
async function runExport(){
  const content=$('input[name=exc]:checked').value, fmt=$('input[name=exf]:checked').value;
  const opts={content, fmt, mark:false, orig:false};
  const pages=exSelected(); if(!pages.length){ $('#exMsg').textContent='Отметь, что выгружать.'; return; }
  const base = pages.length===1 ? slug(pages[0].title) : slug(CUR_PROJ.name)||'vse';
  const stamp=new Date().toISOString().slice(0,10);
  $('#exMsg').textContent='Собираю…';
  try{
    if(fmt==='md'||fmt==='txt'){
      const text=exportText(pages, opts); lastExport={blob:new Blob([text],{type:'text/plain;charset=utf-8'}), name:`${base}-${stamp}.${fmt}`, text};
      $('#exPreview').value=text; $('#exPreviewWrap').hidden=false; $('#exStat').textContent=`· ${text.length.toLocaleString('ru')} знаков`; $('#exCopy').hidden=false;
    } else if(fmt==='pdf'){
      const html=exportHTML(pages, Object.assign({}, opts, {print:true}));
      lastExport={blob:new Blob([html],{type:'text/html;charset=utf-8'}), name:`${base}-${stamp}.html`, text:html};
      $('#exPreviewWrap').hidden=true; $('#exCopy').hidden=true;
      const w=window.open('', '_blank');
      if(w){ w.document.open(); w.document.write(html); w.document.close(); $('#exMsg').textContent='Открылось окно печати: выбери «Сохранить как PDF».'; }
      else { download(lastExport.blob, lastExport.name); $('#exMsg').textContent='Окно заблокировано браузером — скачан HTML-файл: открой его и нажми Ctrl+P → «Сохранить как PDF».'; }
      $('#exDownload').hidden=false; return;
    } else if(fmt==='html'){
      const html=exportHTML(pages, opts); lastExport={blob:new Blob([html],{type:'text/html;charset=utf-8'}), name:`${base}-${stamp}.html`, text:html};
      $('#exPreview').value=html; $('#exPreviewWrap').hidden=false; $('#exStat').textContent=''; $('#exCopy').hidden=false;
    } else {
      const blob=await exportDocx(pages, opts); lastExport={blob, name:`${base}-${stamp}.docx`, text:null};
      $('#exPreviewWrap').hidden=true; $('#exCopy').hidden=true;
    }
    $('#exDownload').hidden=false; $('#exMsg').textContent='Готово';
    if(fmt==='docx'){ download(lastExport.blob, lastExport.name); $('#exMsg').textContent='Файл .docx отправлен на скачивание. Если ничего не произошло — нажми «Скачать файл».'; }
  }catch(e){ console.error(e); $('#exMsg').textContent='Не получилось собрать: '+e.message; }
}
function plainText(pages){
  const L=[];
  pages.forEach((p,i)=>{
    L.push(p.title);
    pageBlocks(p).filter(b=>!b.deleted).forEach(b=>{ L.push(GRID_TYPES.has(b.t)?txtTable(b.h):b.t==='hr'?'* * *':b.t==='media'?(m=>`[${m.kind==='image'?'Фото':'Видео'}${m.cap?': '+m.cap:''}]`)(mediaInfo(b.h)):blockText(b.h)); });
    if(i<pages.length-1) L.push('', '');
  });
  return L.join('\n\n').replace(/\n{3,}/g,'\n\n').trim()+'\n';
}
async function copyText(t, msgEl){
  let ok=false; try{ await navigator.clipboard.writeText(t); ok=true; }catch(e){ try{ const ta=document.createElement('textarea'); ta.value=t; document.body.appendChild(ta); ta.select(); ok=document.execCommand('copy'); ta.remove(); }catch(_){} }
  if(msgEl) msgEl.textContent = ok?'Скопировано':'Не удалось скопировать — выдели текст вручную';
  return ok;
}

/* ---------- project file ---------- */
/* ---------- import: DOCX / Markdown / TXT, split into chapters by headings ---------- */
async function unzipEntry(buf, wantName){
  const dv=new DataView(buf); const u8=new Uint8Array(buf); const td=new TextDecoder();
  let eocd=-1; for(let i=buf.byteLength-22;i>=Math.max(0,buf.byteLength-70000);i--){ if(dv.getUint32(i,true)===0x06054b50){ eocd=i; break; } }
  if(eocd<0) throw new Error('не похоже на zip/docx');
  const cdSize=dv.getUint32(eocd+12,true), cdOff=dv.getUint32(eocd+16,true); let p=cdOff;
  while(p<cdOff+cdSize){ if(dv.getUint32(p,true)!==0x02014b50) break; const method=dv.getUint16(p+10,true), csize=dv.getUint32(p+20,true), nlen=dv.getUint16(p+28,true), elen=dv.getUint16(p+30,true), clen=dv.getUint16(p+32,true), lho=dv.getUint32(p+42,true); const name=td.decode(u8.subarray(p+46,p+46+nlen));
    if(name===wantName){ const lnlen=dv.getUint16(lho+26,true), lelen=dv.getUint16(lho+28,true); const start=lho+30+lnlen+lelen; const data=u8.subarray(start,start+csize);
      if(method===0) return td.decode(data);
      if(method===8){ const ds=new DecompressionStream('deflate-raw'); const w=ds.writable.getWriter(); w.write(data); w.close(); return await new Response(ds.readable).text(); }
      throw new Error('неизвестное сжатие'); }
    p+=46+nlen+elen+clen; }
  throw new Error('в файле нет '+wantName);
}
function docxToBlocks(xml){
  const doc=new DOMParser().parseFromString(xml,'application/xml'); const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const out=[]; const ps=doc.getElementsByTagNameNS(W,'p');
  for(const p of ps){ const pPr=p.getElementsByTagNameNS(W,'pPr')[0]; let style=''; if(pPr){ const st=pPr.getElementsByTagNameNS(W,'pStyle')[0]; if(st) style=(st.getAttributeNS(W,'val')||st.getAttribute('w:val')||'').toLowerCase(); }
    let html=''; for(const r of p.getElementsByTagNameNS(W,'r')){ const rPr=r.getElementsByTagNameNS(W,'rPr')[0]; let b=false,i=false; if(rPr){ b=!!rPr.getElementsByTagNameNS(W,'b').length; i=!!rPr.getElementsByTagNameNS(W,'i').length; }
      let t=''; for(const n of r.childNodes){ if(n.localName==='t') t+=n.textContent; else if(n.localName==='tab') t+=' '; else if(n.localName==='br') t+='\n'; }
      if(!t) continue; t=esc(t); if(b) t='<strong>'+t+'</strong>'; if(i) t='<em>'+t+'</em>'; html+=t; }
    const text=html.replace(/<[^>]+>/g,'').trim(); if(!text) continue;
    let lvl=0; const m=style.match(/heading(\d)|(?:заголовок|title)(\d)?/); if(m) lvl=+(m[1]||m[2]||1); if(style==='title') lvl=1;
    out.push({lvl, html:html.trim(), text}); }
  return out;
}
function mdToBlocks(txt){ const out=[]; txt.replace(/\r\n?/g,'\n').split(/\n/).forEach(line=>{ const l=line.trimEnd(); if(!l.trim()) return; const h=l.match(/^(#{1,4})\s+(.*)$/); if(h){ out.push({lvl:h[1].length, html:esc(h[2].trim()), text:h[2].trim()}); return; }
  let html=esc(l.trim()).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/(^|[^*])\*(?!\*)(.+?)\*(?!\*)/g,'$1<em>$2</em>').replace(/_(.+?)_/g,'<em>$1</em>'); out.push({lvl:0, html, text:l.trim()}); }); return out; }
function txtToBlocks(txt){ const out=[]; txt.replace(/\r\n?/g,'\n').split(/\n/).forEach(line=>{ const l=line.trim(); if(!l) return; const isHead=/^(глава|часть|chapter)\s*\d+/i.test(l) || /^\d{1,2}\.\s+\S/.test(l) && l.length<60 || (l.length<50 && l===l.toUpperCase() && /[А-ЯA-Z]/.test(l) && !/[.!?…]$/.test(l)); out.push({lvl:isHead?1:0, html:esc(l), text:l}); }); return out; }
function classifyBlock(b){ if(b.lvl) return b.lvl<=2?'h2':b.lvl===3?'h3':'h4'; if(/^\d{1,2}:\d\d$/.test(b.text)) return 'time'; if(/^[—–-]\s/.test(b.text)) return 'dialog'; return 'p'; }
function splitChapters(blocks, mode){
  const chapters=[]; let cur=null; const minLvl=Math.min(...blocks.filter(b=>b.lvl).map(b=>b.lvl), 9);
  blocks.forEach(b=>{ const isBreak = mode==='none' ? false : (mode==='h1' ? (b.lvl && b.lvl===minLvl) : (b.lvl && b.lvl<=Math.min(minLvl+1,2)));
    if(isBreak || !cur){ if(isBreak){ cur={title:b.text, blocks:[]}; chapters.push(cur); return; } cur={title:'', blocks:[]}; chapters.push(cur); }
    cur.blocks.push(b); });
  return chapters.filter(c=>c.blocks.length || c.title);
}
let IMPORT={blocks:null, name:''};
function openImport(){ IMPORT={blocks:null, name:''}; $('#impFile').value=''; $('#impText').value=''; $('#impPreview').innerHTML=''; $('#impApply').disabled=true; $('#impMsg').textContent=''; $('#impSec').value = curPage ? (curPage.section.id==='arch'?'ref':curPage.section.id) : 'text'; $('#importModal').hidden=false; }
async function importFile(file){
  try{ let blocks; const name=file.name||'';
    if(/\.docx$/i.test(name)){ const buf=await file.arrayBuffer(); const xml=await unzipEntry(buf,'word/document.xml'); blocks=docxToBlocks(xml); }
    else if(/\.(md|markdown)$/i.test(name)) blocks=mdToBlocks(await file.text());
    else blocks=txtToBlocks(await file.text());
    IMPORT={blocks, name:name.replace(/\.[^.]+$/,'')}; renderImportPreview(); }
  catch(e){ $('#impMsg').textContent='Не удалось прочитать файл: '+e.message; }
}
function renderImportPreview(){
  if(!IMPORT.blocks){ const t=$('#impText').value; if(!t.trim()) return; IMPORT.blocks = /^#{1,4}\s/m.test(t) ? mdToBlocks(t) : txtToBlocks(t); IMPORT.name='Вставленный текст'; }
  const mode=$('input[name=impSplit]:checked').value; const chs=splitChapters(IMPORT.blocks, mode); IMPORT.chapters=chs;
  const pageOpts=PAGES.filter(p=>!p.special).map(p=>`<option value="${p.id}">${esc(p.title)}</option>`).join('');
  $('#impPreview').innerHTML=`<div class="muted small">Получится страниц: ${chs.length}. Для каждой выбери: новая страница или замена текста существующей (старый текст уйдёт в «Версии»).</div>`+chs.map((c,i)=>{ const title=c.title||IMPORT.name||'Без названия'; const match=PAGES.find(p=>!p.special && p.title.trim().toLowerCase()===title.trim().toLowerCase()); const paras=c.blocks.filter(b=>!b.lvl).length; const first=(c.blocks.find(b=>!b.lvl)||{}).text||'';
    return `<div class="imp-row" data-i="${i}"><div class="imp-h"><input type="text" class="imp-title" value="${esc(title)}"><span class="muted small">${paras} абз.</span></div><div class="muted small imp-first">${esc(first.slice(0,140))}${first.length>140?'…':''}</div><select class="imp-target"><option value="">Новая страница</option>${pageOpts}</select></div>`; }).join('');
  $('#impPreview').querySelectorAll('.imp-row').forEach((row,i)=>{ const title=row.querySelector('.imp-title').value; const match=PAGES.find(p=>!p.special && p.title.trim().toLowerCase()===title.trim().toLowerCase()); if(match) row.querySelector('.imp-target').value=match.id; });
  $('#impApply').disabled=!chs.length; $('#impMsg').textContent='';
}
function applyImport(){
  const rows=[...$('#impPreview').querySelectorAll('.imp-row')]; if(!rows.length) return; const sec=$('#impSec').value; let created=0, replaced=0; let firstId=null;
  rows.forEach((row,i)=>{ const ch=IMPORT.chapters[i]; const title=row.querySelector('.imp-title').value.trim()||('Импорт '+(i+1)); const target=row.querySelector('.imp-target').value;
    const blocks=ch.blocks.filter(b=>!(b.lvl && b.text===ch.title)).map((b,k)=>({id:'i'+Date.now().toString(36)+i.toString(36)+k.toString(36), t:classifyBlock(b), h:b.html}));
    if(target && PAGE[target]){ const p=PAGE[target]; const full=pageBlocks(p).filter(b=>!b.deleted).map(b=>({id:b.id,t:b.t,h:b.h})); versionsOf(p.id).push({ts:Date.now(), name:'до импорта', auto:false, z:LZString.compressToUTF16(JSON.stringify({full, pageNote:D.pageNotes[p.id]||''})), n:full.length, c:full.reduce((a,b)=>a+blockText(b.h).length,0), full:true}); replacePageText(p, blocks); replaced++; firstId=firstId||p.id; }
    else { const id='np'+Date.now().toString(36)+i.toString(36); D.pages.push({id, title, sub:'', sec}); registerUserPages(); D.ins['top:'+id]=blocks; blocks.forEach(b=>{ BLOCK[b.id]=b; PAGE_OF[b.id]=id; }); created++; firstId=firstId||id; } });
  save(); buildToc(); $('#importModal').hidden=true; if(firstId) nav('#/'+firstId); else route();
  toast(`Импорт готов: новых страниц ${created}, заменено ${replaced}`);
}
/* ---------- offline (PWA) ---------- */
let swState='';
function initPWA(){
  if(!('serviceWorker' in navigator) || location.protocol!=='https:' && location.hostname!=='localhost') { swState='unsupported'; return; }
  try{
    navigator.serviceWorker.register('sw.js').then(reg=>{
      swState = navigator.serviceWorker.controller ? 'ready' : 'installing';
      reg.addEventListener('updatefound', ()=>{ const nw=reg.installing; if(!nw) return; nw.addEventListener('statechange', ()=>{ if(nw.state==='installed' && navigator.serviceWorker.controller){ toast('Доступна новая версия приложения', {label:'Обновить', fn:()=>{ flush(); location.reload(); }}); } }); });
    }).catch(()=>{ swState='failed'; });
    navigator.serviceWorker.addEventListener('message', e=>{ if(e.data && e.data.type==='limb-sw'){ swState='ready'; } });
    navigator.serviceWorker.ready.then(()=>{ swState='ready'; });
  }catch(e){ swState='failed'; }
}
function openProject(){
  const po=$('#projOffline'); if(po){ po.textContent = swState==='ready' ? 'Приложение доступно без сети: тексты, шрифты и оформление сохранены на этом устройстве. Его можно установить на телефон или компьютер через меню браузера («Установить приложение» / «На экран Домой»).' : swState==='installing' ? 'Готовится работа без сети — при следующем открытии приложение будет доступно офлайн.' : 'Работа без сети в этом окне недоступна (нужно открыть сайт в отдельной вкладке по адресу limbwriting.pplx.app).'; }
  const st={pages:0,notes:0,edits:0,ins:0};
  PAGES.forEach(p=>{ const s=pageStats(p); if(s.notes||s.edits) st.pages++; st.notes+=s.notes; st.edits+=s.edits; });
  for(const k in D.ins) st.ins+=D.ins[k].length;
  $('#projStats').innerHTML=`<div><b>${st.pages}</b><span>страниц затронуто</span></div><div><b>${st.notes}</b><span>заметок</span></div><div><b>${st.edits-st.ins}</b><span>правок и удалений</span></div><div><b>${st.ins}</b><span>новых абзацев</span></div>`;
  $('#projStore').textContent = storageOK ? 'Браузер автоматически сохраняет их между открытиями, но надёжнее время от времени сохранять файл проекта.' : 'В этом окне автосохранение недоступно: перед закрытием обязательно сохрани файл проекта, а в следующий раз открой его.';
  $('#projText').value=backupJSON(); const bc=$('#betaCopy'); bc.disabled=!curPage||!!curPage.special; bc.textContent = curPage&&!curPage.special ? `Копия для беты: ${curPage.title}` : 'Копия главы для беты (открой главу)';
  $('#projLast').textContent = D.lastBackup ? 'Последняя резервная копия: '+fmtDate(D.lastBackup) : 'Резервная копия ещё ни разу не сохранялась.';
  $('#projectModal').hidden=false;
}
function backupJSON(){
  PAGES.forEach(p=>cacheBase(p));
  const pages=PAGES.map(p=>({id:p.id, title:p.title, sub:p.sub||'', sec:p.section.id, user:!!p.user, rev:p.rev||'', blocks:pageBlocks(p).filter(b=>!b.deleted).map(b=>({id:b.id,t:b.t,h:b.h}))}));
  return JSON.stringify({kind:'limb-backup', v:2, ts:Date.now(), app:window.LIMB_V||'', project:{id:CUR_PROJ.id, name:CUR_PROJ.name, builtin:!!CUR_PROJ.builtin}, data:D, pages});
}
function restoreBackup(obj){
  // 1) the work layer as it was; 2) for pages whose source text differs from the one the backup was made against, put the backed-up text in place
  D=Object.assign(emptyData(), obj.data||{}); D.anns=D.anns||{}; D.pages=D.pages||[]; D.types=D.types||{}; D.base=D.base||{}; D.pageRev=D.pageRev||{};
  registerUserPages();
  for(const k in D.ins) D.ins[k].forEach(b=>{ BLOCK[b.id]=b; PAGE_OF[b.id]=PAGE_OF[k]||(k.startsWith('top:')?k.slice(4):null); });
  let replaced=0;
  (obj.pages||[]).forEach(bp=>{
    let p=PAGE[bp.id];
    if(!p){ if(!bp.blocks.length) return; D.pages.push({id:bp.id,title:bp.title,sub:bp.sub,sec:bp.sec}); registerUserPages(); p=PAGE[bp.id]; if(!p) return; }
    if(p.user) { return; }
    const fits = bp.blocks.every(b=>BLOCK[b.id]);
    if(fits) return;                       // same source text: the work layer applies as is
    if(!pageHasTextLayer(p)) return;       // nothing of hers in that text: the newer source is fine
    replacePageText(p, bp.blocks); replaced++;
  });
  PAGES.forEach(p=>{ if(p.rev) D.pageRev[p.id]=p.rev; });
  cleanupOrphans(); buildToc(); save(); route();
  toast(replaced?`Резервная копия восстановлена; текст ${replaced} стр. взят из копии`:'Резервная копия восстановлена');
}
function applyProject(obj, merge){
  if(obj && obj.kind==='limb-backup'){ restoreBackup(obj); return; }
  if(!obj || typeof obj!=='object' || !obj.edits){ toast('Это не файл проекта'); return; }
  if(merge){ D.types=D.types||{}; ['edits','notes','anns','pageNotes','ins','del','types'].forEach(k=>Object.assign(D[k], obj[k]||{})); D.seeded=[...new Set([...(D.seeded||[]),...(obj.seeded||[])])]; (obj.pages||[]).forEach(u=>{ if(!D.pages.find(x=>x.id===u.id)) D.pages.push(u); }); }
  else D=Object.assign(emptyData(), obj);
  D.anns=D.anns||{}; D.pages=D.pages||[]; D.types=D.types||{};
  registerUserPages(); buildToc();
  for(const k in D.ins) D.ins[k].forEach(b=>{ BLOCK[b.id]=b; PAGE_OF[b.id]=PAGE_OF[k]||(k.startsWith('top:')?k.slice(4):null); });
  save(); route(); toast('Проект загружен');
}

/* ---------- misc UI ---------- */
let toastT=null;
function toast(m, action){ const t=$('#toast'); t.textContent=m; if(action){ const b=document.createElement('button'); b.className='toast-act'; b.textContent=action.label; b.onclick=()=>{ t.hidden=true; action.fn(); }; t.appendChild(b); } t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true, action?9000:2600); }


/* ---------- оформление проекта: палитра, шрифт, фон; стартовый экран ---------- */
const PALETTES=[
  {id:'base',   label:'Основная',   c:['#723424','#AC6F40','#5D6444','#516D79','#E5E0CF','#262626']},
  {id:'indigo', label:'Индиго',     c:['#424185','#4453A4','#B4D2EE','#E2BF7B','#E1A656','#131316']},
  {id:'terra',  label:'Терракота',  c:['#B05721','#D0B78E','#746A2C','#46374A','#241F23','#151315']}
];
const APP_NAME = (document.title.split(' · ')[0] || 'Лимб').trim();
function applyLook(look){
  const l=look||CUR_PROJ.look||{};
  if(l.palette && l.palette!=='rust') document.body.dataset.palette=l.palette; else delete document.body.dataset.palette;
  if(l.ui && l.ui!=='beer') document.body.dataset.ui=l.ui; else delete document.body.dataset.ui;
  const LOGOS=window.LIMB_LOGOS; if(LOGOS){ const src=LOGOS[l.palette]||LOGOS.base; $$('img.logo').forEach(i=>{ if(i.getAttribute('src')!==src) i.src=src; }); const fav=$('link[rel="icon"][type="image/svg+xml"]'); if(fav && fav.getAttribute('href')!==src) fav.href=src; }
}
function lookDialog(opts){
  /* opts: {mode:'first'|'new'|'edit', onDone(look,name)} */
  const cur=Object.assign({palette:(CUR_PROJ.look&&CUR_PROJ.look.palette)||(opts.mode==='edit'?'rust':'base'), font:(CUR_PROJ.look&&CUR_PROJ.look.font)||prefs.font||'literata', ui:'beer'}, opts.mode==='edit'?(CUR_PROJ.look||{}):{});
  const before={palette:document.body.dataset.palette, ui:document.body.dataset.ui, font:document.body.dataset.font, fs:document.body.style.fontSize};
  const name = opts.mode==='edit' ? CUR_PROJ.name : (opts.mode==='first' ? '' : '');
  const m=document.createElement('div'); m.className='modal look'; m.id='lookModal';
  m.innerHTML=`<div class="dlgbox">
    <div class="dlgbox-head"><h3>${opts.mode==='edit'?'Редактировать историю':'Новая история'}</h3><button class="icon-btn" data-close>✕</button></div>
    <form class="dlgbox-body" id="lookForm">
      <div class="field"><label for="lookName">Название</label><input type="text" id="lookName" autocomplete="off" maxlength="80" placeholder="" value="${esc(name)}"></div>
      <div class="field"><label>Цветовая палитра</label><div class="tiles">${PALETTES.map(p=>`<label class="tile"><input type="radio" name="palette" value="${p.id}"${p.id===cur.palette?' checked':''}><span class="sw">${p.c.map(c=>`<i style="background:${c}"></i>`).join('')}</span><span>${p.label}</span></label>`).join('')}</div></div>
      <div class="field"><label>Шрифт текста</label><div class="tiles">${FONTS.map(f=>`<label class="tile"><input type="radio" name="font" value="${f.id}"${f.id===cur.font?' checked':''}><span class="fs" style="font-family:${f.ff}">Аа Бб</span><span style="font-family:${f.ff};font-weight:400">${f.label}</span></label>`).join('')}</div></div>
      <div class="field"><label>Шрифт заголовков и кнопок</label><div class="tiles">${UIFONTS.map(f=>`<label class="tile"><input type="radio" name="ui" value="${f.id}"${f.id===cur.ui?' checked':''}><span class="fs" style="font-family:${f.ff}">Глава</span><span style="font-family:${f.ff};font-weight:400">${f.label}</span></label>`).join('')}</div></div>
    </form>
    <div class="dlgbox-foot"><button class="btn primary" type="submit" form="lookForm">${opts.mode==='edit'?'Сохранить':'Создать'}</button><button class="btn" type="button" data-close>Отмена</button></div>
  </div>`;
  document.body.appendChild(m);
  const form=$('#lookForm', m);
  const read=()=>({palette:form.palette.value, font:form.font.value, ui:form.ui.value});
  const preview=()=>{ const l=read(); applyLook(l); const f=FONTS.find(x=>x.id===l.font)||FONTS[0]; document.body.dataset.font=f.id; document.body.style.fontSize=(prefs.size*f.k).toFixed(1)+'px'; };
  const restore=()=>{ if(before.palette) document.body.dataset.palette=before.palette; else delete document.body.dataset.palette; if(before.ui) document.body.dataset.ui=before.ui; else delete document.body.dataset.ui; if(before.font) document.body.dataset.font=before.font; document.body.style.fontSize=before.fs; };
  form.addEventListener('change', preview);
  const close=()=>{ restore(); m.remove(); };
  m.addEventListener('click', e=>{ if(e.target===m || e.target.closest('[data-close]')) close(); });
  form.addEventListener('submit', e=>{ e.preventDefault(); const nm=form.lookName.value.trim(); if(!nm){ form.lookName.focus(); return; } const l=read(); m.remove(); opts.onDone(l, nm); });
  setTimeout(()=>form.lookName.focus(), 30);
  return m;
}
function renderBrand(){ if(!CUR_PROJ.builtin||PROJ.setup) document.title=CUR_PROJ.name+' · Ракурс'; }
function needsStart(){ if(window.RK_CLOUD && RK_CLOUD.enabled && !RK_CLOUD.user) return true; return CUR_PROJ.builtin && !PROJ.setup && PROJ.list.length===1 && !C.sections.some(s=>(s.pages||[]).some(p=>!p.special)) && isEmptyData(D); }
function showStart(){
  const st=document.createElement('div'); st.className='start rk-start-cover'; st.id='startScreen';
  st.innerHTML=`<div class="rk-start-film"><img class="rk-start-bg" src="assets/backgrounds/main-web.webp" alt="Ракурс — пространство для твоих историй" draggable="false"><button type="button" class="rk-start-btn" id="startCreate" aria-label="Открыть"><img class="rk-start-btn-img" src="assets/buttons/open.png" alt="Открыть" draggable="false"><img class="rk-start-btn-img-hover" src="assets/buttons/open-hover.png" alt="" aria-hidden="true" draggable="false"></button></div>`;
  document.body.appendChild(st); document.body.classList.add('has-start');
  const cloud = window.RK_CLOUD && RK_CLOUD.enabled ? RK_CLOUD : null;
  const newStory=()=>lookDialog({mode:'first', onDone:(l,nm)=>{ CUR_PROJ.name=nm; CUR_PROJ.look=l; PROJ.setup=true; saveProjects(PROJ); prefs.font=l.font; savePrefs(); st.remove(); document.body.classList.remove('has-start'); const go=()=>{ location.hash='#/'; location.reload(); }; if(cloud && cloud.user) cloud.flushNow().then(go, go); else go(); }});
  if(cloud) cloud.onLoginFresh = newStory; // вошли, а историй в облаке ещё нет → сразу «Новая история»
  $('#startCreate', st).onclick=()=>{ if(cloud && !cloud.user){ cloud.openDialog('login'); return; } newStory(); };
}
function init(){
  storageOK = store.test();
  const saved = storageOK ? store.read() : null;
  if(saved) D=Object.assign(emptyData(), saved);
  D.anns=D.anns||{}; D.pages=D.pages||[]; D.types=D.types||{};
  registerUserPages(); applyMoves();
  for(const k in D.ins) D.ins[k].forEach(b=>{ BLOCK[b.id]=b; PAGE_OF[b.id]=PAGE_OF[k]||(k.startsWith('top:')?k.slice(4):null); });
  initTabLock(); applyRevisions(); applySeeds(); cleanupOrphans();
  if(!storageOK) setStoreState('bad','В этом окне автосохранение недоступно — открой сайт в отдельной вкладке или пользуйся файлом проекта'); else setStoreState('ok','init');
  $('#storageState').onclick=openProject;
  if(backupStale() && storageOK) setTimeout(()=>toast(D.lastBackup?'Резервной копии больше недели — обнови её':'Сделай резервную копию проекта: данные хранятся только в этом браузере', {label:'Открыть', fn:openProject}), 2500);
  document.body.classList.add('mode-read');
  buildToc();
  $('#btnMore').onclick=e=>{ e.stopPropagation(); const r=$('.bar-right'); r.classList.toggle('open'); $('#btnMore').classList.toggle('on', r.classList.contains('open')); };
  document.addEventListener('click', e=>{ const r=$('.bar-right'); if(r.classList.contains('open') && !e.target.closest('.bar-right') && !e.target.closest('.popmenu') && !e.target.closest('.modal')){ r.classList.remove('open'); $('#btnMore').classList.remove('on'); } });
  $('#btnSide').onclick=openSide; $('#btnCloseSide').onclick=closeSide; $('#sideShade').onclick=closeSide;
  $('#toc').addEventListener('click', e=>{ if(e.target.closest('a')) closeSide(); });
  $('#searchResults').addEventListener('click', e=>{ if(e.target.closest('a')) closeSide(); });
  $('#search').addEventListener('input', e=>doSearch(e.target.value));
  $('#searchTools').addEventListener('click', e=>{ const b=e.target.closest('button'); if(!b) return;
    if(b.dataset.scope){ searchOpts.scopes[b.dataset.scope]=!searchOpts.scopes[b.dataset.scope]; b.classList.toggle('on', searchOpts.scopes[b.dataset.scope]); }
    else if(b.id==='yoFold'){ searchOpts.yo=!searchOpts.yo; b.classList.toggle('on', searchOpts.yo); }
    else if(b.id==='replToggle'){ searchOpts.replace=!searchOpts.replace; b.classList.toggle('on', searchOpts.replace); $('#replBox').hidden=!searchOpts.replace; if(searchOpts.replace) setTimeout(()=>$('#replWith').focus(),30); }
    else if(b.id==='replPage'){ if(!b.dataset.armed){ b.dataset.armed='1'; b.textContent='Точно? Ещё раз'; setTimeout(()=>{ b.dataset.armed=''; b.textContent='На этой странице'; },3000); return; } b.dataset.armed=''; b.textContent='На этой странице'; runReplace(true); }
    else if(b.id==='replAll'){ if(!b.dataset.armed){ b.dataset.armed='1'; b.textContent='Точно везде? Ещё раз'; setTimeout(()=>{ b.dataset.armed=''; b.textContent='Везде'; },3000); return; } b.dataset.armed=''; b.textContent='Везде'; runReplace(false); }
    else return;
    doSearch($('#search').value); });
  $('#replWith').addEventListener('input', ()=>doSearch($('#search').value));
  $$('.seg-btn').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
  loadPrefs(); buildPrefMenus(); applyLook(); applyFont(); applyTheme();
  if(needsStart()) showStart();
  $('#btnTheme').onclick=()=>{ prefs.theme = prefs.theme==='light' ? 'dark' : 'light'; applyTheme(); };
  $('#btnSplit').onclick=()=>toggleSplit();
  $('#btnVersions').onclick=()=>openVersions();
  $('#verSave').onclick=()=>{ if(!curPage) return; saveVersion($('#verName').value.trim()||'', false); $('#verName').value=''; renderVersions(); toast('Версия сохранена'); };
  $('#view2Select').onchange=()=>{ prefs.split=$('#view2Select').value; savePrefs(); renderPane(); };
  $('#view2Close').onclick=()=>toggleSplit(false);
  new ResizeObserver(setBarH).observe($('.bar'));
  $('#view2Min').onclick=()=>setPaneMin(true); $('#view2Max').onclick=()=>setPaneMin(false);
  $('#noteSheetClose').onclick=closeNoteSheet; $('#noteSheet').addEventListener('mousedown',e=>e.stopPropagation());
  window.addEventListener('hashchange', closeNoteSheet);
  $$('#view2 .pane-tabs button').forEach(b=>b.onclick=()=>setPaneTab(b.dataset.tab));
  $('#btnFocus').onclick=()=>toggleFocus(); if(prefs.focus) toggleFocus(true);
  $('#btnHideSide').onclick=()=>{ prefs.sideHidden=!prefs.sideHidden; applySide(); };
  applySide();
  if(prefs.split) toggleSplit(true);
  if(prefs.paneMin) setPaneMin(true);
  $('#btnFont').onclick=e=>{ e.stopPropagation(); togglePopmenu($('#sizeMenu'), $('#btnFont')); };
  $('#btnHand').onclick=e=>{ e.stopPropagation(); togglePopmenu($('#fontMenu'), $('#btnHand')); };
  document.addEventListener('click', e=>{ if(!e.target.closest('.popmenu,#btnFont,#btnHand')) hidePopmenus(); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') hidePopmenus(); });
  $('#btnExport').onclick=openExport; $('#exRun').onclick=runExport;
  $('#exPresets').addEventListener('click', e=>{ const c=e.target.closest('.chip'); if(c) applyPreset(c.dataset.preset); });
  $('#exScopeList').addEventListener('change', e=>{ const i=e.target; if(i&&i.name==='exs'&&PAGE[i.value]&&wsType(PAGE[i.value])==='folder'){ $$('#exScopeList input[name=exs]').forEach(o=>{ if(o!==i&&wsDescendant(o.value,i.value)) o.checked=i.checked; }); } exSyncAll(); $$('#exPresets .chip').forEach(c=>c.classList.remove('on')); $('#exPresetHint').textContent=''; });
  $('#exScopeList').addEventListener('click', e=>{ if(e.target.id!=='exScopeAll') return; const all=$$('#exScopeList input[name=exs]'); const on=!all.every(i=>i.checked); all.forEach(i=>i.checked=on); exSyncAll(); $$('#exPresets .chip').forEach(c=>c.classList.remove('on')); $('#exPresetHint').textContent=''; });
  $('#betaCopy').onclick=()=>{ if(!curPage||curPage.special) return; const html=exportHTML([curPage], {content:$('#betaNotes').checked?'both':'text', fmt:'html', mark:false, orig:false}); const ok=download(new Blob([html],{type:'text/html;charset=utf-8'}), `${slug(curPage.title)}-beta.html`); toast(ok?'Файл с главой скачан — его можно отправить бета‑ридеру':'Скачивание не удалось'); };
  $('#btnNotes').onclick=openNotes; $('#notesClearPage').onclick=()=>{ if(!curPage) return; $('#notesModal').hidden=true; clearPageNotes(curPage); };
  buildInsertMenu(); bindFmtbar();
  document.addEventListener('click', e=>{ if(!e.target.closest('#insertMenu,#fmtInsert')) hideInsertMenu(); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') hideInsertMenu(); });
  window.addEventListener('resize', hideInsertMenu);
  $('#mdApply').onclick=applyMedia;
  $('#mdFile').addEventListener('change', ()=>{ const f=$('#mdFile').files[0]; $('#mdFileName').textContent=f?f.name:''; });
  $('#mdUrl').addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); applyMedia(); } });
  $('#chSave').onclick=saveChapterDialog;
  $('#chTitle').addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); saveChapterDialog(); } });
  $('#chDelete').onclick=()=>{ const b=$('#chDelete'); if(!b.dataset.armed){ b.dataset.armed='1'; b.textContent='Точно удалить? Нажми ещё раз'; return; } const pid=$('#chapterModal').dataset.page; $('#chapterModal').hidden=true; deleteUserPage(pid); toast('Страница удалена'); };
  $('#btnCopy').onclick=async()=>{ if(!curPage) return; const ok=await copyText(plainText([curPage])); toast(ok?'Текст главы скопирован (без заметок)':'Не удалось скопировать'); };
  $('#exCopyPlain').onclick=async()=>{ const pages=exSelected(); if(!pages.length){ $('#exMsg').textContent='Отметь, что выгружать.'; return; } await copyText(plainText(pages), $('#exMsg')); };
  $('#exCopy').onclick=()=>copyText(lastExport.text, $('#exMsg'));
  $('#exDownload').onclick=()=>{ if(!download(lastExport.blob, lastExport.name)) $('#exMsg').textContent='Скачивание заблокировано — скопируй текст из поля'; };
  $('#btnProject').onclick=openProject;
  $('#btnImport').textContent='Выгрузить';
  $('#btnImport').title='Выгрузить тексты в файл';
  $('#btnImport').onclick=e=>{e.preventDefault();const menu=$('#btnImport').closest('details');if(menu)menu.open=false;$('#btnExport').click();};
  $('#btnProject').textContent='Создать резервную копию';
  $('#btnProject').title='Создать резервную копию истории'; $('#impFile').addEventListener('change', e=>{ const f=e.target.files[0]; if(f) importFile(f); }); $('#impText').addEventListener('input', ()=>{ IMPORT.blocks=null; renderImportPreview(); }); $$('input[name=impSplit]').forEach(r=>r.addEventListener('change', ()=>{ if(IMPORT.blocks||$('#impText').value.trim()) { if(!IMPORT.blocks) IMPORT.blocks=null; renderImportPreview(); } })); $('#impApply').onclick=applyImport;
  { renderBrand();
    $('#btnProjects').onclick=e=>{ e.stopPropagation(); const m=$('#projMenu'); m.innerHTML='<button type="button" class="pv" data-a="look">Редактировать</button><button type="button" class="pv" data-a="new">Добавить историю</button>'; togglePopmenu(m, $('#btnProjects')); };
    $('#projMenu').addEventListener('click', e=>{ const b=e.target.closest('button'); if(!b) return; hidePopmenus();
      if(b.dataset.a==='new'){ lookDialog({mode:'new', onDone:(l,nm)=>{ const id='p'+Date.now().toString(36); PROJ.list.push({id, name:nm, builtin:false, look:l}); PROJ.cur=id; saveProjects(PROJ); flush(); location.hash='#/'; location.reload(); }}); }
      if(b.dataset.a==='look'){ lookDialog({mode:'edit', onDone:(l,nm)=>{ CUR_PROJ.look=l; if(nm!==CUR_PROJ.name){ CUR_PROJ.name=nm; } saveProjects(PROJ); applyLook(); prefs.font=l.font; applyFont(); renderBrand(); toast('Оформление сохранено'); }}); }
 }); }
  initPWA();
  $('#projRefresh').onclick=async()=>{ try{ flush(); const regs=await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r=>r.unregister())); const keys=await caches.keys(); await Promise.all(keys.map(k=>caches.delete(k))); }catch(e){} location.replace(location.pathname+'?r='+Date.now()+location.hash); };
  $('#projSave').onclick=()=>{ const ok=download(new Blob([backupJSON()],{type:'application/json'}), `rakurs-backup-${new Date().toISOString().slice(0,10)}.json`); if(ok){ D.lastBackup=Date.now(); save(); openProject(); } toast(ok?'Резервная копия отправлена на скачивание':'Скачивание не удалось — скопируй JSON ниже'); };
  $('#projLoad').addEventListener('change', e=>{ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ try{ applyProject(JSON.parse(r.result), !isEmptyData(D) && confirmMerge()); $('#projectModal').hidden=true; }catch(err){ toast('Не удалось прочитать файл'); } }; r.readAsText(f); e.target.value=''; });
  $('#projCopy').onclick=()=>copyText($('#projText').value, null).then(ok=>toast(ok?'JSON скопирован':'Не удалось скопировать'));
  $('#projApply').onclick=()=>{ try{ applyProject(JSON.parse($('#projText').value), false); $('#projectModal').hidden=true; }catch(e){ toast('Некорректный JSON'); } };
  let clearArmed=false;
  $('#projClear').onclick=()=>{ if(!clearArmed){ clearArmed=true; $('#projClear').textContent='Точно сбросить все правки и заметки?'; setTimeout(()=>{clearArmed=false; $('#projClear').textContent='Сбросить всё';},4000); return; } D=emptyData(); registerUserPages(); buildToc(); save(); route(); $('#projectModal').hidden=true; toast('Всё сброшено'); };
  $$('.modal').forEach(m=>{ m.addEventListener('click', e=>{ if(e.target===m || e.target.closest('[data-close]')) m.hidden=true; }); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') $$('.modal').forEach(m=>m.hidden=true); });
  window.addEventListener('beforeunload', e=>{ if(!storageOK && !isEmptyData(D)){ e.preventDefault(); e.returnValue=''; } });
  route();
}
function confirmMerge(){ return true; } // merging keeps existing work and adds the file on top
/* ---------- special pages: chronology & storylines, character cards & knowledge matrix ---------- */
const MONTHS={'января':1,'февраля':2,'марта':3,'апреля':4,'мая':5,'июня':6,'июля':7,'августа':8,'сентября':9,'октября':10,'ноября':11,'декабря':12};
const MONTH_NAMES=['','января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
function parseDate(title){ const m=title.match(/(\d{1,2})(?:\s*[–—-]\s*(\d{1,2}))?\s+([а-я]+)/i); if(!m || !MONTHS[m[3].toLowerCase()]) return null; const mo=MONTHS[m[3].toLowerCase()]; return {key:mo*100+(+m[1]), d1:+m[1], d2:m[2]?+m[2]:null, mo}; }
function dateLabel(d){ if(!d) return ''; return `${d.d1}${d.d2?'–'+d.d2:''} ${MONTH_NAMES[d.mo]}`; }
function parseKey(str){ const m=(str||'').trim().match(/^(\d{1,2})\s+([а-я]+)/i); if(m && MONTHS[m[2].toLowerCase()]) return {key:MONTHS[m[2].toLowerCase()]*100+(+m[1]), d1:+m[1], d2:null, mo:MONTHS[m[2].toLowerCase()]}; const m2=(str||'').trim().match(/^(\d{1,2})[.\/](\d{1,2})$/); if(m2) return {key:(+m2[2])*100+(+m2[1]), d1:+m2[1], d2:null, mo:+m2[2]}; return null; }
function chrono(){ D.chrono=D.chrono||{}; const c=D.chrono; c.lines=c.lines||[]; c.chapterLines=c.chapterLines||{}; c.dates=c.dates||{}; c.marks=c.marks||[]; c.order=c.order||'read'; c.filter=c.filter||''; return c; }
const LINE_COLORS=['#8c432f','#5d6444','#6a5a9a','#8a6a1e','#4d7a7a','#8a3a5a','#5a6a8a','#a07a2a'];
function timeMarks(p){ return pageBlocks(p).filter(b=>!b.deleted && b.t==='time').map(b=>blockText(b.h).trim()); }
function storyChapters(){ return PAGES.filter(p=>groupOf(p.section).id==='work' && !p.special); }

function renderChrono(p, host){
  const c=chrono(); const chapters=storyChapters();
  const items=chapters.map(ch=>{ const d=parseKey(c.dates[ch.id])||parseDate(ch.title); const tm=timeMarks(ch); return {kind:'ch', p:ch, d, key:d?d.key:9999, tm, lines:c.chapterLines[ch.id]||[]}; });
  c.marks.forEach(m=>{ const d=parseKey(m.date); items.push({kind:'mark', m, d, key:d?d.key:9999, lines:m.lines||[]}); });
  let list=items.slice();
  if(c.order==='time') list.sort((a,b)=>(a.key-b.key) || (a.kind==='mark'?-1:1) || (a.kind==='ch'&&b.kind==='ch'? chapters.indexOf(a.p)-chapters.indexOf(b.p):0));
  else { list=items.filter(i=>i.kind==='ch'); const marks=items.filter(i=>i.kind==='mark'); // bookmarks attached to a chapter follow it; dated ones go after the closest chapter by date
    marks.forEach(m=>{ let at=-1; if(m.m.pid){ at=list.findIndex(x=>x.kind==='ch'&&x.p.id===m.m.pid); } if(at<0 && m.d){ for(let i=0;i<list.length;i++){ if(list[i].kind==='ch' && list[i].key<=m.key) at=i; } } list.splice(at+1,0,m); }); }
  if(c.filter) list=list.filter(i=>i.lines.includes(c.filter));
  const lineChip=l=>`<button class="chip line${c.filter===l.id?' on':''}" data-line="${l.id}" style="--lc:${l.color}">${esc(l.name)}</button>`;
  let html=`<div class="chrono-tools">
    <div class="seg"><button class="seg-btn${c.order==='read'?' on':''}" data-order="read">Порядок чтения</button><button class="seg-btn${c.order==='time'?' on':''}" data-order="time">По времени событий</button></div>
    <div class="chips lines"><span class="lbl">Линии:</span><button class="chip${!c.filter?' on':''}" data-line="">все</button>${c.lines.map(lineChip).join('')}<button class="chip add" data-a="newline">+ линия</button>${c.lines.length?'<button class="chip add" data-a="editlines">изменить…</button>':''}</div>
    <button class="btn" data-a="newmark">+ Закладка</button>
  </div><div class="chrono">`;
  let lastKey=null;
  list.forEach(it=>{
    if(c.order==='time'){ const k=it.d?it.d.key:9999; if(k!==lastKey){ lastKey=k; html+=`<div class="ch-date">${it.d?dateLabel(it.d):'без даты'}</div>`; } }
    const tags=it.lines.map(id=>c.lines.find(l=>l.id===id)).filter(Boolean).map(l=>`<span class="ltag" style="--lc:${l.color}">${esc(l.name)}</span>`).join('');
    if(it.kind==='ch'){ const ch=it.p; const st=pageStats(ch);
      html+=`<div class="ch-item" data-pid="${ch.id}"><div class="ch-main"><a class="ch-title" href="#/${ch.id}">${esc(ch.title)}</a>${ch.sub?`<span class="ch-pov">${esc(ch.sub)}</span>`:''}${st.notes?`<span class="badge n">${st.notes}</span>`:''}</div>
        <div class="ch-meta">${c.order==='read'&&it.d?`<span class="ch-d">${dateLabel(it.d)}</span>`:''}${it.tm.length?`<span class="ch-times">${esc(it.tm[0])}${it.tm.length>1?' → '+esc(it.tm[it.tm.length-1]):''} · ${it.tm.length} ${it.tm.length===1?'метка':it.tm.length<5?'метки':'меток'}</span>`:''}<span class="ltags">${tags}</span><button class="link" data-a="lines" data-pid="${ch.id}">линии</button><button class="link" data-a="date" data-pid="${ch.id}" title="Уточнить дату событий">дата</button></div></div>`; }
    else { const m=it.m; html+=`<div class="ch-item mark" data-mid="${m.id}"><div class="ch-main"><span class="mk">⚑</span><span class="ch-title">${esc(m.title)}</span>${m.approx?'<span class="approx" title="дата приблизительная">≈</span>':''}${m.pid&&PAGE[m.pid]?`<a class="ch-pov" href="#/${m.pid}">${esc(PAGE[m.pid].title)}</a>`:''}</div>
        <div class="ch-meta">${it.d?`<span class="ch-d">${m.approx?'≈ ':''}${dateLabel(it.d)}</span>`:''}${m.note?`<span class="mk-note">${esc(m.note)}</span>`:''}<span class="ltags">${tags}</span><button class="link" data-a="editmark" data-mid="${m.id}">изменить</button></div></div>`; }
  });
  html+='</div>';
  if(!chapters.some(ch=>c.chapterLines[ch.id]&&c.chapterLines[ch.id].length) && !c.lines.length) html+=`<p class="muted chrono-hint">Линии — это сюжетные нити (например, «главная пара», «тайна города», «прошлое героя»). Создай линию и отметь главы, где она идёт; потом по ней можно фильтровать. Закладки — события с приблизительной датой, которых нет в главах: что было до начала, между главами или впереди по плану.</p>`;
  host.innerHTML=html;
  host.querySelectorAll('[data-order]').forEach(b=>b.onclick=()=>{ c.order=b.dataset.order; save(); renderChrono(p,host); });
  host.querySelectorAll('[data-line]').forEach(b=>b.onclick=()=>{ c.filter=b.dataset.line; save(); renderChrono(p,host); });
  host.querySelector('[data-a=newline]').onclick=()=>{ const name=prompt('Название линии'); if(!name||!name.trim()) return; c.lines.push({id:'l'+Date.now().toString(36), name:name.trim(), color:LINE_COLORS[c.lines.length%LINE_COLORS.length]}); save(); renderChrono(p,host); };
  const el=host.querySelector('[data-a=editlines]'); if(el) el.onclick=()=>editLines(c, ()=>renderChrono(p,host));
  host.querySelector('[data-a=newmark]').onclick=()=>editMark(c, null, ()=>renderChrono(p,host));
  host.querySelectorAll('[data-a=editmark]').forEach(b=>b.onclick=()=>editMark(c, c.marks.find(m=>m.id===b.dataset.mid), ()=>renderChrono(p,host)));
  host.querySelectorAll('[data-a=lines]').forEach(b=>b.onclick=()=>pickLines(c, b.dataset.pid, ()=>renderChrono(p,host)));
  host.querySelectorAll('[data-a=date]').forEach(b=>b.onclick=()=>{ const ch=PAGE[b.dataset.pid]; const cur=c.dates[ch.id]||dateLabel(parseDate(ch.title)); const v=prompt('Дата событий главы (например, «18 октября» или «18.10»). Пусто — взять из названия.', cur); if(v===null) return; if(!v.trim()) delete c.dates[ch.id]; else if(parseKey(v)) c.dates[ch.id]=v.trim(); else { toast('Не поняла дату — напиши как «18 октября»'); return; } save(); renderChrono(p,host); });
};
function dlg(title, bodyHTML, onOk, okLabel){ let m=document.getElementById('specialModal'); if(!m){ m=document.createElement('div'); m.className='modal'; m.id='specialModal'; document.body.appendChild(m); m.addEventListener('click',e=>{ if(e.target===m||e.target.closest('[data-close]')) m.hidden=true; }); }
  m.innerHTML=`<div class="dlgbox dlgbox-sm"><div class="dlgbox-head"><h3>${title}</h3><button class="icon-btn" data-close>✕</button></div><div class="dlgbox-body">${bodyHTML}</div><div class="dlgbox-foot"><button class="btn primary" id="spOk">${okLabel||'Сохранить'}</button><button class="btn" data-close>Отмена</button><span class="sp"></span><span id="spExtra"></span></div></div>`; m.hidden=false;
  m.querySelector('#spOk').onclick=()=>{ if(onOk(m)!==false) m.hidden=true; }; return m; }
function pickLines(c, pid, done){ if(!c.lines.length){ toast('Сначала создай линию кнопкой «+ линия»'); return; } const cur=new Set(c.chapterLines[pid]||[]);
  dlg('Линии главы · '+esc(PAGE[pid].title), `<div class="checks">${c.lines.map(l=>`<label><input type="checkbox" value="${l.id}"${cur.has(l.id)?' checked':''}> <span class="ltag" style="--lc:${l.color}">${esc(l.name)}</span></label>`).join('')}</div>`, m=>{ c.chapterLines[pid]=[...m.querySelectorAll('input:checked')].map(i=>i.value); save(); done(); }); }
function editLines(c, done){ dlg('Линии', `<div class="line-edit">${c.lines.map(l=>`<div class="le" data-id="${l.id}"><input type="color" value="${l.color}"><input type="text" value="${esc(l.name)}"><button class="icon-btn" data-del title="Удалить линию">✕</button></div>`).join('')}</div>`, m=>{ m.querySelectorAll('.le').forEach(row=>{ const l=c.lines.find(x=>x.id===row.dataset.id); if(!l) return; l.name=row.querySelector('input[type=text]').value.trim()||l.name; l.color=row.querySelector('input[type=color]').value; }); save(); done(); });
  document.querySelectorAll('#specialModal [data-del]').forEach(b=>b.onclick=()=>{ const row=b.closest('.le'); const id=row.dataset.id; if(!confirm('Удалить линию и снять её со всех глав?')) return; c.lines=c.lines.filter(x=>x.id!==id); for(const k in c.chapterLines) c.chapterLines[k]=c.chapterLines[k].filter(x=>x!==id); c.marks.forEach(mk=>{ mk.lines=(mk.lines||[]).filter(x=>x!==id); }); if(c.filter===id) c.filter=''; row.remove(); save(); done(); }); }
function editMark(c, mark, done){ const m0=mark||{title:'',date:'',approx:true,note:'',pid:'',lines:[]}; const chapters=storyChapters();
  const m=dlg(mark?'Закладка':'Новая закладка', `<div class="field"><label>Событие</label><input type="text" id="mkTitle" value="${esc(m0.title)}" placeholder="Например: Минхо находит дом" autocomplete="off"></div>
    <div class="field"><label>Дата (≈)</label><input type="text" id="mkDate" value="${esc(m0.date)}" placeholder="«20 октября» или «20.10»" autocomplete="off"></div>
    <div class="field"><label><input type="checkbox" id="mkApprox"${m0.approx?' checked':''}> дата приблизительная</label></div>
    <div class="field"><label>Связанная глава</label><select id="mkPid"><option value="">—</option>${chapters.map(ch=>`<option value="${ch.id}"${m0.pid===ch.id?' selected':''}>${esc(ch.title)}</option>`).join('')}</select></div>
    <div class="field"><label>Заметка</label><textarea id="mkNote" rows="2">${esc(m0.note)}</textarea></div>
    ${c.lines.length?`<div class="field"><label>Линии</label><div class="checks">${c.lines.map(l=>`<label><input type="checkbox" class="mkLine" value="${l.id}"${(m0.lines||[]).includes(l.id)?' checked':''}> <span class="ltag" style="--lc:${l.color}">${esc(l.name)}</span></label>`).join('')}</div></div>`:''}`,
    mm=>{ const title=mm.querySelector('#mkTitle').value.trim(); if(!title){ mm.querySelector('#mkTitle').focus(); return false; } const date=mm.querySelector('#mkDate').value.trim(); if(date && !parseKey(date)){ toast('Не поняла дату — напиши как «20 октября»'); return false; }
      const obj={id:m0.id||'m'+Date.now().toString(36), title, date, approx:mm.querySelector('#mkApprox').checked, pid:mm.querySelector('#mkPid').value, note:mm.querySelector('#mkNote').value.trim(), lines:[...mm.querySelectorAll('.mkLine:checked')].map(i=>i.value)};
      if(mark) Object.assign(mark,obj); else c.marks.push(obj); save(); done(); });
  if(mark){ const del=document.createElement('button'); del.className='btn danger'; del.textContent='Удалить'; del.onclick=()=>{ c.marks=c.marks.filter(x=>x.id!==mark.id); save(); m.hidden=true; done(); }; m.querySelector('#spExtra').appendChild(del); }
  setTimeout(()=>m.querySelector('#mkTitle').focus(),30); }

/* ---------- characters ---------- */
function charsData(){ D.chars=D.chars||{}; const c=D.chars; c.know=c.know||{}; c.rel=c.rel||{}; c.aliases=c.aliases||{}; c.open=c.open||''; return c; }
function charList(){ const c=charsData(); return (C.characters||[]).concat(c.custom||[]).map(ch=>Object.assign({}, ch)); }
function addCharacter(){ const name=prompt('Имя персонажа (как в тексте, например «Хан Джисон»)'); if(!name||!name.trim()) return; const short=prompt('Короткое имя для подсчёта упоминаний (например «Джисон»)', name.trim().split(/\s+/).pop()); if(!short||!short.trim()) return; const c=charsData(); c.custom=c.custom||[]; c.custom.push({name:name.trim(), short:short.trim(), stems:[short.trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')], color:LINE_COLORS[c.custom.length%LINE_COLORS.length]}); save(); mentionCache=null; }
function charRegex(ch){ const c=charsData(); const extra=(c.aliases[ch.short]||'').split(',').map(x=>x.trim()).filter(Boolean).map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![а-я])'); const stems=ch.stems.map(s=>ch.exact?s:s+'[а-яё]{0,3}(?![а-яё])'); return new RegExp('(?<![А-Яа-яё])(?:'+stems.concat(extra).join('|')+')','g'); }
function baseCards(){ const page=PAGES.find(p=>/база персонажей/i.test(p.title)); const out={}; if(!page) return out; const blocks=pageBlocks(page).filter(b=>!b.deleted); let inCards=false, cur=null;
  blocks.forEach(b=>{ const t=blockText(b.h).trim(); if(b.t==='h2'){ inCards=/Карточки/i.test(t); cur=null; return; } if(!inCards) return; if(b.t==='h3'){ cur={name:t, fields:[], id:b.id}; out[t]=cur; return; } if(cur && (b.t==='p'||b.t==='list')){ const m=t.replace(/^[·•\-\s]+/,'').match(/^([^.:]{2,40})[.:]\s+(.*)$/s); if(m) cur.fields.push({k:m[1].trim(), v:m[2].trim()}); else cur.fields.push({k:'', v:t.replace(/^[·•\-\s]+/,'')}); } });
  return out; }
let mentionCache=null, mentionKey='';
function mentions(){ const key=String(D.updated||0)+'|'+JSON.stringify(charsData().aliases); if(mentionCache && mentionKey===key) return mentionCache; mentionKey=key;
  const chapters=storyChapters(); const list=charList(); const res={}; list.forEach(ch=>res[ch.short]={total:0, byChapter:{}, first:{}, co:{}});
  const regs=list.map(ch=>[ch.short, charRegex(ch)]);
  chapters.forEach(p=>{ const blocks=pageBlocks(p).filter(b=>!b.deleted && TEXT_TYPES.has(b.t) && b.t!=='pov');
    blocks.forEach(b=>{ const txt=blockText(b.h); const here=[]; regs.forEach(([k,re])=>{ re.lastIndex=0; let n=0; while(re.exec(txt)) n++; if(n){ const r=res[k]; r.total+=n; r.byChapter[p.id]=(r.byChapter[p.id]||0)+n; if(!r.first[p.id]) r.first[p.id]=b.id; here.push(k); } });
      here.forEach(a=>here.forEach(b2=>{ if(a!==b2) res[a].co[b2]=(res[a].co[b2]||0)+1; })); }); });
  mentionCache={res, chapters}; return mentionCache; }

function renderChars(p, host){
  const c=charsData(); const list=charList(); const cards=baseCards(); const {res, chapters}=mentions();
  const sorted=list.slice().sort((a,b)=>res[b.short].total-res[a.short].total);
  if(!sorted.length){ host.innerHTML=`<div class="pane-empty">Персонажей пока нет. Добавь первого — упоминания по главам посчитаются сами.</div><button class="btn" id="addChar">+ Персонаж</button>`; host.querySelector('#addChar').onclick=()=>{ addCharacter(); renderChars(p,host); }; return; }
  let html=`<div class="chars-tools"><div class="chips">${sorted.map(ch=>`<button class="chip char${c.open===ch.short?' on':''}" data-char="${esc(ch.short)}" style="--lc:${ch.color}">${esc(ch.short)} <small>${res[ch.short].total}</small></button>`).join('')}</div>
    <div class="muted small">Упоминания считаются по тексту глав автоматически (имена и их варианты; список вариантов можно дополнить в карточке). Если в Базе истории есть страница «База персонажей» с карточками‑заголовками по именам, их поля подтянутся сюда. <button class="link" id="addChar">+ персонаж</button></div></div>`;
  const ch=list.find(x=>x.short===c.open)||sorted[0]; const r=res[ch.short]; const card=cards[ch.name]||Object.values(cards).find(k=>k.name.includes(ch.short));
  const povCh=chapters.filter(x=>(x.sub||'').includes(ch.short));
  const appear=chapters.filter(x=>r.byChapter[x.id]).map(x=>`<a class="ap" href="#/${x.id}@${r.first[x.id]}" title="К первому упоминанию"><span class="n">${esc(x.title.split('.')[0])}</span><span class="cnt">${r.byChapter[x.id]}</span></a>`).join('');
  const co=Object.entries(r.co).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,n])=>{ const o=list.find(x=>x.short===k); return `<button class="chip char" data-char="${esc(k)}" style="--lc:${o?o.color:'#888'}">${esc(k)} <small>${n}</small></button>`; }).join('');
  html+=`<div class="char-card" style="--lc:${ch.color}"><div class="cc-head"><h2>${esc(ch.name)}</h2>${card?`<a class="link" href="#/chars-02@${card.id}">карточка в базе →</a>`:''}</div>
    <div class="cc-grid">
      <section><h4>Появления в главах <small>${Object.keys(r.byChapter).length} из ${chapters.length} · ${r.total} упоминаний</small></h4><div class="appear">${appear||'<span class="muted">нет упоминаний</span>'}</div>${povCh.length?`<div class="muted small">POV: ${povCh.map(x=>`<a href="#/${x.id}">${esc(x.title)}</a>`).join(', ')}</div>`:''}</section>
      <section><h4>Чаще всего рядом в абзацах</h4><div class="chips">${co||'<span class="muted">—</span>'}</div></section>
      <section class="wide"><h4>Отношения и заметки <small>свои</small></h4><textarea class="cc-rel" rows="3" placeholder="Кто для него кто, что между ними сейчас, что должно измениться">${esc(c.rel[ch.short]||'')}</textarea></section>
      <section class="wide"><h4>Варианты имени для подсчёта <small>через запятую</small></h4><input type="text" class="cc-alias" value="${esc(c.aliases[ch.short]||'')}" placeholder="Например: Кристофер, Крис"></section>
      ${card?`<section class="wide"><h4>Из базы персонажей</h4><dl class="cc-fields">${card.fields.map(f=>f.k?`<dt>${esc(f.k)}</dt><dd>${esc(f.v)}</dd>`:`<dd class="solo">${esc(f.v)}</dd>`).join('')}</dl></section>`:''}
    </div></div>`;
  // knowledge matrix
  html+=`<div class="know"><h3>Кто что знает к какой главе</h3><p class="muted small">Клетка — что персонаж узнал или понял к этой главе (коротко). Щёлкни, чтобы записать. Пусто — ничего нового.</p>
    <div class="know-wrap"><table class="know-t"><thead><tr><th></th>${chapters.map(x=>`<th title="${esc(x.title)}"><a href="#/${x.id}">${esc(x.title.split('.')[0])}</a></th>`).join('')}</tr></thead><tbody>
    ${sorted.map(k=>`<tr><th style="--lc:${k.color}">${esc(k.short)}</th>${chapters.map(x=>{ const v=(c.know[k.short]||{})[x.id]||''; const men=res[k.short].byChapter[x.id]; return `<td class="${v?'has':''}${men?' in':''}" data-k="${esc(k.short)}" data-pid="${x.id}" title="${esc(v||(men?'упоминается, записи нет':''))}">${v?esc(v):(men?'·':'')}</td>`; }).join('')}</tr>`).join('')}
    </tbody></table></div></div>`;
  host.innerHTML=html;
  host.querySelectorAll('[data-char]').forEach(b=>b.onclick=()=>{ c.open=b.dataset.char; save(); renderChars(p,host); });
  host.querySelector('#addChar').onclick=()=>{ addCharacter(); renderChars(p,host); };
  const rel=host.querySelector('.cc-rel'); rel.addEventListener('input',()=>{ if(rel.value.trim()) c.rel[ch.short]=rel.value; else delete c.rel[ch.short]; save(); });
  const al=host.querySelector('.cc-alias'); al.addEventListener('change',()=>{ if(al.value.trim()) c.aliases[ch.short]=al.value.trim(); else delete c.aliases[ch.short]; save(); renderChars(p,host); });
  host.querySelectorAll('.know-t td').forEach(td=>td.onclick=()=>{ const k=td.dataset.k, pid=td.dataset.pid; const cur=(c.know[k]||{})[pid]||''; const v=prompt(`${k} · ${PAGE[pid].title}\nЧто знает / понял к этой главе:`, cur); if(v===null) return; c.know[k]=c.know[k]||{}; if(v.trim()) c.know[k][pid]=v.trim(); else delete c.know[k][pid]; save(); renderChars(p,host); });
};


/* ---------- flexible story workspace ---------- */
const WS_TYPES = [
 ['folder','Папка','Блоки и вложенные папки'],
 ['text','Текст','Свободный текст с форматированием'],
 ['board','Доска','Интерактивная доска со стикерами, рисунками и связями'],
 ['character','Персонаж','Портрет и карточка персонажа'],
 ['timeline','Временная линия','События в нужном тебе порядке'],
 ['map','Карта','Интерактивная карта со стикерами, рисунками и связями'],
 ['location','Локация','Изображение и описание места']
];
function wsId(prefix){ return prefix+Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
function wsData(){ return D.workspace||(D.workspace={cover:''}); }
function wsUser(p){ return (D.pages||[]).find(u=>u.id===(typeof p==='string'?p:p.id)); }
function wsType(p){ const u=wsUser(p); return u&&u.blockType||'text'; }
function wsLabel(p){ const t=WS_TYPES.find(t=>t[0]===wsType(p)); return t?t[1]:'Текст'; }
function wsWritable(){ if(tabReadOnly){ toast('Это окно только для чтения — перенеси редактирование сюда'); return false; } return true; }
function wsParent(p){ const u=wsUser(p), id=u&&u.parent; return id&&PAGE[id]&&wsType(PAGE[id])==='folder'?id:''; }
function wsChildren(parent){
 const list=PAGES.filter(p=>wsParent(p)===(parent||''));
 const stored=(wsData().blockOrder||{})[parent||'$root'];
 if(!Array.isArray(stored))return list;
 const rank=new Map(stored.map((id,i)=>[id,i]));
 return list.map((p,i)=>({p,i})).sort((a,b)=>(rank.has(a.p.id)?rank.get(a.p.id):stored.length+a.i)-(rank.has(b.p.id)?rank.get(b.p.id):stored.length+b.i)).map(x=>x.p);
}
function wsDescendant(id,ancestor){ const seen=new Set(); let p=PAGE[id]; while(p){ if(p.id===ancestor) return true; if(seen.has(p.id)) return false; seen.add(p.id); p=PAGE[wsParent(p)]; } return false; }
function wsFolders(exclude){ return PAGES.filter(p=>wsType(p)==='folder'&&(!exclude||!wsDescendant(p.id,exclude))); }
function wsPath(p){ const seen=new Set(); const out=[]; let par=wsParent(p); while(par&&PAGE[par]&&!seen.has(par)){ seen.add(par); out.unshift(PAGE[par]); par=wsParent(PAGE[par]); } return out; }
function wsCrumbs(p){ return '<nav class="ws-crumbs"><a href="#/">'+esc(CUR_PROJ.name)+'</a>'+wsPath(p).map(x=>' / <a href="#/'+x.id+'">'+esc(x.title)+'</a>').join('')+'</nav>'; }
function wsCommit(){ save(); flush(); return storageOK&&lastWriteOK; }
function isEmptyData(d){ return isEmptyDataLegacy(d)&&!((d.workspace||{}).cover); }
function buildToc(){
 const toc=$('#toc'); toc.innerHTML='';
 const home=document.createElement('a'); home.href='#/'; home.className='ws-toc-home'; home.textContent=CUR_PROJ.name; toc.appendChild(home);
 function branch(parent,depth,seen){
  wsChildren(parent).forEach(p=>{
   if(seen.has(p.id)) return; const next=new Set(seen); next.add(p.id);
   const a=document.createElement('a'); a.href='#/'+p.id; a.dataset.page=p.id;
   a.style.paddingLeft=(12+depth*14)+'px';a.dataset.wsReorder=p.id;a.draggable=!tabReadOnly;
   a.innerHTML='<span class="t"><small class="ws-type">'+esc(wsLabel(p))+'</small>'+esc(p.title)+'</span><span class="badges"></span>';
   toc.appendChild(a); if(wsType(p)==='folder') branch(p.id,depth+1,next);
  });
 }
 branch('',0,new Set());
 const add=document.createElement('button'); add.className='toc-new'; add.textContent='+ Добавить блок'; add.onclick=()=>{closeSide();wsCreate('');}; toc.appendChild(add);
 refreshBadges();if(document.body.classList.contains('split'))renderPane();
}
function wsCardIcon(kind){
 const paths={"board":'<rect x="2" y="3" width="20" height="18" rx="2"/><path d="M6 8h5v5H6zM15 8h3M15 12h3M6 17h12"/>',"folder": "<path d=\"M3 7V4h6l3 4h9v13H3z\"/>", "character": "<circle cx=\"12\" cy=\"7\" r=\"4\"/><path d=\"M4 22v-3a8 8 0 0 1 16 0v3\"/>", "timeline": "<path d=\"M2 12h20M7 6v12M12 3v18M17 7v10\"/>", "map": "<path d=\"m3 4 6-2 6 2 6-2v19l-6 2-6-2-6 2zM9 2v19M15 4v19\"/>", "location": "<path d=\"M20 10c0 6-8 13-8 13S4 16 4 10a8 8 0 0 1 16 0z\"/><circle cx=\"12\" cy=\"10\" r=\"3\"/>", "text": "<path d=\"M5 2h9l5 5v15H5zM14 2v6h5M8 12h8M8 16h8\"/>"};
 return '<span class="ws-card-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+(paths[kind]||paths.text)+'</svg></span>';
}
function wsCard(p){
 const u=wsUser(p), data=u&&u.blockData||{};
 const canvas=u&&(u.blockType==='character'?data.characterCanvas:u.blockType==='location'?data.locationCanvas:null);const preview=canvas&&Array.isArray(canvas.items)?(canvas.items.find(it=>it&&it.type==='media'&&it.media&&it.media.kind==='image'&&wsTimelineMediaSafe(it.media))||{}).media:null;const src=canvas?(preview&&preview.src):data.image;
 const image=src&&wsTimelineMediaSafe({kind:'image',src})?'<img class="ws-card-image" src="'+esc(src)+'" alt="" loading="lazy">':'';
 return '<a class="ws-card" data-ws-kind="'+esc(wsType(p))+'" draggable="'+(!tabReadOnly)+'" data-ws-reorder="'+p.id+'" href="#/'+p.id+'">'+image+'<span class="ws-type">'+esc(wsLabel(p))+'</span><span class="ws-card-title">'+esc(p.title)+'</span>'+wsCardIcon(wsType(p))+'</a>';
}
function wsListing(parent){
 const pages=wsChildren(parent);
 return '<div class="ws-grid">'+pages.map(wsCard).join('')+'<button class="ws-add-card" data-ws-add>+ Добавить блок</button></div>'+'';
}
function wsPrepare(p){
 rkClearFieldColor($('#view'));
 document.body.classList.toggle('rk-character-page',!!p&&['character','location'].includes(wsType(p)));
 curPage=p||null; document.body.classList.remove('special-page'); document.body.classList.toggle('has-page',!!p); document.body.classList.add('ws-page');
 $('#timeline').innerHTML=''; tlMarks=[]; $('#btnCopy').hidden=true; $('#btnVersions').hidden=true;
 document.body.dataset.group=''; lastFocusId=null;
 $('#crumb').innerHTML='<a href="#/">'+esc(CUR_PROJ.name)+'</a>'+(p?' / '+esc(p.title):'');
 requestAnimationFrame(setBarH);refreshBadges();if(document.body.classList.contains('split'))renderPane();
}
function renderHome(){
 wsPrepare(null); const v=$('#view'); v.className='view home ws-home';
 const cover=wsData().cover; const safe=cover&&/^data:image\/(jpeg|png|webp);base64,/.test(cover);
 v.innerHTML='<section class="ws-cover'+(safe?' has-cover':'')+'">'+(safe?'<img src="'+esc(cover)+'" alt="Обложка истории">':'<div class="rk-cover-upload-hint"><span>PNG, JPG или WebP, до 25 МБ, рекомендуемое соотношение сторон — 4:1</span><span>(большие изображения уменьшаются до 1600 px по длинной стороне)</span></div>')+'<div class="ws-cover-actions"><button class="btn" data-cover>'+(safe?'Заменить обложку':'Загрузить обложку')+'</button>'+(safe?'<button class="btn" data-uncover>Убрать</button>':'')+'</div></section><div class="ws-home-title"><h1>'+esc(CUR_PROJ.name)+'</h1></div>'+wsListing('');
 v.querySelector('[data-cover]').onclick=()=>wsUploadImage(value=>{ const old=wsData().cover; wsData().cover=value; if(!wsCommit()){wsData().cover=old;save();toast('Обложка не сохранена: проверь доступное место в браузере');} renderHome(); });
 const remove=v.querySelector('[data-uncover]'); if(remove) remove.onclick=()=>{if(!wsWritable())return;wsData().cover='';wsCommit();renderHome();};
 v.querySelector('[data-ws-add]').onclick=()=>wsCreate('');window.scrollTo(0,0);
}
function wsCreate(parent){
 if(!wsWritable())return;
 dlg('Добавить блок','<div class="field"><label for="ws-title">Название</label><input id="ws-title" maxlength="160" autocomplete="off"></div><fieldset class="ws-kind-select"><legend>Формат</legend>'+WS_TYPES.map((t,i)=>'<label><input type="radio" name="ws-kind" value="'+t[0]+'"'+(i===0?' checked':'')+'><span>'+t[1]+'</span></label>').join('')+'</fieldset>',m=>{
  if(!wsWritable())return false;
  const name=m.querySelector('#ws-title').value.trim();if(!name){m.querySelector('#ws-title').focus();return false;}
  const type=m.querySelector('[name="ws-kind"]:checked').value;
  const id=wsId('wb');D.pages.push({id,title:name,sub:'',sec:type==='text'?'text':'ref',parent:parent&&PAGE[parent]&&wsType(PAGE[parent])==='folder'?parent:'',blockType:type,blockData:{}});
  registerUserPages();wsCommit();buildToc();nav('#/'+id);
  if(['character','location'].includes(type))setMode('edit');
  if(type==='text'){setMode('edit');setTimeout(()=>{if(curPage&&curPage.id===id&&!pageBlocks(curPage).length)insertBlock('top:'+id,'',true,'p');},80);}
 },'Создать');
 setTimeout(()=>$('#ws-title')&&$('#ws-title').focus(),30);
}
function openChapterDialog(p,secId){ if(p&&wsUser(p)){const h=document.querySelector('#view .page-head h1');if(h)wsBeginRename(h,p);} else if(!p) wsCreate(curPage&&wsType(curPage)==='folder'?curPage.id:''); else openChapterDialogLegacy(p,secId); }
function renderPage(p,focusId){
 const type=wsType(p);
 document.body.classList.toggle('rk-character-page',['character','location'].includes(type));
 if(type==='text'){
  document.body.classList.remove('ws-page');renderPageLegacy(p,focusId);
  const head=$('#view .page-head'); if(!head)return;
  const kick=head.querySelector('.kicker');if(kick)kick.innerHTML=wsCrumbs(p)+'<span class="ws-type">Текст</span>';
  $('#crumb').innerHTML='<a href="#/">'+esc(CUR_PROJ.name)+'</a> / '+esc(p.title);
  head.querySelectorAll('[data-a=chprops],[data-props]').forEach(el=>el.remove());wsBindRename(head.querySelector('h1'),p);
  const archive=head.querySelector('[data-a=archive]');if(archive)archive.remove();
  rkFieldColor(p,$('#view'));
  return;
 }
 wsRenderBlock(p);
}



function rkFieldColor(p,host){
 /* RAKURS_UNIVERSAL_FIELD_PALETTE_V1 */
 if(!host||!p)return;
 const css="\nhtml body :is(#rkFieldColorToolbar,#rkPaneFieldColorToolbar)>button.rk-field-palette-trigger{display:inline-flex!important;align-items:center;justify-content:center;box-sizing:border-box;width:36px;height:36px;min-width:36px;flex:0 0 36px;padding:0!important;border:0!important;background:transparent!important;border-radius:8px!important;font-size:0!important;line-height:0!important;box-shadow:none!important;color:inherit;}\nhtml body button.rk-field-palette-trigger>svg{display:block;width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;pointer-events:none;}\nhtml body[data-rk-palette][data-rk-mode] :is(#view,#view2Body)[data-rk-text-page]{background-color:var(--rk-field-surface,var(--rk-bg))!important;color:var(--rk-field-ink,var(--rk-text))!important;}\nhtml body :is(#view,#view2Body)[data-rk-text-page][data-rk-field-custom] :is(.page-head h1,.page-head h2,.page-head .kicker,.page-head .ws-type,.page-head .ws-crumbs,.page-head .ws-crumbs a,.pane-title,.ws-pane-summary h4,.ws-fields label,.ws-content>.field>label,.ws-line-hint,.ws-empty,.pane-empty){color:var(--rk-field-ink)!important;}\nhtml body :is(#view,#view2Body)[data-rk-text-page][data-rk-field-custom]>.ws-content{background-color:transparent!important;}\nhtml body :is(#view,#view2Body)[data-rk-text-page][data-rk-field-custom] .rk-board{--rk-bg:var(--rk-field-surface);--rk-text:var(--rk-field-ink);color:var(--rk-field-ink);}\nhtml body :is(#view,#view2Body)[data-rk-text-page][data-rk-field-custom] .rk-board-viewport{background-color:var(--rk-field-surface)!important;}\n";
 if(!document.getElementById('rk-universal-field-palette-v1')){const style=document.createElement('style');style.id='rk-universal-field-palette-v1';style.textContent=css;document.head.appendChild(style);}
 host.dataset.rkTextPage=p.id;
 const side=host.id==='view2Body',toolbarId=side?'rkPaneFieldColorToolbar':'rkFieldColorToolbar';
 const choices=[['heading','Цвет заголовков'],['primary','Основной цвет'],['secondary','Второй цвет'],['hover','Дополнительный цвет'],['dark','Тёмный'],['light','Светлый']];
 function apply(){
  const token=(wsData().textFieldColors||{})[p.id],style=getComputedStyle(host);
  if(!choices.some(x=>x[0]===token)){host.style.removeProperty('--rk-field-surface');host.style.removeProperty('--rk-field-ink');delete host.dataset.rkFieldCustom;return;}
  const bg=style.getPropertyValue('--rk-'+token).trim();if(!bg)return;const light=style.getPropertyValue('--rk-light').trim(),dark=style.getPropertyValue('--rk-dark').trim();
  const lum=color=>{let c;if(color.startsWith('#')){let h=color.slice(1);if(h.length===3)h=h.split('').map(x=>x+x).join('');c=(h.match(/../g)||[]).slice(0,3).map(x=>parseInt(x,16)/255);}else c=(color.match(/[\d.]+/g)||[]).slice(0,3).map(x=>Number(x)/255);c=c.map(x=>x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4));return (c[0]||0)*.2126+(c[1]||0)*.7152+(c[2]||0)*.0722;};
  const ratio=color=>{const a=lum(bg),b=lum(color);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
  host.style.setProperty('--rk-field-surface',bg);host.style.setProperty('--rk-field-ink',ratio(light)>=ratio(dark)?light:dark);host.dataset.rkFieldCustom='1';
 }
 apply();document.getElementById(toolbarId)?.remove();
 const toolbar=document.createElement('div');toolbar.id=toolbarId;toolbar.className='rk-field-color-toolbar';toolbar.contentEditable='false';
 const button=document.createElement('button');button.type='button';button.className='icon-btn rk-field-palette-trigger';button.title='Изменить цвет поля';button.setAttribute('aria-label','Изменить цвет поля');button.setAttribute('aria-expanded','false');
 const NS='http://www.w3.org/2000/svg',svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');const outline=document.createElementNS(NS,'path');outline.setAttribute('d','M12 3a9 9 0 1 0 0 18h1.5a2.5 2.5 0 0 0 1.8-4.2 1.5 1.5 0 0 1 1.1-2.6H18a3 3 0 0 0 3-3A8.2 8.2 0 0 0 12 3Z');svg.appendChild(outline);[[7,10],[10,6.5],[14,6.5],[17,10]].forEach(([x,y])=>{const c=document.createElementNS(NS,'circle');c.setAttribute('cx',x);c.setAttribute('cy',y);c.setAttribute('r','1');svg.appendChild(c);});button.appendChild(svg);
 const menu=document.createElement('div');menu.className='rk-field-color-menu';menu.hidden=true;menu.setAttribute('role','group');menu.setAttribute('aria-label','Цвет поля');
 function populate(){
  menu.replaceChildren();const style=getComputedStyle(host),seen=new Set(),selected=(wsData().textFieldColors||{})[p.id],active=style.getPropertyValue(selected?'--rk-'+selected:'--rk-bg').trim().toLowerCase().replace(/\s/g,'');
  choices.forEach(([token,label])=>{const value=style.getPropertyValue('--rk-'+token).trim(),key=value.toLowerCase().replace(/\s/g,'');if(!key||seen.has(key))return;seen.add(key);const b=document.createElement('button');b.type='button';b.className='rk-color-option';b.dataset.color=token;b.title=label;b.setAttribute('aria-label',label);b.setAttribute('aria-pressed',String(active===key));const swatch=document.createElement('span');swatch.className='rk-field-color-swatch';swatch.style.background=value;swatch.setAttribute('aria-hidden','true');b.appendChild(swatch);b.onclick=()=>{if(!wsWritable())return;const data=wsData();data.textFieldColors=data.textFieldColors||{};data.textFieldColors[p.id]=token;save();document.querySelectorAll('[data-rk-text-page]').forEach(el=>{if(el.dataset.rkTextPage===p.id)el.dispatchEvent(new Event('rk-field-palette-change'));});menu.hidden=true;button.setAttribute('aria-expanded','false');button.focus();};menu.appendChild(b);});
 }
 populate();button.onclick=()=>{const open=menu.hidden;if(open)populate();menu.hidden=!open;button.setAttribute('aria-expanded',String(open));if(open)menu.querySelector('button')?.focus();};rkDropdownEvents(toolbar,button,menu);toolbar.append(button,menu);
 const anchor=side?document.getElementById('view2Min'):document.getElementById('btnSplit'),top=side?document.querySelector('#view2 .pane-head'):document.querySelector('.bar-in');if(anchor?.parentNode)anchor.before(toolbar);else if(top)top.appendChild(toolbar);
 function syncBoard(){if(typeof RK_BOARD_VIEWS!=='undefined')for(const entry of RK_BOARD_VIEWS){if(entry.root.isConnected&&host.contains(entry.root))entry.sync();}}
 host.onrkfieldpalettechange=()=>{apply();populate();syncBoard();};if(!host.dataset.rkFieldListener){host.addEventListener('rk-field-palette-change',()=>host.onrkfieldpalettechange?.());host.dataset.rkFieldListener='1';}
 syncBoard();if(wsType(p)==='text')rkContents(p,host,side);
}

function rkDropdownEvents(control,button,menu){
 control.addEventListener('keydown',e=>{if(e.key==='Escape'){menu.hidden=true;button.setAttribute('aria-expanded','false');button.focus();e.stopPropagation();}});
 control.addEventListener('focusout',()=>setTimeout(()=>{if(!control.contains(document.activeElement)){menu.hidden=true;button.setAttribute('aria-expanded','false');}},0));
}
function rkContents(p,host,side){
 host.querySelector(':scope > .rk-field-color-control')?.remove();
 const control=document.createElement('div');control.className='rk-field-color-control rk-contents-control';control.contentEditable='false';
 const button=document.createElement('button');button.type='button';button.className='btn';button.textContent='Содержание';button.setAttribute('aria-expanded','false');
 const menu=document.createElement('div');menu.className='rk-contents-menu';menu.hidden=true;menu.setAttribute('role','group');menu.setAttribute('aria-label','Главы проекта');
 function populate(){
  menu.replaceChildren();const ordered=[],seen=new Set();
  function branch(parent){wsChildren(parent).forEach(ch=>{if(seen.has(ch.id))return;seen.add(ch.id);if(wsType(ch)==='text')ordered.push(ch);if(wsType(ch)==='folder')branch(ch.id);});}
  branch('');PAGES.forEach(ch=>{if(!seen.has(ch.id)&&wsType(ch)==='text')ordered.push(ch);});
  ordered.forEach(ch=>{const b=document.createElement('button');b.type='button';b.textContent=ch.title;b.dataset.chapter=ch.id;if(ch.id===p.id)b.setAttribute('aria-current','page');b.onclick=()=>{menu.hidden=true;button.setAttribute('aria-expanded','false');if(side){prefs.split=ch.id;savePrefs();renderPane();}else nav('#/'+ch.id);};menu.appendChild(b);});
  const add=document.createElement('button');add.type='button';add.className='rk-add-chapter';add.textContent='Добавить главу';add.onclick=()=>{menu.hidden=true;button.setAttribute('aria-expanded','false');rkAddChapter(wsParent(p));};menu.appendChild(add);
 }
 button.onclick=()=>{const opening=menu.hidden;if(opening)populate();menu.hidden=!opening;button.setAttribute('aria-expanded',String(opening));if(opening)menu.querySelector('button')?.focus();};
 rkDropdownEvents(control,button,menu);control.append(button,menu);host.prepend(control);
}
function rkAddChapter(parent){
 if(!wsWritable())return;
 dlg('Добавить главу','<div class="field"><label for="rk-chapter-title">Название</label><input id="rk-chapter-title" maxlength="160" autocomplete="off"></div>',m=>{
  if(!wsWritable())return false;const input=m.querySelector('#rk-chapter-title'),name=input.value.trim();if(!name){input.focus();return false;}
  const id=wsId('wb');D.pages.push({id,title:name,sub:'',sec:'text',parent:parent&&PAGE[parent]&&wsType(PAGE[parent])==='folder'?parent:'',blockType:'text',blockData:{}});
  registerUserPages();wsCommit();buildToc();nav('#/'+id);setMode('edit');setTimeout(()=>{if(curPage&&curPage.id===id&&!pageBlocks(curPage).length)insertBlock('top:'+id,'',true,'p');},80);
 },'Создать');setTimeout(()=>document.getElementById('rk-chapter-title')?.focus(),30);
}
function rkClearFieldColor(host){if(!host)return;if(host.id==='view2Body')document.getElementById('rkCharacterPaneMode')?.remove();document.getElementById(host.id==='view2Body'?'rkPaneFieldColorToolbar':'rkFieldColorToolbar')?.remove();delete host.dataset.rkTextPage;host.style.removeProperty('--rk-field-surface');host.style.removeProperty('--rk-field-ink');}


const RK_BOARD_VIEWS=new Set(),RK_BOARD_HISTORY=new Map();
const RK_BOARD_THEME_OBSERVER=new MutationObserver(()=>{for(const entry of [...RK_BOARD_VIEWS]){if(!entry.root.isConnected)RK_BOARD_VIEWS.delete(entry);else entry.sync();}});
RK_BOARD_THEME_OBSERVER.observe(document.body,{attributes:true,attributeFilter:['data-rk-palette','data-rk-mode']});

/* RAKURS_MAP_ICONS_V1 — библиотека иконок для карты (контурные, 24×24) */
const RK_MAP_ICONS=[
 {title:'Жильё',items:[
  ['house','Дом','M3 11l9-7 9 7 M5 10v10h14V10 M10 20v-6h4v6'],
  ['cottage','Коттедж','M3 12l9-8 9 8 M5 11v9h14v-9 M10 20v-5h4v5 M16 7V3h2v6 M7 14h2v2H7z'],
  ['apartments','Многоэтажка','M4 21V5h10v16 M14 9h6v12 M3 21h18 M7 8h1M10 8h1M7 11h1M10 11h1M7 14h1M10 14h1M7 17h1M10 17h1M17 12h1M17 15h1M17 18h1'],
  ['tower','Жилая высотка','M8 21V7l4-3 4 3v14 M5 21h14 M11 21v-4h2v4 M10 9h1M13 9h1M10 12h1M13 12h1M10 15h1M13 15h1'],
  ['hut','Хижина','M2 13L12 4l10 9 M5 12v9h14v-9 M10 21v-5h4v5 M8 9l4-4 4 4'],
  ['tent','Палатка','M3 20L12 5l9 15z M12 5v15 M9 20l3-6 3 6'],
  ['mansion','Особняк','M2 21h20 M4 21V10h16v11 M8 10l4-5 4 5 M7 13h2v3H7z M15 13h2v3h-2z M10 21v-5h4v5'],
  ['barn','Ферма','M3 21V9l9-5 9 5v12 M3 21h18 M8 21v-8h8v8 M8 13l8 8 M16 13l-8 8 M12 7v2'],
 ]},
 {title:'Общественные здания',items:[
  ['shop','Магазин','M3 9l1.5-5h15L21 9 M3 9a3 3 0 0 0 6 0a3 3 0 0 0 6 0a3 3 0 0 0 6 0 M5 12v9h14v-9 M9 21v-6h6v6'],
  ['market','Рынок','M3 8h18l-2-4H5z M4 8v2a2 2 0 0 0 4 0a2 2 0 0 0 4 0a2 2 0 0 0 4 0a2 2 0 0 0 4 0V8 M6 12v9h12v-9 M6 21h12 M9 21v-5h6v5'],
  ['school','Университет / музей','M3 9l9-5 9 5 M4 9h16 M6 9v9M10 9v9M14 9v9M18 9v9 M3 18h18v3H3z'],
  ['hospital','Больница','M4 21V7h16v14 M3 21h18 M12 10v6 M9 13h6 M9 3h6v4H9z'],
  ['church','Храм','M12 2v5 M10 4h4 M9 10l3-3 3 3v11H9z M3 21v-8l6-3 M21 21v-8l-6-3 M3 21h18 M11 21v-4h2v4'],
  ['factory','Завод','M3 21V10l5 3v-3l5 3v-3l5 3v8 M3 21h18 M6 10V4h2v7 M17 7c0-2 2-2 2-4'],
  ['warehouse','Склад','M3 21V9l9-5 9 5v12 M3 21h18 M7 21v-7h10v7 M7 17h10'],
  ['office','Офис','M4 21V3h12v18 M16 9h4v12 M3 21h18 M7 6h2M11 6h2M7 9h2M11 9h2M7 12h2M11 12h2M7 15h2M11 15h2 M9 21v-3h2v3'],
  ['cafe','Кафе','M4 8h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z M16 10h2a2 2 0 0 1 0 4h-2 M3 21h16 M8 5c0-1 1-1 1-2 M12 5c0-1 1-1 1-2'],
  ['hotel','Гостиница','M3 21V6h18v15 M3 21h18 M7 9h2M11 9h2M15 9h2M7 12h2M11 12h2M15 12h2M7 15h2M11 15h2M15 15h2 M10 21v-3h4v3 M9 3h6v3'],
  ['stadium','Стадион','M2 12a10 4 0 0 0 20 0a10 4 0 0 0-20 0 M2 12v4a10 4 0 0 0 20 0v-4 M6 10V6M18 10V6M12 9V5'],
  ['gas','Заправка','M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16 M3 21h12 M6 7h6v4H6z M14 9h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V9l-3-3'],
  ['radio','Вышка связи','M12 21V9 M7 21l5-12 5 12 M8 7a5 5 0 0 1 8 0 M5.5 4.5a9 9 0 0 1 13 0 M9.5 16h5'],
  ['cemetery','Кладбище','M9 21V9a3 3 0 0 1 6 0v12 M6 21h12 M12 12v6 M10 14h4'],
 ]},
 {title:'Ретро',items:[
  ['castle','Замок','M3 21V8h3V5h3v3h6V5h3v3h3v13 M3 21h18 M10 21v-5h4v5 M7 13h2v3H7z M15 13h2v3h-2z'],
  ['ruins','Руины','M3 21h18 M5 21V9 M4 9h3 M9 21v-7 M8 14h3 M15 21v-9 M14 12h3 M19 21V7 M18 7h3 M5 9l2-3'],
  ['windmill','Мельница','M9 21l1.5-9h3L15 21 M8 21h8 M12 10a2 2 0 1 0 .01 0 M12 10L7 5 M12 10l5-5 M12 10l-5 5 M12 10l5 5'],
  ['watertower','Водонапорная башня','M6 4h12l-1 7H7z M8 11l-2 10 M16 11l2 10 M9 16h6 M12 11v10'],
  ['lighthouse','Маяк','M9 21l1.5-13h3L15 21 M7 21h10 M9 8h6 M10 8V4h4v4 M12 2v2 M4 6l2 1 M20 6l-2 1 M10 13h4'],
  ['station','Вокзал / поезд','M6 4h12v12H6z M6 10h12 M9 7h6 M9 13h.01M15 13h.01 M8 16l-2 5 M16 16l2 5 M8 19h8'],
  ['lamp','Фонарь','M12 21V9 M9 21h6 M10 4h4l1 5H9z M12 2v2'],
  ['cinema','Кинотеатр','M3 9h18v12H3z M3 9l2-5h14l2 5 M7 9V4 M12 9V4 M17 9V4 M8 13h8v5H8z'],
  ['booth','Телефонная будка','M7 3h10v18H7z M7 7h10 M10 10h4 M10 13h4 M12 16v2'],
  ['well','Колодец','M5 10l7-6 7 6 M6 12h12 M8 12l1 9h6l1-9 M12 12v6 M10 18h4 M7 10v2 M17 10v2'],
 ]},
 {title:'Футуристика',items:[
  ['dome','Купол','M3 14a9 9 0 0 1 18 0 M2 14h20 M3 18h18 M3 14v4 M21 14v4 M12 5V2 M7 14a5 9 0 0 1 10 0 M12 5v9'],
  ['spire','Шпиль','M12 2v4 M8 21l2-15h4l2 15 M4 21h16 M10 10h4 M10 14h4 M9 18h6'],
  ['rocket','Космопорт','M12 2c3 2 5 6 5 11l-5 4-5-4c0-5 2-9 5-11z M9 14l-3 4 M15 14l3 4 M12 10a1.5 1.5 0 1 0 .01 0 M10 18h4l-2 3z'],
  ['reactor','Реактор','M7 3h10l-2 9 2 9H7l2-9z M9 12h6 M4 21h16 M12 3v3'],
  ['server','Дата-центр','M4 3h16v6H4z M4 9h16v6H4z M4 15h16v6H4z M7 6h.01 M7 12h.01 M7 18h.01 M11 6h6 M11 12h6 M11 18h6'],
  ['glass','Стеклянная башня','M6 21V6l6-3 6 3v15 M4 21h16 M12 3V1 M9 9h6 M9 13h6 M9 17h6 M12 9v12'],
  ['pod','Капсула','M4 12a8 8 0 0 1 16 0v2a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z M8 18v3 M16 18v3 M8 12h8 M12 4v8'],
  ['portal','Портал','M12 21a7 9 0 1 0 0-18 7 9 0 0 0 0 18z M12 17a3 5 0 1 0 0-10 3 5 0 0 0 0 10z M3 21h18'],
  ['solar','Солнечная станция','M3 15l2-8h14l2 8z M3 15h18 M12 7v8 M7.5 7l-1 8 M16.5 7l1 8 M4 11h16 M12 15v6 M9 21h6'],
  ['dish','Антенна','M4 11a8 8 0 0 0 13 6L4 11z M11 17l-2 4 M7 21h6 M14 8l3-3 M18 4a1.5 1.5 0 1 0 .01 0'],
 ]},
 {title:'Природа',items:[
  ['tree','Дерево','M12 21v-5 M12 16c-4 0-6-2-6-5a6 6 0 0 1 12 0c0 3-2 5-6 5z'],
  ['pine','Ель','M12 2l5 7h-3l4 5h-3l4 5H5l4-5H6l4-5H7z M12 19v3'],
  ['forest','Лес','M7 21v-4 M7 17c-3 0-4.5-1.5-4.5-4a4.5 4.5 0 0 1 9 0c0 2.5-1.5 4-4.5 4z M16 21v-4 M16 3l5 8h-3l3 6H11l3-6h-3z'],
  ['park','Парк','M8 21v-4 M8 17c-3 0-5-1.5-5-4.5a5 5 0 0 1 10 0c0 3-2 4.5-5 4.5z M15 15h7 M15 18h7 M16 15v6 M21 15v6'],
  ['lake','Озеро','M3 13c0-4 4-7 9-7s9 3 9 7-4 6-9 6-9-2-9-6z M6 13c2-1 4 1 6 0s4-1 6 0'],
  ['river','Река','M9 2c-4 5 4 7 0 12s-2 6 1 8 M15 2c-4 5 4 7 0 12s-2 6 1 8'],
  ['sea','Море','M3 6c3-2 6-2 9 0s6 2 9 0 M3 12c3-2 6-2 9 0s6 2 9 0 M3 18c3-2 6-2 9 0s6 2 9 0'],
  ['mountains','Горы','M2 20l7-12 4 7 3-4 6 9z M9 8l2 4 M2 20h20'],
  ['hills','Холмы','M2 18c3-6 7-6 10 0s7-6 10 0 M2 21h20'],
  ['field','Поле','M12 21V9 M12 9c-3 0-3-3-3-5 2 0 3 1 3 5z M12 9c3 0 3-3 3-5-2 0-3 1-3 5z M12 14c-3 0-3-3-3-5 2 0 3 1 3 5z M12 14c3 0 3-3 3-5-2 0-3 1-3 5z M3 21h18'],
  ['flower','Сад','M8 5v5a4 4 0 0 0 8 0V5l-2 2-2-2-2 2z M12 14v7 M12 18c-2 0-4-1-5-3 M12 18c2 0 4-1 5-3'],
  ['cave','Пещера','M3 21V12a9 9 0 0 1 18 0v9 M3 21h18 M8 21v-5a4 4 0 0 1 8 0v5 M12 7v2'],
  ['island','Остров','M2 18c3-2 6-2 10 0s7 2 10 0 M6 14c0-3 3-4 6-4s6 1 6 4 M12 10V4 M12 4c3 0 5 1 6 3-2 0-4 0-6-3z M12 4c-3 0-5 1-6 3 2 0 4 0 6-3z'],
  ['waterfall','Водопад','M2 8h5 M7 8v13 M17 8h5 M17 8v13 M9.5 8v12 M12 6v14 M14.5 8v12 M2 21h20'],
  ['swamp','Болото','M3 21h18 M4 17c3-2 5 2 8 0s5-2 8 0 M8 17V8 M8 8c-2 0-3-1-3-3 2 0 3 1 3 3z M12 17v-6 M16 17V9 M16 9c2 0 3-1 3-3-2 0-3 1-3 3z'],
  ['beach','Пляж','M3 21c3-2 6-2 9 0s6 2 9 0 M12 21V10 M4 10a8 8 0 0 1 16 0z M12 2v8 M8 10c0-4 2-8 4-8 M16 10c0-4-2-8-4-8'],
  ['rocks','Скалы','M3 21l4-9 4 3 3-7 7 13z M3 21h18'],
 ]},
 {title:'Дороги и места',items:[
  ['pin','Метка','M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z M12 7a3 3 0 1 0 .01 0'],
  ['road','Дорога','M6 21L9 3 M18 21L15 3 M12 6v2 M12 11v2 M12 16v2'],
  ['rail','Железная дорога','M7 3v18 M17 3v18 M7 7h10 M7 11h10 M7 15h10 M7 19h10'],
  ['bridge','Мост','M2 18h20 M5 18v-7 M19 18v-7 M3 11c5-6 13-6 18 0 M9 18v-5 M12 18v-6 M15 18v-5'],
  ['metro','Метро','M3 21h18 M5 19V7l7 8 7-8v12'],
  ['bus','Автобусная остановка','M4 5h16v12H4z M4 11h16 M7 17v3 M17 17v3 M7 14h.01 M17 14h.01'],
  ['airport','Аэропорт','M2 12l9-2 4-7h2l-2 7 6 2v2l-6 1-1 5h-2l-1-5-9-1z'],
  ['harbor','Пристань','M4 15l2 4h12l2-4z M12 15V4 M12 4l6 8h-6 M12 6l-4 6h4'],
  ['fountain','Фонтан','M12 3v5 M8 8a4 4 0 0 1 8 0 M12 8v6 M4 14h16l-2 6H6z M9 11c-1 1-2 2-2 3 M15 11c1 1 2 2 2 3'],
  ['gate','Ворота','M4 21V9a8 8 0 0 1 16 0v12 M3 21h18 M8 21v-9a4 4 0 0 1 8 0v9'],
  ['fence','Ограда','M4 20V8l2-2 2 2v12 M10 20V8l2-2 2 2v12 M16 20V8l2-2 2 2v12 M2 11h20 M2 17h20'],
  ['bench','Скамейка','M3 10h18 M4 10v4 M20 10v4 M3 14h18 M5 14v6 M19 14v6 M7 7h10'],
 ]}
];
const RK_MAP_ICON_PATH=Object.fromEntries(RK_MAP_ICONS.flatMap(g=>g.items.map(([id,,d])=>[id,d])));
function wsBoard(host,p,data){
 const CSS="\nhtml body .rk-board[data-board-ui=v2]{position:relative;min-width:0;color:var(--rk-text,var(--text));font-family:var(--hand);}\nhtml body .rk-board[data-board-ui=v2] .br2-shell{position:relative;display:flex;justify-content:center;margin:0 0 16px;z-index:20;}\nhtml body .rk-board[data-board-ui=v2] .br2-panel{display:flex;align-items:center;gap:4px;padding:8px;border:1px solid var(--line);border-radius:24px;background:var(--rk-bg,var(--bg));box-sizing:border-box;}\nhtml body .rk-board[data-board-ui=v2] .br2-main{max-width:100%;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:thin;}\nhtml body .rk-board[data-board-ui=v2] button.br2-icon{display:inline-flex!important;align-items:center;justify-content:center;flex:0 0 44px;width:44px;height:44px;min-width:44px;padding:0!important;margin:0!important;border:0!important;border-radius:12px!important;background:transparent!important;color:inherit;font-size:0!important;line-height:0!important;cursor:pointer;box-shadow:none!important;}\nhtml body .rk-board[data-board-ui=v2] button.br2-icon svg{display:block;width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;pointer-events:none;}\nhtml body .rk-board[data-board-ui=v2] button.br2-icon[aria-pressed=true]{background:color-mix(in srgb,var(--rk-secondary) 20%,var(--rk-bg))!important;outline:1px solid var(--rk-secondary);outline-offset:-1px;}\nhtml body .rk-board[data-board-ui=v2] button:focus-visible{outline:2px solid var(--rk-secondary);outline-offset:2px;}\nhtml body .rk-board[data-board-ui=v2] button:disabled{opacity:.35;cursor:default;}\nhtml body .rk-board[data-board-ui=v2] .br2-divider{height:28px;width:1px;background:var(--line);margin:0 4px;flex:none;}\nhtml body .rk-board[data-board-ui=v2] .br2-popup{position:absolute;top:calc(100% + 8px);left:50%;transform:translateX(-50%);max-width:calc(100% - 8px);width:max-content;max-height:300px;overflow:auto;flex-wrap:wrap;justify-content:center;z-index:30;gap:8px;}\nhtml body .rk-board[data-board-ui=v2] .br2-popup[hidden]{display:none!important;}\nhtml body .rk-board[data-board-ui=v2] .br2-shape-menu{display:grid;grid-template-columns:repeat(4,44px);gap:8px;padding:12px;}\nhtml body .rk-board[data-board-ui=v2] .br2-menu-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:center;}\nhtml body .rk-board[data-board-ui=v2] button.br2-swatch{width:36px;height:36px;min-width:36px;flex-basis:36px;}\nhtml body .rk-board[data-board-ui=v2] .br2-swatch span{display:block;width:28px;height:28px;border-radius:8px;border:1px solid var(--line);box-sizing:border-box;}\nhtml body .rk-board[data-board-ui=v2] button.br2-option{font:var(--rk-ui-control,16px)/1.4 var(--hand);color:inherit;background:transparent;border:0;border-radius:12px;padding:10px 16px;cursor:pointer;white-space:nowrap;}\nhtml body .rk-board[data-board-ui=v2] button.br2-option[aria-pressed=true]{background:color-mix(in srgb,var(--rk-secondary) 20%,var(--rk-bg));}\nhtml body .rk-board[data-board-ui=v2] .br2-extra-menu{display:grid;justify-content:stretch;min-width:200px;}\nhtml body .rk-board[data-board-ui=v2] .br2-extra-menu button{text-align:left;}\nhtml body .rk-board[data-board-ui=v2] .br2-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;flex-wrap:wrap;}\nhtml body .rk-board[data-board-ui=v2] .br2-footer .br2-panel{padding:4px;border-radius:16px;}\nhtml body .rk-board[data-board-ui=v2] .br2-percent{min-width:48px;text-align:center;font:var(--rk-ui-caption,14px)/1.4 var(--hand);}\nhtml body .rk-board[data-board-ui=v2] .rk-board-viewport{position:relative;overflow:hidden;touch-action:none;user-select:none;min-height:380px;height:min(70vh,720px);outline-offset:3px;background-color:var(--rk-bg,var(--bg));border:1px solid var(--line);border-radius:8px;}\nhtml body .rk-board[data-board-ui=v2] .rk-board-world{position:absolute;left:0;top:0;width:0;height:0;transform-origin:0 0;}\nhtml body .rk-board[data-board-ui=v2] .br2-lines{position:absolute;left:0;top:0;width:1px;height:1px;overflow:visible;pointer-events:none;}\nhtml body .rk-board[data-board-ui=v2] .br2-edge{pointer-events:stroke;cursor:pointer;fill:none;}\nhtml body .rk-board[data-board-ui=v2] .br2-node{position:absolute;box-sizing:border-box;cursor:move;}\nhtml body .rk-board[data-board-ui=v2] .br2-node.is-selected{outline:2px solid var(--rk-secondary);outline-offset:4px;}\nhtml body .rk-board[data-board-ui=v2] .br2-node.is-source{outline:2px dashed var(--rk-hover);outline-offset:4px;}\nhtml body .rk-board[data-board-ui=v2] .br2-shape{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;}\nhtml body .rk-board[data-board-ui=v2] .br2-text{position:absolute;inset:0;box-sizing:border-box;min-width:0;padding:12px;white-space:pre-wrap;overflow-wrap:anywhere;overflow:hidden;font:var(--rk-ui-body,18px)/1.5 var(--hand);outline:none;}\nhtml body .rk-board[data-board-ui=v2] .br2-text[contenteditable=true]{user-select:text;cursor:text;overflow:auto;}\nhtml body .rk-board[data-board-ui=v2] .br2-node[data-kind=ellipse] .br2-text{padding:24px;text-align:center;}\nhtml body .rk-board[data-board-ui=v2] .br2-node img,html body .rk-board[data-board-ui=v2] .br2-node video{display:block;width:100%;height:100%;object-fit:contain;}\nhtml body .rk-board[data-board-ui=v2] .br2-node img{pointer-events:none;}\nhtml body .rk-board[data-board-ui=v2] .br2-resize{display:none;position:absolute;bottom:-5px;right:-5px;width:12px;height:12px;background:var(--rk-secondary);border:1px solid var(--rk-bg);border-radius:2px;cursor:nwse-resize;}\nhtml body .rk-board[data-board-ui=v2] .br2-node.is-selected>.br2-resize{display:block;}\nhtml body .rk-board[data-board-ui=v2] .br2-frame{border:2px solid var(--rk-secondary);background:transparent;}\nhtml body .rk-board[data-board-ui=v2] .br2-frame-title{position:absolute;top:-28px;left:0;white-space:nowrap;font:var(--rk-ui-caption,14px)/1.4 var(--hand);color:var(--rk-text);}\nhtml body .rk-board[data-board-ui=v2] .br2-file{display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;border:1px solid var(--line);background:var(--rk-bg);}\nhtml body .rk-board[data-board-ui=v2] .br2-file a{color:inherit;overflow-wrap:anywhere;font:var(--rk-ui-control,16px)/1.4 var(--hand);}\nhtml body .rk-board[data-board-ui=v2] .br2-empty{position:absolute;inset:40% 16px auto;text-align:center;opacity:.65;pointer-events:none;font:var(--rk-ui-body,18px)/1.5 var(--hand);}\n@media(max-width:650px){html body .rk-board[data-board-ui=v2] button.br2-icon{width:40px;min-width:40px;height:40px;flex-basis:40px;}html body .rk-board[data-board-ui=v2] .br2-panel{gap:2px;padding:6px;}html body .rk-board[data-board-ui=v2] .br2-shape-menu{grid-template-columns:repeat(4,40px);}html body .rk-board[data-board-ui=v2] .br2-popup{padding:10px;gap:8px;}}\nhtml body .rk-board[data-board-ui=v2] .br2-icon-menu{display:grid;grid-template-columns:repeat(8,44px);gap:2px 4px;padding:12px;max-height:min(420px,60vh);align-content:start;}\nhtml body .rk-board[data-board-ui=v2] .br2-icon-group{grid-column:1 / -1;margin:6px 0 2px;padding:0 4px;font:var(--rk-ui-caption,14px)/1.3 var(--hand);opacity:.7;text-transform:uppercase;letter-spacing:.04em;}\nhtml body .rk-board[data-board-ui=v2] .br2-icon-menu .br2-menu-row{grid-column:1 / -1;margin-top:8px;}\nhtml body .rk-board[data-board-ui=v2] .br2-node[data-kind=icon]{display:flex;flex-direction:column;align-items:center;justify-content:center;}\nhtml body .rk-board[data-board-ui=v2] .br2-node[data-kind=icon] .br2-icon-glyph{flex:1 1 auto;width:100%;min-height:0;pointer-events:none;}\nhtml body .rk-board[data-board-ui=v2] .br2-node[data-kind=icon] .br2-text{position:static;flex:none;width:100%;padding:0 4px 2px;text-align:center;font-size:var(--rk-ui-caption,14px);line-height:1.3;max-height:45%;}\n@media(max-width:650px){html body .rk-board[data-board-ui=v2] .br2-icon-menu{grid-template-columns:repeat(6,40px);}}\n";
 if(!document.getElementById('rk-board-ui-v2')){const style=document.createElement('style');style.id='rk-board-ui-v2';style.textContent=CSS;document.head.appendChild(style);}
 if(!data.board||typeof data.board!=='object'||Array.isArray(data.board))data.board={items:[],edges:[],view:{x:40,y:40,k:1}};
 const board=data.board;board.items=Array.isArray(board.items)?board.items:[];board.edges=Array.isArray(board.edges)?board.edges:[];
 const num=(v,d=0)=>Number.isFinite(+v)?+v:d,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),NS='http://www.w3.org/2000/svg';
 const key=String(CUR_PROJ.id||CUR_PROJ.name)+':'+p.id;
 let hist=RK_BOARD_HISTORY.get(key);if(!hist||hist.model!==board){hist={model:board,undo:[],redo:[]};RK_BOARD_HISTORY.set(key,hist);}
 let view={x:num(board.view?.x,40),y:num(board.view?.y,40),k:clamp(num(board.view?.k,1),.15,4)},selected=null,edgeSelected=null,tool='select',menu=null,source=null,gesture=null,editor=null,space=false,wheelTimer,uploading=false;
 let noteColor='light',shapeColor='primary',textColor='auto',brushColor='auto',shapeType='square',connectType='arrow',brush='pencil',stroke=2,frame={w:640,h:360,ratio:16/9};
 const isMap=wsType(p)==='map';let iconType='house',iconColor='auto';
 const root=document.createElement('section');root.className='rk-board';root.dataset.boardUi='v2';root.setAttribute('aria-label','Интерактивная доска');
 const shell=document.createElement('div');shell.className='br2-shell';const bar=document.createElement('div');bar.className='br2-panel br2-main';bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','Инструменты доски');const popup=document.createElement('div');popup.className='br2-panel br2-popup';popup.hidden=true;popup.setAttribute('role','group');shell.append(bar,popup);
 const stage=document.createElement('div');stage.className='rk-board-viewport';stage.tabIndex=0;stage.setAttribute('aria-label','Поле доски');const world=document.createElement('div');world.className='rk-board-world';stage.appendChild(world);
 const footer=document.createElement('div');footer.className='br2-footer';const historyBar=document.createElement('div');historyBar.className='br2-panel';historyBar.setAttribute('role','toolbar');historyBar.setAttribute('aria-label','История действий');const zoomBar=document.createElement('div');zoomBar.className='br2-panel';zoomBar.setAttribute('role','toolbar');zoomBar.setAttribute('aria-label','Масштаб');footer.append(historyBar,zoomBar);
 const help=document.createElement('p');help.className='rk-board-help';help.textContent='Выбери инструмент и нажми на поле · Двойной щелчок — текст · Пробел + перетаскивание — обзор · Ctrl + колесо — масштаб';root.append(shell,stage,footer,help);host.replaceChildren(root);
 const paths={mapicon:'M3 21h18 M5 21V11l4-3 4 3v10 M13 21V7l4-3 4 3v14 M8 14h.01 M16 10h.01 M16 14h.01',select:'M5 3l14 11-7 1-3 7z M12 15l4 6',hand:'M8 12V6a2 2 0 014 0v6 M12 11V4a2 2 0 014 0v8 M16 11V7a2 2 0 014 0v8c0 5-3 7-7 7-3 0-5-2-7-5l-3-4a2 2 0 013-2l2 2',note:'M4 5h10l6 6v10H4z M14 5v6h6',shapes:'M3 12h9v9H3z M12 12V7a5 5 0 115 5z',arrow:'M3 21L21 3 M13 3h8v8',curve:'M3 20C15 20 7 4 21 4 M16 1l5 3-4 5',elbow:'M3 20h7V5h11 M16 1l5 4-5 4',line:'M3 21L21 3',frame:'M3 6h18M3 18h18M6 3v18M18 3v18',pen:'M3 21l4-1L21 6l-4-4L3 16z M14 5l4 4 M3 16l4 4',marker:'M5 18l4-12h6l4 12 M7 13h10 M3 21h18 M10 3h4',laser:'M4 20l9-9 M16 8l2-2 M17 13h3 M11 5V2 M20 3h1 M15 3h1',eraser:'M3 14l9-10 9 8-9 10H9z M8 9l9 8 M12 22h9',text:'M4 4h16M12 4v17',clip:'M8 12l6-6a3 3 0 014 4l-9 9a5 5 0 01-7-7l10-10',plus:'M12 7v10 M7 12h10 M22 12a10 10 0 11-20 0 10 10 0 0120 0',undo:'M9 5L3 10l6 5 M3 10h10a6 6 0 010 12',redo:'M15 5l6 5-6 5 M21 10h-10a6 6 0 000 12',minus:'M5 12h14',zoomplus:'M5 12h14 M12 5v14',fit:'M3 9V3h6 M15 3h6v6 M21 15v6h-6 M9 21H3v-6',square:'M4 4h16v16H4z',rounded:'M7 4h10a3 3 0 013 3v10a3 3 0 01-3 3H7a3 3 0 01-3-3V7a3 3 0 013-3',circle:'M21 12a9 9 0 11-18 0 9 9 0 0118 0',triangle:'M12 3l10 18H2z',left:'M3 3v18h18z',right:'M21 3v18H3z',diamond:'M12 2l10 10-10 10L2 12z',pentagon:'M12 2l10 8-4 12H6L2 10z'};
 const svg=(tag,attrs)=>{const e=document.createElementNS(NS,tag);Object.entries(attrs||{}).forEach(([k,v])=>e.setAttribute(k,String(v)));return e;};
 const snap=()=>JSON.stringify({items:board.items,edges:board.edges}),node=()=>board.items.find(n=>n.id===selected),edge=()=>board.edges.find(n=>n.id===edgeSelected),readonly=()=>!!tabReadOnly;
 function palette(token){return getComputedStyle(root).getPropertyValue(token==='auto'?'--rk-text':'--rk-'+token).trim()||getComputedStyle(root).color;}
 function luminance(c){let a;if(c.startsWith('#')){let h=c.slice(1);if(h.length===3)h=h.split('').map(x=>x+x).join('');a=(h.match(/../g)||[]).slice(0,3).map(x=>parseInt(x,16));}else a=(c.match(/[\d.]+/g)||[]).slice(0,3).map(Number);a=a.map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;});return (a[0]||0)*.2126+(a[1]||0)*.7152+(a[2]||0)*.0722;}
 function ink(fill){const l=luminance(fill),ratio=c=>(Math.max(l,luminance(c))+.05)/(Math.min(l,luminance(c))+.05),a=palette('dark'),b=palette('light');return ratio(a)>=ratio(b)?a:b;}
 function restore(text){const next=JSON.parse(text);board.items=next.items;board.edges=next.edges;}
 function broadcast(){for(const v of [...RK_BOARD_VIEWS]){if(!v.root.isConnected)RK_BOARD_VIEWS.delete(v);else if(v.key===key&&v.root!==root)v.sync();}}
 function commit(before,strict=false){if(readonly()){restore(before);draw();return false;}if(before===snap()){update();return false;}
  if(strict&&!wsCommit()){restore(before);save();flush();toast('Не удалось сохранить вложение: недостаточно места в браузере. Доска не изменена.');draw();broadcast();return false;}
  hist.undo.push(before);if(hist.undo.length>20)hist.undo.shift();hist.redo=[];board.version=2;save();draw();broadcast();return true;
 }
 function rememberView(){if(!readonly()){board.view={...view};save();}}
 function undo(redo=false){finishEdit();if(!wsWritable())return;const a=redo?hist.redo:hist.undo,b=redo?hist.undo:hist.redo;if(!a.length)return;b.push(snap());restore(a.pop());selected=edgeSelected=source=null;save();draw();broadcast();}
 function iconButton(parent,id,label,icon,fn,edit=true){const b=document.createElement('button');b.type='button';b.className='br2-icon';b.dataset.boardAction=id;b.title=label;b.setAttribute('aria-label',label);const v=svg('svg',{viewBox:'0 0 24 24','aria-hidden':'true'});v.appendChild(svg('path',{d:paths[icon]||paths.plus}));b.appendChild(v);b.onclick=()=>{finishEdit();if(edit&&!wsWritable())return;fn();};parent.appendChild(b);return b;}
 function divider(parent){const d=document.createElement('span');d.className='br2-divider';d.setAttribute('aria-hidden','true');parent.appendChild(d);}
 function toolMenu(t,m){tool=t;source=null;menu=menu===m?null:m;renderMenu();draw();}
 function plainTool(t){tool=t;menu=null;source=null;renderMenu();draw();}
 const tools={};tools.select=iconButton(bar,'select','Выбор и перемещение (V)','select',()=>plainTool('select'),false);tools.hand=iconButton(bar,'hand','Перемещение доски (H)','hand',()=>plainTool('hand'),false);divider(bar);
 if(isMap)tools.icon=iconButton(bar,'icon','Иконки карты (I)','mapicon',()=>toolMenu('icon','icon'));
 tools.note=iconButton(bar,'note','Стикеры (N)','note',()=>toolMenu('note','note'));tools.shape=iconButton(bar,'shape','Фигуры (S)','shapes',()=>toolMenu('shape','shape'));tools.connect=iconButton(bar,'connect','Соединения и линии (L)','curve',()=>toolMenu('connect','connect'));tools.frame=iconButton(bar,'frame','Рамки (F)','frame',()=>toolMenu('frame','frame'));tools.pen=iconButton(bar,'pen','Рисование и ластик (P)','pen',()=>toolMenu('pen','pen'));tools.text=iconButton(bar,'text','Текст (T)','text',()=>toolMenu('text','text'));iconButton(bar,'attachment','Добавить фото, GIF, видео или PDF','clip',()=>{menu=null;renderMenu();file.click();});tools.more=iconButton(bar,'more','Дополнительные действия','plus',()=>{menu=menu==='more'?null:'more';renderMenu();update();},false);
 const undoB=iconButton(historyBar,'undo','Отменить (Ctrl+Z)','undo',()=>undo());const redoB=iconButton(historyBar,'redo','Повторить (Ctrl+Shift+Z)','redo',()=>undo(true));
 iconButton(zoomBar,'zoomOut','Уменьшить','minus',()=>zoom(view.k/1.2),false);const percent=document.createElement('span');percent.className='br2-percent';percent.setAttribute('aria-live','polite');zoomBar.appendChild(percent);iconButton(zoomBar,'zoomIn','Увеличить','zoomplus',()=>zoom(view.k*1.2),false);iconButton(zoomBar,'fit','Вместить всё','fit',fit,false);
 const file=document.createElement('input');file.type='file';file.hidden=true;file.multiple=true;file.accept='image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,application/pdf';root.appendChild(file);
 function option(label,fn,active=false,edit=true){const b=document.createElement('button');b.type='button';b.className='br2-option';b.textContent=label;b.setAttribute('aria-pressed',String(active));b.onclick=()=>{finishEdit();if(!edit||wsWritable())fn();};popup.appendChild(b);return b;}
 function colors(current,change){const seen=new Set();[['heading','Акцент'],['primary','Основной'],['secondary','Второй'],['hover','Дополнительный'],['dark','Тёмный'],['light','Светлый']].forEach(([token,label])=>{const fill=palette(token);if(seen.has(fill))return;seen.add(fill);const b=document.createElement('button');b.type='button';b.className='br2-icon br2-swatch';b.dataset.boardColor=token;b.setAttribute('aria-label',label);b.title=label;b.setAttribute('aria-pressed',String(fill===palette(current)));const sw=document.createElement('span');sw.style.background=fill;b.appendChild(sw);b.onclick=()=>{finishEdit();if(!wsWritable())return;change(token);renderMenu();draw();};popup.appendChild(b);});}
 function applyColor(token,type){const before=snap(),n=node(),e=edge();if(type==='note'){noteColor=token;if(n?.kind==='note')n.color=token;}else if(type==='shape'){shapeColor=token;if(n&&['rect','ellipse'].includes(n.kind))n.color=token;}else if(type==='pen'){brushColor=token;if(n?.kind==='pen')n.color=token;}else if(type==='text'){textColor=token;if(n?.kind==='text')n.color=token;}else if(type==='icon'){iconColor=token;if(n?.kind==='icon')n.color=token;}else if(type==='connect'){if(e)e.color=token;}commit(before);}
 function renderMenu(){const focus=popup.contains(document.activeElement)?{action:document.activeElement.dataset.boardAction,color:document.activeElement.dataset.boardColor,text:document.activeElement.textContent}:null;popup.replaceChildren();popup.className='br2-panel br2-popup';popup.hidden=!menu;if(!menu){update();return;}popup.setAttribute('aria-label',({note:'Цвет стикера',text:'Цвет текста',shape:'Фигуры',connect:'Тип соединения',frame:'Пропорции рамки',pen:'Рисование',more:'Действия с объектом',icon:'Иконки карты'})[menu]);
  if(menu==='icon'){popup.classList.add('br2-icon-menu');RK_MAP_ICONS.forEach(group=>{const h=document.createElement('div');h.className='br2-icon-group';h.textContent=group.title;popup.appendChild(h);group.items.forEach(([v,label,d])=>{const b=iconButton(popup,'icon-'+v,label,'plus',()=>{iconType=v;tool='icon';menu=null;renderMenu();draw();});b.firstChild.firstChild.setAttribute('d',d);b.firstChild.firstChild.setAttribute('stroke-width','1.5');b.setAttribute('aria-pressed',String(iconType===v));});});const row=document.createElement('div');row.className='br2-menu-row';popup.appendChild(row);const start=popup.children.length;colors(node()?.kind==='icon'?node().color:iconColor,t=>applyColor(t,'icon'));[...popup.children].slice(start).forEach(b=>row.appendChild(b));}
  if(menu==='text')colors(node()?.kind==='text'?node().color:textColor,t=>applyColor(t,'text'));
  if(menu==='note')colors(node()?.kind==='note'?node().color:noteColor,t=>applyColor(t,'note'));
  if(menu==='shape'){popup.classList.add('br2-shape-menu');[['square','Квадрат'],['rounded','Скруглённый прямоугольник'],['circle','Круг'],['triangle','Треугольник'],['left','Прямоугольный треугольник влево'],['right','Прямоугольный треугольник вправо'],['diamond','Ромб'],['pentagon','Пятиугольник']].forEach(([v,label])=>{const b=iconButton(popup,'shape-'+v,label,v,()=>{shapeType=v;tool='shape';menu=null;renderMenu();draw();});b.setAttribute('aria-pressed',String(shapeType===v));});const row=document.createElement('div');row.className='br2-menu-row';row.style.gridColumn='1 / -1';popup.appendChild(row);const all=popup;const start=popup.children.length;colors(node()&&['rect','ellipse'].includes(node().kind)?node().color:shapeColor,t=>applyColor(t,'shape'));[...popup.children].slice(start).forEach(b=>row.appendChild(b));}
  if(menu==='connect'){['arrow','curve','elbow','line'].forEach((v,i)=>{const b=iconButton(popup,'connect-'+v,['Стрелка','Изогнутая стрелка','Ломаная стрелка','Линия без стрелки'][i],v,()=>{connectType=v;const e=edge();if(e){const before=snap();e.type=v;commit(before);}renderMenu();});b.setAttribute('aria-pressed',String((edge()?.type||connectType)===v));});}
  if(menu==='frame'){[['16:9',640,360],['4:3',480,360],['1:1',400,400]].forEach(([label,w,h])=>option(label,()=>{frame={w,h,ratio:w/h};tool='frame';menu=null;renderMenu();draw();},Math.abs(frame.ratio-w/h)<.001));option('Свой размер',()=>{menu=null;renderMenu();dlg('Размер рамки','<div class="field"><label>Ширина</label><input id="br2-fw" type="number" min="50" max="4000" value="640"></div><div class="field"><label>Высота</label><input id="br2-fh" type="number" min="50" max="4000" value="360"></div>',m=>{const w=Number(m.querySelector('#br2-fw').value),h=Number(m.querySelector('#br2-fh').value);if(!Number.isFinite(w)||!Number.isFinite(h)||w<50||h<50||w>4000||h>4000){toast('Размер рамки: от 50 до 4000');return false;}frame={w,h,ratio:0};plainTool('frame');},'Применить');});}
  if(menu==='pen'){[['pencil','Карандаш','pen'],['marker','Маркер','marker'],['laser','Указка — без сохранения','laser'],['eraser','Ластик — удаление штрихов','eraser']].forEach(([v,label,ic])=>{const b=iconButton(popup,'brush-'+v,label,ic,()=>{brush=v;tool='pen';renderMenu();draw();});b.setAttribute('aria-pressed',String(brush===v));});divider(popup);[2,5,10].forEach((v,i)=>{const b=iconButton(popup,'width-'+v,['Тонкий штрих','Средний штрих','Толстый штрих'][i],'plus',()=>{stroke=v;const n=node();if(n?.kind==='pen'){const before=snap();n.strokeWidth=v*(n.brush==='marker'?3:1);commit(before);}renderMenu();});b.firstChild.replaceChildren(svg('circle',{cx:12,cy:12,r:[2,4,7][i],fill:'currentColor',stroke:'none'}));b.setAttribute('aria-pressed',String(stroke===v));});divider(popup);colors(node()?.kind==='pen'?node().color:brushColor,t=>applyColor(t,'pen'));}
  if(menu==='more'){popup.classList.add('br2-extra-menu');option('Копировать объект',duplicate).disabled=!node()||readonly();option('Удалить',remove).disabled=(!node()&&!edge())||readonly();option('На передний план',()=>order(true)).disabled=!node()||readonly();option('На задний план',()=>order(false)).disabled=!node()||readonly();option('Вместить всё',()=>{fit();menu=null;renderMenu();},false,false);}
  update();if(focus&&menu){const match=[...popup.querySelectorAll('button')].find(b=>focus.action?b.dataset.boardAction===focus.action:focus.color?b.dataset.boardColor===focus.color:b.textContent===focus.text);(match||popup.querySelector('button'))?.focus({preventScroll:true});}
 }
 function update(){for(const [t,b] of Object.entries(tools))b.setAttribute('aria-pressed',String(t==='more'?menu==='more':tool===t));undoB.disabled=readonly()||!hist.undo.length;redoB.disabled=readonly()||!hist.redo.length;stage.style.cursor=space||tool==='hand'?'grab':tool==='select'?'default':tool==='pen'&&brush==='eraser'?'cell':'crosshair';}
 function transform(){world.style.transform=`translate(${view.x}px,${view.y}px) scale(${view.k})`;stage.style.backgroundSize=`${24*view.k}px ${24*view.k}px`;stage.style.backgroundPosition=`${view.x}px ${view.y}px`;percent.textContent=Math.round(view.k*100)+'%';}
 function point(e){const r=stage.getBoundingClientRect();return {x:(e.clientX-r.left-view.x)/view.k,y:(e.clientY-r.top-view.y)/view.k};}
 function center(){return {x:(stage.clientWidth/2-view.x)/view.k-100,y:(stage.clientHeight/2-view.y)/view.k-80};}
 function add(kind,where,extra={},strict=false,editing=true){if(!wsWritable())return;const before=snap(),pos=where||center(),n={id:wsId('bn'),kind,x:pos.x,y:pos.y,w:200,h:160,text:'',color:kind==='text'?textColor:kind==='note'?noteColor:kind==='icon'?iconColor:shapeColor,...extra};if(kind==='frame')board.items.unshift(n);else board.items.push(n);selected=n.id;edgeSelected=source=null;tool='select';menu=null;renderMenu();if(commit(before,strict)&&editing)edit(n.id);return n;}
 function duplicate(){const n=node();if(!n||!wsWritable())return;const copy=JSON.parse(JSON.stringify(n));delete copy.id;copy.x+=24;copy.y+=24;add(n.kind,{x:copy.x,y:copy.y},copy,false,false);}
 function remove(){finishEdit();if(!wsWritable()||(!selected&&!edgeSelected))return;const before=snap();if(selected){board.items=board.items.filter(n=>n.id!==selected);board.edges=board.edges.filter(e=>e.from!==selected&&e.to!==selected);}else board.edges=board.edges.filter(e=>e.id!==edgeSelected);selected=edgeSelected=source=null;commit(before);if(menu)renderMenu();}
 function order(front){if(!wsWritable())return;const n=node();if(!n)return;const before=snap();board.items=board.items.filter(x=>x!==n);if(front)board.items.push(n);else board.items.unshift(n);commit(before);}
 function finishEdit(){if(editor){const el=editor;editor=null;el.blur();}}
 function edit(id){if(!wsWritable())return;const n=board.items.find(n=>n.id===id);if(!n)return;if(n.kind==='frame'){dlg('Название рамки','<div class="field"><label>Название</label><input id="br2-frame-name"></div>',m=>{if(!wsWritable())return false;const before=snap();n.text=m.querySelector('input').value.trim()||'Рамка';commit(before);});document.querySelector('#br2-frame-name').value=n.text||'Рамка';return;}
  if(!['note','text','rect','ellipse','icon'].includes(n.kind))return;finishEdit();const el=[...world.querySelectorAll('[data-node]')].find(el=>el.dataset.node===id)?.querySelector('.br2-text');if(!el)return;const before=snap(),original=n.text||'';let canceled=false;el.contentEditable='true';editor=el;el.focus();const r=document.createRange();r.selectNodeContents(el);const sel=getSelection();sel.removeAllRanges();sel.addRange(r);el.onkeydown=e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();canceled=true;el.blur();}if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();el.blur();}};el.onblur=()=>{if(editor===el)editor=null;el.contentEditable='false';if(!canceled&&!readonly()){n.text=el.innerText.slice(0,100000);commit(before);}else el.textContent=original;el.onblur=null;};
 }
 function shapeSVG(n,fill){const el=svg('svg',{class:'br2-shape',viewBox:'0 0 100 100',preserveAspectRatio:'none','aria-hidden':'true'}),a={fill,stroke:ink(fill),'stroke-width':1,'vector-effect':'non-scaling-stroke'};let sh;
  switch(n.shape|| (n.kind==='ellipse'?'circle':'square')){case 'circle':sh=svg('ellipse',{cx:50,cy:50,rx:49,ry:49,...a});break;case 'triangle':sh=svg('polygon',{points:'50,1 99,99 1,99',...a});break;case 'left':sh=svg('polygon',{points:'1,1 1,99 99,99',...a});break;case 'right':sh=svg('polygon',{points:'99,1 99,99 1,99',...a});break;case 'diamond':sh=svg('polygon',{points:'50,1 99,50 50,99 1,50',...a});break;case 'pentagon':sh=svg('polygon',{points:'50,1 99,38 80,99 20,99 1,38',...a});break;default:sh=svg('rect',{x:.5,y:.5,width:99,height:99,rx:n.shape==='rounded'?12:0,...a});}el.appendChild(sh);return el;
 }
 function drawNode(n){const el=document.createElement('div');el.className='br2-node'+(n.id===selected?' is-selected':'')+(n.id===source?' is-source':'');el.dataset.node=n.id;el.dataset.kind=n.kind;Object.assign(el.style,{left:num(n.x)+'px',top:num(n.y)+'px',width:clamp(num(n.w,200),4,5000)+'px',height:clamp(num(n.h,160),4,5000)+'px'});const fill=palette(n.color||'primary');
  if(n.kind==='frame'){el.classList.add('br2-frame');const title=document.createElement('span');title.className='br2-frame-title';title.textContent=n.text||'Рамка';el.appendChild(title);}
  else if(n.kind==='image'&&/^data:image\/(png|jpeg|webp|gif);base64,/.test(n.image||'')){const img=document.createElement('img');img.src=n.image;img.alt=n.text||'Изображение доски';img.draggable=false;el.appendChild(img);}
  else if(n.kind==='video'&&/^data:video\/(mp4|webm);base64,/.test(n.src||'')){const video=document.createElement('video');video.src=n.src;video.controls=true;video.playsInline=true;video.preload='metadata';el.appendChild(video);}
  else if(n.kind==='file'&&/^data:application\/pdf;base64,/.test(n.src||'')){el.classList.add('br2-file');const a=document.createElement('a');a.href=n.src;a.download=n.text||'Вложение.pdf';a.textContent=n.text||'Открыть PDF';el.appendChild(a);}
  else if(n.kind==='icon'){const glyph=svg('svg',{class:'br2-icon-glyph',viewBox:'0 0 24 24',preserveAspectRatio:'xMidYMid meet','aria-hidden':'true'});glyph.appendChild(svg('path',{d:RK_MAP_ICON_PATH[n.icon]||RK_MAP_ICON_PATH.pin,fill:'none',stroke:fill,'stroke-width':1.5,'stroke-linecap':'round','stroke-linejoin':'round'}));el.appendChild(glyph);el.style.color=fill;const text=document.createElement('div');text.className='br2-text';text.textContent=n.text||'';el.appendChild(text);}
  else if(n.kind==='pen'){const drawing=svg('svg',{class:'br2-shape',viewBox:`0 0 ${num(n.pathWidth,n.w)||1} ${num(n.pathHeight,n.h)||1}`,preserveAspectRatio:'none'});drawing.appendChild(svg('polyline',{points:(n.points||[]).map(p=>num(p[0])+','+num(p[1])).join(' '),fill:'none',stroke:fill,'stroke-width':num(n.strokeWidth,3),'stroke-linecap':'round','stroke-linejoin':'round',opacity:num(n.opacity,1)}));el.appendChild(drawing);}
  else{if(n.kind==='note'){el.style.background=fill;el.style.color=ink(fill);}else if(n.kind==='text')el.style.color=fill;else{el.appendChild(shapeSVG(n,fill));el.style.color=ink(fill);}const text=document.createElement('div');text.className='br2-text';text.textContent=n.text||'';el.appendChild(text);}
  if(!readonly()){const handle=document.createElement('span');handle.className='br2-resize';handle.setAttribute('aria-hidden','true');el.appendChild(handle);}world.appendChild(el);
 }
 function endpoint(n,other){const c={x:num(n.x)+num(n.w,200)/2,y:num(n.y)+num(n.h,160)/2},dx=other.x-c.x,dy=other.y-c.y,t=Math.min(num(n.w,200)/2/Math.max(Math.abs(dx),.001),num(n.h,160)/2/Math.max(Math.abs(dy),.001));return {x:c.x+dx*t,y:c.y+dy*t};}
 function ends(e){if(e.from&&e.to){const a=board.items.find(n=>n.id===e.from),b=board.items.find(n=>n.id===e.to);if(!a||!b)return null;return [endpoint(a,{x:num(b.x)+num(b.w,200)/2,y:num(b.y)+num(b.h,160)/2}),endpoint(b,{x:num(a.x)+num(a.w,200)/2,y:num(a.y)+num(a.h,160)/2})];}if(e.a&&e.b)return [e.a,e.b];return null;}
 function pathFor(a,b,type){if(type==='curve'){const d=Math.max(50,Math.abs(b.x-a.x)/2);return `M${a.x} ${a.y} C${a.x+d} ${a.y},${b.x-d} ${b.y},${b.x} ${b.y}`;}if(type==='elbow'){const x=(a.x+b.x)/2;return `M${a.x} ${a.y} H${x} V${b.y} H${b.x}`;}return `M${a.x} ${a.y} L${b.x} ${b.y}`;}
 function makeLines(){const lines=svg('svg',{class:'br2-lines','aria-hidden':'true'});world.appendChild(lines);return lines;}
 function draw(){if(editor)return;if(selected&&!node())selected=null;if(edgeSelected&&!edge())edgeSelected=null;world.replaceChildren();board.items.filter(n=>n.kind==='frame').forEach(drawNode);const lines=makeLines();
  board.edges.forEach((e,i)=>{const points=ends(e);if(!points)return;const color=palette(e.color||'secondary'),id='br2arrow'+wsId('m'),defs=svg('defs'),marker=svg('marker',{id,viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:7,markerHeight:7,orient:'auto'});marker.appendChild(svg('path',{d:'M0 0 L10 5 L0 10 z',fill:color}));defs.appendChild(marker);lines.appendChild(defs);const path=svg('path',{class:'br2-edge','data-edge':e.id,d:pathFor(points[0],points[1],e.type||'arrow'),stroke:e.id===edgeSelected?palette('hover'):color,'stroke-width':e.id===edgeSelected?5:3});if(e.type!=='line')path.setAttribute('marker-end',`url(#${id})`);lines.appendChild(path);});board.items.filter(n=>n.kind!=='frame').forEach(drawNode);
  stage.querySelector('.br2-empty')?.remove();transform();update();
 }
 function zoom(k,cx=stage.clientWidth/2,cy=stage.clientHeight/2){const next=clamp(k,.15,4),r=next/view.k;view.x=cx-(cx-view.x)*r;view.y=cy-(cy-view.y)*r;view.k=next;transform();rememberView();}
 function fit(){const bounds=board.items.map(n=>({x:num(n.x),y:num(n.y),w:num(n.w,200),h:num(n.h,160)}));board.edges.forEach(e=>{const points=ends(e);if(points)points.forEach(p=>bounds.push({...p,w:1,h:1}));});if(!bounds.length){view={x:40,y:40,k:1};transform();rememberView();return;}const x=Math.min(...bounds.map(n=>n.x)),y=Math.min(...bounds.map(n=>n.y)),right=Math.max(...bounds.map(n=>n.x+n.w)),bottom=Math.max(...bounds.map(n=>n.y+n.h));view.k=clamp(Math.min((stage.clientWidth-80)/Math.max(right-x,1),(stage.clientHeight-80)/Math.max(bottom-y,1)),.15,4);view.x=(stage.clientWidth-(right-x)*view.k)/2-x*view.k;view.y=(stage.clientHeight-(bottom-y)*view.k)/2-y*view.k;transform();rememberView();}
 function erase(pos){const threshold=12/view.k;const hit=n=>{if(n.kind!=='pen')return false;const pts=(n.points||[]).map(p=>({x:num(n.x)+p[0]*n.w/(n.pathWidth||n.w),y:num(n.y)+p[1]*n.h/(n.pathHeight||n.h)}));for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[i+1]||a,dx=b.x-a.x,dy=b.y-a.y,t=clamp(((pos.x-a.x)*dx+(pos.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);if(Math.hypot(pos.x-a.x-t*dx,pos.y-a.y-t*dy)<threshold+num(n.strokeWidth,3)/2)return true;}return false;};const ids=new Set(board.items.filter(hit).map(n=>n.id));if(ids.size){board.items=board.items.filter(n=>!ids.has(n.id));board.edges=board.edges.filter(e=>!ids.has(e.from)&&!ids.has(e.to));draw();}}
 stage.addEventListener('dblclick',e=>{if(e.target.closest('video,a'))return;const el=e.target.closest('[data-node]');if(el)edit(el.dataset.node);else if(tool==='select'&&!e.target.closest('[data-edge]'))add('note',point(e),{w:200,h:200});});
 stage.addEventListener('pointerdown',e=>{if(e.button!==0&&e.button!==1||e.target.closest('[contenteditable=true],video,a'))return;finishEdit();stage.focus({preventScroll:true});const pos=point(e),el=e.target.closest('[data-node]'),edgeEl=e.target.closest('[data-edge]');menu=null;renderMenu();
  if(space||tool==='hand'||e.button===1)gesture={kind:'pan',sx:e.clientX,sy:e.clientY,view:{...view}};
  else if(tool==='note'||tool==='text'||tool==='shape'||tool==='frame'||tool==='icon'){e.preventDefault();if(!wsWritable())return;if(tool==='icon'){add('icon',{x:pos.x-48,y:pos.y-48},{icon:iconType,w:96,h:96},false,false);return;}if(tool==='note')add('note',pos,{w:200,h:200});else if(tool==='text')add('text',pos,{w:260,h:90});else if(tool==='shape')add(shapeType==='circle'?'ellipse':'rect',pos,{shape:shapeType,w:shapeType==='rounded'?220:160,h:160});else add('frame',pos,{w:frame.w,h:frame.h,ratio:frame.ratio,text:'Рамка'},false,false);return;}
  else if(tool==='pen'){if(!wsWritable())return;if(brush==='eraser'){gesture={kind:'eraser',before:snap()};erase(pos);}else{const lines=world.querySelector('.br2-lines')||makeLines(),preview=svg('polyline',{points:`${pos.x},${pos.y}`,fill:'none',stroke:palette(brushColor),'stroke-width':stroke*(brush==='marker'?3:1),'stroke-linecap':'round','stroke-linejoin':'round',opacity:brush==='marker'?.35:1});lines.appendChild(preview);gesture={kind:brush==='laser'?'laser':'pen',before:snap(),points:[pos],preview};}}
  else if(tool==='connect'){if(!wsWritable())return;if(el){selected=el.dataset.node;edgeSelected=null;if(source&&source!==selected){const before=snap();const e={id:wsId('be'),from:source,to:selected,type:connectType,color:'secondary'};board.edges.push(e);source=selected=null;edgeSelected=e.id;commit(before);}else source=source===selected?null:selected;draw();return;}source=null;const lines=world.querySelector('.br2-lines')||makeLines(),preview=svg('path',{d:pathFor(pos,pos,connectType),fill:'none',stroke:palette('secondary'),'stroke-width':3});lines.appendChild(preview);gesture={kind:'line',start:pos,end:pos,before:snap(),preview};}
  else if(el){selected=el.dataset.node;edgeSelected=null;const n=node();if(!readonly()&&n){const members=n.kind==='frame'?board.items.filter(x=>x.id!==n.id&&x.x+x.w/2>=n.x&&x.x+x.w/2<=n.x+n.w&&x.y+x.h/2>=n.y&&x.y+x.h/2<=n.y+n.h).map(x=>({id:x.id,x:x.x,y:x.y})):[];gesture={kind:e.target.closest('.br2-resize')?'resize':'move',id:n.id,sx:e.clientX,sy:e.clientY,x:n.x,y:n.y,w:n.w,h:n.h,members,before:snap()};}draw();}
  else if(edgeEl){selected=null;edgeSelected=edgeEl.dataset.edge;draw();return;}
  else{selected=edgeSelected=source=null;gesture={kind:'pan',sx:e.clientX,sy:e.clientY,view:{...view}};draw();}
  if(gesture){stage.setPointerCapture(e.pointerId);e.preventDefault();}
 });
 stage.addEventListener('pointermove',e=>{const g=gesture;if(!g)return;if(readonly()&&g.kind!=='pan'){finishGesture(e,true);return;}if(g.kind==='pan'){view.x=g.view.x+e.clientX-g.sx;view.y=g.view.y+e.clientY-g.sy;transform();return;}const pos=point(e);if(g.kind==='eraser'){erase(pos);return;}if(g.kind==='pen'||g.kind==='laser'){const last=g.points[g.points.length-1];if(Math.hypot(pos.x-last.x,pos.y-last.y)>1){g.points.push(pos);g.preview.setAttribute('points',g.points.map(p=>p.x+','+p.y).join(' '));}return;}if(g.kind==='line'){g.end=pos;g.preview.setAttribute('d',pathFor(g.start,pos,connectType));return;}const n=board.items.find(n=>n.id===g.id);if(!n)return;const dx=(e.clientX-g.sx)/view.k,dy=(e.clientY-g.sy)/view.k;if(g.kind==='move'){n.x=g.x+dx;n.y=g.y+dy;g.members.forEach(m=>{const child=board.items.find(n=>n.id===m.id);if(child){child.x=m.x+dx;child.y=m.y+dy;}});}else if(n.kind==='frame'&&n.ratio){const k=clamp(1+(Math.abs(dx/g.w)>Math.abs(dy/g.h)?dx/g.w:dy/g.h),50/Math.min(g.w,g.h),4000/Math.max(g.w,g.h));n.w=g.w*k;n.h=g.h*k;}else{n.w=clamp(g.w+dx,40,5000);n.h=clamp(g.h+dy,40,5000);}draw();});
 function finishGesture(e,cancel=false){const g=gesture;if(!g)return;gesture=null;if(stage.hasPointerCapture(e.pointerId))stage.releasePointerCapture(e.pointerId);if(cancel){if(g.kind==='pan')view=g.view;else restore(g.before);draw();return;}if(g.kind==='pan'){rememberView();return;}if(g.kind==='laser'){setTimeout(()=>g.preview.remove(),650);return;}if(g.kind==='pen'){const pts=g.points;if(pts.length===1)pts.push({x:pts[0].x+.1,y:pts[0].y+.1});const x=Math.min(...pts.map(p=>p.x))-4,y=Math.min(...pts.map(p=>p.y))-4,w=Math.max(...pts.map(p=>p.x))-x+4,h=Math.max(...pts.map(p=>p.y))-y+4;const n={id:wsId('bn'),kind:'pen',x,y,w,h,pathWidth:w,pathHeight:h,points:pts.map(p=>[p.x-x,p.y-y]),color:brushColor,strokeWidth:stroke*(brush==='marker'?3:1),opacity:brush==='marker'?.35:1,brush};board.items.push(n);selected=n.id;commit(g.before);return;}if(g.kind==='line'){g.preview.remove();if(Math.hypot(g.end.x-g.start.x,g.end.y-g.start.y)>5){const e={id:wsId('be'),a:g.start,b:g.end,type:connectType,color:'secondary'};board.edges.push(e);selected=null;edgeSelected=e.id;commit(g.before);}return;}commit(g.before);}
 stage.addEventListener('pointerup',e=>finishGesture(e));stage.addEventListener('pointercancel',e=>finishGesture(e,true));stage.addEventListener('lostpointercapture',e=>{if(gesture)finishGesture(e,true);});stage.addEventListener('wheel',e=>{if(editor)return;e.preventDefault();if(e.ctrlKey||e.metaKey){const r=stage.getBoundingClientRect();zoom(view.k*Math.exp(-e.deltaY*.002),e.clientX-r.left,e.clientY-r.top);}else{view.x-=e.deltaX;view.y-=e.deltaY;transform();clearTimeout(wheelTimer);wheelTimer=setTimeout(rememberView,180);}},{passive:false});
 root.addEventListener('keydown',e=>{e.stopPropagation();if(e.target.closest('input,textarea,[contenteditable=true]'))return;if(e.key==='Escape'){menu=null;source=null;tool='select';renderMenu();draw();}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo(e.shiftKey);}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();undo(true);}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){e.preventDefault();duplicate();}else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();remove();}else if(e.code==='Space'&&e.target===stage){e.preventDefault();space=true;update();}else if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&e.target===stage){const t={v:'select',h:'hand',n:'note',s:'shape',l:'connect',f:'frame',p:'pen',t:'text',i:isMap?'icon':undefined}[e.key.toLowerCase()];if(t&&(t==='select'||t==='hand'||wsWritable()))plainTool(t);}});root.addEventListener('keyup',e=>{e.stopPropagation();if(e.code==='Space'){space=false;update();}});stage.addEventListener('blur',()=>{space=false;update();});root.addEventListener('focusout',()=>setTimeout(()=>{if(!root.contains(document.activeElement)){menu=null;renderMenu();}},0));
 file.onchange=async()=>{const files=[...file.files];file.value='';if(!files.length||!wsWritable())return;if(uploading){toast('Дождись загрузки предыдущего вложения');return;}uploading=true;const prepared=[];try{for(const f of files){if(f.size>10*1024*1024)throw Error('Файл больше 10 МБ');if(!/^(image\/(png|jpeg|webp|gif)|video\/(mp4|webm)|application\/pdf)$/.test(f.type))throw Error('Поддерживаются фото, GIF, MP4, WebM и PDF');const src=await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(String(r.result));r.onerror=no;r.readAsDataURL(f);});const pos=center(),n={id:wsId('bn'),x:pos.x+prepared.length*24,y:pos.y+prepared.length*24,w:320,h:220,text:f.name};if(f.type.startsWith('image/')){let image=src;const dims=await new Promise((ok,no)=>{const img=new Image();img.onload=()=>{if(f.type!=='image/gif'){const k=Math.min(1,1600/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*k));c.height=Math.max(1,Math.round(img.height*k));c.getContext('2d').drawImage(img,0,0,c.width,c.height);image=c.toDataURL('image/webp',.85);}ok([img.width,img.height]);};img.onerror=no;img.src=src;});Object.assign(n,{kind:'image',image,w:320,h:Math.max(40,320*dims[1]/dims[0])});}else Object.assign(n,{kind:f.type.startsWith('video/')?'video':'file',src});prepared.push(n);}if(!root.isConnected||!wsWritable())return;const before=snap();board.items.push(...prepared);selected=prepared[prepared.length-1]?.id;tool='select';commit(before,true);}catch(e){toast(e.message||'Не удалось прочитать вложение');}finally{uploading=false;}};
 const entry={key,root,sync:()=>{if(!editor&&!gesture){draw();if(menu)renderMenu();}}};for(const v of [...RK_BOARD_VIEWS])if(!v.root.isConnected)RK_BOARD_VIEWS.delete(v);RK_BOARD_VIEWS.add(entry);draw();
}


function wsBindRename(heading,p){
 if(!heading||!wsUser(p))return;
 heading.classList.add('ws-rename-title');heading.title='Двойной клик — изменить название';heading.tabIndex=0;
 heading.addEventListener('dblclick',e=>{e.preventDefault();wsBeginRename(heading,p);});
 heading.addEventListener('keydown',e=>{if(!heading.isContentEditable&&e.key==='F2'){e.preventDefault();e.stopPropagation();wsBeginRename(heading,p);}});
}
function wsBeginRename(heading,p){
 if(!wsWritable()||heading.isContentEditable)return;
 const user=wsUser(p);if(!user)return;const old=user.title;let done=false;
 heading.contentEditable='true';heading.classList.add('ws-renaming');heading.setAttribute('role','textbox');heading.setAttribute('aria-label','Название блока');heading.setAttribute('aria-multiline','false');heading.spellcheck=false;
 function finish(cancel){
  if(done)return;done=true;
  const title=heading.textContent.replace(/\s+/g,' ').trim().slice(0,160);
  heading.removeEventListener('keydown',key);heading.removeEventListener('blur',blur);heading.removeEventListener('paste',paste);
  heading.removeAttribute('contenteditable');heading.classList.remove('ws-renaming');heading.removeAttribute('role');heading.removeAttribute('aria-label');heading.removeAttribute('aria-multiline');
  if(cancel||!title||tabReadOnly){heading.textContent=old;return;}
  heading.textContent=title;if(title===old)return;
  user.title=title;registerUserPages();wsCommit();buildToc();
  if(curPage&&curPage.id===p.id){$('#crumb').innerHTML='<a href="#/">'+esc(CUR_PROJ.name)+'</a> / '+esc(title);}
 }
 function key(e){e.stopPropagation();if(e.key==='Enter'){e.preventDefault();finish(false);heading.blur();}else if(e.key==='Escape'){e.preventDefault();finish(true);heading.blur();}}
 function blur(){finish(false);}
 function paste(e){e.preventDefault();const text=(e.clipboardData.getData('text/plain')||'').replace(/\s+/g,' ');const selection=window.getSelection();if(!selection.rangeCount)return;const range=selection.getRangeAt(0);if(!heading.contains(range.commonAncestorContainer))return;range.deleteContents();const node=document.createTextNode(text);range.insertNode(node);range.setStartAfter(node);range.collapse(true);selection.removeAllRanges();selection.addRange(range);}
 heading.addEventListener('keydown',key);heading.addEventListener('blur',blur);heading.addEventListener('paste',paste);
 heading.focus();const range=document.createRange();range.selectNodeContents(heading);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
}


/* RAKURS_CHARACTER_DESIGNER_V1 */
const RK_CHARACTER_VIEWS=new Set(),RK_CHARACTER_HISTORY=new Map(),RK_CHARACTER_PANE_MODES=new Map();
function rkCharacterDesigner(host,p,data){
 /* RAKURS_LOCATION_DESIGNER_V1 */
 const isLocation=wsType(p)==='location',canvasKey=isLocation?'locationCanvas':'characterCanvas';
 const designerCSS="\nhtml body.ws-page.rk-character-page .bar-in>.seg{display:inline-flex!important}\nhtml body :is(#view,#view2Body) .rk-character-designer{--ci:var(--rk-field-ink,var(--rk-text,var(--text)));--cp:var(--rk-field-surface,var(--rk-bg,var(--bg)));color:var(--ci);font-family:var(--hand);position:relative;min-width:0;isolation:isolate}\nhtml body :is(#view,#view2Body) .rk-character-designer *{box-sizing:border-box}\nhtml body :is(#view,#view2Body) .rk-character-designer [hidden]{display:none!important}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-tools{display:flex;align-items:center;gap:5px;min-height:38px;position:relative;z-index:100;margin-bottom:8px;flex-wrap:wrap}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-icon{display:inline-flex!important;align-items:center;justify-content:center;width:32px;min-width:32px;height:32px;flex:0 0 32px;padding:0!important;margin:0!important;background:transparent!important;border:0!important;border-radius:6px!important;color:inherit!important;line-height:0!important;font-size:0!important;cursor:pointer}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-icon svg{display:block;width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-icon:disabled{opacity:.3;cursor:default}\nhtml body :is(#view,#view2Body) .rk-character-designer :focus-visible{outline:2px solid currentColor!important;outline-offset:2px}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-icon:hover,html body :is(#view,#view2Body) .rk-character-designer .cc-icon[aria-pressed=true]{outline:1px dashed currentColor;outline-offset:-3px}\nhtml body :is(#view,#view2Body) .rk-character-designer :is(.cc-menu,.cc-hint){position:absolute;top:40px;left:0;z-index:100;max-width:100%;min-width:240px;padding:12px;border:1px solid currentColor;border-radius:9px;background:var(--cp)!important;color:var(--ci)!important;box-shadow:0 6px 24px #0002}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-menu{display:grid;gap:3px}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-menu button{padding:6px 10px!important;text-align:left;border:0!important;background:transparent!important;color:inherit!important;font:17px/1.4 var(--hand)!important;cursor:pointer}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-menu button:hover{outline:1px dashed currentColor}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-hint{display:flex;align-items:center;gap:8px;font-size:18px}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-sizer{position:relative;width:100%;overflow:hidden}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-stage{position:absolute;top:0;left:0;width:1000px;transform-origin:top left}\nhtml body :is(#view,#view2Body) .rk-character-designer[data-edit=\"1\"] .cc-stage{background-image:linear-gradient(to right,color-mix(in srgb,var(--ci) 10%,transparent) 1px,transparent 1px),linear-gradient(to bottom,color-mix(in srgb,var(--ci) 10%,transparent) 1px,transparent 1px);background-size:20px 20px;box-shadow:inset -1px 0 0 color-mix(in srgb,var(--ci) 10%,transparent),inset 0 -1px 0 color-mix(in srgb,var(--ci) 10%,transparent)}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-item{position:absolute;border:1px solid transparent;border-radius:4px;color:inherit}\nhtml body :is(#view,#view2Body) .rk-character-designer[data-edit=\"1\"] .cc-item{border:1px dashed color-mix(in srgb,var(--ci) 35%,transparent)}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-selected{border-color:currentColor!important;box-shadow:0 0 0 1px currentColor;z-index:500!important}\nhtml body :is(#view,#view2Body) .rk-character-designer[data-edit=\"0\"] .cc-framed{border:1px solid currentColor}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-content{height:100%;display:flex;flex-direction:column;gap:8px;padding:12px;overflow:auto;scrollbar-width:thin}\nhtml body :is(#view,#view2Body) .rk-character-designer :is(.cc-input,.cc-title,.cc-text){display:block;width:100%;min-width:0;margin:0!important;padding:3px 0!important;background:transparent!important;color:inherit!important;border:0!important;border-radius:0!important;box-shadow:none!important;font-family:inherit!important;font-size:inherit!important;line-height:1.4!important;resize:none;white-space:pre-wrap;overflow-wrap:anywhere}\nhtml body :is(#view,#view2Body) .rk-character-designer :is(input,textarea)::placeholder{color:var(--ci)!important;opacity:.45}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-title{font:1.25em/1.4 var(--hand)!important;flex:0 0 auto;min-height:32px}\nhtml body :is(#view,#view2Body) .rk-character-designer h3.cc-title{font-weight:400}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-text{font-family:var(--prose,var(--hand))!important;flex:1;min-height:0;overflow:auto}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-heading .cc-title{font-size:1.8em!important}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-rows{display:flex;flex-direction:column;gap:8px;overflow:auto;min-height:0;flex:1}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-row{display:flex;gap:10px;align-items:center;min-height:32px}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-row>.cc-input{flex:1;min-width:0}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-line{min-height:32px;border-bottom:1px solid currentColor!important}\nhtml body :is(#view,#view2Body) .rk-character-designer input[type=checkbox]{width:18px;height:18px;flex:0 0 18px;margin:0;opacity:1;accent-color:currentColor}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-item-tools{display:none;position:absolute;top:-35px;left:0;align-items:center;gap:1px;background:var(--cp);border:1px solid currentColor;border-radius:6px;z-index:20}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-selected>.cc-item-tools{display:flex}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-move{touch-action:none;cursor:grab}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-resize{position:absolute;right:-7px;bottom:-7px;width:15px;height:15px;padding:0!important;border:2px solid currentColor!important;border-radius:3px;background:var(--cp)!important;color:inherit;touch-action:none;cursor:nwse-resize;display:none}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-selected>.cc-resize{display:block}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-media{display:block;width:100%;height:100%;min-height:0;flex:1;object-fit:contain}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-empty{flex:1;display:flex;align-items:center;justify-content:center;border:1px dashed currentColor;min-height:40px;opacity:.55}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-scale{position:relative;min-height:24px;margin:16px 8px 8px}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-track{position:absolute;top:10px;left:0;right:0;height:2px;background:currentColor}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-track:before,html body :is(#view,#view2Body) .rk-character-designer .cc-track:after{content:'';position:absolute;top:-3px;width:8px;height:8px;background:currentColor;border-radius:50%}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-track:before{left:-2px}html body :is(#view,#view2Body) .rk-character-designer .cc-track:after{right:-2px}\nhtml body :is(#view,#view2Body) .rk-character-designer input[type=range]{display:block;position:relative;width:calc(100% + 16px);height:24px;margin:0 -8px;padding:0;background:transparent!important;accent-color:var(--ci)}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-range-dot{position:absolute;top:4px;width:14px;height:14px;transform:translateX(-50%);border:2px solid currentColor;border-radius:50%;background:var(--cp)}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-poles{display:flex;gap:15px;justify-content:space-between}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-poles>*{width:48%}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-poles>:last-child{text-align:right}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-segments{display:flex;flex:1;min-height:30px;max-height:70px;border:1.5px solid currentColor;border-radius:8px;overflow:hidden}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-cell{min-width:0;flex:1;margin:0;padding:0!important;border:0!important;border-right:1px solid currentColor!important;border-radius:0!important;color:inherit!important;background:transparent!important;cursor:pointer}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-cell:last-child{border-right:0!important}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-filled{background:currentColor!important}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-matrix{position:relative;flex:0 0 auto;align-self:center;border:1.5px solid currentColor;border-radius:3px 5px 3px 6px}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-plane{position:absolute;inset:34px 22px;touch-action:none}\nhtml body :is(#view,#view2Body) .rk-character-designer[data-edit=\"1\"] .cc-plane{cursor:crosshair}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-plane:before{content:'';position:absolute;top:50%;left:0;right:0;border-top:1.5px solid currentColor}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-plane:after{content:'';position:absolute;top:0;bottom:0;left:50%;border-left:1.5px solid currentColor}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-point{position:absolute;z-index:2;width:13px;height:13px;border:2px solid currentColor;border-radius:50%;background:var(--cp);transform:translate(-50%,-50%);pointer-events:none}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-axis{position:absolute!important;z-index:3;width:43%;max-height:30px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:.85em!important;padding:1px 3px!important;text-align:center}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-top{top:3px;left:28.5%}html body :is(#view,#view2Body) .rk-character-designer .cc-bottom{bottom:3px;left:28.5%}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-left{left:3px;top:calc(50% - 31px);text-align:left}html body :is(#view,#view2Body) .rk-character-designer .cc-right{right:3px;top:calc(50% - 31px);text-align:right}\nhtml body :is(#view,#view2Body) .rk-character-designer .cc-divider{width:100%;margin:auto 0;border-top:1px solid currentColor}\nhtml body #rkCharacterPaneMode{display:inline-flex;gap:2px;margin-left:auto;flex:0 0 auto}\nhtml body #rkCharacterPaneMode button{font:15px/1.4 var(--hand)!important;padding:4px 8px!important;border:1px solid var(--line);border-radius:12px;background:transparent;color:var(--rk-text,var(--text));cursor:pointer}\nhtml body #rkCharacterPaneMode button[aria-pressed=true]{outline:1px solid currentColor;outline-offset:-3px}\n";
 if(!document.getElementById('rk-character-designer-style')){const s=document.createElement('style');s.id='rk-character-designer-style';s.textContent=designerCSS;document.head.appendChild(s);}
 for(const v of [...RK_CHARACTER_VIEWS])if(!v.root.isConnected){v.dispose();RK_CHARACTER_VIEWS.delete(v);}
 const owner=wsUser(p),project=KEY,key=KEY+'|'+p.id,side=!!host.closest('#view2'),controller=new AbortController(),signal=controller.signal;
 const clone=x=>JSON.parse(JSON.stringify(x)),number=(x,d)=>Number.isFinite(Number(x))?Number(x):d,clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),uid=()=>wsId('ce');
 const types=[['media','Фото / видео / GIF'],['text','Поле с заголовком'],['lines','Строки для ввода'],['checklist','Чек-лист'],['range','Двусторонняя шкала'],['segments','Сегментная шкала'],['matrix','Координатный квадрат'],['heading','Заголовок'],['divider','Разделитель']];
 const root=document.createElement('section');root.className='rk-character-designer';root.dataset[isLocation?'location':'character']=p.id;root.setAttribute('aria-label',isLocation?'Конструктор локации':'Конструктор персонажа');host.replaceChildren(root);
 function initial(){
  if(data[canvasKey])return data[canvasKey].version===1&&Array.isArray(data[canvasKey].items)?clone(data[canvasKey]):null;
  const m={version:1,width:1000,grid:true,introDismissed:false,items:[]},labels=isLocation?{name:'Название места',type:'Тип места',where:'Где находится',description:'Описание',atmosphere:'Атмосфера',story:'Значение для истории',notes:'Заметки'}:{name:'Имя',age:'Возраст',role:'Роль в истории',appearance:'Внешность',personality:'Характер',motivation:'Желания и мотивация',conflict:'Внутренний конфликт',relations:'Связи с другими персонажами',notes:'Заметки'};
  if(data.image&&wsTimelineMediaSafe({kind:'image',src:data.image}))m.items.push({id:'legacy-image',type:'media',title:'',media:{kind:'image',src:data.image,name:''},fit:'contain'});
  Object.entries(data).forEach(([k,v])=>{if(k!=='image'&&typeof v==='string'&&v.trim())m.items.push({id:'legacy-'+k,type:'text',title:labels[k]||k,text:v});});
  m.items.forEach((it,i)=>Object.assign(it,{x:40+i%2*480,y:40+Math.floor(i/2)*380,w:440,h:340,font:18,border:false}));m.introDismissed=!!m.items.length;return m;
 }
 function normalize(it){it.id=typeof it.id==='string'?it.id:uid();it.w=clamp(number(it.w,440),it.type==='matrix'?240:160,960);it.h=clamp(number(it.h,240),it.type==='matrix'?240:80,4000);it.x=clamp(number(it.x,40),0,1000-it.w);it.y=clamp(number(it.y,40),0,200000);it.font=clamp(number(it.font,18),12,48);return it;}
 let model=initial();if(!model){root.textContent='Не удалось открыть формат страницы. Исходные данные сохранены без изменения.';return;}
 model.items=model.items.filter(x=>x&&typeof x==='object');model.items.forEach(normalize);model.grid=model.grid!==false;
 let selected=null,session=null,scale=1,cancelDrag=null;
 if(!RK_CHARACTER_HISTORY.has(key))RK_CHARACTER_HISTORY.set(key,{undo:[],redo:[]});const history=RK_CHARACTER_HISTORY.get(key);
 const editable=()=>root.isConnected&&KEY===project&&wsUser(p)===owner&&!tabReadOnly&&(side?RK_CHARACTER_PANE_MODES.get(key)==='edit':mode==='edit');
 const icons={plus:'<path d="M12 5v14M5 12h14"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',move:'<path d="M12 3v18M3 12h18m-12-6 3-3 3 3m-6 12 3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3"/>',copy:'<rect x="8" y="8" width="12" height="12" rx="1"/><path d="M16 8V4H4v12h4"/>',trash:'<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',settings:'<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',undo:'<path d="m8 5-4 4 4 4M4 9h9a6 6 0 0 1 0 12h-3"/>',redo:'<path d="m16 5 4 4-4 4m4-4h-9a6 6 0 0 0 0 12h3"/>',grid:'<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>',up:'<path d="m6 11 6-6 6 6M12 5v15"/>',down:'<path d="m6 13 6 6 6-6M12 4v15"/>'};
 function icon(name,label,fn){const b=document.createElement('button');b.type='button';b.className='cc-icon';b.title=label;b.setAttribute('aria-label',label);b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+icons[name]+'</svg>';if(fn)b.onclick=fn;return b;}
 function checkpoint(group){if(group&&group===session)return;const last=history.undo[history.undo.length-1];if(!last||JSON.stringify(last)!==JSON.stringify(model))history.undo.push(clone(model));while(history.undo.length>25)history.undo.shift();history.redo=[];session=group||null;}
 function buttons(){undo.disabled=!history.undo.length;redo.disabled=!history.redo.length;}
 function commit(redraw){
  if(!editable()||!wsWritable())return false;const prev=data[canvasKey];data[canvasKey]=clone(model);
  if(!wsCommit()){if(prev===undefined)delete data[canvasKey];else data[canvasKey]=prev;save();flush();model=initial();draw();toast('Изменение не сохранено: хранилище недоступно или заполнено. Для большого медиа используй прямую ссылку.');return false;}
  for(const v of [...RK_CHARACTER_VIEWS]){if(!v.root.isConnected){v.dispose();RK_CHARACTER_VIEWS.delete(v);}else if(v.key===key&&v.root!==root)v.receive(model);}buttons();if(redraw)draw();return true;
 }
 function change(fn,redraw,group){if(!editable())return;checkpoint(group);fn();commit(redraw);}
 function travel(forward){if(!editable())return;const from=forward?history.redo:history.undo,to=forward?history.undo:history.redo;if(!from.length)return;to.push(clone(model));model=clone(from.pop());session=null;selected=null;commit(true);}
 const tools=document.createElement('div');tools.className='cc-tools';
 const addButton=icon('plus','Добавить элемент',()=>{menu.hidden=!menu.hidden;hint.hidden=true;addButton.setAttribute('aria-expanded',String(!menu.hidden));if(!menu.hidden)menu.querySelector('button')?.focus();});addButton.setAttribute('aria-expanded','false');
 const undo=icon('undo','Отменить',()=>travel(false)),redo=icon('redo','Повторить',()=>travel(true)),grid=icon('grid','Привязка к сетке',()=>change(()=>model.grid=!model.grid,true));
 const menu=document.createElement('div');menu.className='cc-menu';menu.hidden=true;menu.setAttribute('role','group');menu.setAttribute('aria-label','Добавить элемент');
 types.forEach(([t,label])=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.addType=t;b.onclick=()=>add(t);menu.appendChild(b);});
 const hint=document.createElement('div');hint.className='cc-hint';const text=document.createElement('span');text.textContent='Добавить нужные блоки';hint.append(text,icon('close','Закрыть подсказку',()=>change(()=>model.introDismissed=true,true)));
 tools.append(addButton,undo,redo,grid,menu,hint);const sizer=document.createElement('div');sizer.className='cc-sizer';const stage=document.createElement('div');stage.className='cc-stage';stage.setAttribute('aria-label',isLocation?'Страница локации':'Страница персонажа');sizer.appendChild(stage);root.append(tools,sizer);
 function fit(){scale=Math.min(1,(sizer.clientWidth||host.clientWidth||1000)/1000);const height=Math.max(680,...model.items.map(it=>it.y+it.h+60));stage.style.height=height+'px';stage.style.transform='scale('+scale+')';sizer.style.height=Math.ceil(height*scale)+'px';}
 const observer=new ResizeObserver(fit);observer.observe(sizer);
 function pick(id){selected=id;stage.querySelectorAll('.cc-item').forEach(n=>n.classList.toggle('cc-selected',n.dataset.element===id));}
 function add(type){if(!editable())return;checkpoint();const it={id:uid(),type,x:40,y:model.items.length?Math.max(...model.items.map(x=>x.y+x.h))+40:40,w:440,h:240,font:18,title:'',text:'',border:false};
  if(type==='media'){it.h=340;it.fit='contain';}if(type==='matrix'){it.w=380;it.h=440;it.point=null;it.left='';it.right='';it.top='';it.bottom='';}if(type==='range'){it.h=170;it.value=null;it.left='';it.right='';}if(type==='segments'){it.h=150;it.value=0;it.count=10;}if(type==='lines'||type==='checklist')it.rows=[{id:uid(),text:'',checked:false}];if(type==='heading')it.h=100;if(type==='divider')it.h=80;
  model.items.push(it);model.introDismissed=true;selected=it.id;menu.hidden=true;addButton.setAttribute('aria-expanded','false');if(commit(true))stage.querySelector('[data-element="'+CSS.escape(it.id)+'"]')?.scrollIntoView({block:'nearest'});
 }
 function remove(it){change(()=>{model.items=model.items.filter(x=>x.id!==it.id);selected=null;},true);}
 function duplicate(it){change(()=>{const cp=clone(it);cp.id=uid();cp.x=clamp(it.x+20,0,1000-it.w);cp.y=it.y+20;if(cp.rows)cp.rows.forEach(r=>r.id=uid());model.items.push(cp);selected=cp.id;},true);}
 function layer(it,front){change(()=>{model.items.splice(model.items.indexOf(it),1);if(front)model.items.push(it);else model.items.unshift(it);},true);}
 function settings(it){if(!editable())return;
  const extra=it.type==='segments'?'<div class="field"><label>Количество делений</label><input type="number" data-cc="count" min="2" max="30" value="'+clamp(number(it.count,10),2,30)+'"></div>':it.type==='media'?'<div class="field"><label>Отображение</label><select data-cc="fit"><option value="contain"'+(it.fit!=='cover'?' selected':'')+'>Целиком</option><option value="cover"'+(it.fit==='cover'?' selected':'')+'>Заполнить рамку</option></select></div>':'';
  dlg('Настройки элемента','<div class="field"><label>Ширина / высота</label><div class="row-btns"><input type="number" data-cc="w" value="'+it.w+'" min="160" max="960" aria-label="Ширина"><input type="number" data-cc="h" value="'+it.h+'" min="80" max="4000" aria-label="Высота"></div></div><div class="field"><label>Размер текста</label><input type="number" data-cc="font" min="12" max="48" value="'+it.font+'"></div><div class="field"><label>Выравнивание</label><select data-cc="align">'+[['left','Слева'],['center','По центру'],['right','Справа']].map(([v,t])=>'<option value="'+v+'"'+((it.align||'left')===v?' selected':'')+'>'+t+'</option>').join('')+'</select></div><label><input type="checkbox" data-cc="border"'+(it.border?' checked':'')+'> Показывать рамку в чтении</label>'+extra,m=>{if(!editable())return false;const found=model.items.find(x=>x.id===it.id);if(!found)return false;it=found;checkpoint();for(const k of ['w','h','font','count']){const input=m.querySelector('[data-cc='+k+']');if(input)it[k]=number(input.value,it[k]);}it.align=m.querySelector('[data-cc=align]').value;it.border=m.querySelector('[data-cc=border]').checked;const fit=m.querySelector('[data-cc=fit]');if(fit)it.fit=fit.value;if(it.type==='segments'){it.count=clamp(Math.round(it.count),2,30);it.value=clamp(number(it.value,0),0,it.count);}normalize(it);return commit(true);});
 }
 function geometry(n,it){n.style.left=it.x+'px';n.style.top=it.y+'px';n.style.width=it.w+'px';n.style.height=it.h+'px';const bar=n.querySelector('.cc-item-tools');if(bar){bar.style.left=it.x>500?'auto':'0';bar.style.right=it.x>500?'0':'auto';}const square=n.querySelector('.cc-matrix');if(square){const size=Math.max(50,Math.min(it.w-26,it.h-72));square.style.width=size+'px';square.style.height=size+'px';}}
 function drag(e,it,node,resizing){if(!editable()||e.button!==0||e.isPrimary===false)return;e.preventDefault();e.stopPropagation();pick(it.id);const before=clone(model),old=clone(it),length=history.undo.length;checkpoint();const ac=new AbortController(),sig=ac.signal,rect=stage.getBoundingClientRect(),sx=(e.clientX-rect.left)/scale,sy=(e.clientY-rect.top)/scale;let changed=false;
  const snap=(v,ev)=>model.grid&&!ev.altKey?Math.round(v/20)*20:v;
  function move(ev){if(!editable()){cancel();return;}const r=stage.getBoundingClientRect(),dx=(ev.clientX-r.left)/scale-sx,dy=(ev.clientY-r.top)/scale-sy;if(resizing){it.w=clamp(snap(old.w+dx,ev),it.type==='matrix'?240:160,1000-it.x);it.h=clamp(snap(old.h+dy,ev),it.type==='matrix'?240:80,4000);}else{it.x=clamp(snap(old.x+dx,ev),0,1000-it.w);it.y=clamp(snap(old.y+dy,ev),0,200000);}changed=true;geometry(node,it);fit();}
  function end(){ac.abort();cancelDrag=null;if(changed)commit(false);else{history.undo.splice(length);buttons();}}
  function cancel(){ac.abort();cancelDrag=null;model=before;history.undo.splice(length);draw();}cancelDrag=cancel;
  window.addEventListener('pointermove',move,{signal:sig});window.addEventListener('pointerup',end,{once:true,signal:sig});window.addEventListener('pointercancel',cancel,{once:true,signal:sig});window.addEventListener('keydown',ev=>{if(ev.key==='Escape'){ev.preventDefault();cancel();}},{signal:sig});signal.addEventListener('abort',()=>ac.abort(),{once:true});
 }
 function field(it,k,placeholder,classes,multiline,parent){const input=editable(),n=document.createElement(input?(multiline?'textarea':'input'):(k==='title'?'h3':'div'));n.className=classes||'cc-input';if(input){if(!multiline)n.type='text';n.value=typeof it[k]==='string'?it[k]:'';n.placeholder=placeholder;n.setAttribute('aria-label',placeholder);n.dataset.ccField=k;n.oninput=()=>change(()=>it[k]=n.value,false,it.id+':'+k);n.onblur=()=>{session=null;};}else{n.textContent=typeof it[k]==='string'?it[k]:'';if(k==='title'&&!n.textContent)n.hidden=true;}parent.appendChild(n);return n;}
 function mediaDialog(it){if(!editable())return;let active=true,busy=false;
  const modal=dlg('Фото / видео / GIF','<div class="field"><label>Файл с компьютера</label><input type="file" data-cc-file accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/ogg"><span class="muted small">Фото оптимизируются, GIF сохраняет анимацию. Большое видео может не поместиться в хранилище браузера.</span></div><div class="field"><label>Или прямая ссылка на файл</label><input type="url" data-cc-url placeholder="https://…" autocomplete="off"></div><div class="field"><label>Тип файла по ссылке</label><select data-cc-kind><option value="image">Фото / GIF</option><option value="video">Видео</option></select></div><p data-cc-status role="status"></p>',m=>{if(busy||!editable())return false;const current=model.items.find(x=>x.id===it.id);if(!current)return false;it=current;const media={kind:m.querySelector('[data-cc-kind]').value,src:m.querySelector('[data-cc-url]').value.trim(),name:''};if(!wsTimelineMediaSafe(media)){m.querySelector('[data-cc-status]').textContent='Нужна прямая ссылка http или https на файл.';return false;}checkpoint();it.media=media;return commit(true);},'Добавить ссылку');
  modal.addEventListener('click',e=>{if(e.target===modal||e.target.closest('[data-close]'))active=false;},{signal});const input=modal.querySelector('[data-cc-file]'),status=modal.querySelector('[data-cc-status]'),ok=modal.querySelector('#spOk');
  input.onchange=async()=>{const f=input.files[0];if(!f||!editable())return;const ext=f.name.split('.').pop().toLowerCase(),mime={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',mp4:'video/mp4',webm:'video/webm',ogg:'video/ogg',ogv:'video/ogg'}[ext];if(!mime||f.size>25*1024*1024){status.textContent='Поддерживаются JPG, PNG, WebP, GIF, MP4, WebM и Ogg до 25 МБ. Для большого файла используй прямую ссылку.';return;}busy=true;input.disabled=true;ok.disabled=true;status.textContent='Подготовка файла…';
   try{let src=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(Error('Не удалось прочитать файл'));r.readAsDataURL(new Blob([f],{type:mime}));});
    if(mime.startsWith('image/')&&mime!=='image/gif')src=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{try{const factor=Math.min(1,1600/Math.max(im.naturalWidth,im.naturalHeight)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(im.naturalWidth*factor));c.height=Math.max(1,Math.round(im.naturalHeight*factor));c.getContext('2d').drawImage(im,0,0,c.width,c.height);resolve(c.toDataURL('image/webp',.85));}catch(e){reject(e);}};im.onerror=()=>reject(Error('Не удалось открыть фото'));im.src=src;});
    if(!active||modal.hidden||!editable())return;const current=model.items.find(x=>x.id===it.id);if(!current){status.textContent='Элемент уже удалён.';return;}it=current;const media={kind:mime.startsWith('video/')?'video':'image',src,name:f.name};if(!wsTimelineMediaSafe(media))throw Error('Неподдерживаемый файл');checkpoint();it.media=media;if(commit(true))modal.hidden=true;else status.textContent='Файл не сохранён. Используй файл меньшего размера или прямую ссылку.';
   }catch(e){status.textContent=e.message||'Не удалось добавить файл';}finally{busy=false;input.disabled=false;ok.disabled=false;input.value='';}
  };
 }
 function point(it,matrix){const plane=document.createElement('div');plane.className='cc-plane';plane.setAttribute('role','img');plane.setAttribute('aria-label','Положение точки по двум осям');if(editable())plane.tabIndex=0;const dot=document.createElement('span');dot.className='cc-point';plane.appendChild(dot);matrix.appendChild(plane);
  function update(){dot.hidden=!it.point;if(it.point){dot.style.left=clamp(number(it.point.x,.5),0,1)*100+'%';dot.style.top=clamp(number(it.point.y,.5),0,1)*100+'%';plane.setAttribute('aria-label','Точка: X '+Math.round(it.point.x*100)+', Y '+Math.round((1-it.point.y)*100));}}update();
  if(editable()){plane.onpointerdown=e=>{if(e.button!==0||e.isPrimary===false)return;e.preventDefault();e.stopPropagation();pick(it.id);const old=clone(it.point),length=history.undo.length;checkpoint();const ac=new AbortController(),sig=ac.signal;
   const move=ev=>{if(!editable())return;const r=plane.getBoundingClientRect();it.point={x:clamp((ev.clientX-r.left)/r.width,0,1),y:clamp((ev.clientY-r.top)/r.height,0,1)};update();};move(e);
   function end(){ac.abort();cancelDrag=null;commit(false);}function cancel(){ac.abort();cancelDrag=null;it.point=old;history.undo.splice(length);update();buttons();}cancelDrag=cancel;
   window.addEventListener('pointermove',move,{signal:sig});window.addEventListener('pointerup',end,{once:true,signal:sig});window.addEventListener('pointercancel',cancel,{once:true,signal:sig});window.addEventListener('keydown',ev=>{if(ev.key==='Escape'){ev.preventDefault();cancel();}},{signal:sig});signal.addEventListener('abort',()=>ac.abort(),{once:true});
  };plane.onkeydown=e=>{const d={ArrowLeft:[-.01,0],ArrowRight:[.01,0],ArrowUp:[0,-.01],ArrowDown:[0,.01]}[e.key];if(d){e.preventDefault();e.stopPropagation();change(()=>{const prev=it.point||{x:.5,y:.5},m=e.shiftKey?10:1;it.point={x:clamp(prev.x+d[0]*m,0,1),y:clamp(prev.y+d[1]*m,0,1)};update();},false,'point:'+it.id);}};}
 }
 function render(it,index){const n=document.createElement('article');n.className='cc-item'+(it.border?' cc-framed':'')+(it.type==='heading'?' cc-heading':'');n.dataset.element=it.id;n.style.fontSize=it.font+'px';n.style.textAlign=['left','center','right'].includes(it.align)?it.align:'left';n.style.zIndex=String(index+1);n.classList.toggle('cc-selected',editable()&&selected===it.id);const content=document.createElement('div');content.className='cc-content';n.appendChild(content);
  if(editable()){const bar=document.createElement('div');bar.className='cc-item-tools';const move=icon('move','Переместить элемент');move.classList.add('cc-move');move.onpointerdown=e=>drag(e,it,n,false);bar.append(move,icon('settings','Настройки элемента',()=>settings(it)),icon('copy','Дублировать элемент',()=>duplicate(it)),icon('up','На передний план',()=>layer(it,true)),icon('down','На задний план',()=>layer(it,false)),icon('trash','Удалить элемент',()=>remove(it)));n.appendChild(bar);const resize=document.createElement('button');resize.type='button';resize.className='cc-resize';resize.setAttribute('aria-label','Изменить размер элемента');resize.title='Изменить размер';resize.onpointerdown=e=>drag(e,it,n,true);n.appendChild(resize);n.onpointerdown=e=>{if(!e.target.closest('.cc-item-tools,.cc-resize'))pick(it.id);};}
  field(it,'title','Заголовок','cc-title',false,content);
  if(it.type==='text')field(it,'text','Текст','cc-text',true,content);
  if(it.type==='lines'||it.type==='checklist'){if(!Array.isArray(it.rows))it.rows=[];const rows=document.createElement('div');rows.className='cc-rows';content.appendChild(rows);it.rows.forEach((r,i)=>{const row=document.createElement('div');row.className='cc-row';if(it.type==='checklist'){const c=document.createElement('input');c.type='checkbox';c.checked=!!r.checked;c.disabled=!editable();c.setAttribute('aria-label',r.text||'Пункт '+(i+1));c.onchange=()=>change(()=>r.checked=c.checked,false);row.appendChild(c);}field(r,'text',it.type==='lines'?'Строка':'Пункт','cc-input'+(it.type==='lines'?' cc-line':''),false,row);if(editable())row.appendChild(icon('close','Удалить строку',()=>change(()=>it.rows.splice(i,1),true)));rows.appendChild(row);});if(editable())content.appendChild(icon('plus','Добавить строку',()=>change(()=>it.rows.push({id:uid(),text:'',checked:false}),true)));}
  if(it.type==='media'){if(it.media&&wsTimelineMediaSafe(it.media)){const media=document.createElement(it.media.kind==='video'?'video':'img');media.className='cc-media';media.src=it.media.src;media.draggable=false;media.style.objectFit=it.fit==='cover'?'cover':'contain';if(it.media.kind==='video'){media.controls=true;media.playsInline=true;media.preload='metadata';}else{media.alt=it.title||it.media.name||(isLocation?'Изображение локации':'Изображение персонажа');media.loading='lazy';}content.appendChild(media);}else if(editable()){const e=document.createElement('div');e.className='cc-empty';e.textContent='Фото / видео / GIF';content.appendChild(e);}if(editable())content.appendChild(icon('plus',it.media?'Заменить медиа':'Добавить медиа',()=>mediaDialog(it)));}
  if(it.type==='range'){const box=document.createElement('div');box.className='cc-scale';const track=document.createElement('div');track.className='cc-track';box.appendChild(track);if(editable()){const input=document.createElement('input');input.type='range';input.min='0';input.max='100';input.step='1';input.value=String(it.value==null?50:clamp(number(it.value,50),0,100));input.setAttribute('aria-label',it.title||'Значение шкалы');input.oninput=()=>change(()=>it.value=Number(input.value),false,'range:'+it.id);input.onblur=()=>{session=null;};box.appendChild(input);}else if(it.value!=null){const dot=document.createElement('span');dot.className='cc-range-dot';dot.style.left=clamp(number(it.value,50),0,100)+'%';box.appendChild(dot);box.setAttribute('role','img');box.setAttribute('aria-label',(it.title||'Шкала')+': '+it.value+' из 100');}content.appendChild(box);const poles=document.createElement('div');poles.className='cc-poles';field(it,'left','Левая подпись','cc-input',false,poles);field(it,'right','Правая подпись','cc-input',false,poles);content.appendChild(poles);}
  if(it.type==='segments'){const bar=document.createElement('div');bar.className='cc-segments';const count=clamp(Math.round(number(it.count,10)),2,30),value=clamp(number(it.value,0),0,count);bar.setAttribute('aria-label',(it.title||'Шкала')+': '+value+' из '+count);for(let i=0;i<count;i++){const cell=document.createElement(editable()?'button':'span');cell.className='cc-cell'+(i<value?' cc-filled':'');if(editable()){cell.type='button';cell.setAttribute('aria-label','Значение '+(i+1)+' из '+count);cell.onclick=()=>change(()=>it.value=it.value===i+1?0:i+1,true);}bar.appendChild(cell);}content.appendChild(bar);}
  if(it.type==='matrix'){const square=document.createElement('div');square.className='cc-matrix';for(const k of ['top','left','right','bottom']){const f=field(it,k,({top:'Верхняя подпись',bottom:'Нижняя подпись',left:'Левая подпись',right:'Правая подпись'})[k],'cc-input cc-axis cc-'+k,false,square);f.maxLength=60;}point(it,square);content.appendChild(square);}
  if(it.type==='divider'){const line=document.createElement('div');line.className='cc-divider';content.appendChild(line);}geometry(n,it);return n;
 }
 function draw(){root.dataset.edit=editable()?'1':'0';tools.hidden=!editable();const has=!!model.items.length;undo.hidden=!has&&!history.undo.length;redo.hidden=!has&&!history.redo.length;grid.hidden=!has;grid.setAttribute('aria-pressed',String(model.grid));hint.hidden=true;stage.replaceChildren();model.items.forEach((it,i)=>stage.appendChild(render(it,i)));fit();buttons();}
 root.addEventListener('pointerdown',e=>{if(e.target===stage||e.target===sizer)pick(null);},{signal});
 root.addEventListener('keydown',e=>{if(!editable())return;if(e.key==='Escape'){if(cancelDrag){cancelDrag();e.preventDefault();}menu.hidden=true;addButton.setAttribute('aria-expanded','false');return;}const typing=e.target.closest('input,textarea,[contenteditable=true]');if(!typing&&(e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())){e.preventDefault();e.stopPropagation();travel(e.key.toLowerCase()==='y'||e.shiftKey);}else if(!typing&&selected&&['Delete','Backspace'].includes(e.key)){e.preventDefault();e.stopPropagation();const it=model.items.find(x=>x.id===selected);if(it)remove(it);}},{signal});
 document.addEventListener('pointerdown',e=>{if(!root.contains(e.target)){menu.hidden=true;addButton.setAttribute('aria-expanded','false');}},{signal});
 if(side){document.getElementById('rkCharacterPaneMode')?.remove();const modes=document.createElement('div');modes.id='rkCharacterPaneMode';modes.setAttribute('role','group');modes.setAttribute('aria-label',isLocation?'Режим локации справа':'Режим персонажа справа');for(const [value,label] of [['read','Чтение'],['edit','Правка']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-pressed',String((tabReadOnly?'read':RK_CHARACTER_PANE_MODES.get(key)||'read')===value));if(value==='edit')b.disabled=tabReadOnly;b.onclick=()=>{if(value==='edit'&&!wsWritable())return;RK_CHARACTER_PANE_MODES.set(key,value);renderPane();};modes.appendChild(b);}const anchor=document.getElementById('rkPaneFieldColorToolbar')||document.getElementById('view2Min');anchor?.before(modes);}
 const entry={root,key,receive(value){model=clone(value);session=null;selected=model.items.some(x=>x.id===selected)?selected:null;draw();},refresh(){draw();if(side)document.querySelectorAll('#rkCharacterPaneMode button').forEach((b,i)=>{b.setAttribute('aria-pressed',String((tabReadOnly?'read':RK_CHARACTER_PANE_MODES.get(key)||'read')===(i?'edit':'read')));if(i)b.disabled=tabReadOnly;});},dispose(){observer.disconnect();controller.abort();}};RK_CHARACTER_VIEWS.add(entry);draw();
}

function wsRenderBlock(p){
 wsPrepare(p);const u=wsUser(p);if(!u)return;const type=wsType(p),data=u.blockData||(u.blockData={});
 const v=$('#view');v.className='view ws-detail';
 v.innerHTML='<div class="page-head">'+wsCrumbs(p)+'<h1>'+esc(p.title)+'</h1></div><div class="ws-content"></div>';
 if(!['character','location'].includes(type)||mode==='edit')wsBindRename(v.querySelector('.page-head h1'),p);const host=v.querySelector('.ws-content');
 if(type==='folder'){host.innerHTML=wsListing(p.id);host.querySelector('[data-ws-add]').onclick=()=>wsCreate(p.id);}
 if(type==='character')rkCharacterDesigner(host,p,data);
 if(type==='location')rkCharacterDesigner(host,p,data);
 if(type==='timeline')wsTimeline(host,p,data);
 if(type==='map')wsMapBoard(host,p,data);
 if(type==='board')wsBoard(host,p,data);
 if(tabReadOnly)host.querySelectorAll('input,textarea,button,select').forEach(el=>el.disabled=true);
 rkFieldColor(p,v);
 window.scrollTo(0,0);
}
function wsFields(host,p,data,fields,image){
 host.innerHTML=(image?wsImageHTML(data):'')+'<div class="ws-fields">'+fields.map((f,i)=>'<div class="field"><label for="ws-f-'+f[0]+'">'+f[1]+'</label>'+(i<3?'<input id="ws-f-'+f[0]+'" data-field="'+f[0]+'" value="'+esc(data[f[0]]||'')+'">':'<textarea id="ws-f-'+f[0]+'" data-field="'+f[0]+'" rows="4">'+esc(data[f[0]]||'')+'</textarea>')+'</div>').join('')+'</div>';
 host.querySelectorAll('[data-field]').forEach(el=>el.oninput=()=>{if(!wsWritable())return;data[el.dataset.field]=el.value;save();});if(image)wsBindImage(host,p,data);
}
function wsImageHTML(data){
 const safe=data.image&&/^data:image\/(jpeg|png|webp);base64,/.test(data.image);
 return '<div class="ws-block-image">'+(safe?'<img src="'+esc(data.image)+'" alt="Изображение блока">':'')+'<div class="ws-toolbar"><button class="btn" data-image>'+(safe?'Заменить изображение':'Загрузить изображение')+'</button>'+(safe?'<button class="btn" data-image-remove>Убрать</button>':'')+'</div></div>';
}
function wsBindImage(host,p,data){
 const b=host.querySelector('[data-image]');if(b)b.onclick=()=>wsUploadImage(value=>{const old=data.image;data.image=value;if(!wsCommit()){data.image=old;save();toast('Изображение не сохранено: недостаточно места или хранилище недоступно');} wsRenderBlock(p);});
 const r=host.querySelector('[data-image-remove]');if(r)r.onclick=()=>{if(!wsWritable())return;data.image='';wsCommit();wsRenderBlock(p);};
}
function wsUploadImage(done){
 if(!wsWritable())return; const input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';
 input.onchange=async()=>{
  const f=input.files&&input.files[0];if(!f)return;
  if(!['image/png','image/jpeg','image/webp'].includes(f.type)){toast('Выбери PNG, JPG или WebP');return;}
  if(f.size>25*1024*1024){toast('Выбери изображение размером до 25 МБ');return;}
  try{
   const url=URL.createObjectURL(f);const img=new Image();
   try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});
    const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
    const ctx=canvas.getContext('2d');ctx.fillStyle='#eee5cf';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
    if(wsWritable())done(canvas.toDataURL('image/jpeg',.82));
   }finally{URL.revokeObjectURL(url);}
  }catch(e){toast('Не удалось загрузить изображение');}
 };input.click();
}

/* Timeline media v1: attachments remain inside the project data. */
function wsTimelineMediaSafe(m){
 if(!m||!['image','video'].includes(m.kind)||typeof m.src!=='string')return false;
 if(/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/.test(m.src))return m.kind==='image';
 if(/^data:video\/(mp4|webm|ogg);base64,[A-Za-z0-9+/=\s]+$/.test(m.src))return m.kind==='video';
 try{const url=new URL(m.src);return url.protocol==='https:'||url.protocol==='http:';}catch(e){return false;}
}
function wsTimelineMediaHTML(event){
 const list=Array.isArray(event.media)?event.media.filter(wsTimelineMediaSafe):[];
 if(!list.length)return '';
 return '<div class="rk-timeline-media">'+list.map(m=>'<figure class="rk-timeline-attachment">'+(m.kind==='video'?'<video controls playsinline preload="metadata" draggable="false" src="'+esc(m.src)+'" aria-label="'+esc(m.name||'Видео события')+'"></video>':'<img loading="lazy" draggable="false" src="'+esc(m.src)+'" alt="'+esc(m.name||'Изображение события')+'">')+'</figure>').join('')+'</div>';
}
function wsTimelineDraftUI(modal,draft){
 const host=modal.querySelector('[data-event-media]'),status=host.querySelector('[data-media-status]'),preview=host.querySelector('[data-media-preview]'),file=host.querySelector('input[type=file]'),ok=modal.querySelector('#spOk');let busy=false,active=true;
 const state={get busy(){return busy;},get active(){return active;},close(){active=false;}};
 function message(t){status.textContent=t||'';}
 function redraw(){preview.replaceChildren();draft.forEach((m,index)=>{const figure=document.createElement('figure');figure.className='rk-timeline-attachment';
  const media=document.createElement(m.kind==='video'?'video':'img');media.src=m.src;media.draggable=false;if(m.kind==='video'){media.controls=true;media.playsInline=true;media.preload='metadata';}else media.alt=m.name||'Изображение';
  const caption=document.createElement('figcaption');caption.textContent=m.name||'Вложение';const remove=document.createElement('button');remove.type='button';remove.className='link-btn';remove.textContent='Удалить вложение';remove.onclick=()=>{if(!wsWritable()||busy)return;draft.splice(index,1);message('');redraw();};figure.append(media,caption,remove);preview.appendChild(figure);
 });}
 function setBusy(on){busy=on;file.disabled=on;host.querySelector('[data-add-media-url]').disabled=on;if(ok)ok.disabled=on;}
 const read=f=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(Error('Не удалось прочитать «'+f.name+'»'));r.readAsDataURL(f);});
 const photo=src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL('image/webp',.85));};img.onerror=()=>reject(Error('Не удалось открыть фотографию'));img.src=src;});
 host.querySelector('[data-add-media-file]').onclick=()=>{if(wsWritable()&&!busy)file.click();};
 file.onchange=async()=>{if(!wsWritable()||busy)return;const files=[...file.files];file.value='';if(!files.length)return;setBusy(true);message('Подготовка файлов…');const added=[];try{
  for(const f of files){if(!active||modal.hidden||!modal.contains(host))return;if(draft.length+added.length>=12)throw Error('В одном событии можно добавить до 12 вложений');
   const ext=f.name.split('.').pop().toLowerCase(),mime=f.type||({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',mp4:'video/mp4',webm:'video/webm',ogv:'video/ogg'}[ext]||'');
   if(!/^image\/(jpeg|png|webp|gif)$|^video\/(mp4|webm|ogg)$/.test(mime))throw Error('Поддерживаются JPG, PNG, WebP, GIF, MP4, WebM и OGV');
   if(f.size>20*1024*1024)throw Error('«'+f.name+'» больше 20 МБ. Для большого файла используй прямую ссылку');
   let src=await read(f);src=src.replace(/^data:[^;,]*/, 'data:'+mime);if(mime.startsWith('image/')&&mime!=='image/gif')src=await photo(src);
   const item={id:wsId('media'),kind:mime.startsWith('video/')?'video':'image',name:f.name,src};if(!wsTimelineMediaSafe(item))throw Error('Файл «'+f.name+'» не удалось подготовить');added.push(item);
  }
  if(!active||modal.hidden||!modal.contains(host))return;draft.push(...added);message('Файлы добавлены. Нажми «Сохранить», чтобы сохранить событие.');redraw();
 }catch(e){if(active)message(e.message||'Не удалось добавить файлы');}finally{if(active&&modal.contains(host))setBusy(false);}};
 host.querySelector('[data-add-media-url]').onclick=()=>{if(!wsWritable()||busy)return;const input=host.querySelector('[data-media-url]'),value=input.value.trim(),kind=host.querySelector('[data-media-kind]').value;if(draft.length>=12){message('В одном событии можно добавить до 12 вложений');return;}const item={id:wsId('media'),kind,name:kind==='video'?'Видео по ссылке':'Изображение по ссылке',src:value};if(!value||!wsTimelineMediaSafe(item)||value.startsWith('data:')){message('Вставь прямую ссылку http:// или https:// на изображение, GIF или видеофайл');return;}draft.push(item);input.value='';message('Ссылка добавлена. Нужна ссылка на сам файл, а не на страницу видеосервиса.');redraw();};
 modal.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>state.close(),{once:true}));modal.addEventListener('click',e=>{if(e.target===modal)state.close();},{once:true});
 redraw();return state;
}
function wsTimeline(host,p,data){
 const events=data.events||(data.events=[]),horizontal=data.orientation==='horizontal';
 host.innerHTML='<div class="ws-toolbar ws-line-tools"><button class="btn primary" data-event-add>+ Добавить событие</button><div class="ws-line-format" role="group" aria-label="Формат временной линии">'+['vertical','horizontal'].map(f=>'<button class="btn'+((f==='horizontal')===horizontal?' primary':'')+'" data-line-format="'+f+'" aria-pressed="'+((f==='horizontal')===horizontal)+'">'+(f==='vertical'?'Вертикальный':'Горизонтальный')+'</button>').join('')+'</div></div><div class="ws-line-scroll" tabindex="0" aria-label="Временная линия"><ol class="ws-events'+(horizontal?' ws-events-horizontal':' ws-events-vertical')+'">'+events.map(e=>'<li data-event-id="'+esc(e.id)+'" draggable="'+(!tabReadOnly)+'"><div class="ws-event-top"><div class="ws-event-date">'+esc((e.date||'Без даты')+(e.date2?' — '+e.date2:''))+'</div><button class="ws-drag-handle" title="Перетащить событие. С клавиатуры: Alt и стрелки" aria-label="Переместить событие «'+esc(e.title)+'»">⋮⋮</button></div><h3>'+esc(e.title)+'</h3><p>'+esc(e.note||'')+'</p>'+wsTimelineMediaHTML(e)+'<div class="ws-toolbar"><button class="link-btn" data-event-edit="'+esc(e.id)+'">Изменить</button><button class="link-btn" data-event-delete="'+esc(e.id)+'">Удалить</button></div></li>').join('')+'</ol></div>'+'<span class="ws-sr-only" role="status" aria-live="polite" data-line-status></span>';
 const scroller=host.querySelector('.ws-line-scroll');
 function redraw(scroll){wsRenderBlock(p);host=document.querySelector('#view .ws-content');const el=host&&host.querySelector('.ws-line-scroll');if(el)el.scrollLeft=scroll||0;}
 host.querySelectorAll('[data-line-format]').forEach(b=>b.onclick=()=>{if(!wsWritable())return;data.orientation=b.dataset.lineFormat;wsCommit();wsRenderBlock(p);});
 function edit(event){
  if(!wsWritable())return;const prev=event||{title:'',date:'',date2:'',note:''},draft=Array.isArray(prev.media)?prev.media.filter(wsTimelineMediaSafe).map(m=>({...m})):[];let ui=null;
  const mediaHTML='<div class="field rk-timeline-media-editor" data-event-media><label>Фото / видео / GIF</label><div class="ws-toolbar"><button type="button" class="btn" data-add-media-file>Добавить файлы</button><input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/ogg" multiple hidden></div><div class="rk-timeline-media" data-media-preview></div><details class="rk-timeline-media-link"><summary>Добавить по ссылке</summary><div class="rk-timeline-media-url"><select data-media-kind aria-label="Тип вложения"><option value="image">Фото / GIF</option><option value="video">Видео</option></select><input type="url" data-media-url placeholder="Прямая ссылка на файл" aria-label="Прямая ссылка на медиафайл"><button type="button" class="btn" data-add-media-url>Добавить</button></div></details><p class="rk-timeline-media-status" data-media-status role="status" aria-live="polite"></p></div>';
  const modal=dlg(event?'Событие':'Новое событие','<div class="field"><label>Название</label><input id="ws-ev-title" value="'+esc(prev.title)+'"></div><div class="field"><label>Дата или период</label><div class="seg" id="ws-ev-date-seg" style="display:inline-flex;margin-bottom:8px"><button type="button" class="seg-btn on" data-dmode="single">Дата</button><button type="button" class="seg-btn" data-dmode="range">Период</button></div><div style="display:flex;gap:8px;align-items:center"><input id="ws-ev-date" value="'+esc(prev.date)+'" style="flex:1;min-width:0"><span id="ws-ev-date-dash" style="'+(prev.date2?'':'display:none')+'">—</span><input id="ws-ev-date2" value="'+esc(prev.date2||'')+'" style="flex:1;min-width:0;'+(prev.date2?'':'display:none')+'"></div></div><div class="field"><label>Описание</label><textarea id="ws-ev-note" rows="5">'+esc(prev.note)+'</textarea></div>'+mediaHTML,m=>{
   if(!wsWritable()||ui&&ui.busy)return false;const title=m.querySelector('#ws-ev-title').value.trim();if(!title){m.querySelector('#ws-ev-title').focus();return false;}
   const before=event?{...event}:null,e=event||{id:wsId('ev')};e.title=title;e.date=m.querySelector('#ws-ev-date').value.trim();const d2=(m.querySelector('#ws-ev-date2')?m.querySelector('#ws-ev-date2').value.trim():'');if(d2)e.date2=d2;else delete e.date2;e.note=m.querySelector('#ws-ev-note').value;
   if(draft.length)e.media=draft.map(m=>({...m}));else delete e.media;if(!event)events.push(e);
   function parseDateOrder(str){
    if(!str) return 99999999;
    const y=str.match(/\b(19\d\d|20\d\d)\b/);
    const d=parseKey(str);
    const year=y?+y[1]:9999;
    const dayKey=d?d.key:5000;
    return year*10000 + dayKey;
   }
   events.sort((a,b)=>parseDateOrder(a.date)-parseDateOrder(b.date));
   const scroll=scroller.scrollLeft;
   if(!wsCommit()){
    if(event){Object.keys(event).forEach(k=>{if(!(k in before))delete event[k];});Object.assign(event,before);}else{const i=events.indexOf(e);if(i>=0)events.splice(i,1);}
    save();flush();m.querySelector('[data-media-status]').textContent='Не удалось сохранить: хранилище браузера заполнено или недоступно. Событие не изменено. Удали крупные вложения из этой формы или добавь их прямой ссылкой.';return false;
   }
   ui&&ui.close();redraw(scroll);if(document.body.classList.contains('split'))renderPane();
  },event?'Сохранить':'Добавить');ui=wsTimelineDraftUI(modal,draft);
  const seg=modal.querySelector('#ws-ev-date-seg'),d2Input=modal.querySelector('#ws-ev-date2'),dash=modal.querySelector('#ws-ev-date-dash');
  if(seg && d2Input){
   const btns=seg.querySelectorAll('.seg-btn');
   if(prev.date2){ btns.forEach(b=>b.classList.toggle('on', b.dataset.dmode==='range')); d2Input.style.display=''; if(dash)dash.style.display=''; }
   btns.forEach(b=>b.onclick=()=>{
    btns.forEach(x=>x.classList.remove('on'));
    b.classList.add('on');
    const isRange=b.dataset.dmode==='range';
    d2Input.style.display=isRange?'':'none';if(dash)dash.style.display=isRange?'':'none';
    if(!isRange) d2Input.value=''; else d2Input.focus();
   });
  }
 }
 host.querySelector('[data-event-add]').onclick=()=>edit(null);
 host.querySelectorAll('[data-event-edit]').forEach(b=>b.onclick=()=>edit(events.find(e=>e.id===b.dataset.eventEdit)));
 host.querySelectorAll('[data-event-delete]').forEach(b=>b.onclick=()=>{if(!wsWritable())return;const i=events.findIndex(e=>e.id===b.dataset.eventDelete);if(i<0||!confirm('Удалить событие «'+events[i].title+'»?'))return;const scroll=scroller.scrollLeft;events.splice(i,1);wsCommit();redraw(scroll);});
 const list=host.querySelector('.ws-events');let dragged=null;
 function clear(){list.querySelectorAll('.ws-drop-before,.ws-drop-after,.ws-dragging').forEach(el=>el.classList.remove('ws-drop-before','ws-drop-after','ws-dragging'));}
 function move(id,targetId,after){const from=events.findIndex(e=>e.id===id),to=events.findIndex(e=>e.id===targetId);if(from<0||to<0||from===to)return;let index=to+(after?1:0);if(from<index)index--;if(index===from)return;const scroll=scroller.scrollLeft,item=events.splice(from,1)[0];events.splice(index,0,item);wsCommit();redraw(scroll);const status=host.querySelector('[data-line-status]');if(status)status.textContent='Порядок событий сохранён';}
 list.addEventListener('dragstart',e=>{const card=e.target.closest('[data-event-id]');if(!card||tabReadOnly||e.target.closest('button:not(.ws-drag-handle),a,input,textarea,video,.rk-timeline-media')){e.preventDefault();return;}dragged=card.dataset.eventId;card.classList.add('ws-dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',dragged);});
 list.addEventListener('dragover',e=>{if(!dragged||tabReadOnly)return;e.preventDefault();e.dataTransfer.dropEffect='move';list.querySelectorAll('.ws-drop-before,.ws-drop-after').forEach(el=>el.classList.remove('ws-drop-before','ws-drop-after'));const target=e.target.closest('[data-event-id]');if(target&&target.dataset.eventId!==dragged){const r=target.getBoundingClientRect(),after=horizontal?e.clientX>r.left+r.width/2:e.clientY>r.top+r.height/2;target.classList.add(after?'ws-drop-after':'ws-drop-before');}const r=scroller.getBoundingClientRect();if(horizontal){if(e.clientX>r.right-65)scroller.scrollLeft+=24;else if(e.clientX<r.left+65)scroller.scrollLeft-=24;}else{if(e.clientY>window.innerHeight-65)window.scrollBy(0,24);else if(e.clientY<65)window.scrollBy(0,-24);}});
 list.addEventListener('drop',e=>{if(!dragged||!wsWritable())return;e.preventDefault();const id=dragged;dragged=null;const target=e.target.closest('[data-event-id]');if(!target){clear();return;}const r=target.getBoundingClientRect(),after=horizontal?e.clientX>r.left+r.width/2:e.clientY>r.top+r.height/2;clear();move(id,target.dataset.eventId,after);});
 list.addEventListener('dragend',()=>{dragged=null;clear();});
 list.addEventListener('keydown',e=>{if(!e.altKey||!e.target.matches('.ws-drag-handle')||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)||!wsWritable())return;e.preventDefault();const id=e.target.closest('[data-event-id]').dataset.eventId,i=events.findIndex(x=>x.id===id),forward=['ArrowRight','ArrowDown'].includes(e.key),j=i+(forward?1:-1);if(j<0||j>=events.length)return;move(id,events[j].id,forward);const card=Array.from(host.querySelectorAll('[data-event-id]')).find(el=>el.dataset.eventId===id);if(card)card.querySelector('.ws-drag-handle').focus();});
}
function wsMapBoard(host,p,data){
 const safe=!!(data.image&&/^data:image\/(jpeg|png|webp);base64,/.test(data.image)),pins=Array.isArray(data.pins)?data.pins:[];
 if(data.board||(!safe&&!pins.length)){wsBoard(host,p,data);return;}
 const build=(iw,ih)=>{if(data.board){if(host.isConnected)wsBoard(host,p,data);return;}const items=[],w=800,h=safe?Math.max(40,Math.round(w*ih/iw)):600;
  if(safe)items.push({id:wsId('bn'),kind:'image',image:data.image,x:40,y:40,w,h,text:p.title||''});
  pins.forEach((pin,i)=>{const px=Math.max(0,Math.min(100,Number(pin.x)||0)),py=Math.max(0,Math.min(100,Number(pin.y)||0));items.push({id:wsId('bn')+i,kind:'note',x:Math.round(40+px/100*w),y:Math.round(40+py/100*h),w:200,h:120,text:(pin.title||'')+(pin.note?'\n'+pin.note:''),color:'light'});});
  data.board={items,edges:[],view:{x:40,y:40,k:1}};save();if(host.isConnected)wsBoard(host,p,data);};
 if(!safe){build(4,3);return;}
 const img=new Image();img.onload=()=>build(img.naturalWidth||4,img.naturalHeight||3);img.onerror=()=>build(4,3);img.src=data.image;
}
function wsMap(host,p,data){
 const pins=data.pins||(data.pins=[]);const safe=data.image&&/^data:image\/(jpeg|png|webp);base64,/.test(data.image);
 host.innerHTML=wsImageHTML(data)+'<div class="field"><label for="ws-map-note">Описание карты</label><textarea id="ws-map-note" rows="4">'+esc(data.notes||'')+'</textarea></div>'+(safe?'<p class="muted">Нажми на карту, чтобы поставить отметку. В списке ниже можно изменить её или связать с локацией.</p><div class="ws-map-canvas"><img src="'+esc(data.image)+'" alt="Карта">'+pins.map((pin,i)=>'<button class="ws-pin" style="left:'+Math.max(0,Math.min(100,Number(pin.x)||0))+'%;top:'+Math.max(0,Math.min(100,Number(pin.y)||0))+'%" data-pin="'+pin.id+'" title="'+esc(pin.title)+'">'+(i+1)+'</button>').join('')+'</div>':'')+'<div class="ws-pin-list">'+pins.map((pin,i)=>'<div><button class="link-btn" data-pin="'+pin.id+'">'+(i+1)+'. '+esc(pin.title)+'</button>'+(pin.location&&PAGE[pin.location]?'<a href="#/'+pin.location+'">Открыть локацию</a>':'')+'</div>').join('')+'</div>';
 // The map itself is the image; avoid showing a second full-size preview.
 const preview=host.querySelector('.ws-block-image > img');if(preview)preview.remove();
 wsBindImage(host,p,data);host.querySelector('#ws-map-note').oninput=e=>{if(!wsWritable())return;data.notes=e.target.value;save();};
 function edit(pin,x,y){if(!wsWritable())return;const old=pin||{title:'',note:'',location:''};const locations=PAGES.filter(x=>wsType(x)==='location');const m=dlg(pin?'Отметка на карте':'Новая отметка','<div class="field"><label>Название</label><input id="ws-pin-title" value="'+esc(old.title)+'"></div><div class="field"><label>Описание</label><textarea id="ws-pin-note" rows="4">'+esc(old.note||'')+'</textarea></div><div class="field"><label>Связанная локация</label><select id="ws-pin-location"><option value="">Без связи</option>'+locations.map(l=>'<option value="'+l.id+'"'+(old.location===l.id?' selected':'')+'>'+esc(l.title)+'</option>').join('')+'</select></div>',m=>{if(!wsWritable())return false;const title=m.querySelector('#ws-pin-title').value.trim();if(!title)return false;const obj=pin||{id:wsId('pin'),x,y};obj.title=title;obj.note=m.querySelector('#ws-pin-note').value;obj.location=m.querySelector('#ws-pin-location').value;if(!pin)pins.push(obj);wsCommit();wsRenderBlock(p);},pin?'Сохранить':'Добавить');
  if(pin){const b=document.createElement('button');b.className='btn danger';b.textContent='Удалить отметку';b.onclick=()=>{if(!wsWritable()||!confirm('Удалить отметку?'))return;data.pins=pins.filter(x=>x.id!==pin.id);wsCommit();m.hidden=true;wsRenderBlock(p);};m.querySelector('#spExtra').append(b);}
 }
 const canvas=host.querySelector('.ws-map-canvas');if(canvas)canvas.onclick=e=>{if(e.target.closest('[data-pin]'))return;const r=canvas.getBoundingClientRect();edit(null,(e.clientX-r.left)/r.width*100,(e.clientY-r.top)/r.height*100);};
 host.querySelectorAll('[data-pin]').forEach(b=>b.onclick=e=>{e.stopPropagation();edit(pins.find(pin=>pin.id===b.dataset.pin));});
}
function renderPane(focusBid){
 if(!document.body.classList.contains('split'))return;
 prefs.paneTab='page';const p=wsPaneSelect(),host=$('#view2Body');if(!host)return;rkClearFieldColor(host);
 if(!p){host.innerHTML='<div class="pane-empty">В проекте пока нет блоков. Добавь блок в основной области.</div>';return;}
 const type=wsType(p),u=wsUser(p),data=u&&u.blockData||{};
 if(type!=='text')rkFieldColor(p,host);
 if(type==='text'){
  renderPaneLegacy(focusBid);const title=host.querySelector('.pane-title');if(title)title.textContent=p.title;rkFieldColor(p,host);return;
 }
 if(['character','location'].includes(type)){host.innerHTML='<div class="pane-title">'+esc(p.title)+'</div><div class="rk-character-pane"></div>';rkCharacterDesigner(host.querySelector('.rk-character-pane'),p,data);return;}
 if(type==='board'||type==='map'){host.innerHTML='<div class="pane-title">'+esc(p.title)+'</div><div class="rk-board-pane"></div>';(type==='map'?wsMapBoard:wsBoard)(host.querySelector('.rk-board-pane'),p,data);return;}
 let html='<div class="pane-title">'+esc(p.title)+'</div>';
 if(type==='folder'){
  const children=wsChildren(p.id).filter(x=>wsUser(x));
  html+=children.length?'<div class="ws-pane-summary">'+children.map(x=>'<p><a href="#/'+esc(x.id)+'" data-pane-block="'+esc(x.id)+'">'+esc(x.title)+' · '+esc(wsLabel(x))+'</a></p>').join('')+'</div>':'<p class="pane-empty">Папка пока пуста.</p>';
 }else if(type==='timeline'){
  const events=Array.isArray(data.events)?data.events:[];
  html+=events.length?'<ol class="ws-events">'+events.map(e=>'<li><div class="ws-event-date">'+esc((e.date||'Без даты')+(e.date2?' — '+e.date2:''))+'</div><h3>'+esc(e.title||'')+'</h3><p>'+esc(e.note||'')+'</p>'+wsTimelineMediaHTML(e)+'</li>').join('')+'</ol>':'<p class="pane-empty">Временная линия пока пуста.</p>';
 }else{
  const safe=data.image&&/^data:image\/(jpeg|png|webp);base64,/.test(data.image);
  if(safe)html+='<div class="ws-block-image"><img src="'+esc(data.image)+'" alt="'+esc(p.title)+'"></div>';
  const labels={name:'Имя / название',age:'Возраст',role:'Роль',appearance:'Внешность',personality:'Характер',motivation:'Мотивация',conflict:'Конфликт',relations:'Связи',notes:'Заметки',type:'Тип',where:'Расположение',description:'Описание',atmosphere:'Атмосфера',story:'Роль в истории'};
  const fields=Object.entries(data).filter(([k,v])=>k!=='image'&&typeof v==='string'&&v.trim());
  html+='<div class="ws-pane-summary">'+fields.map(([k,v])=>'<h4>'+esc(labels[k]||k)+'</h4><p>'+esc(v)+'</p>').join('')+'</div>';
  if(type==='map'&&Array.isArray(data.pins))html+='<div class="ws-pin-list">'+data.pins.map((pin,i)=>'<p>'+(i+1)+'. '+esc(pin.title||'')+(pin.note?'<br>'+esc(pin.note):'')+(pin.location&&PAGE[pin.location]&&wsUser(PAGE[pin.location])?' <a href="#/'+esc(pin.location)+'" data-pane-block="'+esc(pin.location)+'">Открыть локацию</a>':'')+'</p>').join('')+'</div>';
  if(!safe&&!fields.length&&!(Array.isArray(data.pins)&&data.pins.length))html+='<p class="pane-empty">Блок пока не заполнен.</p>';
 }
 host.innerHTML=html;
 host.querySelectorAll('[data-pane-block]').forEach(a=>a.onclick=e=>{e.preventDefault();prefs.split=a.dataset.paneBlock;savePrefs();renderPane();});
}

function wsInstallBlockOrdering(){
 let source=null,lastDrop=0;
 const selector='[data-ws-reorder]',marks=['ws-block-before','ws-block-after','ws-block-append','ws-block-into'];
 function clear(){document.querySelectorAll(marks.map(c=>'.'+c).join(',')).forEach(el=>el.classList.remove(...marks));}
 function finish(){source=null;clear();document.querySelectorAll('.ws-block-dragging').forEach(el=>el.classList.remove('ws-block-dragging'));document.body.classList.remove('ws-block-dnd');}
 function valid(parent){return !!source&&(!parent||(PAGE[parent]&&wsType(PAGE[parent])==='folder'&&!wsDescendant(parent,source.id)));}
 function target(e){
  const el=e.target.closest(selector);
  if(el){const p=PAGE[el.dataset.wsReorder];if(!p||p.id===source.id)return null;
   const r=el.getBoundingClientRect(),side=!!el.closest('#toc'),f=side?(e.clientY-r.top)/r.height:(e.clientX-r.left)/r.width;
   if(wsType(p)==='folder'&&f>.23&&f<.77)return valid(p.id)?{el,id:null,parent:p.id,mode:'into'}:null;
   const parent=wsParent(p);if(!valid(parent))return null;
   const after=side?e.clientY>r.top+r.height/2:e.clientY<r.top+r.height*.25?false:e.clientY>r.bottom-r.height*.25?true:e.clientX>r.left+r.width/2;
   return {el,id:p.id,parent,mode:after?'after':'before'};
  }
  const home=e.target.closest('.ws-toc-home,.ws-crumbs a,#crumb a');
  if(home){const hash=home.getAttribute('href')||'',parent=hash==='#/'?'':hash.startsWith('#/')?hash.slice(2):null;return parent!==null&&valid(parent)?{el:home,id:null,parent,mode:'into'}:null;}
  const area=e.target.closest('.ws-grid [data-ws-add],.ws-grid');
  if(area){const parent=curPage&&wsType(curPage)==='folder'?curPage.id:'';return valid(parent)?{el:area,id:null,parent,mode:'into'}:null;}
  return null;
 }
 function move(id,t){
  const p=PAGE[id];if(!p||t.parent&&(!PAGE[t.parent]||wsType(PAGE[t.parent])!=='folder'||wsDescendant(t.parent,id)))return;
  const oldParent=wsParent(p),parent=t.parent,oldIds=wsChildren(oldParent).map(p=>p.id),ids=wsChildren(parent).map(p=>p.id).filter(x=>x!==id);
  const base=t.id===null?ids.length:ids.indexOf(t.id);if(base<0||t.id===id)return;
  const index=base+(t.id!==null&&t.mode==='after'?1:0);ids.splice(index,0,id);
  if(oldParent===parent&&JSON.stringify(ids)===JSON.stringify(oldIds))return;
  const u=wsUser(p);if(!u){toast('Этот встроенный блок нельзя переместить');return;}
  const workspace=wsData(),oldOrder=workspace.blockOrder,hadParent=Object.prototype.hasOwnProperty.call(u,'parent'),previous=u.parent;
  workspace.blockOrder=Object.assign({},oldOrder||{});u.parent=parent;
  if(oldParent!==parent)workspace.blockOrder[oldParent||'$root']=oldIds.filter(x=>x!==id);
  workspace.blockOrder[parent||'$root']=ids;
  if(!wsCommit()){if(hadParent)u.parent=previous;else delete u.parent;workspace.blockOrder=oldOrder;save();toast('Не удалось сохранить перемещение');return;}
  const y=window.scrollY,toc=document.querySelector('#toc'),sy=toc&&toc.scrollTop;
  buildToc();if(!curPage||wsType(curPage)==='folder')route();
  requestAnimationFrame(()=>{window.scrollTo(0,y);if(toc)toc.scrollTop=sy||0;});
 }
 document.addEventListener('dragstart',e=>{
  const el=e.target.closest(selector);if(!el)return;finish();
  if(!wsWritable()||e.target.closest('input,textarea,button,[contenteditable=true]')){e.preventDefault();return;}
  const p=PAGE[el.dataset.wsReorder];if(!p||!e.dataTransfer){e.preventDefault();return;}
  source={id:p.id};document.body.classList.add('ws-block-dnd');el.classList.add('ws-block-dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('application/x-rakurs-block',p.id);e.dataTransfer.setData('text/plain',p.id);
 });
 document.addEventListener('dragover',e=>{
  if(!source)return;clear();if(tabReadOnly)return;const t=target(e);if(!t){if(e.dataTransfer)e.dataTransfer.dropEffect='none';return;}
  e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='move';t.el.classList.add('ws-block-'+t.mode);
  const side=t.el.closest('#toc');if(side){const r=side.getBoundingClientRect();if(e.clientY>r.bottom-50)side.scrollTop+=20;else if(e.clientY<r.top+50)side.scrollTop-=20;}
  else if(e.clientY>window.innerHeight-60)window.scrollBy(0,24);else if(e.clientY<60)window.scrollBy(0,-24);
 });
 document.addEventListener('dragleave',e=>{if(source&&(!e.relatedTarget||!document.documentElement.contains(e.relatedTarget)))clear();});
 document.addEventListener('drop',e=>{if(!source){clear();return;}const t=target(e),id=source.id;finish();if(!t)return;e.preventDefault();e.stopPropagation();if(!wsWritable())return;lastDrop=Date.now();move(id,t);});
 document.addEventListener('dragend',finish);window.addEventListener('blur',finish);window.addEventListener('pagehide',finish);window.addEventListener('hashchange',finish);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)finish();});
 document.addEventListener('pointerdown',()=>{if(!source)clear();},true);
 document.addEventListener('click',e=>{if(Date.now()-lastDrop<300&&e.target.closest(selector+',.ws-toc-home,.ws-crumbs a,#crumb a')){e.preventDefault();e.stopPropagation();}},true);
 document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){finish();return;}
  const el=e.target.closest(selector);if(!el||!e.altKey||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;
  if(!wsWritable())return;e.preventDefault();e.stopPropagation();const id=el.dataset.wsReorder,p=PAGE[id];if(!p)return;
  const parent=wsParent(p),siblings=wsChildren(parent),i=siblings.findIndex(x=>x.id===id),forward=['ArrowDown','ArrowRight'].includes(e.key),j=i+(forward?1:-1);if(j<0||j>=siblings.length)return;
  const inToc=!!el.closest('#toc');move(id,{id:siblings[j].id,parent,mode:forward?'after':'before'});
  const next=Array.from(document.querySelectorAll((inToc?'#toc ':'#view ')+selector)).find(x=>x.dataset.wsReorder===id);if(next)next.focus();
 });
 const style=document.createElement('style');style.textContent=`
 html body.ws-block-dnd .ws-block-into{outline:2px dashed var(--heading-2,var(--green));outline-offset:2px;}
 html body #side #toc a:not(:focus-visible):not(.ws-block-before):not(.ws-block-after):not(.ws-block-into){outline:none!important;box-shadow:none!important;}
 html body #view :is(.ws-card,.ws-add-card):not(:focus-visible):not(.ws-block-before):not(.ws-block-after):not(.ws-block-into){outline:none!important;box-shadow:none!important;}
 `;document.head.appendChild(style);finish();
}

function wsInstallStyles(){
 const style=document.createElement('style');style.id='rakurs-workspace-style';style.textContent=`
 .ws-home,.ws-detail {max-width:1200px!important;margin-inline:auto!important;}
 .ws-cover{position:relative;min-height:200px;background:var(--well);border:1px dashed var(--line);border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center;margin:20px 0 28px;}
 .ws-cover.has-cover{height:clamp(210px,28vw,360px);border-style:solid;}
 .ws-cover>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}
 .ws-cover-placeholder{color:var(--muted);margin-bottom:50px;}
 .ws-cover-actions{position:absolute;bottom:16px;right:16px;left:16px;display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;}
 .ws-cover-actions .btn{background:var(--panel);color:var(--text);}
 .ws-home-title h1{margin:0 0 30px;text-align:left;overflow-wrap:anywhere;}
 .ws-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(240px,100%),1fr));gap:16px;}
 .ws-card,.ws-add-card{min-height:145px;border:1px solid var(--line);border-radius:9px;padding:20px;background:var(--card);color:var(--text);text-decoration:none;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:8px;overflow-wrap:anywhere;}
 .ws-card:hover,.ws-add-card:hover{border-color:var(--rust);background:var(--hover);}
 .ws-add-card{border-style:dashed;cursor:pointer;font:inherit;text-align:left;}
 .ws-card-title{font-size:1.2em;}.ws-card small,.ws-type{color:var(--muted);font-size:.82em;}
 .ws-type{display:block;letter-spacing:.04em;}.ws-card-image{width:100%;height:130px;object-fit:cover;border-radius:4px;}
 .ws-empty{color:var(--muted);padding:20px 0;}.ws-crumbs{margin:0 0 20px;font-size:.85em;}.ws-crumbs a{color:var(--muted);}
 .ws-toc-home{margin-bottom:16px;}.ws-kind-select{border:0;padding:0;margin:0 0 24px;display:grid;grid-template-columns:1fr 1fr;gap:10px;}
 .ws-kind-select legend{padding:0;margin-bottom:12px;color:var(--muted);}
 .ws-kind-select label{display:flex;align-items:flex-start;gap:10px;border:1px solid var(--line);border-radius:7px;padding:12px;cursor:pointer;}
 .ws-kind-select label:has(input:checked){border-color:var(--rust);background:var(--hover);}
 .ws-kind-select input{flex:0 0 auto;width:auto!important;margin-top:6px;}.ws-kind-select small{display:block;font-size:.75em;color:var(--muted);}
 .ws-fields{display:grid;grid-template-columns:1fr 1fr;gap:18px;}.ws-fields .field{margin:0;}
 .ws-fields textarea,.ws-content> .field textarea{width:100%;resize:vertical;min-height:100px;}
 .ws-block-image>img{display:block;max-width:100%;max-height:400px;object-fit:contain;margin:0 auto 20px;border-radius:6px;}
 .ws-toolbar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:14px 0 24px;}
 .ws-events{list-style:none;padding:0 0 0 22px;border-left:2px solid var(--rust);margin:30px 0;}
 .ws-events li{position:relative;margin:0 0 24px;padding:18px;border:1px solid var(--line);border-radius:7px;background:var(--card);}
 .ws-events li:before{content:'';position:absolute;left:-29px;top:28px;width:10px;height:10px;border-radius:50%;background:var(--rust);}
 .ws-events h3{margin:8px 0;}.ws-events p,.ws-pane-summary p{white-space:pre-wrap;}.ws-event-date{color:var(--muted);font-size:.9em;}
 .ws-map-canvas{position:relative;line-height:0;cursor:crosshair;margin:20px 0;}.ws-map-canvas>img{width:100%;height:auto;display:block;}
 .ws-pin{position:absolute;transform:translate(-50%,-50%);width:30px;height:30px;min-width:0!important;padding:0!important;border:2px solid var(--paper)!important;border-radius:50%;background:var(--rust);color:#fff;line-height:26px;font:16px sans-serif;cursor:pointer;}
 .ws-pin-list>div{display:flex;gap:18px;align-items:center;margin:10px 0;}
 body.ws-page .seg,body.ws-page #fmtbar{display:none!important;}
 body.ws-page #specialModal #ws-ev-date-seg{display:inline-flex!important;}
 .ws-detail .page-head h1{overflow-wrap:anywhere;}
 @media(max-width:650px){.ws-fields,.ws-kind-select{grid-template-columns:1fr;}.ws-cover{min-height:180px;}.ws-cover-actions{justify-content:center;}}

 body #search{font-family:var(--prose);font-style:normal;}
 body #search::placeholder{font-family:var(--hand);font-style:normal;color:var(--text);opacity:.5;}
 .ws-line-tools{justify-content:space-between;align-items:center;gap:16px;}.ws-line-format{display:flex;gap:8px;flex-wrap:wrap;font-family:var(--hand);}
 .ws-line-hint{font-family:var(--hand);color:var(--muted);font-size:.9em;}
 .ws-line-scroll{min-width:0;max-width:100%;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-color:var(--line-strong) var(--bg);padding:4px 5px 14px;}
 .ws-events li{cursor:grab;overflow-wrap:anywhere;}.ws-events li:active{cursor:grabbing;}.ws-events .ws-event-top{display:flex;justify-content:space-between;gap:12px;align-items:center;}
 .ws-drag-handle{flex:none;padding:3px 9px;background:none;border:1px solid var(--line);border-radius:4px;color:var(--muted);cursor:grab;font:20px sans-serif;line-height:1.3;}.ws-drag-handle:active{cursor:grabbing;}.ws-drag-handle:focus-visible{outline:2px solid var(--heading-2);outline-offset:3px;}
 .ws-events li.ws-dragging{opacity:.4;}.ws-events li.ws-drop-before{box-shadow:0 -4px 0 var(--heading-2);}.ws-events li.ws-drop-after{box-shadow:0 4px 0 var(--heading-2);}
 .ws-events.ws-events-horizontal{display:flex;align-items:stretch;gap:24px;border-left:0;border-top:2px solid var(--rust);padding:28px 0 0;margin:24px 0 0;width:max-content;min-width:100%;list-style:none;}
 .ws-events.ws-events-horizontal>li{box-sizing:border-box;flex:0 0 320px;width:320px;max-width:75vw;margin:0;}.ws-events.ws-events-horizontal>li:before{left:24px;top:-35px;width:10px;height:10px;}
 .ws-events.ws-events-horizontal>li.ws-drop-before{box-shadow:-4px 0 0 var(--heading-2);}.ws-events.ws-events-horizontal>li.ws-drop-after{box-shadow:4px 0 0 var(--heading-2);}.ws-events .ws-toolbar{margin-bottom:0;}
 .ws-sr-only{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0;}
 .ws-rename-title{cursor:text;}.ws-rename-title:focus-visible{outline:1px dashed var(--line-strong);outline-offset:6px;}
 body #view .page-head h1.ws-renaming{font-family:var(--hand)!important;outline:1px dashed var(--heading-2);outline-offset:6px;white-space:pre-wrap;min-width:1ch;}
 .ws-grid .ws-card[data-ws-reorder]{cursor:grab;}.ws-grid .ws-card[data-ws-reorder]:active{cursor:grabbing;}
 [data-ws-reorder] img{pointer-events:none;user-select:none;}
 [data-ws-reorder].ws-block-dragging{opacity:.4!important;}
 [data-ws-reorder].ws-block-before{outline:2px solid var(--heading-2)!important;outline-offset:3px;box-shadow:-5px 0 0 var(--heading-2)!important;}
 [data-ws-reorder].ws-block-after{outline:2px solid var(--heading-2)!important;outline-offset:3px;box-shadow:5px 0 0 var(--heading-2)!important;}
 #toc [data-ws-reorder].ws-block-before{box-shadow:0 -3px 0 var(--heading-2)!important;}
 #toc [data-ws-reorder].ws-block-after{box-shadow:0 3px 0 var(--heading-2)!important;}
 .ws-grid [data-ws-add].ws-block-append{outline:2px solid var(--heading-2);outline-offset:3px;}

 `;document.head.appendChild(style);
}
wsInstallStyles();wsInstallBlockOrdering();
const wsSearch=document.getElementById('search');if(wsSearch){wsSearch.placeholder='Поиск';wsSearch.setAttribute('aria-label','Поиск');}

window.__limb={get D(){return D}, pageBlocks, PAGE}; window.selInfo=selInfo;
window.RK_CLOUD_UI={ key:KEY, projId:CUR_PROJ.id, toast:(m)=>toast(m), isDirty:()=>dirty||!!saveT, apply:(k)=>{ if(k!==KEY||dirty||saveT) return false; reloadFromStore(); return true; } };
init();
})();

/* Appearance: per-story theme, palette, balanced surfaces and sidebar layout. */
(function(){
 'use strict';
 const STORAGE_KEY='rakursPaletteThemesV1';
 const css="html body[data-rk-palette=\"base\"][data-rk-mode=\"dark\"]{color-scheme:dark;--bg:#262626!important;--bg-2:#262626!important;--bg-3:#262626!important;--text:#E5E0CF!important;--muted:#E5E0CF!important;--dim:#E5E0CF!important;--rust:#723424!important;--rust-2:#723424!important;--heading:#723424!important;--heading-2:#723424!important;--panel:#262626!important;--panel-text:#E5E0CF!important;--paper:#262626!important;--paper-2:#E5E0CF!important;--paper-text:#E5E0CF!important;--line:#516D79!important;--line-strong:#516D79!important;--panel-line:#516D79!important;--green:#5D6444!important;--green-2:#516D79!important;--green-soft:#5D6444!important;--sel:#516D79!important;--panel-soft:#262626!important;--panel-shade:#262626!important;--mark:#516D79!important;--mark-hot:#AC6F40!important;--mark-line:#516D79!important;--chrome:#262626!important;--chrome-2:#262626!important;--card:#262626!important;--hover:#AC6F40!important;--hover-2:#AC6F40!important;--well:#262626!important;--rk-bg:#262626!important;--rk-text:#E5E0CF!important;--rk-heading:#723424!important;--rk-primary:#5D6444!important;--rk-secondary:#516D79!important;--rk-hover:#AC6F40!important;--rk-dark:#262626!important;--rk-light:#E5E0CF!important;}\nhtml body[data-rk-palette=\"base\"][data-rk-mode=\"light\"]{color-scheme:light;--bg:#E5E0CF!important;--bg-2:#E5E0CF!important;--bg-3:#E5E0CF!important;--text:#262626!important;--muted:#262626!important;--dim:#262626!important;--rust:#723424!important;--rust-2:#723424!important;--heading:#723424!important;--heading-2:#723424!important;--panel:#E5E0CF!important;--panel-text:#262626!important;--paper:#E5E0CF!important;--paper-2:#262626!important;--paper-text:#262626!important;--line:#516D79!important;--line-strong:#516D79!important;--panel-line:#516D79!important;--green:#5D6444!important;--green-2:#516D79!important;--green-soft:#5D6444!important;--sel:#516D79!important;--panel-soft:#E5E0CF!important;--panel-shade:#E5E0CF!important;--mark:#516D79!important;--mark-hot:#AC6F40!important;--mark-line:#516D79!important;--chrome:#E5E0CF!important;--chrome-2:#E5E0CF!important;--card:#E5E0CF!important;--hover:#AC6F40!important;--hover-2:#AC6F40!important;--well:#E5E0CF!important;--rk-bg:#E5E0CF!important;--rk-text:#262626!important;--rk-heading:#723424!important;--rk-primary:#5D6444!important;--rk-secondary:#516D79!important;--rk-hover:#AC6F40!important;--rk-dark:#262626!important;--rk-light:#E5E0CF!important;}\nhtml body[data-rk-palette=\"indigo\"][data-rk-mode=\"dark\"]{color-scheme:dark;--bg:#131316!important;--bg-2:#131316!important;--bg-3:#131316!important;--text:#B4D2EE!important;--muted:#B4D2EE!important;--dim:#B4D2EE!important;--rust:#424185!important;--rust-2:#424185!important;--heading:#424185!important;--heading-2:#424185!important;--panel:#131316!important;--panel-text:#B4D2EE!important;--paper:#131316!important;--paper-2:#B4D2EE!important;--paper-text:#B4D2EE!important;--line:#E2BF7B!important;--line-strong:#E2BF7B!important;--panel-line:#E2BF7B!important;--green:#4453A4!important;--green-2:#E2BF7B!important;--green-soft:#4453A4!important;--sel:#E2BF7B!important;--panel-soft:#131316!important;--panel-shade:#131316!important;--mark:#E2BF7B!important;--mark-hot:#E1A656!important;--mark-line:#E2BF7B!important;--chrome:#131316!important;--chrome-2:#131316!important;--card:#131316!important;--hover:#E1A656!important;--hover-2:#E1A656!important;--well:#131316!important;--rk-bg:#131316!important;--rk-text:#B4D2EE!important;--rk-heading:#424185!important;--rk-primary:#4453A4!important;--rk-secondary:#E2BF7B!important;--rk-hover:#E1A656!important;--rk-dark:#131316!important;--rk-light:#B4D2EE!important;}\nhtml body[data-rk-palette=\"indigo\"][data-rk-mode=\"light\"]{color-scheme:light;--bg:#B4D2EE!important;--bg-2:#B4D2EE!important;--bg-3:#B4D2EE!important;--text:#131316!important;--muted:#131316!important;--dim:#131316!important;--rust:#424185!important;--rust-2:#424185!important;--heading:#424185!important;--heading-2:#424185!important;--panel:#B4D2EE!important;--panel-text:#131316!important;--paper:#B4D2EE!important;--paper-2:#131316!important;--paper-text:#131316!important;--line:#E2BF7B!important;--line-strong:#E2BF7B!important;--panel-line:#E2BF7B!important;--green:#4453A4!important;--green-2:#E2BF7B!important;--green-soft:#4453A4!important;--sel:#E2BF7B!important;--panel-soft:#B4D2EE!important;--panel-shade:#B4D2EE!important;--mark:#E2BF7B!important;--mark-hot:#E1A656!important;--mark-line:#E2BF7B!important;--chrome:#B4D2EE!important;--chrome-2:#B4D2EE!important;--card:#B4D2EE!important;--hover:#E1A656!important;--hover-2:#E1A656!important;--well:#B4D2EE!important;--rk-bg:#B4D2EE!important;--rk-text:#131316!important;--rk-heading:#424185!important;--rk-primary:#4453A4!important;--rk-secondary:#E2BF7B!important;--rk-hover:#E1A656!important;--rk-dark:#131316!important;--rk-light:#B4D2EE!important;}\nhtml body[data-rk-palette=\"terra\"][data-rk-mode=\"dark\"]{color-scheme:dark;--bg:#151315!important;--bg-2:#151315!important;--bg-3:#151315!important;--text:#D0B78E!important;--muted:#D0B78E!important;--dim:#D0B78E!important;--rust:#B05721!important;--rust-2:#B05721!important;--heading:#B05721!important;--heading-2:#B05721!important;--panel:#151315!important;--panel-text:#D0B78E!important;--paper:#151315!important;--paper-2:#D0B78E!important;--paper-text:#D0B78E!important;--line:#46374A!important;--line-strong:#46374A!important;--panel-line:#46374A!important;--green:#746A2C!important;--green-2:#46374A!important;--green-soft:#746A2C!important;--sel:#46374A!important;--panel-soft:#151315!important;--panel-shade:#151315!important;--mark:#46374A!important;--mark-hot:#B05721!important;--mark-line:#46374A!important;--chrome:#151315!important;--chrome-2:#151315!important;--card:#151315!important;--hover:#B05721!important;--hover-2:#B05721!important;--well:#151315!important;--rk-bg:#151315!important;--rk-text:#D0B78E!important;--rk-heading:#B05721!important;--rk-primary:#746A2C!important;--rk-secondary:#46374A!important;--rk-hover:#B05721!important;--rk-dark:#151315!important;--rk-light:#D0B78E!important;}\nhtml body[data-rk-palette=\"terra\"][data-rk-mode=\"light\"]{color-scheme:light;--bg:#D0B78E!important;--bg-2:#D0B78E!important;--bg-3:#D0B78E!important;--text:#151315!important;--muted:#151315!important;--dim:#151315!important;--rust:#B05721!important;--rust-2:#B05721!important;--heading:#B05721!important;--heading-2:#B05721!important;--panel:#D0B78E!important;--panel-text:#151315!important;--paper:#D0B78E!important;--paper-2:#151315!important;--paper-text:#151315!important;--line:#46374A!important;--line-strong:#46374A!important;--panel-line:#46374A!important;--green:#746A2C!important;--green-2:#46374A!important;--green-soft:#746A2C!important;--sel:#46374A!important;--panel-soft:#D0B78E!important;--panel-shade:#D0B78E!important;--mark:#46374A!important;--mark-hot:#B05721!important;--mark-line:#46374A!important;--chrome:#D0B78E!important;--chrome-2:#D0B78E!important;--card:#D0B78E!important;--hover:#B05721!important;--hover-2:#B05721!important;--well:#D0B78E!important;--rk-bg:#D0B78E!important;--rk-text:#151315!important;--rk-heading:#B05721!important;--rk-primary:#746A2C!important;--rk-secondary:#46374A!important;--rk-hover:#B05721!important;--rk-dark:#151315!important;--rk-light:#D0B78E!important;}\nhtml body[data-rk-mode]{background:var(--rk-bg)!important;background-image:none!important;color:var(--rk-text)!important;}\nhtml body[data-rk-mode] :is(.side,.main,.bar,.bar-in,.dlgbox,.dlgbox-head,.dlgbox-body,.dlgbox-foot,.popmenu,.toast,.ws-save-content,.pane-head,.pane-body){background:var(--rk-bg)!important;color:var(--rk-text);border-color:var(--rk-secondary)!important;box-shadow:none!important;}\nhtml body[data-rk-mode] :is(.blocks,.paper,.blk,.ws-card,.ws-add-card,.ws-cover,.ws-events li,.look .tile){background-color:var(--rk-bg)!important;color:var(--rk-text);border-color:var(--rk-secondary)!important;box-shadow:none;}\nhtml body[data-rk-mode] :is(h1,h2,h3,h4,h5,h6,.ws-card-title,.page-title,.brand-t,.gtag,.section-title,.toc-group h3,.ws-home-title){color:var(--rk-heading)!important;}\nhtml body[data-rk-mode] #side .brand .brand-t,\nhtml body[data-rk-mode] .modal:has(.ws-kind-select) .dlgbox-head h3{color:var(--rk-heading)!important;}\nhtml body[data-rk-mode] :is(input:not([type=radio]):not([type=checkbox]):not([type=color]),textarea,select,[contenteditable=true]){background-color:var(--rk-bg)!important;color:var(--rk-text)!important;caret-color:var(--rk-text);border-color:var(--rk-secondary)!important;}\nhtml body[data-rk-mode] :is(input,textarea)::placeholder{color:var(--rk-text)!important;opacity:.5;}\nhtml body[data-rk-mode] :is(input[type=radio],input[type=checkbox]){accent-color:var(--rk-primary);}\nhtml body[data-rk-mode] :is(.btn,.chip,.rk-theme-button,.ws-save-menu>summary){background:var(--rk-primary)!important;border-color:var(--rk-primary)!important;color:var(--rk-light)!important;box-shadow:none!important;}\nhtml body[data-rk-mode] :is(.icon-btn,.link-btn,.toc-new,.ws-drag-handle,.toc .side-open){color:var(--rk-primary)!important;}\nhtml body[data-rk-mode] :is(.btn,.chip,.rk-theme-button,.ws-save-menu>summary):hover:not(:disabled){background:var(--rk-hover)!important;border-color:var(--rk-hover)!important;color:var(--rk-dark)!important;}\nhtml body[data-rk-mode] :is(.icon-btn,.link-btn,.toc-new,.ws-drag-handle,.toc .side-open):hover:not(:disabled){color:var(--rk-hover)!important;border-color:var(--rk-hover)!important;}\nhtml body[data-rk-mode] :is(.ws-card,.ws-add-card,.look .tile,.ws-kind-select label):hover{border-color:var(--rk-hover)!important;outline:1px solid var(--rk-hover);outline-offset:0;}\nhtml body[data-rk-mode] :is(a:not(.btn):not(.ws-card),.popmenu button):hover{color:var(--rk-hover)!important;}\nhtml body[data-rk-mode] :is(.ws-card-icon,.ws-crumbs a,.ws-pin-list a,.pane-title a){color:var(--rk-secondary)!important;}\nhtml body[data-rk-mode] :is(a.on,.chip.on,.tile:has(input:checked),.ws-kind-select label:has(input:checked)){border-color:var(--rk-primary)!important;outline:1px solid var(--rk-primary);outline-offset:-1px;}\nhtml body[data-rk-mode] #toc a.on{background:var(--rk-bg)!important;}\nhtml body[data-rk-mode] .ws-grid .ws-card[data-ws-kind=folder]{box-shadow:inset 0 3px 0 var(--rk-primary)!important;border-color:var(--rk-primary)!important;}\nhtml body[data-rk-mode] .ws-grid .ws-card[data-ws-kind=folder]::before{background:var(--rk-bg)!important;border-color:var(--rk-primary)!important;}\nhtml body[data-rk-mode] .ws-grid .ws-card[data-ws-kind=folder]:hover::before{border-color:var(--rk-hover)!important;}\nhtml body[data-rk-mode] .ws-grid .ws-card[data-ws-kind=folder]:hover{border-color:var(--rk-hover)!important;}\nhtml body[data-rk-mode] .ws-pin{background:var(--rk-primary)!important;border-color:var(--rk-light)!important;color:var(--rk-light)!important;}\nhtml body[data-rk-mode] .ws-events,html body[data-rk-mode] .ws-events-horizontal{border-color:var(--rk-primary)!important;}\nhtml body[data-rk-mode] .ws-events li::before{background:var(--rk-primary)!important;}\nhtml body[data-rk-mode] :is(.ws-block-before,.ws-block-after,.ws-drop-before,.ws-drop-after){outline-color:var(--rk-secondary)!important;}\nhtml body[data-rk-mode] .btn.danger{color:var(--rk-light)!important;background:var(--rk-heading)!important;border-color:var(--rk-heading)!important;}\nhtml body[data-rk-mode] .btn.danger:hover{background:var(--rk-hover)!important;color:var(--rk-dark)!important;}\nhtml body[data-rk-mode] :focus-visible{outline-color:var(--rk-secondary)!important;}\nhtml body[data-rk-mode] ::selection{background:var(--rk-secondary);color:var(--rk-light);}\nhtml body[data-rk-mode] :is(.modal,.drawer-shade){background:transparent!important;backdrop-filter:blur(4px);}\nhtml body[data-rk-mode] .dlgbox{outline:2px solid var(--rk-secondary);box-shadow:0 0 0 2px var(--rk-bg)!important;}\n.rk-theme-button{display:inline-flex;align-items:center;justify-content:center;flex:0 0 32px;width:32px;height:32px;padding:5px;border:1px solid;border-radius:50%;cursor:pointer;}\n.rk-theme-button svg{width:19px;height:19px;display:block;}\n.rk-mode-field{font-family:var(--hand);}\n.rk-mode-field .rk-mode-options{display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;}\n.rk-mode-field button[aria-pressed=true]{outline:2px solid var(--rk-secondary)!important;outline-offset:3px;}\n\nhtml body[data-rk-mode] #side .side-head{display:flex;align-items:center;gap:8px;}\nhtml body[data-rk-mode] #side .side-head .brand{flex:1 1 auto;min-width:0;}\nhtml body[data-rk-mode] #side .side-head .brand-t{min-width:0;overflow-wrap:anywhere;}\nhtml body[data-rk-mode] #side #btnProjects{position:static!important;flex:0 0 34px;}\nhtml body[data-rk-mode] #side #rkThemeToggle{position:static;flex:0 0 32px;}\n\n\nhtml body[data-rk-palette=\"base\"][data-rk-mode]{\n --balance-line:color-mix(in srgb,var(--rk-text) 22%,transparent);\n --balance-strong:color-mix(in srgb,var(--rk-text) 36%,transparent);\n --line:var(--balance-line)!important;--line-strong:var(--balance-strong)!important;\n --panel-line:var(--balance-line)!important;--panel:var(--rk-bg)!important;\n --panel-text:var(--rk-text)!important;--card:var(--rk-bg)!important;\n --well:var(--rk-bg)!important;--heading:var(--rk-text)!important;\n --heading-2:#5D6444!important;--green:#5D6444!important;\n --hover:var(--rk-bg)!important;--hover-2:var(--rk-bg)!important;\n}\nhtml body[data-rk-palette=\"base\"][data-rk-mode=dark]{--balance-title:#E5E0CF;}\nhtml body[data-rk-palette=\"base\"][data-rk-mode=light]{--balance-title:#723424;}\nhtml body[data-rk-palette=\"base\"][data-rk-mode] :is(h1,h2,h3,h4,h5,h6,.page-title,.ws-card-title,.ws-home-title){color:var(--balance-title)!important;}\nhtml body[data-rk-palette=\"base\"][data-rk-mode] #side .brand .brand-t{color:#AC6F40!important;}\nhtml body[data-rk-palette=\"base\"][data-rk-mode] .modal:has(.ws-kind-select) .dlgbox-head h3{color:var(--balance-title)!important;}\nhtml body[data-rk-palette=\"base\"][data-rk-mode] :is(.side,.main,.bar,.bar-in,.dlgbox,.dlgbox-head,.dlgbox-body,.dlgbox-foot,.popmenu,.toast,.ws-save-content,.pane-head,.pane-body,.blocks,.paper,.ws-card,.ws-add-card,.ws-cover,.ws-events li,.look .tile){background-color:var(--rk-bg)!important;color:var(--rk-text)!important;border-color:var(--balance-line)!important;}\nhtml body[data-rk-palette=\"base\"][data-rk-mode] :is(input:not([type=radio]):not([type=checkbox]):not([type=color]):not([type=file]):not([type=button]):not([type=submit]),textarea,select,.blocks,.blocks .blk,.blocks [contenteditable=true]){\n background-color:var(--rk-bg)!important;color:var(--rk-text)!important;caret-color:var(--rk-text)!important;border-color:var(--balance-line)!important;\n}\nhtml body[data-rk-palette=\"base\"][data-rk-mode] :is(input,textarea)::placeholder{color:var(--rk-text)!important;opacity:.5;}\nhtml body[data-rk-palette=\"base\"][data-rk-mode] .blocks :is(h1,h2,h3,h4,h5,h6){color:var(--balance-title)!important;}\nhtml body[data-rk-palette=\"base\"][data-rk-mode] :is(.ws-fields label,.field>label,.ws-type,.ws-crumbs a,.ws-event-date,.ws-card-icon,.toc-new,.link-btn,.icon-btn,.ws-drag-handle){color:var(--rk-text)!important;}\nhtml body[data-rk-palette=\"base\"][data-rk-mode] :is(.btn,.chip,.rk-theme-button,.ws-save-menu>summary){background:transparent!important;color:var(--rk-text)!important;border-color:var(--balance-strong)!important;box-shadow:none!important;}\nhtml body[data-rk-palette=\"base\"][data-rk-mode] :is(.btn.primary:not([data-line-format]):not([data-mode]),[data-cover],[data-image],[data-event-add],#spOk,#projSave){background:#723424!important;color:#E5E0CF!important;border-color:#723424!important;}\nhtml body[data-rk-palette=\"base\"][data-rk-mode] :is(.btn,.chip,.rk-theme-button,.ws-save-menu>summary):hover:not(:disabled){background:transparent!important;color:#AC6F40!important;border-color:#AC6F40!important;}\nhtml body[data-rk-palette=\"base\"][data-rk-mode] :is(.btn.primary:not([data-line-format]):not([data-mode]),[data-cover],[data-image],[data-event-add],#spOk,#projSave):hover:not(:disabled){background:#AC6F40!important;color:#262626!important;border-color:#AC6F40!important;}\nhtml body[data-rk-palette=\"base\"][data-rk-mode] :is(.icon-btn,.link-btn,.toc-new,.ws-drag-handle):hover:not(:disabled){color:#AC6F40!important;}\nhtml body[data-rk-palette=\"base\"][data-rk-mode] :is(.ws-card,.ws-add-card,.look .tile,.ws-kind-select label){border-color:var(--balance-line)!important;}\nhtml body[data-rk-palette=\"base\"][data-rk-mode] :is(.ws-card,.ws-add-card,.look .tile,.ws-kind-select label):hover{border-color:#AC6F40!important;outline:none!important;}\nhtml body[data-rk-palette=\"base\"][data-rk-mode] :is(.tile:has(input:checked),.ws-kind-select label:has(input:checked),.rk-mode-options button[aria-pressed=true],[data-line-format][aria-pressed=true],.chip.on){outline:1px solid #5D6444!important;outline-offset:-1px;border-color:#5D6444!important;}\nhtml body[data-rk-palette=\"base\"][data-rk-mode] #toc a.on{background:transparent!important;outline:none!important;border-color:transparent!important;border-left:3px solid #5D6444!important;}\nhtml body[data-rk-palette=\"base\"][data-rk-mode] #toc a[data-page]{box-sizing:border-box;border-left:3px solid transparent;}\nhtml body[data-rk-palette=\"base\"][data-rk-mode] .ws-grid .ws-card[data-ws-kind=folder]{background:var(--rk-bg)!important;border-color:var(--balance-strong)!important;box-shadow:inset 0 2px 0 var(--balance-strong)!important;}\nhtml body[data-rk-palette=\"base\"][data-rk-mode] .ws-grid .ws-card[data-ws-kind=folder]::before{background:var(--rk-bg)!important;border-color:var(--balance-strong)!important;}\nhtml body[data-rk-palette=\"base\"][data-rk-mode] .ws-grid .ws-card[data-ws-kind=folder]:hover,\nhtml body[data-rk-palette=\"base\"][data-rk-mode] .ws-grid .ws-card[data-ws-kind=folder]:hover::before{border-color:#AC6F40!important;}\nhtml body[data-rk-palette=\"base\"][data-rk-mode] :is(.ws-events,.ws-events-horizontal){border-color:var(--balance-strong)!important;}\nhtml body[data-rk-palette=\"base\"][data-rk-mode] .ws-events li::before{background:#5D6444!important;}\nhtml body[data-rk-palette=\"base\"][data-rk-mode] .ws-pin{background:#5D6444!important;border-color:#E5E0CF!important;color:#E5E0CF!important;}\nhtml body[data-rk-palette=\"base\"][data-rk-mode] .dlgbox{outline:1px solid var(--balance-strong)!important;box-shadow:none!important;}\nhtml body[data-rk-palette=\"base\"][data-rk-mode] :is(input,textarea,select):focus{border-color:#5D6444!important;outline:none!important;box-shadow:inset 0 0 0 1px #5D6444!important;}\nhtml body[data-rk-palette=\"base\"][data-rk-mode] :is(button,a,summary):focus-visible{outline:2px solid #5D6444!important;outline-offset:3px;}\nhtml body[data-rk-palette=\"base\"][data-rk-mode] #view .page-head h1.ws-rename-title{outline:none!important;border:0!important;}\nhtml body[data-rk-palette=\"base\"][data-rk-mode] #view .page-head h1.ws-rename-title:focus-visible{outline:none!important;}\nhtml body[data-rk-palette=\"base\"][data-rk-mode] #view .page-head h1.ws-renaming{background:transparent!important;color:var(--balance-title)!important;caret-color:var(--rk-text)!important;outline:1px dashed #5D6444!important;outline-offset:6px;border:0!important;box-shadow:none!important;}\nhtml body[data-rk-palette=\"base\"][data-rk-mode] .ws-pin-list a{color:#516D79!important;}\nhtml body[data-rk-palette=\"base\"][data-rk-mode] .ws-pin-list a:hover{color:#AC6F40!important;}\n\nhtml body[data-rk-palette=\"base\"][data-rk-mode] :is(input:not([type=radio]):not([type=checkbox]):not([type=color]):not([type=file]):not([type=button]):not([type=submit]):focus,textarea:focus,select:focus){border-color:#5D6444!important;outline:none!important;box-shadow:inset 0 0 0 1px #5D6444!important;}\n\n\n\nhtml body[data-rk-palette=\"base\"][data-rk-mode] .ws-grid .ws-card[data-ws-kind=\"folder\"]:hover{\n --balance-strong:#AC6F40;--line-strong:#AC6F40;\n border-color:#AC6F40!important;outline:none!important;\n box-shadow:inset 0 2px 0 #AC6F40!important;\n}\nhtml body[data-rk-palette=\"base\"][data-rk-mode] .ws-grid .ws-card[data-ws-kind=\"folder\"]:hover::before,\nhtml body[data-rk-palette=\"base\"][data-rk-mode] .ws-grid .ws-card[data-ws-kind=\"folder\"]:hover::after{\n border-color:#AC6F40!important;box-shadow:none!important;outline:none!important;\n}\nhtml body #side .side-head{display:flex!important;align-items:center!important;gap:10px!important;}\nhtml body #side .side-head .brand{\n display:flex!important;align-items:center!important;align-self:center!important;\n flex:1 1 auto!important;min-width:0!important;margin:0!important;padding:0!important;\n line-height:1!important;outline:none!important;box-shadow:none!important;\n}\nhtml body #side .side-head .brand .brand-t{\n display:block!important;font-size:34px!important;line-height:1!important;\n margin:0!important;padding:0!important;letter-spacing:.08em!important;\n}\nhtml body #side .side-head .brand:focus-visible{text-decoration:underline;text-underline-offset:6px;}\nhtml body #side .side-head :is(.rk-theme-button,#btnTheme,#btnProjects){\n position:static!important;top:auto!important;right:auto!important;bottom:auto!important;\n align-self:center!important;flex:0 0 auto!important;margin-top:0!important;margin-bottom:0!important;transform:none!important;\n}\nhtml body #side .side-head :is(.rk-theme-button,#btnTheme){display:inline-flex!important;align-items:center!important;justify-content:center!important;}\nhtml body #side .side-head > :has(> .rk-theme-button){align-self:center!important;margin-top:0!important;margin-bottom:0!important;}\n\n\n.ws-cover>.rk-cover-upload-hint{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:calc(100% - 40px);max-width:700px;text-align:center;color:var(--rk-text,var(--text));opacity:.65;font-family:var(--hand);font-size:16px;line-height:1.5;pointer-events:none;}\n.rk-cover-upload-hint span{display:block;}\n@media(max-width:650px){.ws-cover>.rk-cover-upload-hint{font-size:14px;}}\n#side #storageState{display:none!important;}\n.ws-save-content .foot-links{display:flex;flex-wrap:wrap;gap:12px 18px;}\n.ws-save-content .foot-links button{white-space:normal;text-align:left;line-height:1.45;}\n.ws-kind-select small{display:none;}\n.ws-kind-select label{align-items:center;min-height:56px;box-sizing:border-box;}\n.ws-kind-select label>span{line-height:1.4;}\n\n.ws-grid{row-gap:28px;}\n.ws-grid .ws-card{position:relative;padding-bottom:56px;}\n.ws-card .ws-type{display:none;}\n.ws-card-icon{position:absolute;right:20px;bottom:18px;line-height:0;pointer-events:none;}\n.ws-card-icon svg{width:24px;height:24px;}\n.ws-grid .ws-card[data-ws-kind=folder]{overflow:visible;margin-top:0;}\n.ws-grid .ws-card[data-ws-kind=folder]::before{content:'';position:absolute;left:18px;top:-12px;width:90px;height:12px;border:1px solid var(--line-strong);border-bottom:0;border-radius:7px 7px 0 0;background:var(--bg);}\n\nhtml body[data-rk-palette=\"base\"][data-rk-mode]{--rk-text-page-surface:#783B29;--rk-note-surface:#E5E0CF;--rk-note-input-surface:#EEECE0;--rk-note-ink:#5D6444;}\nhtml body[data-rk-palette][data-rk-mode] :is(#view,#view2Body):has(> .blocks),html body[data-rk-palette][data-rk-mode] :is(#view,#view2Body) :is(.blocks,.blocks .blk,.blocks [contenteditable=true]){background-color:var(--rk-field-surface,var(--rk-text-page-surface,var(--rk-heading)))!important;color:var(--rk-field-ink,var(--rk-text))!important;caret-color:var(--rk-field-ink,var(--rk-text))!important;}\nhtml body[data-rk-palette][data-rk-mode] :is(#view,#view2Body) .blocks .note{background:var(--rk-note-surface,var(--rk-light))!important;color:var(--rk-note-ink,var(--rk-primary))!important;}\nhtml body[data-rk-palette][data-rk-mode] :is(#view,#view2Body) .blocks .note :is(.q,.txt,.meta,.link,.link-btn,.done-btn,.kind,.kind-btn){color:var(--rk-note-ink,var(--rk-primary))!important;}\nhtml body[data-rk-palette][data-rk-mode] :is(#view,#view2Body) :is(.blocks .note,.page-note) textarea{background:var(--rk-note-input-surface,var(--rk-light))!important;color:var(--rk-note-ink,var(--rk-primary))!important;caret-color:var(--rk-note-ink,var(--rk-primary))!important;border-color:var(--rk-note-ink,var(--rk-primary))!important;}\nhtml body[data-rk-palette][data-rk-mode] :is(#view,#view2Body) :is(.blocks .note,.page-note) textarea::placeholder{color:var(--rk-note-ink,var(--rk-primary))!important;}\nhtml body[data-rk-palette][data-rk-mode] :is(#view,#view2Body) .blocks .note :is(.kind,.kind-btn,.done-btn){background:transparent!important;border-color:color-mix(in srgb,var(--rk-note-ink,var(--rk-primary)) 50%,var(--rk-note-surface,var(--rk-light)))!important;}\nhtml body[data-rk-palette][data-rk-mode] :is(#view,#view2Body) .blocks .note .q{border-color:color-mix(in srgb,var(--rk-note-ink,var(--rk-primary)) 45%,var(--rk-note-surface,var(--rk-light)))!important;}\nhtml body[data-rk-palette][data-rk-mode] :is(#view,#view2Body) .blocks .note :is(.btn.primary,.kind-btn.on){background:var(--rk-note-ink,var(--rk-primary))!important;color:var(--rk-note-surface,var(--rk-light))!important;border-color:var(--rk-note-ink,var(--rk-primary))!important;}\nhtml body[data-rk-palette=\"base\"][data-rk-mode=\"dark\"] :is(#side,#side .side-head,#side .side-foot,#side .foot,#side .ws-save-content,.bar,.bar-in){background-color:#131311!important;}\nhtml body[data-rk-palette][data-rk-mode] :is(#view,#view2Body) .page-note.page-note textarea{background:transparent!important;color:var(--rk-field-ink,var(--rk-text))!important;caret-color:var(--rk-field-ink,var(--rk-text))!important;border-color:color-mix(in srgb,var(--rk-field-ink,var(--rk-text)) 45%,transparent)!important;}\nhtml body[data-rk-palette][data-rk-mode] :is(#view,#view2Body) .page-note.page-note textarea::placeholder{color:var(--rk-field-ink,var(--rk-text))!important;opacity:.65;}\nhtml body[data-rk-palette][data-rk-mode] #side .side-head .brand .brand-t{color:var(--rk-heading,var(--rust))!important;}\nhtml body[data-rk-palette][data-rk-mode] #selBubble{background:var(--rk-light)!important;color:var(--rk-primary)!important;}\nhtml body[data-rk-palette][data-rk-mode] :is(#view,#view2Body)[data-rk-text-page] :is(.page-head h1,.page-head .kicker,.page-head .kicker a,.page-head .ws-type,.blocks h1,.blocks h2,.blocks h3,.blocks h4,.blocks h5,.blocks h6,.pane-title){color:var(--rk-field-ink,var(--rk-text))!important;}\n.rk-field-color-control{position:relative;display:flex;justify-content:flex-start;margin:0 0 12px;gap:8px;font-family:var(--hand);}\n.rk-field-color-menu{position:absolute;top:calc(100% + 6px);left:0;z-index:50;min-width:220px;padding:8px;display:grid;gap:4px;background:var(--rk-bg,var(--bg));border:1px solid var(--line);border-radius:8px;}\n.rk-field-color-menu[hidden]{display:none!important;}\n.rk-field-color-menu button{display:flex;align-items:center;gap:10px;padding:8px 12px;text-align:left;background:transparent;color:var(--rk-text,var(--text));border:0;cursor:pointer;font:inherit;}\n.rk-field-color-swatch{display:inline-block;width:20px;height:20px;flex:0 0 20px;border:1px solid var(--line);border-radius:50%;}\nhtml body[data-rk-palette][data-rk-mode] :is(#view,#view2Body) > .rk-field-color-control > button{background:transparent!important;color:var(--rk-field-ink,var(--rk-text))!important;}\nhtml body[data-rk-palette][data-rk-mode]{--rk-text-page-surface:var(--rk-bg)!important;}\n.rk-field-color-toolbar{position:relative;display:inline-flex;flex:0 0 auto;margin:0;font-family:var(--hand);}\n.rk-field-color-toolbar .rk-field-color-menu{left:auto;right:0;min-width:0;grid-template-columns:repeat(6,36px);gap:4px;z-index:100;}\n.rk-field-color-menu button.rk-color-option{width:36px;height:36px;padding:6px;justify-content:center;border:1px solid transparent;border-radius:6px;}\n.rk-field-color-menu button.rk-color-option[aria-pressed=true]{border-color:var(--rk-text,var(--text));}\n.rk-contents-menu{position:absolute;top:calc(100% + 6px);left:0;z-index:60;min-width:240px;max-width:min(420px,85vw);max-height:min(55vh,420px);overflow:auto;display:grid;gap:4px;padding:8px;background:var(--rk-bg,var(--bg));color:var(--rk-text,var(--text));border:1px solid var(--line);border-radius:8px;}\n.rk-contents-menu[hidden]{display:none!important;}\n.rk-contents-menu button{font:inherit;text-align:left;white-space:normal;padding:8px 12px;border:0;background:transparent;color:var(--rk-text,var(--text));cursor:pointer;}\n.rk-contents-menu button[aria-current=page]{text-decoration:underline;}\n.rk-contents-menu .rk-add-chapter{border-top:1px solid var(--line);margin-top:4px;padding-top:12px;}\n\n/* Interactive boards: all selectors are confined to the new block. */\n.rk-board{font-family:var(--hand);color:var(--rk-text,var(--text));min-width:0;}\n.rk-board-toolbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:10px;}\n.rk-board-toolbar .btn{font:inherit;padding:6px 10px;white-space:nowrap;}\n.rk-board-toolbar [aria-pressed=true]{outline:2px solid var(--rk-secondary);outline-offset:1px;}\n.rk-board-colors{display:flex;gap:3px;align-items:center;}\n.rk-board-colors button{width:28px;height:28px;padding:4px;display:flex;align-items:center;justify-content:center;border:1px solid transparent;background:transparent;border-radius:5px;}\n.rk-board-colors button[aria-pressed=true]{border-color:var(--rk-text);}\n.rk-board-colors span{width:18px;height:18px;border-radius:50%;border:1px solid var(--line);display:block;}\n.rk-board-viewport{height:min(70vh,720px);min-height:380px;position:relative;overflow:hidden;border:1px solid var(--line);border-radius:8px;touch-action:none;user-select:none;background-color:var(--rk-bg,var(--bg));background-image:radial-gradient(circle,color-mix(in srgb,var(--rk-text,var(--text)) 22%,transparent) 1px,transparent 1px);outline-offset:3px;}\n#view2 .rk-board-viewport{height:58vh;min-height:330px;}\n.rk-board-viewport[data-tool=hand]{cursor:grab;}\n.rk-board-viewport[data-tool=pen],.rk-board-viewport[data-tool=connect]{cursor:crosshair;}\n.rk-board-world{position:absolute;left:0;top:0;width:0;height:0;transform-origin:0 0;}\n.rk-board-edges{position:absolute;left:0;top:0;width:1px;height:1px;overflow:visible;pointer-events:none;}\n.rk-board-edge{fill:none;stroke:var(--rk-secondary);stroke-width:3;pointer-events:stroke;cursor:pointer;}\n.rk-board-edge.is-selected{stroke:var(--rk-hover);stroke-width:5;}\n.rk-board-item{position:absolute;box-sizing:border-box;display:flex;align-items:stretch;border:1px solid color-mix(in srgb,currentColor 55%,transparent);border-radius:5px;cursor:move;overflow:visible;}\n.rk-board-item[data-kind=ellipse]{border-radius:50%;}\n.rk-board-item[data-kind=text],.rk-board-item[data-kind=pen],.rk-board-item[data-kind=image]{border-color:transparent;}\n.rk-board-item.is-selected{outline:2px solid var(--rk-secondary);outline-offset:3px;}\n.rk-board-item.is-source{outline:3px dashed var(--rk-hover);outline-offset:3px;}\n.rk-board-text{box-sizing:border-box;flex:1;min-width:0;padding:12px;white-space:pre-wrap;overflow-wrap:anywhere;overflow:hidden;font:20px/1.35 var(--hand);color:inherit;outline:none;}\n.rk-board-item[data-kind=ellipse] .rk-board-text{padding:22px;text-align:center;}\n.rk-board-text[contenteditable=true]{cursor:text;user-select:text;overflow:auto;}\n.rk-board-item img{width:100%;height:100%;object-fit:contain;pointer-events:none;user-select:none;}\n.rk-board-item>svg{width:100%;height:100%;overflow:visible;pointer-events:none;}\n.rk-board-resize{display:none;position:absolute;right:-5px;bottom:-5px;width:13px;height:13px;border:1px solid var(--rk-bg);background:var(--rk-secondary);cursor:nwse-resize;border-radius:2px;}\n.rk-board-item.is-selected .rk-board-resize{display:block;}\n.rk-board-help{font-size:15px;line-height:1.4;opacity:.75;margin:8px 0;}\n.rk-board-status{min-width:36px;text-align:center;font-size:15px;}\n.rk-board-zoom{display:flex;gap:4px;align-items:center;}\n.rk-board-empty{position:absolute;inset:40% 15px auto;text-align:center;opacity:.65;pointer-events:none;font-size:18px;}\n\n.rk-board-colors button[hidden]{display:none!important;}\n\n/* Timeline media v1 */\n.rk-timeline-media{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr));gap:12px;margin:12px 0;}\n.rk-timeline-attachment{margin:0;min-width:0;overflow:hidden;}\n.rk-timeline-attachment img,.rk-timeline-attachment video{display:block;width:100%;max-height:340px;object-fit:contain;border-radius:6px;background:transparent;}\n.rk-timeline-attachment video{touch-action:auto;}\n.rk-timeline-attachment figcaption{font-size:14px;overflow-wrap:anywhere;margin:6px 0;opacity:.8;}\n.rk-timeline-media-url{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;}\n.rk-timeline-media-url input{flex:1 1 160px;min-width:0;}\n.rk-timeline-media-link summary{cursor:pointer;}\n.rk-timeline-media-hint,.rk-timeline-media-status{font-size:14px;line-height:1.45;white-space:normal;}\n.rk-timeline-media-hint{opacity:.75;}\n.rk-timeline-media-status:empty{display:none;}\n.rk-timeline-media-editor input[type=file][hidden]{display:none!important;}\n";
 const icons={dark:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>',light:'<path d="M20 14a8 8 0 0 1-10-10 8 8 0 1 0 10 10Z"/>'};
 let storage=null;try{storage=window.localStorage;}catch(e){}
 let saved={};try{saved=JSON.parse(storage&&storage.getItem(STORAGE_KEY)||'{}')||{};}catch(e){}
 let project='main';try{project=JSON.parse(storage&&storage.getItem('wsblankProjects')||'{}').cur||'main';}catch(e){}
 let toggle;
 function palette(){const value=document.body.dataset.palette;return value==='indigo'||value==='terra'?value:'base';}
 function key(){return project+':'+palette();}
 function mode(){return saved[key()]==='light'?'light':'dark';}
 function persist(){try{if(storage)storage.setItem(STORAGE_KEY,JSON.stringify(saved));}catch(e){}
  try{const prefs=JSON.parse(storage&&storage.getItem('wsblank1prefs')||'{}');prefs.theme=mode();if(storage)storage.setItem('wsblank1prefs',JSON.stringify(prefs));}catch(e){}
 }
 function setMode(next){saved[key()]=next==='light'?'light':'dark';persist();sync();}
 function sync(){
  const p=palette(),m=mode(),body=document.body;
  if(body.dataset.rkPalette!==p)body.dataset.rkPalette=p;
  if(body.dataset.rkMode!==m)body.dataset.rkMode=m;
  if(body.dataset.theme!==m)body.dataset.theme=m;
  const label=m==='dark'?'Включить светлую тему':'Включить тёмную тему';
  if(toggle){toggle.title=label;toggle.setAttribute('aria-label',label);toggle.setAttribute('aria-pressed',String(m==='light'));if(toggle.dataset.mode!==m){toggle.dataset.mode=m;toggle.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icons[m]+'</svg>';}}
  const original=document.getElementById('btnTheme');if(original){original.title=label;original.setAttribute('aria-label',label);original.onclick=()=>setMode(mode()==='dark'?'light':'dark');}
  document.querySelectorAll('.rk-mode-options button').forEach(b=>{const pressed=String(b.dataset.mode===m);if(b.getAttribute('aria-pressed')!==pressed)b.setAttribute('aria-pressed',pressed);});
 }
 function enhanceDialog(){
  const form=document.getElementById('lookForm');if(!form||form.querySelector('.rk-mode-field'))return;
  const field=document.createElement('div');field.className='field rk-mode-field';
  field.innerHTML='<label>Тема</label><div class="rk-mode-options" role="group" aria-label="Тема оформления"><button type="button" class="btn" data-mode="dark">Тёмная</button><button type="button" class="btn" data-mode="light">Светлая</button></div>';
  const paletteField=form.querySelector('input[name=palette]');if(paletteField)paletteField.closest('.field').after(field);else form.prepend(field);
  field.querySelectorAll('button').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));sync();
 }
 function install(){
  if(document.getElementById('rakurs-exact-palette-themes'))return;
  const style=document.createElement('style');style.id='rakurs-exact-palette-themes';style.textContent=css;document.head.appendChild(style);
  const head=document.querySelector('#side .side-head');if(head){toggle=document.createElement('button');toggle.type='button';toggle.id='rkThemeToggle';toggle.className='rk-theme-button';toggle.onclick=()=>setMode(mode()==='dark'?'light':'dark');const projects=document.getElementById('btnProjects');if(projects)projects.before(toggle);else head.append(toggle);}
  sync();enhanceDialog();
  new MutationObserver(()=>{sync();}).observe(document.body,{attributes:true,attributeFilter:['data-palette','data-theme']});
  const dialogObserver=new MutationObserver(()=>enhanceDialog());dialogObserver.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY){try{saved=JSON.parse(e.newValue||'{}')||{};sync();}catch(err){}}});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

/* Collapsible sidebar saving controls: move original nodes, keep their handlers. */
(function(){
 'use strict';
 function install(){
  const foot=document.querySelector('#side .side-foot');if(!foot||foot.querySelector('.ws-save-menu'))return;
  const status=document.getElementById('storageState'),links=foot.querySelector('.foot-links');if(!links)return;
  const menu=document.createElement('details');menu.className='ws-save-menu';
  const summary=document.createElement('summary');summary.textContent='Сохранение';summary.setAttribute('aria-controls','rkSaveContent');summary.setAttribute('aria-expanded','false');
  const content=document.createElement('div');content.className='ws-save-content';content.id='rkSaveContent';
  menu.append(summary,content);if(status)content.append(status);content.append(links);foot.append(menu);
  menu.addEventListener('toggle',()=>summary.setAttribute('aria-expanded',String(menu.open)));
  document.addEventListener('click',e=>{if(menu.open&&!menu.contains(e.target))menu.open=false;});
  links.addEventListener('click',e=>{if(e.target.closest('button'))menu.open=false;});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu.open){menu.open=false;summary.focus();}});
  const style=document.createElement('style');style.id='rk-sidebar-saving-controls';style.textContent=`
 html body #side .side-foot{position:relative;overflow:visible!important;}
 html body #side .side-foot .ws-save-menu{position:relative;display:block;width:100%;margin:0;padding:0;border:0;}
 html body #side .side-foot .ws-save-menu>summary{display:flex!important;align-items:center;justify-content:center;box-sizing:border-box;width:100%;min-height:46px;padding:12px 16px;list-style:none;cursor:pointer;font:inherit;text-align:center;text-decoration:none;border:1px solid var(--rust,#723424)!important;border-radius:8px;background:var(--rust,#723424)!important;color:var(--rk-light,#E5E0CF)!important;box-shadow:none!important;}
 html body #side .side-foot .ws-save-menu>summary::-webkit-details-marker{display:none;}
 html body #side .side-foot .ws-save-menu>summary::marker{content:'';}
 html body #side .side-foot .ws-save-menu>summary:hover{background:var(--rust-2,#AC6F40)!important;border-color:var(--rust-2,#AC6F40)!important;}
 html body #side .side-foot .ws-save-menu:not([open])>.ws-save-content{display:none!important;}
 html body #side .side-foot .ws-save-menu[open]>.ws-save-content{display:block!important;position:absolute;left:0;right:0;bottom:calc(100% + 10px);z-index:120;box-sizing:border-box;padding:16px;border:1px solid var(--line-strong);border-radius:8px;background:var(--rk-bg,var(--bg))!important;color:var(--rk-text,var(--text));max-height:min(60vh,360px);overflow:auto;}
 html body #side .side-foot .ws-save-content .foot-links{display:flex!important;flex-direction:column;align-items:stretch;gap:12px;margin:0;}
 html body #side .side-foot .ws-save-content .foot-links button{width:100%;text-align:left;white-space:normal;}
 html body #side .side-foot .ws-save-content #storageState{display:block!important;margin:0 0 14px;}
 html body.ws-block-dnd #side #toc a,html body.ws-block-dnd #view .ws-card,html body.ws-block-dnd #view .ws-add-card,html body.ws-block-dnd #view .ws-grid,html body.ws-block-dnd .ws-crumbs a,html body.ws-block-dnd #crumb a,html body.ws-block-dnd .ws-block-before,html body.ws-block-dnd .ws-block-after,html body.ws-block-dnd .ws-block-append,html body.ws-block-dnd .ws-block-into{outline:none!important;box-shadow:none!important;}
 `;document.head.appendChild(style);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

/* Sidebar visibility controls only. Existing application handlers stay unchanged. */
(function(){
 'use strict';
 function install(){
  if(document.getElementById('rkSidebarToggle'))return;
  const side=document.getElementById('side'),head=side&&side.querySelector('.side-head'),native=document.getElementById('btnHideSide');
  if(!head||!native)return;
  const icon='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M9 4.5v15M15.5 9l-3 3 3 3"/></svg>';
  const hide=document.createElement('button');hide.type='button';hide.id='rkSidebarToggle';hide.className='icon-btn';hide.title='Скрыть боковую панель';hide.setAttribute('aria-label',hide.title);hide.setAttribute('aria-controls','side');hide.innerHTML=icon;
  const show=document.createElement('button');show.type='button';show.id='rkSidebarRestore';show.className='icon-btn';show.title='Показать боковую панель';show.setAttribute('aria-label',show.title);show.setAttribute('aria-controls','side');show.innerHTML=icon;
  const projects=document.getElementById('btnProjects');if(projects&&projects.parentElement===head)head.insertBefore(hide,projects);else head.appendChild(hide);
  document.body.appendChild(show);
  function sync(){const hidden=document.body.classList.contains('side-hidden');show.hidden=!hidden;hide.setAttribute('aria-expanded',String(!hidden));show.setAttribute('aria-expanded',String(!hidden));}
  hide.addEventListener('click',()=>{
   if(side.classList.contains('open')){const close=document.getElementById('btnCloseSide');if(close){close.click();return;}}
   native.click();sync();if(!show.hidden)show.focus();
  });
  show.addEventListener('click',()=>{
   if(document.body.classList.contains('side-hidden'))native.click();
   sync();
   const r=side.getBoundingClientRect();
   if(r.right<=0){const opener=document.getElementById('btnSide');if(opener)opener.click();}
   hide.focus();
  });
  new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});
  const style=document.createElement('style');style.id='rk-sidebar-visibility-controls';style.textContent=`
 html body #side .side-head #rkSidebarToggle{position:static!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;flex:0 0 30px!important;width:30px!important;height:32px!important;min-width:30px!important;padding:5px!important;margin:0!important;transform:none!important;color:var(--rk-text,var(--text))!important;background:transparent!important;border:0!important;border-radius:4px;cursor:pointer;}
 html body #rkSidebarRestore{position:fixed!important;top:12px;left:12px;z-index:125;display:inline-flex!important;align-items:center;justify-content:center;width:34px;height:34px;padding:6px;box-sizing:border-box;color:var(--rk-text,var(--text));background:var(--rk-bg,var(--bg));border:1px solid var(--line-strong);border-radius:5px;cursor:pointer;}
 html body #rkSidebarRestore[hidden]{display:none!important;}
 html body #rkSidebarRestore svg{transform:rotate(180deg);}
 html body #side .side-head #rkSidebarToggle svg,html body #rkSidebarRestore svg{display:block;flex:none;width:18px;height:18px;}
 `;document.head.appendChild(style);sync();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

/* Text toolbar duplicates and folder card appearance only. */
(function(){
 'use strict';
 function install(){
  if(document.getElementById('rk-text-toolbar-folder-finish'))return;
  const style=document.createElement('style');style.id='rk-text-toolbar-folder-finish';style.textContent=`
 html body .bar #btnFocus,html body .bar #btnTheme{display:none!important;}
 html body #view .ws-card[data-ws-kind="folder"],
 html body #view .ws-card[data-ws-kind="folder"]:hover{
  position:relative!important;isolation:isolate;overflow:visible!important;
  background:transparent!important;border-color:transparent!important;box-shadow:none!important;
 }
 html body #view .ws-card[data-ws-kind="folder"]::before,
 html body #view .ws-card[data-ws-kind="folder"]::after{display:none!important;content:none!important;}
 html body #view .ws-card[data-ws-kind="folder"]>.rk-folder-contour{
  position:absolute!important;display:block!important;left:-1px;top:-13px;
  width:calc(100% + 2px)!important;height:calc(100% + 14px)!important;
  max-width:none!important;max-height:none!important;overflow:hidden;
  z-index:-1;pointer-events:none;user-select:none;
 }
 html body #view .ws-card[data-ws-kind="folder"]>.rk-folder-contour>path{
  fill:#723424!important;stroke:var(--line-strong,var(--line,#888))!important;stroke-width:1.4px;
 }
 html body #view .ws-card[data-ws-kind="folder"]:hover>.rk-folder-contour>path{stroke:var(--rk-hover,#AC6F40)!important;}
 `;document.head.appendChild(style);
  const view=document.getElementById('view');if(!view)return;
  function draw(){view.querySelectorAll('.ws-card[data-ws-kind="folder"]').forEach(card=>{
   if(card.querySelector(':scope > .rk-folder-contour'))return;
   const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
   svg.setAttribute('class','rk-folder-contour');svg.setAttribute('viewBox','0 0 320 180');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
   const path=document.createElementNS('http://www.w3.org/2000/svg','path');
   path.setAttribute('d','M14 14H28V8Q28 2 34 2H108Q114 2 114 8V14H306Q318 14 318 26V166Q318 178 306 178H14Q2 178 2 166V26Q2 14 14 14Z');
   path.setAttribute('vector-effect','non-scaling-stroke');path.setAttribute('stroke-linejoin','round');svg.appendChild(path);card.prepend(svg);
  });}
  new MutationObserver(draw).observe(view,{childList:true,subtree:true});draw();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

/* Current-project secondary panel: no inherited story-specific tabs or groups. */
(function(){
 function install(){
  if(document.getElementById('rk-current-project-pane'))return;
  const style=document.createElement('style');style.id='rk-current-project-pane';style.textContent=`
 html body #view2 .pane-tabs{display:none!important;}
 html body #view2 .pane-head{display:flex!important;align-items:center;gap:8px;flex-wrap:nowrap;}
 html body #view2 #view2Select{display:block!important;flex:1 1 auto;min-width:0;width:auto;}
 html body #view2 .ws-pane-summary p{white-space:pre-wrap;overflow-wrap:anywhere;}
 html body #view2 .ws-block-image img{max-width:100%;height:auto;}
 `;document.head.appendChild(style);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

/* Secondary pane picker and collapse controls: presentation only. */
(function(){
 'use strict';
 function install(){
  if(document.getElementById('rkPanePicker'))return;
  const pane=document.getElementById('view2'),select=document.getElementById('view2Select');if(!pane||!select)return;
  const paths={folder:'<path d="M3 7V4h6l3 4h9v13H3z"/>',text:'<path d="M5 2h9l5 5v15H5zM14 2v6h5M8 12h8M8 16h8"/>',character:'<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',timeline:'<path d="M2 12h20M7 6v12M12 3v18M17 7v10"/>',map:'<path d="m3 4 6-2 6 2 6-2v19l-6 2-6-2-6 2zM9 2v19M15 4v19"/>',location:'<path d="M20 10c0 6-8 13-8 13S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>'};
  function svg(path){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+path+'</svg>';}
  const wrap=document.createElement('div');wrap.id='rkPanePicker';
  const trigger=document.createElement('button');trigger.id='rkPanePickerTrigger';trigger.type='button';trigger.setAttribute('role','combobox');trigger.setAttribute('aria-label','Блок текущего проекта');trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-controls','rkPaneBlockList');trigger.setAttribute('aria-expanded','false');
  const list=document.createElement('div');list.id='rkPaneBlockList';list.setAttribute('role','listbox');list.setAttribute('aria-label','Блоки текущего проекта');list.hidden=true;
  wrap.append(trigger,list);select.before(wrap);select.classList.add('rk-pane-native');select.tabIndex=-1;select.setAttribute('aria-hidden','true');
  const min=document.getElementById('view2Min'),max=document.getElementById('view2Max');
  if(min){min.innerHTML=svg('<rect x="3.5" y="5" width="17" height="14" rx="1.5"/><path d="M15 5v14M8 9l3 3-3 3"/>');min.title='Свернуть вторую страницу';min.setAttribute('aria-label',min.title);}
  if(max){max.innerHTML=svg('<rect x="3.5" y="5" width="17" height="14" rx="1.5"/><path d="M15 5v14M11 9l-3 3 3 3"/>');max.title='Развернуть вторую страницу';max.setAttribute('aria-label',max.title);}
  let entries=[],key='',scheduled=false;
  function close(focus){list.hidden=true;trigger.setAttribute('aria-expanded','false');if(focus)trigger.focus();}
  function rows(){return Array.from(list.querySelectorAll('[role=option]'));}
  function open(which){if(trigger.disabled||document.body.classList.contains('pane-min'))return;sync();list.hidden=false;trigger.setAttribute('aria-expanded','true');const all=rows(),i=all.findIndex(b=>b.dataset.value===select.value);const row=which==='last'?all[all.length-1]:which==='first'?all[0]:all[Math.max(0,i)];if(row)row.focus();}
  function rowContent(el,entry){
   const name=document.createElement('span');name.className='rk-pane-name';name.textContent=entry.title;
   const icon=document.createElement('span');icon.className='rk-pane-kind';icon.setAttribute('aria-hidden','true');icon.innerHTML=svg(paths[entry.kind]||paths.text);
   el.replaceChildren(name,icon);el.title=entry.path;
  }
  function choose(value){
   if(select.disabled||!Array.from(select.options).some(o=>o.value===value))return;
   select.value=value;close(true);select.dispatchEvent(new Event('change',{bubbles:true}));sync();
  }
  function sync(){
   scheduled=false;
   const reference=document.querySelector('#toc a[data-page] .t')||document.querySelector('#toc .ws-toc-home');
   if(reference){const font=getComputedStyle(reference);['font-family','font-size','font-weight','font-style','letter-spacing','line-height','text-transform'].forEach(prop=>wrap.style.setProperty(prop,font.getPropertyValue(prop)));}
   entries=Array.from(select.options).filter(o=>o.value&&!o.disabled).map(o=>({value:o.value,title:o.dataset.title||o.textContent,kind:o.dataset.kind||'text',depth:Number(o.dataset.depth)||0,path:o.textContent}));
   const next=JSON.stringify(entries);
   if(next!==key){key=next;list.replaceChildren();entries.forEach((entry,i)=>{
    const row=document.createElement('button');row.type='button';row.className='rk-pane-option';row.setAttribute('role','option');row.id='rkPaneOption'+i;row.tabIndex=-1;row.dataset.value=entry.value;row.style.setProperty('--rk-depth',entry.depth);rowContent(row,entry);row.addEventListener('click',()=>choose(entry.value));list.appendChild(row);
   });}
   const current=entries.find(x=>x.value===select.value);
   if(current){rowContent(trigger,current);trigger.setAttribute('aria-activedescendant','rkPaneOption'+entries.indexOf(current));}
   else{trigger.textContent='В проекте пока нет блоков';trigger.removeAttribute('aria-activedescendant');}
   let arrow=trigger.querySelector('.rk-pane-chevron');if(!arrow){arrow=document.createElement('span');arrow.className='rk-pane-chevron';arrow.setAttribute('aria-hidden','true');arrow.innerHTML=svg('<path d="M7 10l5 5 5-5"/>');trigger.appendChild(arrow);}
   trigger.disabled=select.disabled||!entries.length;
   rows().forEach(row=>row.setAttribute('aria-selected',String(row.dataset.value===select.value)));
   if(trigger.disabled||document.body.classList.contains('pane-min'))close(false);
  }
  function queue(){if(!scheduled){scheduled=true;queueMicrotask(sync);}}
  trigger.addEventListener('click',()=>{if(list.hidden)open();else close(false);});
  trigger.addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();open(e.key==='End'||e.key==='ArrowUp'?'last':'first');}else if(e.key==='Escape')close(false);});
  list.addEventListener('keydown',e=>{
   const all=rows(),i=all.indexOf(document.activeElement);let next=i;
   if(e.key==='ArrowDown')next=(i+1)%all.length;else if(e.key==='ArrowUp')next=(i-1+all.length)%all.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=all.length-1;
   else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(true);return;}else if(e.key==='Tab'){close(false);return;}else return;
   e.preventDefault();if(all[next])all[next].focus();
  });
  document.addEventListener('pointerdown',e=>{if(!wrap.contains(e.target))close(false);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!list.hidden){e.preventDefault();close(true);}});
  select.addEventListener('rk-pane-sync',sync);select.addEventListener('change',sync);
  new MutationObserver(queue).observe(select,{childList:true,subtree:true,attributes:true,characterData:true});
  const content=document.getElementById('view2Body');if(content)new MutationObserver(queue).observe(content,{childList:true,subtree:true});
  new MutationObserver(()=>{queue();if(document.body.classList.contains('pane-min')&&pane.contains(document.activeElement)&&max)max.focus();}).observe(document.body,{attributes:true,attributeFilter:['class','style','data-rk-mode','data-rk-palette']});
  const toc=document.getElementById('toc');if(toc)new MutationObserver(queue).observe(toc,{childList:true,subtree:true});
  const style=document.createElement('style');style.id='rk-pane-picker-style';style.textContent=`
 html body #view2 #view2Select.rk-pane-native{display:none!important;}
 html body #view2 .pane-head{overflow:visible!important;}
 html body #view2 #rkPanePicker{position:relative;flex:1 1 auto;min-width:0;z-index:6;}
 html body #view2 #rkPanePickerTrigger,html body #view2 .rk-pane-option{display:flex;align-items:center;gap:9px;box-sizing:border-box;width:100%;margin:0;font:inherit;letter-spacing:inherit;text-transform:inherit;text-align:left;color:var(--rk-text,var(--text))!important;background:var(--rk-bg,var(--bg))!important;box-shadow:none!important;cursor:pointer;}
 html body #view2 #rkPanePickerTrigger{min-height:36px;padding:8px 10px;border:1px solid var(--line-strong)!important;border-radius:5px;}
 html body #view2 #rkPanePickerTrigger:disabled{opacity:.6;cursor:default;}
 html body #view2 #rkPaneBlockList{position:absolute;top:calc(100% + 6px);left:0;right:0;z-index:20;max-height:min(60vh,420px);overflow:auto;overscroll-behavior:contain;padding:5px;border:1px solid var(--line-strong);border-radius:6px;background:var(--rk-bg,var(--bg));box-shadow:0 8px 24px #0003;}
 html body #view2 #rkPaneBlockList[hidden]{display:none!important;}
 html body #view2 .rk-pane-option{min-height:36px;padding:8px 10px 8px calc(10px + var(--rk-depth,0)*14px);border:0!important;border-radius:4px;}
 html body #view2 .rk-pane-option:hover,html body #view2 .rk-pane-option[aria-selected="true"]{background:color-mix(in srgb,var(--rk-secondary,var(--green)) 18%,var(--rk-bg,var(--bg)))!important;}
 html body #view2 .rk-pane-option:focus-visible,html body #view2 #rkPanePickerTrigger:focus-visible{outline:1px solid var(--rk-secondary,var(--green))!important;outline-offset:-2px;}
 html body #view2 .rk-pane-name{flex:1 1 auto;min-width:0;overflow-wrap:anywhere;}
 html body #view2 .rk-pane-kind{display:inline-flex;flex:0 0 15px;width:15px;height:15px;opacity:.75;}
 html body #view2 .rk-pane-kind svg{display:block;width:15px;height:15px;}
 html body #view2 .rk-pane-chevron{display:inline-flex;flex:0 0 14px;width:14px;height:14px;}
 html body #view2 .rk-pane-chevron svg{display:block;width:14px;height:14px;}
 html body #view2 #view2Min,html body #view2 #view2Max{writing-mode:horizontal-tb!important;text-orientation:mixed!important;transform:none!important;font-size:0!important;line-height:0!important;border-radius:5px!important;box-sizing:border-box;}
 html body #view2 #view2Min{display:inline-flex!important;align-items:center;justify-content:center;flex:0 0 32px;width:32px;height:32px;padding:6px!important;}
 html body #view2 #view2Min svg,html body #view2 #view2Max svg{display:block;width:20px;height:20px;flex:none;}
 html body:not(.pane-min) #view2 #view2Max{display:none!important;}
 html body.pane-min #view2{width:46px!important;min-width:46px!important;overflow:hidden!important;}
 html body.pane-min #view2>:not(#view2Max){display:none!important;}
 html body.pane-min #view2 #view2Max{display:flex!important;align-items:center;justify-content:center;position:absolute!important;inset:10px auto auto 7px!important;width:32px!important;height:32px!important;min-height:0!important;padding:6px!important;margin:0!important;box-shadow:none!important;border-color:transparent!important;}
 `;document.head.appendChild(style);sync();
  if(document.fonts)document.fonts.ready.then(queue);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

/* Keep button labels legible on hover and keyboard focus in every palette. */
(function(){
 'use strict';
 const selector='button,[role="button"],summary,input[type="button"],input[type="submit"],.btn,.link-btn,.icon-btn,.link';
 const active=new Map();let hovered=null,focused=null;
 function ink(bg){const m=bg.match(/#[0-9a-f]{6}|#[0-9a-f]{3}/i);if(!m)return '#000000';let h=m[0].slice(1);if(h.length===3)h=h.split('').map(x=>x+x).join('');const c=h.match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4));const l=c[0]*.2126+c[1]*.7152+c[2]*.0722;return (l+.05)/.05>=1.05/(l+.05)?'#000000':'#ffffff';}
 function restore(el){const saved=active.get(el);if(!saved)return;saved.forEach(([node,props])=>props.forEach(([name,value,priority])=>{if(value)node.style.setProperty(name,value,priority);else node.style.removeProperty(name);}));active.delete(el);}
 function paint(el){if(!el||el.disabled||el.getAttribute('aria-disabled')==='true')return;if(active.has(el))restore(el);const bg=getComputedStyle(document.body).getPropertyValue('--rk-hover').trim()||'#AC6F40',fg=ink(bg),saved=[];
  const set=(node,props)=>{saved.push([node,props.map(([name])=>[name,node.style.getPropertyValue(name),node.style.getPropertyPriority(name)])]);props.forEach(([name,value])=>node.style.setProperty(name,value,'important'));};
  set(el,[['transition-property','none'],['background-color',bg],['background-image','none'],['color',fg]]);
  el.querySelectorAll('*').forEach(node=>{if(node instanceof HTMLElement)set(node,[['color',fg]]);});active.set(el,saved);
 }
 function sync(){for(const el of [...active.keys()])if(el!==hovered&&el!==focused)restore(el);if(hovered)paint(hovered);if(focused&&focused!==hovered)paint(focused);}
 document.addEventListener('pointerover',e=>{const el=e.target.closest&&e.target.closest(selector);if(el!==hovered){hovered=el;sync();}},true);
 document.addEventListener('pointerout',e=>{const el=e.relatedTarget&&e.relatedTarget.closest&&e.relatedTarget.closest(selector);if(el!==hovered){hovered=el;sync();}},true);
 document.addEventListener('focusin',e=>{focused=e.target.closest&&e.target.closest(selector);sync();},true);
 document.addEventListener('focusout',()=>{focused=null;sync();},true);
 new MutationObserver(()=>{sync();document.querySelectorAll('[data-rk-text-page]').forEach(host=>{const id=host.dataset.rkTextPage;host.dispatchEvent(new CustomEvent('rk-field-palette-change',{detail:id}));});}).observe(document.body,{attributes:true,attributeFilter:['data-rk-palette','data-rk-mode']});
})();


/* RAKURS_TYPOGRAPHY_V1_START */
(function(){
 'use strict';
 const css="\n/* Rakurs typography v1: only font sizes and line heights. */\nhtml body[data-rk-typography=v1]{\n --rk-ui-caption:.875rem;--rk-ui-badge:.75rem;--rk-ui-control:1rem;--rk-ui-body:1.125rem;--rk-ui-card:1.25rem;\n --rk-ui-h3:1.5rem;--rk-ui-h2:1.75rem;--rk-ui-h1:2.25rem;--rk-ui-brand:2rem;\n --rk-reading-size:17px;\n --rk-h1:max(var(--rk-ui-h1),calc(var(--rk-reading-size) * 1.9));\n --rk-h2:max(var(--rk-ui-h2),calc(var(--rk-reading-size) * 1.6));\n --rk-h3:max(var(--rk-ui-h3),calc(var(--rk-reading-size) * 1.4));\n --rk-h4:max(1.375rem,calc(var(--rk-reading-size) * 1.25));\n --rk-h5:max(1.25rem,calc(var(--rk-reading-size) * 1.125));\n --rk-h6:max(1.125rem,calc(var(--rk-reading-size) * 1.05));\n}\nhtml body[data-rk-typography=v1] :is(h1,.page-title,.page-head h1,.ws-home-title){font-size:var(--rk-h1)!important;line-height:1.2!important;}\nhtml body[data-rk-typography=v1] :is(h2,.section-title,.g-title,.home-group>h2){font-size:var(--rk-h2)!important;line-height:1.25!important;}\nhtml body[data-rk-typography=v1] h3{font-size:var(--rk-h3)!important;line-height:1.3!important;}\nhtml body[data-rk-typography=v1] h4{font-size:var(--rk-h4)!important;line-height:1.3!important;}\nhtml body[data-rk-typography=v1] h5{font-size:var(--rk-h5)!important;line-height:1.35!important;}\nhtml body[data-rk-typography=v1] h6{font-size:var(--rk-h6)!important;line-height:1.35!important;}\nhtml body[data-rk-typography=v1] :is(.ws-card-title,.card .h,.card .title,.ch-title,.ws-events h3,.ws-pin-list h3,.char-card h3,.cc-head h3){font-size:var(--rk-ui-card)!important;line-height:1.3!important;}\nhtml body[data-rk-typography=v1] :is(.dlgbox-head h3,.dlgbox-head h2,.dlgbox-head h1,.sheet-head h3,.note-sheet-head h3){font-size:var(--rk-ui-h3)!important;line-height:1.3!important;}\nhtml body[data-rk-typography=v1] :is(button,input[type=button],input[type=submit],input[type=reset],summary,[role=button],.btn,.chip,.link,.link-btn,.toc-new,.ws-add-card,.popmenu,.rk-contents-menu,.rk-pane-option,.rk-pane-picker-trigger):not(.icon-btn,.ws-pin,.rk-theme-button,.ws-drag-handle,.rk-color-option,[data-board-color],[id=view2Min],[id=view2Max],[id=rkThemeToggle]){font-size:var(--rk-ui-control)!important;line-height:1.35!important;}\nhtml body[data-rk-typography=v1] :is(button,.btn,.chip,.link,.link-btn,.rk-pane-option,.rk-pane-picker-trigger)>:is(span,strong,b):not(.badge):not(.rk-pane-kind):not(.rk-pane-chevron):not(.rk-field-color-swatch){font-size:inherit!important;line-height:inherit!important;}\nhtml body[data-rk-typography=v1] :is(input:not([type=checkbox]):not([type=radio]):not([type=color]):not([type=range]):not([type=file]):not([type=hidden]):not([type=button]):not([type=submit]):not([type=reset]),textarea,select){font-size:var(--rk-ui-body)!important;line-height:1.5!important;}\nhtml body[data-rk-typography=v1] :is(input,textarea)::placeholder{font-size:inherit!important;line-height:inherit!important;}\nhtml body[data-rk-typography=v1] :is(.field>label,.ws-fields label,.ws-kind-select legend,.lbl,.ws-type,.ws-event-date,.ws-crumbs,.kicker,.page-head .sub,.page-head .pov,.page-head .time,.ws-line-hint,.ws-empty,.ws-cover>.rk-cover-upload-hint,.rk-board-help,.rk-board-status,.rk-timeline-media-hint,.rk-timeline-media-status,.rk-timeline-attachment figcaption,.side-foot,.foot-links,.bar .saved,.bar .status,.ch-pov,.ch-meta,.toc-hint,.muted.small){font-size:var(--rk-ui-caption)!important;line-height:1.45!important;}\nhtml body[data-rk-typography=v1] :is(.field>label,.ws-fields label)>:is(span,small){font-size:inherit!important;}\nhtml body[data-rk-typography=v1] :is(.note,.note .txt,.note p.txt,.rk-board-text,.ws-content>.ws-empty,.ws-events>li>p,.ws-pane-summary p){font-size:var(--rk-ui-body)!important;line-height:1.5!important;}\nhtml body[data-rk-typography=v1] .note :is(.q,.meta,.kind){font-size:var(--rk-ui-caption)!important;line-height:1.45!important;}\nhtml body[data-rk-typography=v1] :is(.badge,.badges,.cnt){font-size:var(--rk-ui-badge)!important;line-height:1.2!important;}\nhtml body[data-rk-typography=v1] :is(#crumb,.pane-title,.ws-kind-select label>span){font-size:var(--rk-ui-body)!important;line-height:1.35!important;}\nhtml body[data-rk-typography=v1] #side .side-head .brand .brand-t{font-size:var(--rk-ui-brand)!important;line-height:1.1!important;}\nhtml body[data-rk-typography=v1] #toc .ws-toc-home{font-size:var(--rk-ui-card)!important;line-height:1.35!important;}\nhtml body[data-rk-typography=v1] #toc>a[data-page]{font-size:var(--rk-ui-body)!important;line-height:1.35!important;}\nhtml body[data-rk-typography=v1] #toc>a[data-page][data-rk-type-depth=\"1\"]{font-size:1.0625rem!important;}\nhtml body[data-rk-typography=v1] #toc>a[data-page][data-rk-type-depth=\"2\"]{font-size:var(--rk-ui-control)!important;}\nhtml body[data-rk-typography=v1] #toc>a[data-page]>.t{font-size:inherit!important;line-height:inherit!important;}\nhtml body[data-rk-typography=v1] .blocks{font-size:var(--rk-reading-size)!important;}\nhtml body[data-rk-typography=v1] .blocks :is(.blk.p,.blk.quote,.blk.callout,.blk.ul,.blk.ol,.blk.table)>.body{font-size:var(--rk-reading-size)!important;}\nhtml body[data-rk-typography=v1] .blocks :is(.blk.h1,.blk.h1>.body){font-size:var(--rk-h1)!important;line-height:1.2!important;}\nhtml body[data-rk-typography=v1] .blocks :is(.blk.h2,.blk.h2>.body){font-size:var(--rk-h2)!important;line-height:1.25!important;}\nhtml body[data-rk-typography=v1] .blocks :is(.blk.h3,.blk.h3>.body){font-size:var(--rk-h3)!important;line-height:1.3!important;}\nhtml body[data-rk-typography=v1] .blocks :is(.blk.h4,.blk.h4>.body){font-size:var(--rk-h4)!important;line-height:1.3!important;}\nhtml body[data-rk-typography=v1] .blocks :is(.blk.h5,.blk.h5>.body){font-size:var(--rk-h5)!important;line-height:1.35!important;}\nhtml body[data-rk-typography=v1] .blocks :is(.blk.h6,.blk.h6>.body){font-size:var(--rk-h6)!important;line-height:1.35!important;}\n@media(max-width:650px){html body[data-rk-typography=v1]{--rk-ui-h1:2rem;--rk-ui-h2:1.625rem;--rk-ui-h3:1.375rem;--rk-ui-body:1rem;--rk-ui-caption:.8125rem;}}\n\nhtml body[data-rk-typography=v1] #view2 :is(#rkPanePickerTrigger,.rk-pane-option){font-size:var(--rk-ui-control)!important;line-height:1.35!important;}\n";
 function install(){
  const body=document.body;if(!body)return;body.dataset.rkTypography='v1';
  let style=document.getElementById('rk-consistent-typography-v1');if(!style){style=document.createElement('style');style.id='rk-consistent-typography-v1';document.head.appendChild(style);}style.textContent=css;
  function reading(){const value=getComputedStyle(body).fontSize;if(value&&body.style.getPropertyValue('--rk-reading-size')!==value)body.style.setProperty('--rk-reading-size',value);}
  function tree(){document.querySelectorAll('#toc>a[data-page]').forEach(a=>{const depth=Math.min(2,Math.max(0,Math.round(((parseFloat(a.style.paddingLeft)||12)-12)/14))),value=String(depth);if(a.dataset.rkTypeDepth!==value)a.dataset.rkTypeDepth=value;});}
  let queued=false;function refresh(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;reading();tree();});}
  reading();tree();new MutationObserver(refresh).observe(body,{attributes:true,attributeFilter:['style','data-font','data-ui']});new MutationObserver(refresh).observe(body,{childList:true,subtree:true});window.addEventListener('resize',refresh,{passive:true});if(document.fonts)document.fonts.ready.then(refresh);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
/* RAKURS_TYPOGRAPHY_V1_END */


/* RAKURS_SPACING_V1_START */
(function(){'use strict';const css="\n/* Rakurs spacing v1: preserve typography, colors and positioned board objects. */\nhtml body[data-rk-spacing=v1]{--rk-space-1:4px;--rk-space-2:8px;--rk-space-3:12px;--rk-space-4:16px;--rk-space-5:20px;--rk-space-6:24px;--rk-space-8:32px;--rk-space-12:48px;--rk-page-pad:32px;--rk-card-pad:20px;--rk-section-gap:32px;--rk-field-gap:24px;--rk-dialog-pad:24px;}\nhtml body[data-rk-spacing=v1] #view{padding-inline:var(--rk-page-pad)!important;}\nhtml body[data-rk-spacing=v1] #view2Body{padding:16px!important;}\nhtml body[data-rk-spacing=v1] :is(#view,#view2Body) .page-head{margin-block:0 var(--rk-section-gap)!important;}\nhtml body[data-rk-spacing=v1] :is(#view,#view2Body) .page-head h1{margin-block:0!important;}\nhtml body[data-rk-spacing=v1] :is(#view,#view2Body) .page-head :is(.sub,.pov,.time){margin-block:8px 0!important;}\nhtml body[data-rk-spacing=v1] .ws-crumbs{margin-block:0 12px!important;}\nhtml body[data-rk-spacing=v1] .page-head>.ws-type{margin-block:0 8px!important;}\nhtml body[data-rk-spacing=v1] .pane-title{margin-block:0 24px!important;}\nhtml body[data-rk-spacing=v1] .ws-cover{margin-block:0 32px!important;}\nhtml body[data-rk-spacing=v1] .ws-cover-actions{gap:8px!important;inset-inline:16px!important;bottom:16px!important;}\nhtml body[data-rk-spacing=v1] .ws-home-title{margin-block:0 32px!important;}\nhtml body[data-rk-spacing=v1] .ws-home-title h1{margin:0!important;}\nhtml body[data-rk-spacing=v1] .ws-grid{gap:24px!important;}\nhtml body[data-rk-spacing=v1] :is(.ws-card,.ws-add-card){box-sizing:border-box;padding:var(--rk-card-pad)!important;gap:12px!important;}\nhtml body[data-rk-spacing=v1] .ws-card{padding-bottom:56px!important;}\nhtml body[data-rk-spacing=v1] .ws-card-icon{right:var(--rk-card-pad)!important;bottom:20px!important;}\nhtml body[data-rk-spacing=v1] .ws-card-title{margin:0!important;}\nhtml body[data-rk-spacing=v1] .ws-fields{gap:var(--rk-field-gap)!important;}\nhtml body[data-rk-spacing=v1] .field{margin:0!important;}\nhtml body[data-rk-spacing=v1] .field>label{display:block;margin:0 0 8px!important;}\nhtml body[data-rk-spacing=v1] .ws-content>.field+.field{margin-top:var(--rk-field-gap)!important;}\nhtml body[data-rk-spacing=v1] .field :is(input:not([type=checkbox]):not([type=radio]):not([type=color]):not([type=range]):not([type=file]):not([type=hidden]),textarea,select){box-sizing:border-box;margin-block:0!important;padding:8px 12px!important;}\nhtml body[data-rk-spacing=v1] .btn:not(.icon-btn):not(.ws-pin):not(.rk-color-option):not([data-board-color]){padding:8px 16px!important;}\nhtml body[data-rk-spacing=v1] :is(.head-tools,.pane-head,.ws-line-format,.rk-board-toolbar){gap:8px!important;}\nhtml body[data-rk-spacing=v1] .ws-toolbar{gap:8px 12px!important;margin-block:16px 24px!important;}\nhtml body[data-rk-spacing=v1] .ws-line-tools{margin-block:0 12px!important;}\nhtml body[data-rk-spacing=v1] .ws-line-hint{margin-block:0 16px!important;}\nhtml body[data-rk-spacing=v1] .ws-kind-select{gap:12px 16px!important;margin-block:0!important;}\nhtml body[data-rk-spacing=v1] .ws-kind-select legend{margin-bottom:12px!important;}\nhtml body[data-rk-spacing=v1] .ws-empty{margin-block:16px 0!important;padding-block:8px!important;}\nhtml body[data-rk-spacing=v1] .ws-block-image>img{margin-block:0 24px!important;}\nhtml body[data-rk-spacing=v1] .ws-map-canvas{margin-block:24px!important;}\nhtml body[data-rk-spacing=v1] .ws-pin-list>div{gap:16px!important;margin-block:0 16px!important;}\nhtml body[data-rk-spacing=v1] .dlgbox-head{padding:var(--rk-dialog-pad) var(--rk-dialog-pad) 16px!important;gap:16px!important;}\nhtml body[data-rk-spacing=v1] .dlgbox-head :is(h1,h2,h3){margin:0!important;}\nhtml body[data-rk-spacing=v1] .dlgbox-body{display:flex;flex-direction:column;gap:var(--rk-field-gap);padding:8px var(--rk-dialog-pad) var(--rk-dialog-pad)!important;}\nhtml body[data-rk-spacing=v1] .dlgbox-body>*{margin-block:0!important;min-width:0;}\nhtml body[data-rk-spacing=v1] .dlgbox-foot{gap:8px 12px!important;padding:16px var(--rk-dialog-pad) var(--rk-dialog-pad)!important;flex-wrap:wrap;}\nhtml body[data-rk-spacing=v1] .ws-events:not(.ws-events-horizontal){padding:0 0 0 24px!important;margin-block:0!important;}\nhtml body[data-rk-spacing=v1] .ws-events>li{padding:var(--rk-card-pad)!important;margin-block:0 24px!important;}\nhtml body[data-rk-spacing=v1] .ws-events:not(.ws-events-horizontal)>li:before{left:-31px!important;top:24px!important;}\nhtml body[data-rk-spacing=v1] .ws-events>li:last-child{margin-bottom:0!important;}\nhtml body[data-rk-spacing=v1] .ws-events>li>*{margin-block:0!important;}\nhtml body[data-rk-spacing=v1] .ws-events>li>*+*{margin-top:12px!important;}\nhtml body[data-rk-spacing=v1] .ws-events>li>h3{margin-top:8px!important;}\nhtml body[data-rk-spacing=v1] .ws-events>li>:is(.ws-toolbar,.rk-timeline-media){margin-top:16px!important;margin-bottom:0!important;}\nhtml body[data-rk-spacing=v1] .ws-events.ws-events-horizontal{gap:24px!important;margin-block:0!important;padding:28px 0 0!important;}\nhtml body[data-rk-spacing=v1] .ws-events.ws-events-horizontal>li{margin:0!important;}\nhtml body[data-rk-spacing=v1] .ws-line-scroll{padding:4px 4px 16px!important;}\nhtml body[data-rk-spacing=v1] .rk-timeline-media{gap:16px!important;margin-block:16px!important;}\nhtml body[data-rk-spacing=v1] .rk-timeline-attachment{margin:0!important;}\nhtml body[data-rk-spacing=v1] .rk-timeline-attachment figcaption{margin-block:8px!important;}\nhtml body[data-rk-spacing=v1] .rk-timeline-media-url{gap:8px!important;margin-top:12px!important;}\nhtml body[data-rk-spacing=v1] .rk-timeline-media-hint{margin-block:12px 0!important;}\nhtml body[data-rk-spacing=v1] .rk-timeline-media-status:not(:empty){margin-block:8px 0!important;}\nhtml body[data-rk-spacing=v1] .rk-board-toolbar{margin-block:0 16px!important;}\nhtml body[data-rk-spacing=v1] .rk-board-help{margin-block:12px 0!important;}\nhtml body[data-rk-spacing=v1] :is(.rk-field-color-control,.rk-contents-control){margin-block:0 24px!important;}\nhtml body[data-rk-spacing=v1] .rk-field-color-toolbar{margin:0!important;}\nhtml body[data-rk-spacing=v1] .blocks .blk{margin-block:0!important;}\nhtml body[data-rk-spacing=v1] .blocks .blk+.blk{margin-top:16px!important;}\nhtml body[data-rk-spacing=v1] .blocks .blk:is(.h1,.h2){margin-top:32px!important;}\nhtml body[data-rk-spacing=v1] .blocks .blk:is(.h3,.h4,.h5,.h6){margin-top:24px!important;}\nhtml body[data-rk-spacing=v1] .blocks .blk:is(.h1,.h2,.h3,.h4,.h5,.h6)+.blk{margin-top:12px!important;}\nhtml body[data-rk-spacing=v1] .blocks .blk:first-child{margin-top:0!important;}\nhtml body[data-rk-spacing=v1] .blocks .blk>.body{margin-block:0!important;}\nhtml body[data-rk-spacing=v1] .blocks .note{padding:16px!important;margin-block:16px 0!important;}\nhtml body[data-rk-spacing=v1] .blocks .note :is(.q,.txt,.meta){margin-block:0!important;}\nhtml body[data-rk-spacing=v1] .blocks .note :is(.q,.txt,.meta)+*{margin-top:12px!important;}\nhtml body[data-rk-spacing=v1] .page-note{margin-block:32px 0!important;}\n@media(max-width:900px){html body[data-rk-spacing=v1]{--rk-page-pad:24px;}}\n@media(max-width:650px){html body[data-rk-spacing=v1]{--rk-page-pad:16px;--rk-card-pad:16px;--rk-section-gap:24px;--rk-field-gap:20px;--rk-dialog-pad:16px;}html body[data-rk-spacing=v1] .ws-grid{gap:16px!important;}html body[data-rk-spacing=v1] .ws-home-title,html body[data-rk-spacing=v1] .ws-cover{margin-bottom:24px!important;}}\n";function install(){document.body.dataset.rkSpacing='v1';let style=document.getElementById('rk-consistent-spacing-v1');if(!style){style=document.createElement('style');style.id='rk-consistent-spacing-v1';document.head.appendChild(style);}style.textContent=css;}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();})();
/* RAKURS_SPACING_V1_END */


/* RAKURS_BOARD_CONTROLS_TOP_V1_START */
(function(){'use strict';const css="\nhtml body .rk-board[data-board-ui=v2][data-br2-controls-top] .br2-shell{display:grid!important;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:16px;margin-bottom:16px;}\nhtml body .rk-board[data-board-ui=v2][data-br2-controls-top] .br2-main{grid-column:2;grid-row:1;justify-self:center;min-width:0;max-width:100%;}\nhtml body .rk-board[data-board-ui=v2][data-br2-controls-top] .br2-history{grid-column:1;grid-row:1;justify-self:start;}\nhtml body .rk-board[data-board-ui=v2][data-br2-controls-top] .br2-zoom{grid-column:3;grid-row:1;justify-self:end;}\nhtml body .rk-board[data-board-ui=v2][data-br2-controls-top] :is(.br2-history,.br2-zoom){padding:4px;border-radius:16px;flex-wrap:nowrap;}\nhtml body .rk-board[data-board-ui=v2][data-board-controls=stacked] .br2-shell,html body .rk-board[data-board-ui=v2][data-board-controls=tiny] .br2-shell{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px 8px;}\nhtml body .rk-board[data-board-ui=v2]:is([data-board-controls=stacked],[data-board-controls=tiny]) .br2-main{grid-column:1 / -1;grid-row:1;}\nhtml body .rk-board[data-board-ui=v2]:is([data-board-controls=stacked],[data-board-controls=tiny]) .br2-history{grid-column:1;grid-row:2;}\nhtml body .rk-board[data-board-ui=v2]:is([data-board-controls=stacked],[data-board-controls=tiny]) .br2-zoom{grid-column:2;grid-row:2;}\nhtml body .rk-board[data-board-ui=v2][data-board-controls=tiny] :is(.br2-history,.br2-zoom) button.br2-icon{width:32px!important;min-width:32px!important;height:32px!important;flex-basis:32px!important;}\nhtml body .rk-board[data-board-ui=v2][data-board-controls=tiny] .br2-percent{min-width:36px;}\n";
 function install(){
  let style=document.getElementById('rk-board-controls-top-v1');if(!style){style=document.createElement('style');style.id='rk-board-controls-top-v1';document.head.appendChild(style);}style.textContent=css;
  function mount(root){if(root.dataset.br2ControlsTop)return;const shell=root.querySelector('.br2-shell'),bar=shell?.querySelector('.br2-main'),footer=root.querySelector('.br2-footer');if(!shell||!bar||!footer)return;const groups=footer.querySelectorAll(':scope>.br2-panel');if(groups.length!==2)return;root.dataset.br2ControlsTop='1';const history=groups[0],zoom=groups[1];history.classList.add('br2-history');zoom.classList.add('br2-zoom');shell.insertBefore(history,bar);shell.appendChild(zoom);footer.remove();root.querySelectorAll(':scope>.rk-board-help').forEach(el=>el.remove());
   function resize(){if(!root.isConnected){observer.disconnect();return;}const width=root.clientWidth,needed=bar.scrollWidth+Math.max(history.scrollWidth,zoom.scrollWidth)*2+32,layout=width<340?'tiny':width<needed?'stacked':'wide';if(root.dataset.boardControls!==layout)root.dataset.boardControls=layout;}
   const observer=new ResizeObserver(resize);observer.observe(root);resize();
  }
  function scan(){document.querySelectorAll('.rk-board[data-board-ui=v2]').forEach(mount);}scan();let pending=false;new MutationObserver(()=>{if(!pending){pending=true;queueMicrotask(()=>{pending=false;scan();});}}).observe(document.body,{childList:true,subtree:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
/* RAKURS_BOARD_CONTROLS_TOP_V1_END */


/* RAKURS_HIDE_TOP_SAVE_STATUS_V1_START */
(function(){'use strict';const id='rk-hide-top-save-status-v1';if(document.getElementById(id))return;const style=document.createElement('style');style.id=id;style.textContent='html body #saveState,html body #saveStateM{display:none!important;}';document.head.appendChild(style);})();
/* RAKURS_HIDE_TOP_SAVE_STATUS_V1_END */





/* RAKURS_ADD_ACTIONS_V2_START */
(function(){'use strict';const css="html body #projMenu button[data-a=new].rk-add-action,html body .rk-contents-menu button.rk-add-chapter.rk-add-action{display:flex!important;align-items:center!important;justify-content:flex-start!important;column-gap:8px!important;text-align:left!important;}html body button.rk-add-action>svg.rk-add-plus-icon{display:block!important;width:18px!important;min-width:18px!important;max-width:18px!important;height:18px!important;flex:0 0 18px!important;margin:0!important;padding:0!important;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;pointer-events:none;}";
 function install(){let style=document.getElementById('rk-add-actions-v2');if(!style){style=document.createElement('style');style.id='rk-add-actions-v2';document.head.appendChild(style);}style.textContent=css;
  function update(){document.querySelectorAll('#projMenu button[data-a=new],.rk-contents-menu button.rk-add-chapter').forEach(button=>{button.classList.add('rk-add-action');if(button.querySelector(':scope>svg.rk-add-plus-icon'))return;const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('rk-add-plus-icon');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M12 5v14M5 12h14');svg.appendChild(path);button.prepend(svg);});document.querySelectorAll('.page-note textarea').forEach(el=>{const text=(el.getAttribute('placeholder')||'').replace(/[̵̶̷̸]/g,'');if(text==='Заметка к странице целиком')el.setAttribute('placeholder','Заметка к странице');});}
  update();let queued=false;new MutationObserver(()=>{if(!queued){queued=true;queueMicrotask(()=>{queued=false;update();});}}).observe(document.body,{childList:true,subtree:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
/* RAKURS_ADD_ACTIONS_V2_END */
/* RAKURS_CONTRAST_V1_START — читаемость во всех палитрах и темах: цвета только из палитры истории */
(function(){
 'use strict';
 const css=`
/* роли по умолчанию */
html body[data-rk-mode]{--rk-on-primary:var(--rk-light);--rk-on-heading:var(--rk-light);--rk-on-folder:var(--rk-light);--rk-accent:var(--rk-primary);--rk-crumb:var(--rk-secondary);--rk-line:var(--rk-secondary)}
/* Основная: кнопки и бейджи — светлый текст на заливке в обеих темах */
html body[data-rk-palette="base"][data-rk-mode]{--rk-on-primary:#E5E0CF;--rk-on-heading:#E5E0CF;--rk-on-folder:#E5E0CF;--rk-accent:var(--rk-text);--rk-crumb:var(--rk-text);--rk-line:color-mix(in srgb,var(--rk-text) 28%,transparent)}
/* Индиго, тёмная: заголовки, иконки и ссылки — золотом, а не тёмно-синим на чёрном */
html body[data-rk-palette="indigo"][data-rk-mode="dark"]{--rk-heading:#E1A656!important;--heading:#E1A656!important;--heading-2:#E1A656!important;--rk-accent:#E2BF7B;--rk-on-primary:#B4D2EE;--rk-on-heading:#B4D2EE;--rk-on-folder:#131316}
/* Индиго, светлая: линии и крошки — синим вместо золота на голубом */
html body[data-rk-palette="indigo"][data-rk-mode="light"]{--rk-line:color-mix(in srgb,#4453A4 62%,#B4D2EE);--rk-crumb:#4453A4;--rk-accent:#4453A4;--rk-on-primary:#B4D2EE;--rk-on-heading:#B4D2EE;--rk-on-folder:#B4D2EE;--line:color-mix(in srgb,#4453A4 62%,#B4D2EE)!important;--line-strong:#4453A4!important;--panel-line:color-mix(in srgb,#4453A4 62%,#B4D2EE)!important;--mark-line:#4453A4!important;--sel:color-mix(in srgb,#4453A4 30%,transparent)!important}
/* Терра, тёмная: заливка кнопок и акценты — охра, линии светлее */
html body[data-rk-palette="terra"][data-rk-mode="dark"]{--rk-primary:#B05721!important;--green:#B05721!important;--rk-hover:#D0B78E!important;--hover:#D0B78E!important;--hover-2:#D0B78E!important;--rk-on-primary:#151315;--rk-on-heading:#151315;--rk-on-folder:#151315;--rk-accent:#B05721;--rk-crumb:#B05721;--rk-line:color-mix(in srgb,#46374A 45%,#D0B78E);--line:color-mix(in srgb,#46374A 45%,#D0B78E)!important;--line-strong:color-mix(in srgb,#46374A 30%,#D0B78E)!important;--panel-line:color-mix(in srgb,#46374A 45%,#D0B78E)!important}
/* Терра, светлая: заголовки, кнопки и ссылки — сливовым вместо охры и оливы на бежевом */
html body[data-rk-palette="terra"][data-rk-mode="light"]{--rk-heading:#46374A!important;--heading:#46374A!important;--heading-2:#46374A!important;--rk-primary:#46374A!important;--green:#46374A!important;--rk-on-primary:#D0B78E;--rk-on-heading:#151315;--rk-on-folder:#D0B78E;--rk-accent:#46374A;--rk-crumb:#46374A;--rk-line:#46374A}

/* применение ролей */
html body[data-rk-mode] :is(.btn,.chip,.rk-theme-button,.ws-save-menu>summary){color:var(--rk-on-primary)!important}
html body[data-rk-mode] :is(.btn,.chip,.rk-theme-button,.ws-save-menu>summary):hover:not(:disabled){color:var(--rk-dark)!important}
html body[data-rk-mode] :is(.icon-btn,.link-btn,.toc-new,.ws-drag-handle,.toc .side-open){color:var(--rk-accent)!important}
html body[data-rk-mode] :is(.ws-card-icon,.ws-crumbs a,.ws-pin-list a,.pane-title a){color:var(--rk-crumb)!important}
html body[data-rk-mode] :is(.side,.main,.bar,.bar-in,.dlgbox,.dlgbox-head,.dlgbox-body,.dlgbox-foot,.popmenu,.toast,.ws-save-content,.pane-head,.pane-body,.blocks,.paper,.blk,.ws-card,.ws-add-card,.ws-cover,.ws-events li,.look .tile,.seg,.fmtbar,.side-foot,.ws-drag-handle,input:not([type=radio]):not([type=checkbox]):not([type=color]),textarea,select,[contenteditable=true]){border-color:var(--rk-line)!important}
html body[data-rk-mode] .dlgbox{outline-color:var(--rk-line)!important}
html body[data-rk-mode] :is(.badge.n,.btn.danger,#side .side-foot summary,.ws-save-menu>summary){color:var(--rk-on-heading)!important}
html body[data-rk-mode] .btn.danger:hover{color:var(--rk-dark)!important}
html body[data-rk-mode].mode-edit .seg-btn.on{color:var(--rk-on-primary)!important}
html body[data-rk-mode] :is(.btn,.seg-btn) .count{background:transparent!important;color:inherit!important;border:1px solid currentColor!important}
html body[data-rk-mode] :is(.ws-rename-title,.page-head h1,.ws-home-title h1,.pane-title){color:var(--rk-heading)!important}
html body[data-rk-mode] .look .tile .fs{color:var(--rk-text)!important}
html body[data-rk-mode] #view .ws-card[data-ws-kind=folder]>.rk-folder-contour>path{fill:var(--rk-heading)!important}
html body[data-rk-mode] #view .ws-card[data-ws-kind=folder] :is(.ws-card-title,.ws-card-icon,.ws-type){color:var(--rk-on-folder)!important}
html body[data-rk-mode] :is(input,textarea)::placeholder{opacity:.7!important}
html body[data-rk-mode] .ws-cover>.rk-cover-upload-hint{color:var(--rk-text)!important;opacity:.85!important}
`;
 function install(){ let st=document.getElementById('rakurs-contrast-v1'); if(!st){ st=document.createElement('style'); st.id='rakurs-contrast-v1'; } st.textContent=css; document.head.appendChild(st); }
 if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', install, {once:true}); else install();
 /* блок палитр вставляет свой <style> позже — держим наш последним */
 new MutationObserver(()=>{ const st=document.getElementById('rakurs-contrast-v1'); if(st && document.head.lastElementChild!==st && document.getElementById('rakurs-exact-palette-themes')) document.head.appendChild(st); }).observe(document.head,{childList:true});
})();
/* RAKURS_CONTRAST_V1_END */
