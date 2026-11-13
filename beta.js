/* Ракурс · доступ для беты.
   Автор выбирает главы и выдаёт ссылку на почту беты; бета читает только эти главы и комментирует.
   Текст глав, ссылки и комментарии живут в Supabase (таблицы rk_shares, rk_chapters, rk_comments — supabase/schema-beta.sql);
   доступ ограничен политиками RLS, поэтому невыбранные главы бете не отправляются.
   Файл загружается после cloud.js и до app.js. При открытии #/beta/<id> приложение автора не запускается —
   вместо него строится экран беты. */
(function(){
'use strict';
const BETA_RE=/^#\/beta\/([0-9a-f-]{36})/i;
const betaMatch=location.hash.match(BETA_RE);
if(betaMatch) window.RK_BETA_MODE=true;
const pageNoteStyle=document.createElement('style');pageNoteStyle.id='rk-hide-page-note';pageNoteStyle.textContent='html body :is(#view,#view2Body,#rkBetaView) .page-note{display:none!important}';document.head.appendChild(pageNoteStyle);

const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const sb=()=>window.RK_CLOUD&&RK_CLOUD.enabled?RK_CLOUD.client:null;
const user=()=>window.RK_CLOUD&&RK_CLOUD.user||null;
const PALETTES={base:['#723424','#AC6F40','#5D6444','#516D79','#E5E0CF','#262626'],indigo:['#424185','#4453A4','#B4D2EE','#E2BF7B','#E1A656','#131316'],terra:['#B05721','#D0B78E','#746A2C','#46374A','#241F23','#151315']};
const DEFAULT_COLORS=pal=>({author:(PALETTES[pal]||PALETTES.base)[0], editor:(PALETTES[pal]||PALETTES.base)[3]});
const when=ts=>{ const d=new Date(ts); if(isNaN(d)) return ''; return d.toLocaleDateString('ru',{day:'numeric',month:'short'})+', '+d.toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'}); };
const uid=()=>'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
function toast(msg){ const t=document.getElementById('toast'); if(!t){ console.log('[бета]',msg); return; } t.textContent=msg; t.hidden=false; clearTimeout(toast._t); toast._t=setTimeout(()=>{ t.hidden=true; },3200); }
function humanErr(e){ const s=(e&&e.message)||String(e||''); if(/relation .* does not exist|schema cache|Could not find the table/i.test(s)) return 'В облаке ещё нет таблиц для беты — выполни supabase/schema-beta.sql в Supabase.'; if(/Failed to fetch|NetworkError/i.test(s)) return 'Нет связи с облаком.'; if(/row-level security|permission denied/i.test(s)) return 'Нет прав на это действие.'; return s; }
function linkFor(id){ return location.origin+location.pathname+'#/beta/'+id; }
async function copyText(t){ try{ await navigator.clipboard.writeText(t); return true; }catch(e){ try{ const ta=document.createElement('textarea'); ta.value=t; document.body.appendChild(ta); ta.select(); const ok=document.execCommand('copy'); ta.remove(); return ok; }catch(err){ return false; } } }

/* ---------- стили (общие для автора и беты) ---------- */
const CSS=`

/* Stable controls: selecting a filter never replaces the dialog's controls. */
.rk-comment-settings .dlgbox{width:min(540px,calc(100vw - 28px));max-height:calc(100dvh - 32px);overflow:auto}
.rk-comment-settings fieldset{border:1px solid var(--line);padding:14px;margin:0 0 16px;min-width:0}
.rk-comment-settings legend{font-family:var(--hand);padding:0 6px}
.rk-comment-settings fieldset label{display:flex;align-items:center;gap:10px;min-height:40px;text-transform:none;letter-spacing:normal;cursor:pointer}
.rk-comment-settings input{flex:0 0 auto;margin:0;accent-color:var(--text)}
.rk-comment-settings button{box-sizing:border-box!important;transform:none!important;border-width:1px!important}
.rk-comment-settings button:focus-visible,.rk-comment-settings input:focus-visible{outline:2px solid var(--text)!important;outline-offset:3px}
@media(min-width:1050px){
html body:not(.mode-edit) .rk-bc-sideview{position:relative!important;max-width:1600px!important;overflow:visible!important;--rk-comment-width:340px;--rk-comment-gap:24px}
html body:not(.mode-edit) .rk-bc-sideview .blocks{position:static!important;width:calc(100% - var(--rk-comment-width) - var(--rk-comment-gap))!important;max-width:none!important;box-sizing:border-box!important;margin-inline:0!important}
html body:not(.mode-edit) .rk-bc-sideview .blocks>.blk{display:block!important;position:static!important;min-height:0!important;grid-template-columns:none!important}
html body:not(.mode-edit) .rk-bc-sideview .blocks>.blk>.body{min-width:0;grid-column:auto!important;grid-row:auto!important}
html body:not(.mode-edit) .rk-bc-sideview .rk-bc-slot,
html body:not(.mode-edit) .rk-bc-sideview .rk-bc-general{display:contents!important;position:static!important}
html body:not(.mode-edit) .rk-bc-sideview .rk-bc-slot>.rk-bc-thread,
html body:not(.mode-edit) .rk-bc-sideview .rk-bc-general>.rk-bc-thread,
html body:not(.mode-edit) .rk-bc-sideview .rk-bc-slot>.rk-bc-compose,
html body:not(.mode-edit) .rk-bc-sideview .rk-bc-general>.rk-bc-compose{position:absolute!important;top:var(--rk-comment-top,0px)!important;right:var(--rk-page-pad,28px)!important;left:auto!important;width:var(--rk-comment-width)!important;box-sizing:border-box!important;margin:0!important;min-width:0;overflow-wrap:anywhere;z-index:2}
html body:not(.mode-edit) .rk-bc-sideview .blocks>.blk>.noteslot:has(>.rk-bc-slot){position:static!important}
html body:not(.mode-edit) .rk-bc-sideview::after{content:'';display:block;height:var(--rk-comment-tail,0px);pointer-events:none}
}
.rk-bc-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 16px;font-family:var(--hand);font-size:15px}
.rk-bc-bar .rk-bc-title{letter-spacing:.1em;text-transform:uppercase;font-size:13px;color:var(--muted);margin-right:4px}
.rk-bc-bar .sp{flex:1}
.rk-bc-general{display:grid;gap:12px;margin:0 0 20px}
.rk-bc-general:empty{display:none}
.rk-bc-slot{display:grid;gap:10px;margin:8px 0 4px}
.rk-bc-slot:empty{display:none}
.rk-bc-thread{position:relative;font-family:var(--hand);font-size:15px;line-height:1.45;letter-spacing:.01em;background:var(--rk-bg,var(--bg));color:var(--rk-text,var(--text));border:1px solid var(--rk-line,var(--line));border-left:4px solid var(--bc);border-radius:4px;padding:10px 12px 8px}
.rk-bc-thread.done{opacity:.6}
.rk-bc-thread.hot{box-shadow:0 0 0 2px var(--bc)}
.rk-bc-msg{position:relative;padding-left:0}
.rk-bc-msg+.rk-bc-msg{margin-top:10px;padding-top:10px;border-top:1px dashed var(--rk-line,var(--line))}
.rk-bc-replies .rk-bc-msg{margin-left:14px;padding-left:10px;border-left:2px solid var(--bc)}
.rk-bc-meta{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline;font-size:13px;letter-spacing:.04em;margin-bottom:4px}
.rk-bc-who{color:var(--bc);font-weight:600;text-transform:uppercase;font-size:12px;letter-spacing:.1em}
.rk-bc-when{opacity:.7}
.rk-bc-q{font-size:13.5px;opacity:.85;padding-left:10px;border-left:2px solid var(--bc);margin:0 0 6px;cursor:pointer}
.rk-bc-text{white-space:pre-wrap;overflow-wrap:anywhere;font-family:var(--prose);font-size:1em}
.rk-bc-actions{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:8px}
.rk-bc-actions button{font:inherit;font-size:13px;letter-spacing:.06em;background:none;border:0;padding:0;color:var(--rk-text,var(--text));cursor:pointer;text-decoration:underline;text-underline-offset:3px;opacity:.85}
.rk-bc-actions button:hover{opacity:1;color:var(--bc)}
.rk-bc-compose{display:grid;gap:8px;margin-top:8px}
.rk-bc-compose textarea{width:100%;box-sizing:border-box;min-height:120px;max-height:60vh;overflow-y:hidden;font:inherit;font-family:var(--prose);font-size:1em;line-height:1.5;padding:8px 10px;border:1px solid var(--rk-line,var(--line));border-radius:4px;background:var(--rk-bg,var(--bg));color:var(--rk-text,var(--text));resize:vertical}
.rk-bc-compose .row-btns{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.rk-bc-compose select{font:inherit;font-size:14px;padding:5px 8px;border:1px solid var(--rk-line,var(--line));border-radius:4px;background:var(--rk-bg,var(--bg));color:var(--rk-text,var(--text))}
mark.rk-bc-mark{background:color-mix(in srgb,var(--bc) 30%,transparent);color:inherit;border-bottom:2px solid var(--bc);padding:1px 0;cursor:pointer}
mark.rk-bc-mark:hover,mark.rk-bc-mark.hot{background:color-mix(in srgb,var(--bc) 50%,transparent)}
#rkBetaBubble{position:fixed;z-index:61;font-family:var(--hand);font-size:14px;letter-spacing:.06em;background:var(--paper);color:var(--paper-text);border:0;border-radius:999px;padding:7px 14px;box-shadow:0 4px 14px rgb(0 0 0 / .45);cursor:pointer;white-space:nowrap}
#rkBetaBubble[hidden]{display:none}
body.mode-edit #rkBetaBubble,body.tab-readonly #rkBetaBubble{display:none!important}
.rk-share-list{display:grid;gap:10px}
.rk-share-item{display:grid;gap:6px;padding:10px 12px;border:1px solid var(--rk-line,var(--line));border-radius:6px}
.rk-share-item.off{opacity:.65}
.rk-share-item .rk-share-head{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline}
.rk-share-item .rk-share-head b{font-weight:600}
.rk-share-item .rk-share-head .muted{font-size:13px}
.rk-share-item .row-btns .link-btn{font-size:14px}
.rk-share-chapters{display:grid;gap:8px}
.rk-share-chapters label{display:flex;align-items:flex-start;gap:8px;text-transform:none;letter-spacing:.02em;font-size:16px;color:var(--text);cursor:pointer}
.rk-share-chapters label.rk-share-book{font-weight:600}
.rk-share-chapters label.rk-share-chapter{padding-left:24px}
.rk-share-chapters input{margin-top:5px}
.rk-share-tools{display:flex;gap:8px;flex-wrap:wrap}
.rk-share-colors{display:grid;gap:10px}
.rk-share-colors .rk-share-color-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.rk-share-colors .rk-share-color-row>span{min-width:64px;font-size:14px}
.rk-share-swatch{width:26px;height:26px;border-radius:50%;border:2px solid transparent;padding:0;cursor:pointer;box-shadow:0 0 0 1px var(--line-strong),inset 0 0 0 1px rgb(0 0 0 / .25)}
.rk-share-swatch[aria-pressed=true]{border-color:var(--text)}
.rk-share-dialog .dlgbox{max-width:560px}
.rk-share-dialog .field input[type=email]{font:inherit;font-family:var(--hand);letter-spacing:.03em;padding:8px 10px;border:1px solid var(--line-strong);border-radius:4px;background:var(--bg);color:var(--text);width:100%;box-sizing:border-box}
/* экран беты */
body.rk-beta-mode .app,body.rk-beta-mode #noteSheet,body.rk-beta-mode .start{display:none!important}
.rk-beta{min-height:100vh;display:flex;flex-direction:column}
.rk-beta-bar{position:sticky;top:0;z-index:20;background:var(--chrome);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);font-family:var(--hand)}
.rk-beta-bar-in{display:flex;align-items:center;gap:10px;padding:8px 16px;flex-wrap:wrap}
.rk-beta-bar .rk-beta-brand{font-size:15px;letter-spacing:.12em;text-transform:uppercase;color:var(--heading);white-space:nowrap}
.rk-beta-bar .rk-beta-book{font-size:15px;color:var(--muted);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rk-beta-bar .sp{flex:1}
.rk-beta-bar select{font:inherit;font-size:15px;max-width:min(60vw,420px);padding:6px 10px;border:1px solid var(--line-strong);border-radius:4px;background:var(--bg);color:var(--text)}
.rk-beta-bar .rk-beta-user{font-size:13px;color:var(--muted);white-space:nowrap}
.rk-beta-main{flex:1;width:100%}
.rk-beta .view{max-width:1200px;width:100%;margin:0 auto;padding:26px 28px 40vh;box-sizing:border-box}
.rk-beta-center{max-width:520px;margin:12vh auto 0;padding:24px;font-family:var(--hand);font-size:16px;line-height:1.5;text-align:center;display:grid;gap:14px;justify-items:center}
.rk-beta-center h1{font-family:var(--hand);font-weight:400;font-size:24px;letter-spacing:.1em;text-transform:uppercase;color:var(--heading);margin:0}
.rk-beta-center p{margin:0;color:var(--muted)}
.rk-beta-readonly{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);border:1px solid var(--line-strong);border-radius:999px;padding:3px 10px;white-space:nowrap}
@media(max-width:760px){.rk-beta .view{padding:18px 14px 30vh}.rk-beta-bar .rk-beta-book{display:none}}
`;
function installCSS(){ if(document.getElementById('rk-beta-css')) return; const s=document.createElement('style'); s.id='rk-beta-css'; s.textContent=CSS; document.head.appendChild(s); }

/* ---------- общие части: фрагменты, ветки, карточки ---------- */
function textOffset(body,node,off){ const r=document.createRange(); r.selectNodeContents(body); try{ r.setEnd(node,off); }catch(e){ return 0; } return r.toString().length; }
function wrapRange(body,s,e,id,color){
  const walker=document.createTreeWalker(body,NodeFilter.SHOW_TEXT); let pos=0,n; const nodes=[];
  while((n=walker.nextNode())){ const len=n.nodeValue.length; const ns=pos,ne=pos+len; pos=ne; if(ne<=s||ns>=e||!len) continue; nodes.push({n,from:Math.max(s,ns)-ns,to:Math.min(e,ne)-ns}); }
  nodes.forEach(({n,from,to})=>{ let t=n; if(from>0) t=t.splitText(from); if(to-from<t.nodeValue.length) t.splitText(to-from); const m=document.createElement('mark'); m.className='rk-bc-mark'; m.dataset.bc=id; m.style.setProperty('--bc',color); t.parentNode.insertBefore(m,t); m.appendChild(t); });
}
function locate(body,c){ const text=body.textContent; const q=c.quote||''; if(!q) return null; if(typeof c.o1==='number'&&typeof c.o2==='number'&&text.slice(c.o1,c.o2)===q) return [c.o1,c.o2]; let i=text.indexOf(q); if(i<0){ const nq=q.replace(/\s+/g,' ').trim(); const nt=text.replace(/\s+/g,' '); const j=nt.indexOf(nq); if(j>=0&&nt.length===text.length) i=j; } return i>=0?[i,i+q.length]:null; }
function unpaint(root){ root.querySelectorAll('mark.rk-bc-mark').forEach(m=>{ const p=m.parentNode; while(m.firstChild) p.insertBefore(m.firstChild,m); p.removeChild(m); p.normalize(); }); }
function paint(root,threads,colors){
  unpaint(root);
  threads.forEach(t=>{ const c=t.root; if(!c.block_id||!c.quote||c.done) return; const blk=root.querySelector('.blk[data-id="'+CSS_escape(c.block_id)+'"] > .body'); if(!blk) return; const r=locate(blk,c); if(r&&r[1]>r[0]) wrapRange(blk,r[0],r[1],c.id,colors[c.role]||colors.editor); });
}
/* в режиме правки карточки живут внутри .noteslot — редактор автора не трогает его содержимое; в чтении и у беты — прямо в .blk */
function slotHost(el,edit){ return (edit&&el.querySelector(':scope > .noteslot'))||el; }
function CSS_escape(s){ return (window.CSS&&CSS.escape)?CSS.escape(s):String(s).replace(/["\\]/g,'\\$&'); }
function threadsOf(list){ const roots=list.filter(c=>!c.parent_id).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)); const by={}; list.filter(c=>c.parent_id).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)).forEach(c=>(by[c.parent_id]=by[c.parent_id]||[]).push(c)); return roots.map(r=>({id:r.id,root:r,replies:by[r.id]||[]})); }
function selectionIn(container){
  const sel=getSelection(); if(!sel||sel.isCollapsed||!sel.rangeCount) return null;
  const r=sel.getRangeAt(0); const closest=n=>{ const el=n.nodeType===1?n:n.parentElement; return el?el.closest('.blk > .body'):null; };
  const b1=closest(r.startContainer), b2=closest(r.endContainer); if(!b1||!b2||!container.contains(b1)||!container.contains(b2)) return null;
  const blk=b1.closest('.blk'); let q=sel.toString().replace(/\s+/g,' ').trim(); if(!q) return null;
  const o1=textOffset(b1,r.startContainer,r.startOffset); let o2=b1===b2?textOffset(b2,r.endContainer,r.endOffset):b1.textContent.length;
  if(b1===b2){ if(o2<=o1) return null; q=b1.textContent.slice(o1,o2); } else q=b1.textContent.slice(o1,o2);
  if(!q.trim()) return null;
  const rects=r.getClientRects(); const rect=rects.length?rects[0]:r.getBoundingClientRect();
  return {block_id:blk.dataset.id,o1,o2,quote:q.slice(0,600),rect};
}
/* Карточка ветки. ctx: {role, uid, colors, canResolve, onReply(root,text), onDone(root), onDelete(c), composeShares} */
function threadCard(t,ctx){
  const c=t.root; const box=document.createElement('div'); box.className='rk-bc-thread'+(c.done?' done':''); box.dataset.id=c.id; box.style.setProperty('--bc',ctx.colors[c.role]||ctx.colors.editor); box.contentEditable='false';
  const msg=(m,root)=>`<div class="rk-bc-msg${root?' root':''}" style="--bc:${esc(ctx.colors[m.role]||ctx.colors.editor)}"><div class="rk-bc-meta"><span class="rk-bc-who">${m.role==='author'?'Автор':'Бета'}${m.role==='editor'&&m.author_name?' · '+esc(m.author_name):''}</span><span class="rk-bc-when">${esc(when(m.created_at))}</span>${root&&m.done?'<span class="rk-bc-when">· решено</span>':''}</div>${root&&m.quote?`<div class="rk-bc-q" title="К фрагменту">«${esc(m.quote.length>220?m.quote.slice(0,220)+'…':m.quote)}»</div>`:''}<div class="rk-bc-text">${esc(m.body)}</div>${!root&&m.author_id===ctx.uid?`<div class="rk-bc-actions">${ctx.onEdit?`<button type="button" data-edit="${m.id}">Изменить</button>`:''}<button type="button" data-del="${m.id}">Удалить</button></div>`:''}</div>`;
  box.innerHTML=msg(c,true)+(t.replies.length?`<div class="rk-bc-replies">${t.replies.map(r=>msg(r,false)).join('')}</div>`:'')+`<div class="rk-bc-actions rk-bc-root-actions"><button type="button" data-reply>Ответить</button>${ctx.canResolve?`<button type="button" data-done>${c.done?'Вернуть в работу':'Решено'}</button>`:''}${c.author_id===ctx.uid&&ctx.onEdit?`<button type="button" data-edit="${c.id}">Изменить</button>`:''}${c.author_id===ctx.uid?`<button type="button" data-del="${c.id}">Удалить</button>`:''}</div>`;
  attachPublishButtons(box,t,ctx);
  box.addEventListener('mousedown',e=>e.stopPropagation());
  box.querySelectorAll('[data-del]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); if(!confirm('Удалить комментарий?')) return; ctx.onDelete(b.dataset.del); });
  const all=[c,...t.replies];
  box.querySelectorAll('[data-edit]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); const m=all.find(x=>String(x.id)===b.dataset.edit); if(!m||box.querySelector('.rk-bc-compose')) return;
    const node=[...box.querySelectorAll('.rk-bc-msg')][all.indexOf(m)]; const txt=node&&node.querySelector('.rk-bc-text'); if(!txt) return;
    const hide=[txt]; if(m===c) hide.push(box.querySelector('.rk-bc-root-actions')); else { const a=node.querySelector('.rk-bc-actions'); if(a) hide.push(a); }
    hide.forEach(x=>x&&(x.hidden=true));
    const f=composer({edit:true,value:m.body,ok:'Сохранить',placeholder:'Текст комментария…',onOk:async text=>{ if(text===m.body){ restore(); return; } await ctx.onEdit(m,text); },onCancel:()=>restore()});
    function restore(){ f.remove(); hide.forEach(x=>x&&(x.hidden=false)); }
    txt.after(f); focusComposer(f); });
  const dn=box.querySelector('[data-done]'); if(dn) dn.onclick=e=>{ e.stopPropagation(); ctx.onDone(c); };
  const q=box.querySelector('.rk-bc-q'); if(q) q.onclick=e=>{ e.stopPropagation(); const m=document.querySelector('mark.rk-bc-mark[data-bc="'+CSS_escape(c.id)+'"]'); if(m){ m.scrollIntoView({block:'center',behavior:'smooth'}); m.classList.add('hot'); setTimeout(()=>m.classList.remove('hot'),1600); } };
  box.querySelector('[data-reply]').onclick=e=>{ e.stopPropagation(); if(box.querySelector('.rk-bc-compose')) return; const f=composer({placeholder:'Ответ…',ok:ctx.role==='author'?'Сохранить':'Отправить',onOk:async text=>{ await ctx.onReply(c,text); },onCancel:()=>f.remove()}); box.appendChild(f); focusComposer(f); };
  box.addEventListener('mouseenter',()=>document.querySelectorAll('mark.rk-bc-mark[data-bc="'+CSS_escape(c.id)+'"]').forEach(m=>m.classList.add('hot')));
  box.addEventListener('mouseleave',()=>document.querySelectorAll('mark.rk-bc-mark[data-bc="'+CSS_escape(c.id)+'"]').forEach(m=>m.classList.remove('hot')));
  return box;
}
/* Форма ввода. opts: {placeholder, ok, onOk(text, shareId), onCancel, shares:[{id,label}], quote, value} */
function growTextarea(ta){ ta.style.height='auto'; const max=Math.max(160,Math.round(innerHeight*0.6)); ta.style.height=Math.min(ta.scrollHeight+2,max)+'px'; ta.style.overflowY=ta.scrollHeight+2>max?'auto':'hidden'; }
/* Фокус без прыжка страницы: сначала карточка встает на место, потом показываем ее, только если она вне экрана. */
function focusComposer(f){
  const ta=f&&f.querySelector('textarea'); if(!ta) return;
  try{ ta.focus({preventScroll:true}); }catch(e){ ta.focus(); }
  try{ const n=ta.value.length; ta.setSelectionRange(n,n); }catch(e){}
  /* ждем, пока раскладка карточек перестанет двигать форму (до ~0,5 с), и только потом решаем, нужна ли прокрутка */
  let last=null, stable=0, frames=0;
  const tick=()=>{ if(!f.isConnected) return; const r=f.getBoundingClientRect(); const same=last&&Math.abs(r.top-last)<0.5; last=r.top; stable=same?stable+1:0; frames++;
    if(stable<3&&frames<30){ requestAnimationFrame(tick); return; }
    const bar=document.querySelector(document.body.classList.contains('rk-beta-mode')?'.rk-beta-bar':'.bar'); const top=(bar?Math.max(0,bar.getBoundingClientRect().bottom):0)+12;
    if(r.top<top) window.scrollBy({top:r.top-top,behavior:'smooth'}); else if(r.bottom>innerHeight-12) window.scrollBy({top:Math.min(r.bottom-innerHeight+12,r.top-top),behavior:'smooth'});
  };
  requestAnimationFrame(tick);
}
function composer(opts){
  const f=document.createElement('div'); f.className='rk-bc-compose'; f.contentEditable='false'; if(opts.edit) f.dataset.edit='1';
  f.innerHTML=(opts.quote?`<div class="rk-bc-q">«${esc(opts.quote.length>220?opts.quote.slice(0,220)+'…':opts.quote)}»</div>`:'')+`<textarea rows="4" placeholder="${esc(opts.placeholder||'Комментарий…')}"></textarea><div class="row-btns">${opts.shares&&opts.shares.length>1?`<select>${opts.shares.map(s=>`<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('')}</select>`:''}<button type="button" class="btn primary" data-ok>${esc(opts.ok||'Отправить')}</button><button type="button" class="btn" data-cancel>Отмена</button><span class="muted" data-msg></span></div>`;
  const ta=f.querySelector('textarea'); if(opts.value) ta.value=opts.value;
  f.addEventListener('mousedown',e=>e.stopPropagation()); f.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Escape'){ opts.onCancel&&opts.onCancel(); } if((e.ctrlKey||e.metaKey)&&e.key==='Enter') send(); });
  f.addEventListener('input',e=>{ e.stopPropagation(); if(e.target===ta) growTextarea(ta); }); f.addEventListener('beforeinput',e=>e.stopPropagation());
  requestAnimationFrame(()=>growTextarea(ta));
  f.querySelector('[data-cancel]').onclick=e=>{ e.stopPropagation(); opts.onCancel&&opts.onCancel(); };
  /* Кнопка срабатывает, только если нажатие началось на ней самой: выделение текста мышью в поле не может случайно отправить комментарий. */
  const okBtn=f.querySelector('[data-ok]'); let armed=false;
  f.addEventListener('pointerdown',e=>{ armed=e.target.closest('[data-ok]')===okBtn; },true);
  let busy=false;
  async function send(){ if(busy) return; const text=ta.value.trim(); if(!text){ ta.focus({preventScroll:true}); return; } busy=true; f.dataset.sending='1'; const btns=f.querySelectorAll('button'); btns.forEach(b=>b.disabled=true); const sel=f.querySelector('select'); try{ await opts.onOk(text, sel?sel.value:(opts.shares&&opts.shares[0]?opts.shares[0].id:null)); }catch(err){ f.querySelector('[data-msg]').textContent=humanErr(err); btns.forEach(b=>b.disabled=false); delete f.dataset.sending; } busy=false; }
  okBtn.onclick=e=>{ e.stopPropagation(); if(e.detail>0&&!armed) return; armed=false; send(); };
  return f;
}

/* Перерисовка комментариев (опрос облака, возврат на вкладку) не должна стирать недописанный текст. */
function keepComposers(root){
  if(!root) return [];
  return [...root.querySelectorAll('.rk-bc-compose')].filter(f=>!f.dataset.sending&&!f.dataset.edit).map(f=>{
    const thread=f.closest('.rk-bc-thread'), blk=f.closest('.blk'), focused=f.contains(document.activeElement);
    const ta=f.querySelector('textarea'); const sel=ta?[ta.selectionStart,ta.selectionEnd]:null;
    const item=thread?{kind:'thread',key:thread.dataset.id,f}:f.closest('.rk-bc-general')?{kind:'general',f}:blk?{kind:'slot',key:blk.dataset.id,f}:null;
    if(item){ item.focused=focused; item.sel=sel; f.remove(); } return item;
  }).filter(Boolean);
}
function restoreComposers(root,list,editMode){
  list.forEach(it=>{ let ok=false;
    if(it.kind==='thread'){ const card=root.querySelector('.rk-bc-thread[data-id="'+CSS_escape(it.key)+'"]'); if(card){ card.appendChild(it.f); ok=true; } }
    else if(it.kind==='general'){ const gen=root.querySelector('.rk-bc-general'); if(gen){ gen.prepend(it.f); ok=true; } }
    else { const el=root.querySelector('.blk[data-id="'+CSS_escape(it.key)+'"]'); if(el){ let slot=el.querySelector('.rk-bc-slot'); if(!slot){ slot=document.createElement('div'); slot.className='rk-bc-slot'; slot.contentEditable='false'; slotHost(el,editMode).appendChild(slot); } slot.prepend(it.f); ok=true; } }
    if(ok&&it.focused){ const ta=it.f.querySelector('textarea'); try{ ta.focus({preventScroll:true}); if(it.sel) ta.setSelectionRange(it.sel[0],it.sel[1]); }catch(e){} }
  });
}
function composing(root){ return !!root&&[...root.querySelectorAll('.rk-bc-compose:not([data-sending]) textarea')].some(t=>t.value.trim()||document.activeElement===t); }
const commentControls=new WeakMap();
function commentPreferenceKey(){return 'rk:comments-layout:v1:'+(user()?.id||'local')+':'+(betaMatch?betaMatch[1]:'author');}
const commentLayouts=new Map();
let commentLayoutFrame=0;
let activeCommentId='';
const commentObserved=new Set();
const commentResize=window.ResizeObserver?new ResizeObserver(scheduleCommentLayouts):null;
function scheduleCommentLayouts(){
  if(!commentLayoutFrame)commentLayoutFrame=requestAnimationFrame(()=>{commentLayoutFrame=0;updateCommentLayouts();});
}
function applyCommentLayout(bar,state){
  requestAnimationFrame(()=>{
    const host=bar.closest('.view,#view2Body');
    if(host){commentLayouts.set(host,{bar,state});scheduleCommentLayouts();}
  });
}
function packCommentCards(items,activeId,viewportTop,textBottom){
  let bottom=0;
  return items.map(item=>{
    let target=item.anchor;
    const top=Math.max(0,target,bottom);
    bottom=top+item.height+12;
    return {...item,top};
  });
}
function updateCommentLayouts(){
  const observe=new Set();
  for(const [host,entry] of commentLayouts){
    if(!host.isConnected||!entry.bar.isConnected){
      host.classList.remove('rk-bc-sideview');host.style.removeProperty('--rk-comment-tail');commentLayouts.delete(host);continue;
    }
    const blocks=host.querySelector('.blocks');
    const cards=[...host.querySelectorAll('.rk-bc-slot > .rk-bc-thread,.rk-bc-general > .rk-bc-thread,.rk-bc-slot > .rk-bc-compose,.rk-bc-general > .rk-bc-compose')];
    const enabled=entry.state.commentLayout==='side'&&!!blocks&&cards.length>0&&!document.body.classList.contains('mode-edit')&&host.clientWidth>=760&&window.innerWidth>=1050;
    host.classList.toggle('rk-bc-sideview',enabled);
    if(!enabled){host.style.removeProperty('--rk-comment-tail');continue;}
    observe.add(host);observe.add(blocks);
    const rect=host.getBoundingClientRect();
    const origin=rect.top+host.clientTop-host.scrollTop;
    const marks=new Map();
    host.querySelectorAll('mark.rk-bc-mark[data-bc]').forEach(m=>{if(!marks.has(m.dataset.bc))marks.set(m.dataset.bc,m);});
    const topBar=document.querySelector(document.body.classList.contains('rk-beta-mode')?'.rk-beta-bar':'.bar');
    const barBottom=topBar?Math.max(0,topBar.getBoundingClientRect().bottom):0;
    const textBottom=blocks.getBoundingClientRect().bottom-origin;
    const items=cards.map((card,index)=>{
      observe.add(card);
      const id=card.dataset.id||'compose-'+index;
      const anchor=marks.get(id)||card.closest('.blk')?.querySelector(':scope > .body')||blocks;
      return {card,id,index,anchor:Math.max(0,anchor.getBoundingClientRect().top-origin),height:card.getBoundingClientRect().height};
    }).sort((a,b)=>a.anchor-b.anchor||a.index-b.index);
    const packed=packCommentCards(items,activeCommentId,barBottom+12-origin,textBottom);
    let last=textBottom;
    packed.forEach(item=>{
      const value=item.top.toFixed(2)+'px';
      if(item.card.style.getPropertyValue('--rk-comment-top')!==value)item.card.style.setProperty('--rk-comment-top',value);
      last=Math.max(last,item.top+item.height);
    });
    const tail=Math.max(0,last-textBottom+12).toFixed(2)+'px';
    if(host.style.getPropertyValue('--rk-comment-tail')!==tail)host.style.setProperty('--rk-comment-tail',tail);
  }
  if(commentResize){
    commentObserved.forEach(el=>{if(!observe.has(el)){commentResize.unobserve(el);commentObserved.delete(el);}});
    observe.forEach(el=>{if(!commentObserved.has(el)){commentObserved.add(el);commentResize.observe(el);}});
  }
}
function selectCommentLayoutTarget(e){
  const target=e.target instanceof Element?e.target:null;
  const mark=target?.closest('mark.rk-bc-mark');
  const card=target?.closest('.rk-bc-thread');
  if(mark||card){activeCommentId=mark?.dataset.bc||card.dataset.id;scheduleCommentLayouts();}
}
document.addEventListener('pointerdown',selectCommentLayoutTarget,true);
document.addEventListener('focusin',selectCommentLayoutTarget,true);
document.addEventListener('scroll',scheduleCommentLayouts,{capture:true,passive:true});
window.addEventListener('resize',scheduleCommentLayouts,{passive:true});
window.addEventListener('hashchange',()=>{activeCommentId='';scheduleCommentLayouts();});
document.addEventListener('change',scheduleCommentLayouts);
document.addEventListener('load',scheduleCommentLayouts,true);
new MutationObserver(scheduleCommentLayouts).observe(document.body,{childList:true,subtree:true,characterData:true});
new MutationObserver(scheduleCommentLayouts).observe(document.body,{attributes:true,attributeFilter:['class','data-font','data-ui','data-theme','data-palette','data-rk-mode','data-rk-palette']});
if(document.fonts?.ready)document.fonts.ready.then(scheduleCommentLayouts);
function filterBar(state,onChange,extra){
  if(!state.commentLayout){try{state.commentLayout=localStorage.getItem(commentPreferenceKey())==='side'?'side':'bottom';}catch(e){state.commentLayout='bottom';}}
  const bar=document.createElement('div');bar.className='rk-bc-bar';bar.contentEditable='false';
  const trigger=document.createElement('button');trigger.type='button';trigger.className='btn';trigger.textContent='Комментарии';trigger.setAttribute('aria-haspopup','dialog');
  bar.appendChild(trigger);
  let controls=commentControls.get(state);
  if(!controls){controls={modal:null,extra:null,onChange:null,bar:null,trigger:null};commentControls.set(state,controls);}
  Object.assign(controls,{extra,onChange,bar,trigger});
  const sync=()=>{
    const m=controls.modal;if(!m)return;
    m.querySelectorAll('[name=rkCommentFilter]').forEach(i=>i.checked=i.value===state.filter);
    m.querySelectorAll('[name=rkCommentLayout]').forEach(i=>i.checked=i.value===state.commentLayout);
    m.querySelector('[data-show-done]').checked=!!state.showDone;
    m.querySelector('[data-done-count]').textContent=state.doneCount?' ('+state.doneCount+')':'';
    m.querySelector('[data-general]').disabled=!controls.extra||controls.extra.disabled;
  };
  trigger.onclick=()=>{
    if(controls.modal?.isConnected){controls.modal.querySelector('[data-close]').focus();return;}
    const m=document.createElement('div');m.className='modal rk-comment-settings';
    m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');m.setAttribute('aria-label','Настройки комментариев');
    m.innerHTML=`<div class="dlgbox"><div class="dlgbox-head"><h3>Комментарии</h3><button type="button" class="icon-btn" data-close aria-label="Закрыть">✕</button></div><div class="dlgbox-body">
      <fieldset><legend>Расположение комментариев</legend>
      <label><input type="radio" name="rkCommentLayout" value="bottom"> Под текстом</label>
      <label><input type="radio" name="rkCommentLayout" value="side"> Справа от текста</label>
      <p class="muted">На узком экране комментарии остаются под текстом.</p></fieldset>
      <fieldset><legend>Показывать комментарии</legend>
      <label><input type="radio" name="rkCommentFilter" value="all"> Все</label>
      <label><input type="radio" name="rkCommentFilter" value="author"> Автор</label>
      <label><input type="radio" name="rkCommentFilter" value="editor"> Бета</label>
      <label><input type="checkbox" data-show-done> Показывать решённые<span data-done-count></span></label></fieldset>
      <p class="muted" role="status" data-status></p></div><div class="dlgbox-foot"><button type="button" class="btn" data-general>Комментарий к главе</button><button type="button" class="btn" data-close>Готово</button></div></div>`;
    controls.modal=m;
    function close(){document.removeEventListener('keydown',key,true);m.remove();controls.modal=null;if(controls.trigger?.isConnected)controls.trigger.focus({preventScroll:true});}
    function key(e){
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();return;}
      if(e.key!=='Tab')return;
      const a=[...m.querySelectorAll('button:not(:disabled),input')].filter(x=>x.getClientRects().length),first=a[0],last=a[a.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
    m.addEventListener('change',e=>{
      const i=e.target;
      if(i.name==='rkCommentLayout'){
        state.commentLayout=i.value;
        try{localStorage.setItem(commentPreferenceKey(),i.value);m.querySelector('[data-status]').textContent='';}catch(e){m.querySelector('[data-status]').textContent='Выбор действует сейчас, но браузер не разрешил сохранить его.';}
        applyCommentLayout(controls.bar,state);
      }else if(i.name==='rkCommentFilter'){state.filter=i.value;controls.onChange();}
      else if(i.hasAttribute('data-show-done')){state.showDone=i.checked;controls.onChange();}
      sync();
    });
    m.addEventListener('click',e=>{if(e.target===m||e.target.closest('[data-close]'))close();});
    m.querySelector('[data-general]').onclick=()=>{const action=controls.extra;close();if(action&&!action.disabled)action.click();};
    document.body.appendChild(m);sync();document.addEventListener('keydown',key,true);m.querySelector('[data-close]').focus();
  };
  sync();applyCommentLayout(bar,state);return bar;
}
function visibleThreads(threads,state){ return threads.filter(t=>(state.showDone||!t.root.done)&&(state.filter==='all'||t.root.role===state.filter)); }

/* ---------- данные: запросы к облаку ---------- */
/* MANUAL_BETA_PUBLICATION_V1: drafts stay in the owner's project, never in rk_comments. */
const manualIcon='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 8a7 7 0 0 1 11.6-3L20 8M4 16l2.3 3A7 7 0 0 0 17.9 16"/></svg>';
const manualStyle=document.createElement('style');manualStyle.textContent='.rk-manual-publish{display:inline-flex!important;align-items:center;justify-content:center;flex:0 0 28px;width:28px!important;height:28px!important;min-width:28px!important;padding:4px!important;background:transparent!important;color:inherit!important;border:0!important;cursor:pointer}.rk-manual-publish:focus-visible{outline:2px solid currentColor!important;outline-offset:2px}.rk-manual-publish[disabled]{opacity:.5;cursor:default}.rk-manual-publish[data-state=pending]{outline:1px dashed currentColor;outline-offset:1px}.rk-share-item{position:relative;padding-right:48px}.rk-share-item>.rk-manual-publish{position:absolute;right:10px;top:10px}';document.head.appendChild(manualStyle);
function manualWorkspace(write=false){const b=window.RK_BETA_BRIDGE;if(betaMatch||!b||!user())throw Error('Открой проект автора');if(write&&document.body.classList.contains('tab-readonly'))throw Error('Это окно только для чтения');return b.wsData();}
function privateComments(){return manualWorkspace().betaPrivateComments||[];}
function savePrivate(list){manualWorkspace(true).betaPrivateComments=list;window.RK_BETA_BRIDGE.save();}
function privateById(id){if(betaMatch||!window.RK_BETA_BRIDGE||!user())return null;return privateComments().find(c=>c.id===id&&c.author_id===user().id);}
function draftComment(row){if(row.owner_id!==user()?.id||row.author_id!==user()?.id)throw Error('Неверный аккаунт комментария');const c={...row,id:crypto.randomUUID(),done:false,created_at:new Date().toISOString(),_private:true};savePrivate([...privateComments(),c]);return c;}
async function publishPrivate(c){if(!c._private||c.author_id!==user()?.id)throw Error('Нет личного черновика');if(c.parent_id&&privateById(c.parent_id))throw Error('Сначала отправь родительский комментарий');const workspace=manualWorkspace(),account=user().id,row={...c};delete row._private;const {error}=await sb().from('rk_comments').upsert(row,{onConflict:'id'});if(error)throw error;if(user()?.id!==account||manualWorkspace()!==workspace)throw Error('Аккаунт или проект изменился; проверь статус отправки');savePrivate(privateComments().filter(x=>x.id!==c.id));}
function manualButton(title){const b=document.createElement('button');b.type='button';b.className='rk-manual-publish';b.title=title;b.setAttribute('aria-label',title);b.innerHTML=manualIcon;return b;}
function attachPublishButtons(box,t,ctx){if(ctx.role!=='author')return;const messages=[t.root,...t.replies];box.querySelectorAll('.rk-bc-msg').forEach((node,i)=>{const c=messages[i];if(c?.role!=='author'||c.author_id!==ctx.uid||!(c._private||c._pendingEdit))return;const m=document.createElement('span');m.className='rk-bc-when rk-bc-unsent';m.textContent=c._private?'· не отправлено':'· правка не отправлена';m.title='Уйдет бете при обновлении ссылки в окне «Доступ для беты»';node.querySelector('.rk-bc-meta').appendChild(m);});}
function pendingEdits(){return manualWorkspace().betaPendingEdits||{};}
function savePendingEdits(map){manualWorkspace(true).betaPendingEdits=map;window.RK_BETA_BRIDGE.save();}

const api={
  async shares(ownerId,projectId){ const {data,error}=await sb().from('rk_shares').select('*').eq('owner_id',ownerId).eq('project_id',projectId).order('created_at'); if(error) throw error; return data||[]; },
  async comments(where){ let q=sb().from('rk_comments').select('*'); for(const k in where){ if(Array.isArray(where[k])) q=q.in(k,where[k]); else q=q.eq(k,where[k]); } const {data,error}=await q.order('created_at'); if(error) throw error; if(!betaMatch&&where.owner_id===user()?.id){const pe=pendingEdits();return (data||[]).map(c=>pe[c.id]&&c.author_id===user().id?{...c,body:pe[c.id].body,_pendingEdit:true}:c).concat(privateComments().filter(c=>c.author_id===user().id&&Object.entries(where).every(([k,v])=>Array.isArray(v)?v.includes(c[k]):c[k]===v)));} return data||[]; },
  async insertComment(row){ if(!betaMatch&&row.role==='author')return draftComment(row); const {data,error}=await sb().from('rk_comments').insert(row).select('*').single(); if(error) throw error; return data; },
  async setDone(id,done){ const draft=privateById(id);if(draft){savePrivate(privateComments().map(c=>c.id===id?{...c,done}:c));return;} const {error}=await sb().from('rk_comments').update({done}).eq('id',id); if(error) throw error; },
  async updateComment(id,body,row){ const draft=privateById(id);if(draft){savePrivate(privateComments().map(c=>c.id===id?{...c,body}:c));return;} if(!betaMatch&&row&&row.role==='author'&&row.author_id===user()?.id){savePendingEdits({...pendingEdits(),[id]:{body,share_id:row.share_id,page_id:row.page_id}});return;} const {data,error}=await sb().from('rk_comments').update({body}).eq('id',id).select('id,body'); if(error) throw error; if(Array.isArray(data)&&data.length&&data[0].body!==body) throw Error('Облако не приняло правку'); },
  async deleteComment(id){ const draft=privateById(id);if(draft){savePrivate(privateComments().filter(c=>c.id!==id).map(c=>c.parent_id===id?{...c,parent_id:null}:c));return;} if(!betaMatch&&pendingEdits()[id]){const pe={...pendingEdits()};delete pe[id];savePendingEdits(pe);} const {error}=await sb().from('rk_comments').delete().eq('id',id); if(error) throw error; }
};

/* =====================================================================
   СТОРОНА АВТОРА
   ===================================================================== */
function authorSide(){
  const B=()=>window.RK_BETA_BRIDGE;
  let shares=null, sharesLoadedFor='';     // кэш ссылок проекта
  const comments={};                       // page_id -> список комментариев
  const state={filter:'all',showDone:false,doneCount:0};
  let pushTimer=null, pushQueue=new Set(), pollTimer=null;
  const ready=()=>!!(sb()&&user()&&B());
  const projectId=()=>B().curProject.id;
  const colors=()=>{ const ws=B().wsData(); const look=B().curProject.look||{}; return Object.assign(DEFAULT_COLORS(look.palette||'base'), ws.betaColors||{}); };
  async function loadShares(force){ if(!ready()) return []; const key=user().id+':'+projectId(); if(shares&&sharesLoadedFor===key&&!force) return shares; shares=await api.shares(user().id,projectId()); sharesLoadedFor=key; return shares; }
  const sharesForPage=pid=>(shares||[]).filter(s=>(s.chapters||[]).includes(pid));
  const activeSharesForPage=pid=>sharesForPage(pid).filter(s=>s.active);
  const isShared=pid=>sharesForPage(pid).length>0;

  /* --- копия главы в облаке --- */
  function chapterPayload(p){ const blocks=B().pageBlocks(p).filter(b=>!b.deleted).map(b=>{ let h=String(b.h==null?'':b.h); if(h.length>400000) h='<p class="muted">[вложение не передаётся бете]</p>'; return {id:b.id,t:b.t,h}; }); return {title:p.title,sub:p.sub||'',blocks,updated:Date.now()}; }
  async function pushChapters(ids){ if(!ready()) return; const rows=[]; ids.forEach(id=>{ const p=B().PAGE[id]; if(!p) return; const d=chapterPayload(p); rows.push({owner_id:user().id,project_id:projectId(),page_id:id,title:p.title,data:JSON.stringify(d),updated:d.updated}); }); if(!rows.length) return; const {error}=await sb().from('rk_chapters').upsert(rows,{onConflict:'owner_id,project_id,page_id'}); if(error) throw error; }
  function queuePush(id){}
  function onFlush(){}
  async function pushAllShared(){await loadShares();}


  /* Manual publication only. Existing rk_chapters snapshots are shared by overlapping links. */
  function unsentFor(s){ if(!user()) return {drafts:[],edits:[]}; const ch=s.chapters||[]; const drafts=privateComments().filter(c=>c.author_id===user().id&&c.share_id===s.id&&ch.includes(c.page_id)); const edits=Object.entries(pendingEdits()).filter(([,e])=>e.share_id===s.id&&ch.includes(e.page_id)); return {drafts,edits}; }
  async function publishShare(s,button,say){
    if(!ready()||!s.active)return;
    const affected=(shares||[]).filter(x=>x.active&&x.id!==s.id&&(x.chapters||[]).some(id=>(s.chapters||[]).includes(id)));
    if(affected.length&&!confirm('Эти главы также открыты другим бетам: '+affected.map(x=>x.editor_email).join(', ')+'. Их копии текста глав тоже обновятся. Отправить?'))return;
    const account=user().id,project=projectId(),workspace=manualWorkspace();button.disabled=true;button.dataset.state='sending';say('Отправляем…');
    const guard=()=>{if(user()?.id!==account||projectId()!==project||manualWorkspace()!==workspace)throw Error('Аккаунт или проект изменился; открой окно заново и проверь отправку');};
    try{
      await pushChapters(s.chapters||[]);guard();
      const {error}=await sb().from('rk_shares').update({colors:colors()}).eq('id',s.id).eq('owner_id',account);if(error)throw error;
      const {drafts,edits}=unsentFor(s);const ids=new Set(drafts.map(c=>c.id));
      const clean=c=>{const r={...c};delete r._private;delete r._pendingEdit;return r;};
      const roots=drafts.filter(c=>!c.parent_id||!ids.has(c.parent_id)).map(clean),replies=drafts.filter(c=>c.parent_id&&ids.has(c.parent_id)).map(clean);
      for(const part of [roots,replies]){if(!part.length)continue;guard();const {error:e}=await sb().from('rk_comments').upsert(part,{onConflict:'id'});if(e)throw e;}
      if(ids.size){guard();savePrivate(privateComments().filter(c=>!ids.has(c.id)));}
      let edited=0;
      for(const [id,e] of edits){guard();const {error:er}=await sb().from('rk_comments').update({body:e.body}).eq('id',id).eq('author_id',account);if(er)throw er;const pe={...pendingEdits()};if(pe[id]&&pe[id].body===e.body)delete pe[id];savePendingEdits(pe);edited++;}
      button.dataset.state='sent';button.title='Все отправлено бете';
      const parts=['Текст глав отправлен бете'];if(ids.size)parts.push(ids.size+' '+plural(ids.size,'комментарий','комментария','комментариев'));if(edited)parts.push(edited+' '+plural(edited,'правка','правки','правок')+' комментариев');
      say(parts.join(', ')+'.');decorateCurrent(true);
    }catch(e){button.dataset.state='pending';say(humanErr(e)+' Что не ушло, осталось неотправленным; нажми обновление еще раз.',true);}finally{if(button.isConnected)button.disabled=false;}
  }

  /* --- окно «Доступ для беты» --- */
  async function openShareDialog(book){
    if(!B()) return;
    if(!sb()){ toast('Облако не настроено — доступ для беты недоступен'); return; }
    if(!user()){ toast('Сначала войди в облако'); RK_CLOUD.openDialog('login'); return; }
    installCSS();
    document.getElementById('rkShareModal')?.remove();
    const m=document.createElement('div'); m.className='modal rk-share-dialog'; m.id='rkShareModal';
    const close=()=>m.remove();
    m.addEventListener('click',e=>{ if(e.target===m||e.target.closest('[data-close]')) close(); });
    document.body.appendChild(m);
    const chapterList=()=>{ const out=[{p:book,book:true}]; B().wsChapters(book).forEach(ch=>out.push({p:ch,book:false})); return out; };
    const render=async(editing,msg,bad)=>{
      let list=[]; let err='';
      try{ list=await loadShares(true); }catch(e){ err=humanErr(e); }
      const bookShares=list.filter(s=>s.book_id===book.id);
      const unsentCount=s=>{try{const u=unsentFor(s);return u.drafts.length+u.edits.length;}catch(e){return 0;}};
      const col=colors(); const pal=PALETTES[(B().curProject.look||{}).palette||'base']||PALETTES.base;
      const checked=editing?new Set(editing.chapters||[]):new Set();
      const chaptersHTML=`<div class="rk-share-tools"><button type="button" class="btn" data-all>Выбрать все</button><button type="button" class="btn" data-none>Снять выбор</button></div>
        <div class="rk-share-chapters">${chapterList().map(x=>`<label class="${x.book?'rk-share-book':'rk-share-chapter'}"><input type="checkbox" value="${esc(x.p.id)}"${checked.has(x.p.id)?' checked':''}><span>${esc(x.p.title)}</span></label>`).join('')}</div>`;
      const colorsHTML=`<div class="field"><label>Цвета комментариев</label><div class="rk-share-colors">${[['author','Автор'],['editor','Бета']].map(([k,l])=>`<div class="rk-share-color-row"><span>${l}</span>${pal.map(c=>`<button type="button" class="rk-share-swatch" data-role="${k}" data-color="${c}" style="background:${c}" aria-pressed="${(col[k]||'').toLowerCase()===c.toLowerCase()}" title="${c}"></button>`).join('')}</div>`).join('')}</div></div>`;
      const existing=bookShares.length?`<div class="field"><label>Ссылки</label><div class="rk-share-list">${bookShares.map(s=>`<div class="rk-share-item${s.active?'':' off'}" data-id="${s.id}"><button type="button" class="rk-manual-publish" data-publish-share="${s.id}" data-state="${unsentCount(s)?'pending':''}" title="Отправить бете текст глав и неотправленные комментарии" aria-label="Отправить бете текст глав и неотправленные комментарии"${s.active?'':' disabled'}>${manualIcon}</button><div class="rk-share-head"><b>${esc(s.editor_email)}</b><span class="muted">${(s.chapters||[]).length} ${plural((s.chapters||[]).length,'глава','главы','глав')} · ${s.active?(s.editor_id?'открыта бетой':'ждёт первого входа'):'отключена'}${unsentCount(s)?' · не отправлено: '+unsentCount(s):''}</span></div><div class="row-btns"><button type="button" class="link-btn" data-copy="${s.id}">Копировать ссылку</button><button type="button" class="link-btn" data-edit="${s.id}">Главы</button><button type="button" class="link-btn" data-toggle="${s.id}">${s.active?'Отключить':'Включить'}</button><button type="button" class="link-btn" data-remove="${s.id}">Удалить</button></div></div>`).join('')}</div></div>`:'';
      m.innerHTML=`<div class="dlgbox"><div class="dlgbox-head"><h3>Доступ для беты</h3><button class="icon-btn" type="button" data-close>✕</button></div>
        <div class="dlgbox-body">
          ${err?`<p class="muted" style="color:var(--rk-hover,var(--heading))">${esc(err)}</p>`:''}
          <div class="muted rk-cloud-msg${bad?' bad':''}" id="rkShareMsg"${msg?'':' hidden'}>${esc(msg||'')}</div>
          ${editing?`<p class="muted">Главы для <b>${esc(editing.editor_email)}</b></p>`:existing}
          ${editing?'':`<div class="field"><label for="rkShareEmail">Почта беты</label><input type="email" id="rkShareEmail" autocomplete="off" placeholder="Аккаунт «Ракурса», которому откроются главы"></div>`}
          ${chaptersHTML}
          ${editing?'':colorsHTML}
        </div>
        <div class="dlgbox-foot">${editing?`<button class="btn primary" type="button" data-save>Сохранить главы</button><button class="btn" type="button" data-back>Назад</button>`:`<button class="btn primary" type="button" data-create>Создать ссылку</button>`}</div></div>`;
      const say=(t,isBad)=>{ const el=m.querySelector('#rkShareMsg'); if(el){ el.textContent=t; el.hidden=!t; el.classList.toggle('bad',!!isBad); el.scrollIntoView({block:'nearest'}); } };
      const boxes=()=>[...m.querySelectorAll('.rk-share-chapters input')];
      m.querySelector('[data-all]').onclick=()=>boxes().forEach(b=>b.checked=true);
      m.querySelector('[data-none]').onclick=()=>boxes().forEach(b=>b.checked=false);
      m.querySelectorAll('.rk-share-swatch').forEach(b=>b.onclick=()=>{const ws=B().wsData();ws.betaColors=Object.assign({},colors(),{[b.dataset.role]:b.dataset.color});B().save();m.querySelectorAll(`.rk-share-swatch[data-role="${b.dataset.role}"]`).forEach(x=>x.setAttribute('aria-pressed',String(x===b)));say('Цвет сохранен у автора. Бета увидит его после обновления ссылки (кнопка справа в карточке).');decorateCurrent(true);});
      m.querySelectorAll('[data-publish-share]').forEach(b=>b.onclick=()=>publishShare(list.find(x=>x.id===b.dataset.publishShare),b,say));
      m.querySelectorAll('[data-copy]').forEach(b=>b.onclick=async()=>{ const ok=await copyText(linkFor(b.dataset.copy)); say(ok?'Ссылка скопирована':linkFor(b.dataset.copy),!ok); });
      m.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>render(list.find(s=>s.id===b.dataset.edit)));
      m.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=async()=>{ const s=list.find(x=>x.id===b.dataset.toggle); if(!s) return; try{ const {error}=await sb().from('rk_shares').update({active:!s.active}).eq('id',s.id); if(error) throw error; await render(null,s.active?'Ссылка отключена':'Ссылка включена'); decorateCurrent(true); }catch(e){ say(humanErr(e),true); } });
      m.querySelectorAll('[data-remove]').forEach(b=>b.onclick=async()=>{ const s=list.find(x=>x.id===b.dataset.remove); if(!s) return; if(!confirm('Удалить ссылку для '+s.editor_email+'? Комментарии этой беты тоже удалятся.')) return; try{ const {error}=await sb().from('rk_shares').delete().eq('id',s.id); if(error) throw error; await render(null,'Ссылка удалена'); decorateCurrent(true); }catch(e){ say(humanErr(e),true); } });
      const back=m.querySelector('[data-back]'); if(back) back.onclick=()=>render(null);
      const save=m.querySelector('[data-save]'); if(save) save.onclick=async()=>{ const ids=boxes().filter(b=>b.checked).map(b=>b.value); if(!ids.length){ say('Выбери хотя бы одну главу',true); return; } save.disabled=true; try{ const {error}=await sb().from('rk_shares').update({chapters:ids,book_title:book.title}).eq('id',editing.id); if(error) throw error; await render(null,'Список глав обновлен. Бета увидит их после обновления ссылки (кнопка справа в карточке).'); decorateCurrent(true); }catch(e){ save.disabled=false; say(humanErr(e),true); } };
      const create=m.querySelector('[data-create]'); if(create) create.onclick=async()=>{
        const email=(m.querySelector('#rkShareEmail').value||'').trim().toLowerCase(); const ids=boxes().filter(b=>b.checked).map(b=>b.value);
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ say('Укажи почту беты',true); m.querySelector('#rkShareEmail').focus(); return; }
        if(email===(user().email||'').toLowerCase()){ say('Это твоя почта — укажи почту беты',true); return; }
        if(!ids.length){ say('Выбери хотя бы одну главу',true); return; }
        create.disabled=true; say('Создаём…');
        try{
          const look=Object.assign({palette:'base'},B().curProject.look||{});
          const row={owner_id:user().id,project_id:projectId(),book_id:book.id,book_title:book.title,editor_email:email,chapters:ids,active:true,look,colors:colors()};
          const {data,error}=await sb().from('rk_shares').insert(row).select('id').single(); if(error) throw error;
          /* First publication also requires the explicit refresh icon. */
          const link=linkFor(data.id); const ok=await copyText(link);
          await render(null,ok?'Ссылка создана и скопирована. Нажми обновление справа в карточке, чтобы отправить главы, затем отправь ссылку бете. Открыть ее сможет только аккаунт с почтой '+email:'Ссылка создана: '+link);
          decorateCurrent(true);
        }catch(e){ create.disabled=false; say(humanErr(e),true); }
      };
      setTimeout(()=>m.querySelector('#rkShareEmail')?.focus(),30);
    };
    await render(null);
  }
  function plural(n,a,b,c){ n=Math.abs(n)%100; const d=n%10; if(n>10&&n<20) return c; if(d>1&&d<5) return b; if(d===1) return a; return c; }

  /* --- комментарии в тексте автора --- */
  async function loadComments(pid,force){ if(!ready()) return []; if(comments[pid]&&!force) return comments[pid]; const list=await api.comments({owner_id:user().id,page_id:pid}); comments[pid]=list; return list; }
  let decorating=false;
  function decorateCurrent(reload){ const cp=B()&&B().curPage; if(cp) decorate(cp,document.getElementById('view'),reload); }
  async function decorate(p,host,reload){
    if(!ready()||!host||!p) return;
    try{ await loadShares(); }catch(e){ return; }
    if(!isShared(p.id)){ host.querySelectorAll('.rk-bc-bar,.rk-bc-general,.rk-bc-slot').forEach(x=>x.remove()); unpaint(host); return; }
    installCSS();
    let list; try{ list=await loadComments(p.id,reload); }catch(e){ console.warn('beta comments',e); return; }
    if(B().curPage!==p||!host.isConnected) return;
    const threads=threadsOf(list); state.doneCount=threads.filter(t=>t.root.done).length;
    const col=colors(); const me=user().id; const shown=visibleThreads(threads,state);
    const ctx={role:'author',uid:me,colors:col,canResolve:true,
      onReply:async(root,text)=>{ await api.insertComment({share_id:root.share_id,owner_id:me,page_id:p.id,parent_id:root.id,body:text,role:'author',author_id:me,author_name:'Автор'}); await decorate(p,host,true); },
      onDone:async root=>{ try{ await api.setDone(root.id,!root.done); await decorate(p,host,true); }catch(e){ toast(humanErr(e)); } },
      onEdit:async(c,text)=>{ await api.updateComment(c.id,text,c); await decorate(p,host,true); },
      onDelete:async id=>{ try{ await api.deleteComment(id); await decorate(p,host,true); }catch(e){ toast(humanErr(e)); } }};
    decorating=true; const kept=keepComposers(host);
    try{
      const head=host.querySelector('.page-head'); const blocks=host.querySelector('.blocks');
      host.querySelectorAll('.rk-bc-bar,.rk-bc-general').forEach(x=>x.remove());
      if(head){
        const active=activeSharesForPage(p.id);
        const btn=document.createElement('button'); btn.type='button'; btn.className='btn'; btn.textContent='Комментарий к главе'; btn.disabled=!active.length; btn.title=active.length?'':'Нет активных ссылок для этой главы';
        const bar=filterBar(state,()=>decorate(p,host,false),btn);
        const gen=document.createElement('div'); gen.className='rk-bc-general'; gen.contentEditable='false';
        btn.onclick=()=>{ if(gen.querySelector('.rk-bc-compose')) return; const f=composer({ok:'Сохранить',placeholder:'Комментарий ко всей главе…',shares:active.map(s=>({id:s.id,label:s.editor_email})),onOk:async(text,sid)=>{ await api.insertComment({share_id:sid,owner_id:me,page_id:p.id,body:text,role:'author',author_id:me,author_name:'Автор'}); await decorate(p,host,true); },onCancel:()=>f.remove()}); gen.prepend(f); focusComposer(f); };
        shown.filter(t=>!t.root.block_id).forEach(t=>gen.appendChild(threadCard(t,ctx)));
        head.after(bar,gen);
      }
      if(blocks){
        blocks.querySelectorAll('.rk-bc-slot').forEach(x=>x.remove());
        const byBlock={}; shown.filter(t=>t.root.block_id).forEach(t=>(byBlock[t.root.block_id]=byBlock[t.root.block_id]||[]).push(t));
        for(const bid in byBlock){ const el=blocks.querySelector('.blk[data-id="'+CSS_escape(bid)+'"]'); if(!el) continue; const slot=document.createElement('div'); slot.className='rk-bc-slot'; slot.contentEditable='false'; byBlock[bid].forEach(t=>slot.appendChild(threadCard(t,ctx))); slotHost(el,B().mode==='edit').appendChild(slot); }
        if(B().mode!=='edit') paint(blocks,shown,col); else unpaint(blocks);
      }
      restoreComposers(host,kept,B().mode==='edit');
    } finally { setTimeout(()=>{ decorating=false; },0); }
  }
  /* блоки перерисовываются без renderPage (rerender) — возвращаем карточки */
  let mo=null, moT=null;
  function watch(){ const v=document.getElementById('view'); if(!v||mo) return; mo=new MutationObserver(()=>{ if(decorating) return; const cp=B()&&B().curPage; if(!cp||!shares||!isShared(cp.id)) return; const blocks=v.querySelector('.blocks'); if(!blocks) return; const need=!v.querySelector('.rk-bc-bar')||(comments[cp.id]||[]).some(c=>!c.parent_id&&c.block_id&&!c.done&&!blocks.querySelector('.rk-bc-slot .rk-bc-thread[data-id="'+CSS_escape(c.id)+'"]')&&blocks.querySelector('.blk[data-id="'+CSS_escape(c.block_id)+'"]')&&(state.filter==='all'||c.role===state.filter)); if(!need) return; clearTimeout(moT); moT=setTimeout(()=>decorate(cp,v,false),120); }); mo.observe(v,{childList:true,subtree:true}); }

  /* --- «Комментировать» для выделения --- */
  let bubble=null, pendingSel=null;
  function ensureBubble(){ if(bubble) return bubble; bubble=document.createElement('button'); bubble.id='rkBetaBubble'; bubble.type='button'; bubble.textContent='Комментировать'; bubble.hidden=true; bubble.addEventListener('mousedown',e=>e.preventDefault()); bubble.onclick=()=>{ const s=pendingSel; bubble.hidden=true; pendingSel=null; if(!s) return; try{ getSelection().removeAllRanges(); }catch(e){} openSelectionComposer(s); }; document.body.appendChild(bubble); return bubble; }
  function checkSelection(){
    const cp=B()&&B().curPage; const v=document.getElementById('view');
    if(!ready()||!cp||!v||!shares||!activeSharesForPage(cp.id).length||B().mode==='edit'){ if(bubble) bubble.hidden=true; pendingSel=null; return; }
    const s=selectionIn(v); if(!s){ if(bubble) bubble.hidden=true; pendingSel=null; return; }
    pendingSel=s; const b=ensureBubble(); b.hidden=false;
    const other=document.getElementById('selBubble'); const w=b.offsetWidth; let left=s.rect.left+s.rect.width/2-w/2; let top=s.rect.top-42; const bar=document.querySelector('.bar'); if(top<((bar&&bar.offsetHeight)||0)+6) top=s.rect.bottom+8;
    if(other&&!other.hidden){ const r=other.getBoundingClientRect(); left=r.right+8; top=r.top; }
    left=Math.max(8,Math.min(left,innerWidth-w-8)); b.style.left=left+'px'; b.style.top=top+'px';
  }
  function openSelectionComposer(s){
    const cp=B().curPage; const host=document.getElementById('view'); const el=host&&host.querySelector('.blk[data-id="'+CSS_escape(s.block_id)+'"]'); if(!cp||!el) return;
    let slot=el.querySelector('.rk-bc-slot'); if(!slot){ slot=document.createElement('div'); slot.className='rk-bc-slot'; slot.contentEditable='false'; slotHost(el,B().mode==='edit').appendChild(slot); }
    if(slot.querySelector('.rk-bc-compose')) return;
    const active=activeSharesForPage(cp.id); const me=user().id;
    const f=composer({ok:'Сохранить',quote:s.quote,placeholder:'Комментарий к фрагменту…',shares:active.map(x=>({id:x.id,label:x.editor_email})),onOk:async(text,sid)=>{ await api.insertComment({share_id:sid,owner_id:me,page_id:cp.id,block_id:s.block_id,o1:s.o1,o2:s.o2,quote:s.quote,body:text,role:'author',author_id:me,author_name:'Автор'}); await decorate(cp,host,true); },onCancel:()=>{ f.remove(); if(!slot.children.length) slot.remove(); }});
    slot.prepend(f); focusComposer(f);
  }
  let selT=null; document.addEventListener('selectionchange',()=>{ clearTimeout(selT); selT=setTimeout(checkSelection,160); });
  window.addEventListener('scroll',()=>{ if(bubble&&!bubble.hidden) checkSelection(); },{passive:true});
  document.addEventListener('click',e=>{ const m=e.target.closest&&e.target.closest('mark.rk-bc-mark'); if(!m) return; const sel=getSelection(); if(sel&&!sel.isCollapsed) return; const card=document.querySelector('.rk-bc-thread[data-id="'+CSS_escape(m.dataset.bc)+'"]'); if(card){ e.preventDefault(); e.stopPropagation(); card.scrollIntoView({block:'center',behavior:'smooth'}); card.classList.add('hot'); setTimeout(()=>card.classList.remove('hot'),1600); } },true);

  /* --- опрос облака --- */
  function poll(){ clearInterval(pollTimer); pollTimer=setInterval(async()=>{ if(document.visibilityState!=='visible'||!ready()) return; const cp=B()&&B().curPage; if(!cp||!shares||!isShared(cp.id)) return; const before=JSON.stringify((comments[cp.id]||[]).map(c=>[c.id,c.done,c.body])); try{ const list=await api.comments({owner_id:user().id,page_id:cp.id}); const after=JSON.stringify(list.map(c=>[c.id,c.done,c.body])); if(after!==before&&!composing(document.getElementById('view'))){ comments[cp.id]=list; decorateCurrent(false); } }catch(e){} },45000); }
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'&&ready()&&!composing(document.getElementById('view'))){ const cp=B()&&B().curPage; if(cp&&shares&&isShared(cp.id)) decorateCurrent(true); } });

  window.RK_BETA={
    available:()=>!!sb(),
    openShareDialog,
    onFlush,
    onPageRender(p,host){ if(!ready()) return; watch(); decorate(p,host,false); },
    refresh:()=>decorateCurrent(true)
  };
  setTimeout(()=>{ if(ready()){ watch(); poll(); pushAllShared().then(()=>decorateCurrent(false)); } },1500);
}

/* =====================================================================
   ЭКРАН БЕТЫ
   ===================================================================== */
function betaScreen(shareId){
  document.body.classList.add('rk-beta-mode','mode-read','has-page');
  installCSS();
  const root=document.createElement('div'); root.className='rk-beta'; root.id='rkBeta'; document.body.appendChild(root);
  let share=null, chapters=[], cur=null, comments=[]; const state={filter:'all',showDone:false,doneCount:0};
  const me=()=>user();
  const center=(title,text,btn)=>{ root.innerHTML=`<div class="rk-beta-center"><h1>${esc(title)}</h1>${text?`<p>${text}</p>`:''}${btn?`<button type="button" class="btn primary" id="rkBetaAction">${esc(btn.label)}</button>`:''}</div>`; if(btn) root.querySelector('#rkBetaAction').onclick=btn.fn; };

  const TEXT_FONTS = [
    ['literata','Literata','Literata'], ['roboto','Roboto Serif','Roboto Serif'],
    ['bitter','Bitter','Bitter'], ['didact','Didact Gothic','Didact Gothic'],
    ['comfortaa','Comfortaa','Comfortaa'], ['badscript','Bad Script','Bad Script'],
    ['amatic','Amatic SC','Amatic SC'], ['beer','Beer Money','Beer Money'],
    ['ftw','First Time Writing','First Time Writing']
  ];
  const UI_FONTS = [
    ['beer','Beer Money','Beer Money'], ['boozy','Boozy','Boozy'],
    ['angst','Angst','Angst'], ['bicubik','Bicubik','Bicubik'],
    ['druzhok','Druzhok','Druzhok'], ['amatic','Amatic SC','Amatic SC'],
    ['badscript','Bad Script','Bad Script'], ['ftw','First Time Writing','First Time Writing'],
    ['comfortaa','Comfortaa','Comfortaa']
  ];
  let readerLook=null;
  function appearanceKey(){ return 'rk:beta-appearance:v1:'+me().id+':'+shareId; }
  function cleanLook(value){
    const l=value&&typeof value==='object'?value:{};
    return {
      palette:['base','indigo','terra'].includes(l.palette)?l.palette:'base',
      theme:l.theme==='light'?'light':'dark',
      font:TEXT_FONTS.some(f=>f[0]===l.font)?l.font:'literata',
      ui:UI_FONTS.some(f=>f[0]===l.ui)?l.ui:'beer'
    };
  }
  function authorLook(){ return cleanLook(share.look||{}); }
  function currentLook(){ return cleanLook(readerLook||authorLook()); }
  function loadReaderLook(){
    try{const raw=localStorage.getItem(appearanceKey());readerLook=raw?cleanLook(JSON.parse(raw)):null;}
    catch(e){readerLook=null;}
  }
  function applyLook(value){
    const l=cleanLook(value||currentLook()),b=document.body;
    b.dataset.palette=l.palette;b.dataset.theme=l.theme;
    b.dataset.font=l.font;b.dataset.ui=l.ui;
    const fav=document.querySelector('link[rel="icon"][type="image/svg+xml"]');
    if(window.LIMB_LOGOS&&fav) fav.href=LIMB_LOGOS[l.palette]||LIMB_LOGOS.base;
    const button=root.querySelector('#rkBetaTheme');
    if(button){button.title=l.theme==='dark'?'Включить светлую тему':'Включить тёмную тему';button.setAttribute('aria-label',button.title);}
  }
  function saveReaderLook(value){
    if(value===null){localStorage.removeItem(appearanceKey());readerLook=null;}
    else{const next=cleanLook(value);localStorage.setItem(appearanceKey(),JSON.stringify(next));readerLook=next;}
    applyLook();
  }
  function openReaderLook(){
    if(document.getElementById('rkBetaLook'))return;
    const before=currentLook(),previousFocus=document.activeElement;
    let draft={...before},inherit=readerLook===null;
    const modal=document.createElement('div');
    modal.id='rkBetaLook';modal.className='modal look';
    modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
    modal.setAttribute('aria-labelledby','rkBetaLookTitle');
    const fonts=(name,list)=>`<div class="tiles">${list.map(([id,label,family])=>`
      <label class="tile"><input type="radio" name="${name}" value="${id}">
      <span class="fs" style="font-family:'${family}'">Аа Бб</span>
      <span>${esc(label)}</span></label>`).join('')}</div>`;
    modal.innerHTML=`<div class="dlgbox">
      <div class="dlgbox-head"><h3 id="rkBetaLookTitle">Настройки чтения</h3>
      <button type="button" class="icon-btn" data-close aria-label="Закрыть">✕</button></div>
      <div class="dlgbox-body"><p class="muted">Только твоё отображение. Текст и оформление автора не меняются.</p>
      <div class="field"><label>Цветовая палитра</label><div class="tiles">
      ${[['base','Основная'],['indigo','Индиго'],['terra','Терракота']].map(([id,label])=>`
      <label class="tile"><input type="radio" name="palette" value="${id}">
      <span class="sw">${PALETTES[id].map(c=>`<i style="background:${c}"></i>`).join('')}</span>
      <span>${label}</span></label>`).join('')}</div></div>
      <div class="field"><label>Тема</label><div class="radios">
      <label><input type="radio" name="theme" value="dark"> Тёмная</label>
      <label><input type="radio" name="theme" value="light"> Светлая</label></div></div>
      <div class="field"><label>Шрифт текста</label>${fonts('font',TEXT_FONTS)}</div>
      <div class="field"><label>Шрифт заголовков и кнопок</label>${fonts('ui',UI_FONTS)}</div>
      <p class="muted" data-message role="status"></p></div>
      <div class="dlgbox-foot"><button type="button" class="btn primary" data-save>Сохранить</button>
      <button type="button" class="btn" data-close>Отмена</button>
      <button type="button" class="btn" data-reset>Как у автора</button></div></div>`;
    function sync(){modal.querySelectorAll('input[type=radio]').forEach(i=>{i.checked=draft[i.name]===i.value;});}
    function close(saved){
      document.removeEventListener('keydown',onKey,true);modal.remove();
      if(!saved)applyLook(before);
      if(previousFocus&&previousFocus.isConnected)previousFocus.focus();
    }
    function onKey(e){
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(false);return;}
      if(e.key!=='Tab')return;
      const controls=[...modal.querySelectorAll('button:not([disabled]),input:checked')];
      const first=controls[0],last=controls[controls.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
    modal.addEventListener('change',e=>{
      const i=e.target;if(!i.matches('input[type=radio]'))return;
      draft[i.name]=i.value;inherit=false;applyLook(draft);
    });
    modal.addEventListener('click',e=>{if(e.target===modal||e.target.closest('[data-close]'))close(false);});
    modal.querySelector('[data-reset]').onclick=()=>{draft=authorLook();inherit=true;sync();applyLook(draft);};
    modal.querySelector('[data-save]').onclick=()=>{
      try{saveReaderLook(inherit?null:draft);close(true);toast('Настройки чтения сохранены на этом устройстве');}
      catch(e){modal.querySelector('[data-message]').textContent='Браузер не разрешил сохранить настройки. Сейчас действует только предпросмотр.';}
    };
    document.body.appendChild(modal);sync();document.addEventListener('keydown',onKey,true);
    modal.querySelector('[data-close]').focus();
  }
  async function start(){
    if(!sb()){ center('Ракурс','Облако не настроено — ссылка для беты не работает.'); return; }
    if(!me()){ center('Доступ для беты','Это ссылка на главы для вычитки. Войди в аккаунт «Ракурса» с той почтой, на которую автор выдал доступ.',{label:'Войти',fn:()=>RK_CLOUD.openDialog('login')}); RK_CLOUD.onLoginFresh=()=>location.reload(); return; }
    center('Ракурс','Открываем главы…');
    try{
      await sb().rpc('rk_accept_share',{sid:shareId});
      const {data,error}=await sb().from('rk_shares').select('*').eq('id',shareId).maybeSingle(); if(error) throw error;
      if(!data){ center('Ссылка недоступна',`Она отключена автором или выдана другой почте. Ты вошла как <b>${esc(me().email||'')}</b>.`,{label:'Выйти',fn:async()=>{ await sb().auth.signOut(); location.reload(); }}); return; }
      share=data; loadReaderLook(); applyLook();
      const {data:rows,error:e2}=await sb().from('rk_chapters').select('page_id,title,data,updated').eq('owner_id',share.owner_id).eq('project_id',share.project_id).in('page_id',share.chapters||[]); if(e2) throw e2;
      const order=share.chapters||[]; chapters=(rows||[]).map(r=>{ let d={}; try{ d=JSON.parse(r.data)||{}; }catch(e){} return {id:r.page_id,title:r.title||d.title||'Глава',sub:d.sub||'',blocks:d.blocks||[]}; }).sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));
      if(!chapters.length){ center(share.book_title||'Ракурс','Автор ещё не отправил текст глав — попроси открыть эти главы в приложении.'); return; }
      const want=(location.hash.split('/')[3]||''); cur=chapters.find(c=>c.id===want)||chapters[0];
      shell(); await show(cur);
      setInterval(async()=>{ if(document.visibilityState==='visible') refreshComments(true); },45000);
      document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') refreshComments(true); });
    }catch(e){ center('Не удалось открыть',esc(humanErr(e))); }
  }
  function shell(){
    root.innerHTML=`<header class="rk-beta-bar"><div class="rk-beta-bar-in"><span class="rk-beta-brand">Ракурс</span><span class="rk-beta-book">${esc(share.book_title||'')}</span><select id="rkBetaChapter" aria-label="Глава">${chapters.map(c=>`<option value="${esc(c.id)}">${esc(c.title)}</option>`).join('')}</select><span class="rk-beta-readonly">Чтение и комментарии</span><span class="sp"></span><button type="button" class="icon-btn" id="rkBetaTheme" title="Тема"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/></svg></button><span class="rk-beta-user">${esc(me().email||'')}</span><button type="button" class="link-btn" id="rkBetaOut">Выйти</button></div></header><main class="rk-beta-main"><div class="view" id="rkBetaView"></div></main>`;
    root.querySelector('#rkBetaChapter').onchange=e=>{ const c=chapters.find(x=>x.id===e.target.value); if(c) show(c); };
    const themeButton=root.querySelector('#rkBetaTheme');
    themeButton.onclick=()=>{
      if(document.getElementById('rkBetaLook'))return;
      const next=currentLook();next.theme=next.theme==='dark'?'light':'dark';
      try{saveReaderLook(next);}catch(e){toast('Браузер не разрешил сохранить настройку темы');}
    };
    const appearanceButton=document.createElement('button');
    appearanceButton.type='button';appearanceButton.className='btn';
    appearanceButton.id='rkBetaAppearance';appearanceButton.textContent='Оформление';
    appearanceButton.onclick=openReaderLook;themeButton.before(appearanceButton);applyLook();
    root.querySelector('#rkBetaOut').onclick=async()=>{ await sb().auth.signOut(); location.reload(); };
    const bubble=document.createElement('button'); bubble.id='rkBetaBubble'; bubble.type='button'; bubble.textContent='Комментировать'; bubble.hidden=true; bubble.addEventListener('mousedown',e=>e.preventDefault()); document.body.appendChild(bubble);
    let pending=null, selT=null;
    const check=()=>{ const v=root.querySelector('#rkBetaView'); const s=v&&selectionIn(v); if(!s){ bubble.hidden=true; pending=null; return; } pending=s; bubble.hidden=false; const w=bubble.offsetWidth; let left=Math.max(8,Math.min(s.rect.left+s.rect.width/2-w/2,innerWidth-w-8)); let top=s.rect.top-42; const bar=root.querySelector('.rk-beta-bar'); if(top<((bar&&bar.offsetHeight)||0)+6) top=s.rect.bottom+8; bubble.style.left=left+'px'; bubble.style.top=top+'px'; };
    document.addEventListener('selectionchange',()=>{ clearTimeout(selT); selT=setTimeout(check,140); });
    window.addEventListener('scroll',()=>{ if(!bubble.hidden) check(); },{passive:true});
    bubble.onclick=()=>{ const s=pending; bubble.hidden=true; pending=null; if(!s) return; try{ getSelection().removeAllRanges(); }catch(e){} const el=root.querySelector('.blk[data-id="'+CSS_escape(s.block_id)+'"]'); if(!el) return; let slot=el.querySelector('.rk-bc-slot'); if(!slot){ slot=document.createElement('div'); slot.className='rk-bc-slot'; slotHost(el,false).appendChild(slot); } if(slot.querySelector('.rk-bc-compose')) return; const f=composer({quote:s.quote,placeholder:'Комментарий к фрагменту…',onOk:async text=>{ await post({block_id:s.block_id,o1:s.o1,o2:s.o2,quote:s.quote,body:text}); },onCancel:()=>{ f.remove(); if(!slot.children.length) slot.remove(); }}); slot.prepend(f); focusComposer(f); };
    document.addEventListener('click',e=>{ const m=e.target.closest&&e.target.closest('mark.rk-bc-mark'); if(!m) return; const sel=getSelection(); if(sel&&!sel.isCollapsed) return; const card=root.querySelector('.rk-bc-thread[data-id="'+CSS_escape(m.dataset.bc)+'"]'); if(card){ e.preventDefault(); card.scrollIntoView({block:'center',behavior:'smooth'}); card.classList.add('hot'); setTimeout(()=>card.classList.remove('hot'),1600); } },true);
  }
  async function post(extra){ const row=Object.assign({share_id:share.id,owner_id:share.owner_id,page_id:cur.id,role:'editor',author_id:me().id,author_name:me().email||'',done:false},extra); await api.insertComment(row); await refreshComments(true); }
  async function refreshComments(silent){ if(silent&&composing(root)) return; try{ const list=await api.comments({share_id:share.id,page_id:cur.id}); const before=JSON.stringify(comments.map(c=>[c.id,c.done,c.body])); const after=JSON.stringify(list.map(c=>[c.id,c.done,c.body])); comments=list; if((after!==before||!silent)&&!(silent&&composing(root))) renderComments(); }catch(e){ if(!silent) toast(humanErr(e)); } }
  async function show(c){
    cur=c; const sel=root.querySelector('#rkBetaChapter'); if(sel&&sel.value!==c.id) sel.value=c.id;
    try{ history.replaceState(null,'','#/beta/'+shareId+'/'+c.id); }catch(e){}
    const v=root.querySelector('#rkBetaView'); v.innerHTML='';
    const head=document.createElement('div'); head.className='page-head'; head.innerHTML=`<div class="kicker">${esc(share.book_title||'')}</div><h1>${esc(c.title)}</h1>${c.sub?`<div class="sub">${esc(c.sub)}</div>`:''}`; v.appendChild(head);
    const wrap=document.createElement('div'); wrap.className='blocks';
    c.blocks.forEach(b=>{ const el=document.createElement('div'); el.className='blk '+esc(b.t||'p')+' noteable'; el.id='b-'+b.id; el.dataset.id=b.id; el.innerHTML=`<div class="body ${b.t==='table'?'scroll':''}">${b.h}</div><div class="noteslot"></div>`; el.querySelectorAll('[contenteditable]').forEach(x=>x.removeAttribute('contenteditable')); wrap.appendChild(el); });
    v.appendChild(wrap); window.scrollTo(0,0);
    comments=[]; await refreshComments(false);
  }
  function renderComments(){
    const v=root.querySelector('#rkBetaView'); if(!v) return; const head=v.querySelector('.page-head'), blocks=v.querySelector('.blocks'); if(!head||!blocks) return;
    const threads=threadsOf(comments); state.doneCount=threads.filter(t=>t.root.done).length;
    const col=Object.assign(DEFAULT_COLORS((share.look||{}).palette||'base'),share.colors||{}); const shown=visibleThreads(threads,state);
    const ctx={role:'editor',uid:me().id,colors:col,canResolve:false,
      onReply:async(rootC,text)=>{ await post({parent_id:rootC.id,body:text}); },
      onEdit:async(c,text)=>{ await api.updateComment(c.id,text); await refreshComments(false); },
      onDone:()=>{}, onDelete:async id=>{ try{ await api.deleteComment(id); await refreshComments(false); }catch(e){ toast(humanErr(e)); } }};
    const kept=keepComposers(v);
    v.querySelectorAll('.rk-bc-bar,.rk-bc-general,.rk-bc-slot').forEach(x=>x.remove());
    const btn=document.createElement('button'); btn.type='button'; btn.className='btn'; btn.textContent='Комментарий к главе';
    const bar=filterBar(state,renderComments,btn); const gen=document.createElement('div'); gen.className='rk-bc-general';
    btn.onclick=()=>{ if(gen.querySelector('.rk-bc-compose')) return; const f=composer({placeholder:'Комментарий ко всей главе…',onOk:async text=>{ await post({body:text}); },onCancel:()=>f.remove()}); gen.prepend(f); focusComposer(f); };
    shown.filter(t=>!t.root.block_id).forEach(t=>gen.appendChild(threadCard(t,ctx)));
    head.after(bar,gen);
    const byBlock={}; shown.filter(t=>t.root.block_id).forEach(t=>(byBlock[t.root.block_id]=byBlock[t.root.block_id]||[]).push(t));
    for(const bid in byBlock){ const el=blocks.querySelector('.blk[data-id="'+CSS_escape(bid)+'"]'); if(!el) continue; const slot=document.createElement('div'); slot.className='rk-bc-slot'; byBlock[bid].forEach(t=>slot.appendChild(threadCard(t,ctx))); slotHost(el,false).appendChild(slot); }
    paint(blocks,shown,col);
    restoreComposers(v,kept,false);
  }
  return start;
}

/* ---------- запуск ---------- */
if(betaMatch){
  const run=betaScreen(betaMatch[1]);
  const go=()=>{ if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>run(),{once:true}); else run(); };
  /* index.html вызывает RK_CLOUD.boot() и затем подключает app.js; app.js в этом режиме сразу выходит */
  if(window.RK_CLOUD&&typeof RK_CLOUD.boot==='function'){ const ob=RK_CLOUD.boot; RK_CLOUD.boot=function(){ const p=ob.apply(this,arguments); return (p&&p.then?p:Promise.resolve()).then(r=>{ go(); return r; },e=>{ go(); throw e; }); }; }
  else go();
} else {
  authorSide();
}
})();
