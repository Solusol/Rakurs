/* Ракурс · облачная синхронизация историй (Supabase).
   Загружается до app.js. Локальное хранилище остаётся основным: облако — его копия,
   которая подтягивается на других устройствах. Без настроек в cloud-config.js
   или без входа приложение работает как раньше, только локально. */
(function(){
'use strict';
const CFG = window.RK_CLOUD_CONFIG || {};
const PROJ_KEY = 'wsblankProjects';
const SEEN_KEY = 'rkCloudSeen';          // {projId: updated} — последняя известная версия в облаке
const LS = (()=>{ try{ const s=window.localStorage; s.setItem('rkct','1'); s.removeItem('rkct'); return s; }catch(e){ return null; } })();
const enabled = !!(CFG.url && CFG.anonKey && window.supabase && window.supabase.createClient && LS && window.LZString);
const sb = enabled ? window.supabase.createClient(CFG.url, CFG.anonKey, { auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true } }) : null;

const keyFor = id => id==='main' ? 'wsblank1' : 'wsblank1:'+id;
const esc = s => String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function readLocal(id){ try{ const raw=LS.getItem(keyFor(id)); if(!raw) return null; const j=LZString.decompressFromUTF16(raw); return j?JSON.parse(j):null; }catch(e){ return null; } }
function writeLocal(id, obj){ try{ LS.setItem(keyFor(id), LZString.compressToUTF16(JSON.stringify(obj))); return true; }catch(e){ console.warn('cloud: local write failed', e); return false; } }
function readProj(){ try{ const r=JSON.parse(LS.getItem(PROJ_KEY)||'null'); if(r&&r.list) return r; }catch(e){} return {cur:'main', list:[{id:'main', name:'Ракурс', builtin:true}]}; }
function writeProj(r){ try{ LS.setItem(PROJ_KEY, JSON.stringify(r)); }catch(e){} }
function readSeen(){ try{ return JSON.parse(LS.getItem(SEEN_KEY)||'{}')||{}; }catch(e){ return {}; } }
function writeSeen(s){ try{ LS.setItem(SEEN_KEY, JSON.stringify(s)); }catch(e){} }
let seen = readSeen();
function setSeen(id, upd){ seen[id]=upd; writeSeen(seen); }

let user = null;
let state = enabled ? 'off' : 'disabled';   // off | syncing | ok | error | offline
let lastSync = 0, lastError = '';
const pending = new Set();                   // id историй, которые не удалось отправить
let metaPending = false;
const timers = {};
const BIG = 20*1024*1024;
let bigWarned = false;

function ui(){ return window.RK_CLOUD_UI || null; }
function toast(msg){ const u=ui(); if(u&&u.toast) u.toast(msg); else console.log('[облако]', msg); }
function setState(s, err){ state=s; if(err) lastError=err; if(s==='ok') lastSync=Date.now(); renderLink(); }

/* ---------- отправка ---------- */
async function pushNow(id){
  if(!sb||!user) return;
  const d=readLocal(id); if(!d) return;
  const proj=readProj(); const entry=proj.list.find(x=>x.id===id);
  const body=JSON.stringify(d);
  if(body.length>BIG && !bigWarned){ bigWarned=true; toast('История больше 20 МБ — облако может принимать её медленно. Большие видео лучше вставлять ссылкой.'); }
  const row={ user_id:user.id, id, name:entry?entry.name:(d.name||''), data:body, updated:d.updated||0, deleted:false };
  setState('syncing');
  try{
    const base = seen[id];
    if(base!=null){
      const {data, error} = await sb.from('rk_projects').update(row).eq('user_id', user.id).eq('id', id).eq('updated', base).select('id');
      if(error) throw error;
      if(data && data.length){ setSeen(id, row.updated); pending.delete(id); setState('ok'); return; }
      // строки с ожидаемой версией нет: либо её удалили, либо она новее
      const {data:cur, error:e2} = await sb.from('rk_projects').select('updated,deleted,data,name').eq('user_id', user.id).eq('id', id).maybeSingle();
      if(e2) throw e2;
      if(!cur){ const {error:e3}=await sb.from('rk_projects').insert(row); if(e3) throw e3; setSeen(id, row.updated); pending.delete(id); setState('ok'); return; }
      if(!cur.deleted && cur.updated!==base && cur.data!==body){ await keepCloudCopy(id, cur, entry); } // облако менялось с другого устройства
      const {error:e4} = await sb.from('rk_projects').update(row).eq('user_id', user.id).eq('id', id); if(e4) throw e4;
      setSeen(id, row.updated); pending.delete(id); setState('ok'); return;
    }
    const {data:cur, error:e5} = await sb.from('rk_projects').select('updated,deleted,data,name').eq('user_id', user.id).eq('id', id).maybeSingle();
    if(e5) throw e5;
    if(cur && !cur.deleted && cur.data!==body && !isEmpty(safeParse(cur.data))) await keepCloudCopy(id, cur, entry);
    const {error:e6} = await sb.from('rk_projects').upsert(row, {onConflict:'user_id,id'}); if(e6) throw e6;
    setSeen(id, row.updated); pending.delete(id); setState('ok');
  }catch(e){ pending.add(id); setState(navigator.onLine?'error':'offline', e.message||String(e)); console.warn('cloud push', e); }
}
/* В облаке версия новее локальной (правили на другом устройстве). Ничего не затираем:
   облачную версию сохраняем отдельной историей, текущая остаётся как есть. */
async function keepCloudCopy(id, cur, entry){
  let cd=null; try{ cd=JSON.parse(cur.data); }catch(e){ return; }
  const copyId='p'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
  const proj=readProj(); const src=entry||proj.list.find(x=>x.id===id)||{name:cur.name||'История'};
  const name=(src.name||cur.name||'История')+' (с другого устройства)';
  cd.updated=Date.now();
  if(!writeLocal(copyId, cd)) return;
  proj.list.push({id:copyId, name, builtin:false, look:src.look}); proj.updated=Date.now(); writeProj(proj);
  try{ await sb.from('rk_projects').upsert({user_id:user.id, id:copyId, name, data:JSON.stringify(cd), updated:cd.updated, deleted:false}, {onConflict:'user_id,id'}); setSeen(copyId, cd.updated); }catch(e){ pending.add(copyId); }
  pushMetaNow();
  toast('В облаке была более новая версия этой истории — она сохранена отдельно: «'+name+'»');
}
async function pushMetaNow(){
  if(!sb||!user) return;
  const proj=readProj(); const upd=proj.updated||Date.now();
  try{ const {error}=await sb.from('rk_meta').upsert({user_id:user.id, projects:{list:proj.list, setup:!!proj.setup}, updated:upd}, {onConflict:'user_id'}); if(error) throw error; metaPending=false; }
  catch(e){ metaPending=true; console.warn('cloud meta', e); }
}
function push(key, d){
  if(!enabled||!user) return;
  const id = key==='wsblank1' ? 'main' : key.startsWith('wsblank1:') ? key.slice(9) : null; if(!id) return;
  clearTimeout(timers[id]); timers[id]=setTimeout(()=>pushNow(id), 1200);
}
function pushProjects(){ if(!enabled||!user) return; clearTimeout(timers.__meta); timers.__meta=setTimeout(pushMetaNow, 800); }

/* ---------- получение ---------- */
async function pullAll(opts){
  opts=opts||{};
  if(!sb||!user) return;
  setState('syncing');
  try{
    const [{data:meta, error:em}, {data:rows, error:er}] = await Promise.all([
      sb.from('rk_meta').select('projects,updated').eq('user_id', user.id).maybeSingle(),
      sb.from('rk_projects').select('id,name,updated,deleted').eq('user_id', user.id)
    ]);
    if(em) throw em; if(er) throw er;
    const proj=readProj(); let projChanged=false, metaChanged=false;
    const cloudList = (meta&&meta.projects&&Array.isArray(meta.projects.list)) ? meta.projects.list : [];
    const cloudNewer = !!meta && (meta.updated||0) > (proj.updated||0);
    // список историй: объединяем; при более свежем облаке берём его имена и оформление
    for(const ce of cloudList){ const le=proj.list.find(x=>x.id===ce.id); if(!le){ proj.list.push(Object.assign({}, ce)); projChanged=true; } else if(cloudNewer){ if(le.name!==ce.name||JSON.stringify(le.look||null)!==JSON.stringify(ce.look||null)){ le.name=ce.name; le.look=ce.look; projChanged=true; } } }
    if(meta&&meta.projects&&meta.projects.setup&&!proj.setup){ proj.setup=true; projChanged=true; }
    if(proj.setup && !(meta&&meta.projects&&meta.projects.setup)) metaChanged=true;
    for(const le of proj.list){ if(!cloudList.find(x=>x.id===le.id)) metaChanged=true; }
    const u=ui(); const curKey = u&&u.key;
    for(const r of rows||[]){
      const local=readLocal(r.id);
      if(r.deleted){
        if(local && (local.updated||0)<=r.updated){ try{ LS.removeItem(keyFor(r.id)); }catch(e){} const i=proj.list.findIndex(x=>x.id===r.id); if(i>=0&&r.id!=='main'){ proj.list.splice(i,1); projChanged=true; } }
        setSeen(r.id, r.updated); continue;
      }
      if(!proj.list.find(x=>x.id===r.id)){ proj.list.push({id:r.id, name:r.name||'История', builtin:r.id==='main'}); projChanged=true; }
      if(!local || (local.updated||0) < r.updated){
        const {data:full, error:ef} = await sb.from('rk_projects').select('data').eq('user_id', user.id).eq('id', r.id).single();
        if(ef) throw ef;
        let cd=null; try{ cd=JSON.parse(full.data); }catch(e){ continue; }
        const isCur = u && keyFor(r.id)===curKey;
        if(isCur && u.isDirty && u.isDirty()){ continue; } // здесь сейчас печатают — заберём позже
        if(local && !isEmpty(local) && !opts.boot && !isCur){ /* другая история, не открыта — просто обновляем */ }
        if(writeLocal(r.id, cd)){ setSeen(r.id, r.updated); if(isCur && u.apply) u.apply(curKey); }
      } else if((local.updated||0) > r.updated){ setSeen(r.id, r.updated); pending.add(r.id); }
      else { setSeen(r.id, r.updated); }
    }
    // локальные истории, которых нет в облаке
    for(const le of proj.list){ if(!(rows||[]).find(x=>x.id===le.id)){ const local=readLocal(le.id); if(local && !isEmpty(local)) pending.add(le.id); else if(local) pending.add(le.id); } }
    if(projChanged){ proj.updated=Date.now(); writeProj(proj); metaChanged=true; }
    if(metaChanged||metaPending) await pushMetaNow();
    for(const id of [...pending]) await pushNow(id);
    setState(pending.size?'error':'ok');
    return {projChanged};
  }catch(e){ setState(navigator.onLine?'error':'offline', e.message||String(e)); console.warn('cloud pull', e); return null; }
}
function safeParse(t){ try{ return JSON.parse(t)||{}; }catch(e){ return {}; } }
function isEmpty(d){ if(!d) return true; try{ return !(d.pages||[]).length && !Object.keys(d.anns||{}).length && !Object.keys(d.edits||{}).length && !Object.keys(d.notes||{}).length && !Object.keys(d.pageNotes||{}).length && !Object.keys(d.ins||{}).length && !Object.keys(d.del||{}).length && !((d.workspace||{}).cover); }catch(e){ return false; } }

/* ---------- запуск ---------- */
let bootDone=false;
async function boot(){
  if(!enabled){ renderLink(); bootDone=true; return; }
  try{
    const {data:{session}} = await withTimeout(sb.auth.getSession(), 4000);
    user = session ? session.user : null;
  }catch(e){ user=null; }
  if(/access_token=|refresh_token=|type=recovery|type=signup|error=/.test(location.hash)){ history.replaceState(null, '', location.pathname+location.search+'#/'); }
  if(user){ try{ await withTimeout(pullAll({boot:true}), 8000); }catch(e){ setState('error', 'Облако не ответило'); } }
  sb.auth.onAuthStateChange((ev, session)=>{
    if(ev==='PASSWORD_RECOVERY'){ openDialog('newpass'); return; }
    const u = session ? session.user : null;
    const was = user && user.id; user = u;
    if(u && u.id!==was && bootDone){ afterLogin(); }
    if(!u && was){ setState('off'); }
    renderLink();
  });
  bootDone=true; renderLink();
  setInterval(()=>{ if(user && document.visibilityState==='visible') pullAll(); }, 60*1000);
  document.addEventListener('visibilitychange', ()=>{ if(user && document.visibilityState==='visible') pullAll(); });
  window.addEventListener('online', ()=>{ if(user) pullAll(); });
  window.addEventListener('pagehide', ()=>{ for(const id in timers){ if(id==='__meta') continue; if(timers[id]){ clearTimeout(timers[id]); pushNow(id); } } });
}
function withTimeout(p, ms){ return Promise.race([p, new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')), ms))]); }
async function afterLogin(){
  // первый вход на этом устройстве: объединяем локальное и облачное, затем перезагружаем, чтобы список историй обновился
  const res = await pullAll({boot:true});
  toast('Вход выполнен — истории синхронизированы');
  setTimeout(()=>location.reload(), 900);
}

/* ---------- интерфейс ---------- */
function renderLink(){
  const foot=document.querySelector('#side .side-foot'); if(!foot) return;
  let b=document.getElementById('btnCloud');
  if(!enabled){ if(b) b.remove(); return; }
  if(!b){ b=document.createElement('button'); b.type='button'; b.className='link-btn rk-cloud'; b.id='btnCloud'; b.onclick=()=>openDialog(); foot.insertBefore(b, foot.firstChild); }
  b.classList.remove('ok','bad','sync');
  if(!user){ b.textContent='Войти в облако'; b.title='Хранить истории в облаке и открывать их на других устройствах'; return; }
  const t = lastSync ? new Date(lastSync).toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'}) : '';
  if(state==='syncing'){ b.textContent='Облако · синхронизация…'; b.classList.add('sync'); }
  else if(state==='offline'){ b.textContent='Облако · нет сети'; b.classList.add('bad'); }
  else if(state==='error'){ b.textContent='Облако · не удалось сохранить'; b.classList.add('bad'); }
  else { b.textContent='Облако · '+(t?('синхронизировано в '+t):'подключено'); b.classList.add('ok'); }
  b.title=(user.email||'')+(lastError&&state==='error'?' · '+lastError:'');
}
function openDialog(view){
  if(!enabled) return;
  document.getElementById('rkCloudModal')?.remove();
  const m=document.createElement('div'); m.className='modal rk-cloud-modal'; m.id='rkCloudModal';
  const close=()=>m.remove();
  const render=(v, msg, isErr)=>{
    v = v || (user ? 'account' : 'login');
    let body='';
    if(v==='login') body=`<div class="field"><label for="rkcEmail">Почта</label><input type="email" id="rkcEmail" autocomplete="username" required></div>
      <div class="field"><label for="rkcPass">Пароль</label><input type="password" id="rkcPass" autocomplete="current-password" required minlength="6"></div>
      <div class="row-btns"><button class="btn primary" type="submit" data-a="login">Войти</button><button class="btn" type="button" data-v="signup">Создать аккаунт</button><button class="link-btn" type="button" data-v="reset">Забыла пароль</button></div>`;
    else if(v==='signup') body=`<p class="muted">Истории будут храниться в облаке и открываться на любом устройстве после входа.</p>
      <div class="field"><label for="rkcEmail">Почта</label><input type="email" id="rkcEmail" autocomplete="username" required></div>
      <div class="field"><label for="rkcPass">Пароль (не короче 6 символов)</label><input type="password" id="rkcPass" autocomplete="new-password" required minlength="6"></div>
      <div class="row-btns"><button class="btn primary" type="submit" data-a="signup">Создать</button><button class="btn" type="button" data-v="login">У меня есть аккаунт</button></div>`;
    else if(v==='reset') body=`<p class="muted">Пришлём на почту ссылку для смены пароля.</p>
      <div class="field"><label for="rkcEmail">Почта</label><input type="email" id="rkcEmail" autocomplete="username" required></div>
      <div class="row-btns"><button class="btn primary" type="submit" data-a="reset">Отправить</button><button class="btn" type="button" data-v="login">Назад</button></div>`;
    else if(v==='newpass') body=`<div class="field"><label for="rkcPass">Новый пароль</label><input type="password" id="rkcPass" autocomplete="new-password" required minlength="6"></div>
      <div class="row-btns"><button class="btn primary" type="submit" data-a="newpass">Сохранить пароль</button></div>`;
    else body=`<p class="muted">Вход выполнен: <b>${esc(user&&user.email)}</b></p>
      <p class="muted">${state==='error'?'Последняя попытка сохранить в облако не удалась'+(lastError?': '+esc(lastError):''):state==='offline'?'Нет сети — изменения отправятся, когда появится соединение':lastSync?'Синхронизировано в '+new Date(lastSync).toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'}):'Подключено'}.</p>
      <div class="row-btns"><button class="btn primary" type="button" data-a="sync">Синхронизировать сейчас</button><button class="btn" type="button" data-a="logout">Выйти</button></div>
      <p class="muted small">После выхода истории останутся в этом браузере, но перестанут обновляться в облаке.</p>`;
    m.innerHTML=`<div class="dlgbox dlgbox-sm"><div class="dlgbox-head"><h3>${v==='account'?'Облако':v==='signup'?'Новый аккаунт':v==='reset'?'Сменить пароль':v==='newpass'?'Новый пароль':'Вход в облако'}</h3><button class="icon-btn" type="button" data-close>✕</button></div>
      <form class="dlgbox-body" id="rkcForm">${body}<div class="muted rk-cloud-msg${isErr?' bad':''}" id="rkcMsg">${esc(msg||'')}</div></form></div>`;
    m.querySelector('[data-close]').onclick=close;
    m.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>render(b.dataset.v));
    const form=m.querySelector('#rkcForm');
    const busy=(on)=>form.querySelectorAll('button').forEach(b=>b.disabled=on);
    const say=(t,bad)=>{ const el=m.querySelector('#rkcMsg'); el.textContent=t; el.classList.toggle('bad',!!bad); };
    form.onsubmit=async e=>{
      e.preventDefault(); const a=e.submitter&&e.submitter.dataset.a; if(!a) return;
      const email=(form.querySelector('#rkcEmail')||{}).value, pass=(form.querySelector('#rkcPass')||{}).value;
      busy(true);
      try{
        if(a==='login'){ const {error}=await sb.auth.signInWithPassword({email, password:pass}); if(error) throw error; say('Входим…'); close(); }
        else if(a==='signup'){ const {data, error}=await sb.auth.signUp({email, password:pass, options:{emailRedirectTo:location.origin+location.pathname}}); if(error) throw error; if(data.session){ close(); } else say('Аккаунт создан. Подтверди почту по ссылке из письма, затем войди.'); }
        else if(a==='reset'){ const {error}=await sb.auth.resetPasswordForEmail(email, {redirectTo:location.origin+location.pathname}); if(error) throw error; say('Письмо отправлено — открой ссылку из него на этом устройстве.'); }
        else if(a==='newpass'){ const {error}=await sb.auth.updateUser({password:pass}); if(error) throw error; say('Пароль сохранён.'); setTimeout(close, 900); }
      }catch(err){ say(humanErr(err), true); }
      busy(false);
    };
    m.querySelectorAll('[data-a=sync],[data-a=logout]').forEach(b=>b.onclick=async()=>{
      if(b.dataset.a==='sync'){ busy(true); say('Синхронизация…'); const u=ui(); const r=await pullAll(); busy(false); if(r){ say(pending.size?'Часть историй не отправилась: '+lastError:'Готово.', !!pending.size); if(r.projChanged) setTimeout(()=>location.reload(), 700); } else say(lastError||'Не удалось связаться с облаком', true); }
      else { await sb.auth.signOut(); user=null; setState('off'); close(); toast('Выход выполнен'); }
    });
    setTimeout(()=>{ const f=form.querySelector('input'); if(f) f.focus(); }, 30);
  };
  render(view);
  document.body.appendChild(m);
}
function humanErr(e){
  const s=(e&&e.message)||String(e);
  if(/Invalid login credentials/i.test(s)) return 'Неверная почта или пароль.';
  if(/Email not confirmed/i.test(s)) return 'Почта ещё не подтверждена — открой ссылку из письма.';
  if(/already registered|already exists/i.test(s)) return 'Такой аккаунт уже есть — войди.';
  if(/Password should be/i.test(s)) return 'Пароль слишком короткий.';
  if(/rate limit|too many/i.test(s)) return 'Слишком много попыток — подожди минуту.';
  if(/Failed to fetch|NetworkError|timeout/i.test(s)) return 'Нет связи с облаком. Проверь интернет.';
  return s;
}

window.RK_CLOUD = { enabled, boot, push, pushProjects, openDialog, sync:()=>pullAll(), get user(){ return user; }, get state(){ return state; } };
})();
