/* Ракурс: общие кнопки и независимое оформление чтения. */
(function(){
'use strict';
const beta=/^#\/beta\/[0-9a-f-]{36}/i.test(location.hash),sid=location.hash.split('/')[2];
let frame=0,activeKey='',color=null,menu=null,anchor=null;
const style=document.createElement('style');style.id='rk-reader-ui-v3';style.textContent=`
html body .rk-bc-bar{box-sizing:border-box;display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:12px}
html body .rk-bc-bar .chips{display:flex;flex-wrap:wrap;gap:4px}
html body .rk-bc-bar .rk-bc-title{font-size:12px;letter-spacing:.08em}
html body .rk-bc-bar button.chip,html body .rk-bc-bar button.btn{box-sizing:border-box!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;width:auto!important;height:28px!important;min-height:28px!important;max-height:28px!important;min-width:0!important;padding:4px 9px!important;font-size:12px!important;line-height:18px!important;letter-spacing:.06em!important;flex:0 0 auto!important}
html body .rk-bc-bar button.btn{padding-inline:11px!important}
@media(pointer:coarse){html body .rk-bc-bar button.chip,html body .rk-bc-bar button.btn{height:44px!important;min-height:44px!important;max-height:44px!important}}
body.rk-beta-mode .rk-beta-readonly,body.rk-beta-mode .rk-beta-user,body.rk-beta-mode .rk-beta-bar-in>#rkBetaOut{display:none!important}
#rkBetaBackground{position:relative;display:inline-flex}
#rkBetaBackgroundMenu{position:absolute;right:0;top:calc(100% + 8px);width:220px;box-sizing:border-box;padding:12px;background:var(--bg);color:var(--text);border:1px solid var(--line-strong);border-radius:8px;box-shadow:0 4px 18px #0004;z-index:70}
#rkBetaBackgroundMenu[hidden]{display:none}
#rkBetaBackgroundMenu .swatches{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}
#rkBetaBackgroundMenu .swatches button{width:36px;height:36px;min-width:36px;border:1px solid var(--line-strong);border-radius:50%;cursor:pointer}
#rkBetaBackgroundMenu .swatches button[aria-pressed=true]{outline:2px solid var(--text);outline-offset:2px}
html body #rkBeta #rkBetaView .blocks.rk-custom-bg{background:var(--beta-reader-bg)!important;color:var(--beta-reader-fg)!important;--text:var(--beta-reader-fg);--rk-text:var(--beta-reader-fg);--panel-text:var(--beta-reader-fg);--muted:var(--beta-reader-fg);--paper-2:var(--beta-reader-fg);--heading:var(--beta-reader-fg);--heading-2:var(--beta-reader-fg);--rk-heading:var(--beta-reader-fg);--balance-title:var(--beta-reader-fg)}
html body #rkBeta #rkBetaView .blocks.rk-custom-bg .blk,html body #rkBeta #rkBetaView .blocks.rk-custom-bg .blk>.body{background:transparent!important;color:var(--beta-reader-fg)!important}
html body #rkBeta #rkBetaView .blocks.rk-custom-bg .blk>.body :is(h1,h2,h3,h4,h5,h6,p,a,li,span){color:inherit!important}
html:root body .modal.look.look.look .tile.tile.tile{position:relative;box-sizing:border-box;border-width:2px!important;outline:none!important;box-shadow:none!important;background:var(--bg)!important}
html:root body .modal.look.look.look .tile.tile.tile:has(input[type=radio]:checked){border:2px solid var(--text)!important;outline:none!important;box-shadow:none!important;background:var(--bg)!important}
html:root body .modal.look.look.look .tile.tile.tile::after{content:none!important;display:none!important}
html:root body .modal.look.look.look .tile.tile.tile .fs{background:transparent!important;outline:none!important;box-shadow:none!important;border:0!important}
html:root body .modal.look.look.look .tile.tile.tile:has(input[type=radio]:focus-visible){border:2px solid var(--text)!important;outline:none!important;box-shadow:none!important}
html:root body .modal.look.look.look .rk-mode-options button{box-sizing:border-box;border-width:2px!important;outline:none!important;box-shadow:none!important}
html:root body .modal.look.look.look .rk-mode-options button[aria-pressed=true]{border:2px solid var(--text)!important;outline:none!important;box-shadow:none!important;background:var(--bg)!important;color:var(--text)!important}
`;document.head.appendChild(style);
const palettes={base:['#262626','#E5E0CF','#723424','#5D6444','#516D79','#AC6F40'],indigo:['#131316','#B4D2EE','#424185','#4453A4','#E2BF7B','#E1A656'],terra:['#151315','#D0B78E','#B05721','#746A2C','#46374A','#B05721']};
function userId(){return window.RK_CLOUD&&window.RK_CLOUD.user&&window.RK_CLOUD.user.id;}
function preference(){if(!beta||!userId())return null;try{return JSON.parse(localStorage.getItem('rk:beta-appearance:v1:'+userId()+':'+sid)||'null');}catch(e){return null;}}
function set(el,name,value){if(el.style.getPropertyValue(name)!==value||el.style.getPropertyPriority(name)!=='important')el.style.setProperty(name,value,'important');}
function appearance(){
 const b=document.body,saved=preference(),dialog=beta&&document.getElementById('rkBetaLook');
 const chosen=name=>dialog&&dialog.querySelector('input[name='+name+']:checked')?.value;
 const pal=(beta?(chosen('palette')||saved?.palette||b.dataset.palette):(b.dataset.rkPalette||b.dataset.palette))||'base';
 const mode=(beta?(chosen('theme')||saved?.theme||b.dataset.theme):(b.dataset.rkMode||b.dataset.theme))||'dark';
 const [dark,light,head,primary,secondary,hover]=palettes[pal]||palettes.base,l=mode==='light',bg=l?light:dark,fg=l?dark:light;
 const heading=pal==='indigo'&&!l?hover:pal==='terra'&&l?secondary:head,button=pal==='terra'?(l?secondary:head):primary,line='color-mix(in srgb,'+fg+' 35%,transparent)';
 const values={'--rk-bg':bg,'--rk-text':fg,'--rk-heading':heading,'--rk-primary':button,'--rk-secondary':secondary,'--rk-hover':hover,'--rk-dark':dark,'--rk-light':light,'--rk-line':line,'--rk-accent':fg,'--rk-crumb':fg,'--rk-on-primary':light,'--rk-on-heading':light,'--rk-on-folder':light,'--balance-title':l?head:light,'--balance-line':line,'--balance-strong':line,'--rk-text-page-surface':bg,'--bg':bg,'--bg-2':bg,'--bg-3':bg,'--text':fg,'--muted':fg,'--dim':fg,'--heading':heading,'--heading-2':heading,'--panel':bg,'--panel-text':fg,'--paper':bg,'--paper-2':fg,'--paper-text':fg,'--chrome':bg,'--chrome-2':bg,'--card':bg,'--well':bg,'--panel-soft':bg,'--panel-shade':bg,'--rust':head,'--rust-2':head,'--green':button,'--green-2':secondary,'--green-soft':button,'--hover':hover,'--hover-2':hover,'--line':line,'--line-strong':line,'--panel-line':line,'--sel':secondary,'--mark':secondary,'--mark-hot':hover,'--mark-line':secondary};
 Object.entries(values).forEach(([n,v])=>set(b,n,v));if(b.style.colorScheme!==mode)b.style.colorScheme=mode;
 if(beta){const root=document.getElementById('rkBeta');if(root)Object.entries(values).forEach(([n,v])=>set(root,n,v));const modal=document.getElementById('rkBetaLook');if(modal)Object.entries(values).forEach(([n,v])=>set(modal,n,v));}
}
function contrast(hex){const c=hex.slice(1).match(/../g).map(x=>{const v=parseInt(x,16)/255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);});return c[0]*.2126+c[1]*.7152+c[2]*.0722>.179?'#191a18':'#f7f3e8';}
function background(){
 const main=document.querySelector('#rkBeta .rk-beta-main');if(main){main.classList.remove('rk-custom-bg');main.style.removeProperty('--beta-reader-bg');main.style.removeProperty('--beta-reader-fg');}
 document.querySelectorAll('#rkBetaView .blocks').forEach(block=>{block.classList.toggle('rk-custom-bg',!!color);if(color){set(block,'--beta-reader-bg',color);set(block,'--beta-reader-fg',contrast(color));}else{block.style.removeProperty('--beta-reader-bg');block.style.removeProperty('--beta-reader-fg');}});
}
function swatches(){if(menu)menu.querySelectorAll('[data-color]').forEach(b=>{const v=String(b.dataset.color===color);if(b.getAttribute('aria-pressed')!==v)b.setAttribute('aria-pressed',v);});}
function saveColor(value){try{if(!activeKey)throw Error();if(value)localStorage.setItem(activeKey,value);else localStorage.removeItem(activeKey);color=value;background();swatches();menu.querySelector('[role=status]').textContent='';}catch(e){menu.querySelector('[role=status]').textContent='Не удалось сохранить цвет в этом браузере.';}}
function closeMenu(){if(menu)menu.hidden=true;if(anchor)anchor.setAttribute('aria-expanded','false');}
function control(old){
 const host=document.createElement('div');host.id='rkBetaBackground';
 anchor=document.createElement('button');anchor.type='button';anchor.className='icon-btn';anchor.title='Цвет подложки текста';anchor.setAttribute('aria-label',anchor.title);anchor.setAttribute('aria-expanded','false');anchor.setAttribute('aria-controls','rkBetaBackgroundMenu');
 anchor.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3a9 9 0 1 0 0 18h1.5a2.5 2.5 0 0 0 1.8-4.2 1.5 1.5 0 0 1 1.1-2.6H18a3 3 0 0 0 3-3A8.2 8.2 0 0 0 12 3Z"/><circle cx="7" cy="10" r="1"/><circle cx="10" cy="6.5" r="1"/><circle cx="14" cy="6.5" r="1"/><circle cx="17" cy="10" r="1"/></svg>';
 menu=document.createElement('div');menu.id='rkBetaBackgroundMenu';menu.hidden=true;menu.setAttribute('role','group');menu.setAttribute('aria-label','Цвет подложки текста');menu.innerHTML='<div>Цвет подложки текста</div><div class="swatches"></div><button type="button" class="btn" data-reset>Как в теме</button><p role="status"></p>';
 [['#d0b78e','Песочный'],['#e5e0cf','Кремовый'],['#f7f3e8','Бумага'],['#c6d3cc','Шалфейный'],['#c4d3df','Серо-голубой'],['#262626','Тёмный']].forEach(([value,label])=>{const b=document.createElement('button');b.type='button';b.dataset.color=value;b.title=label;b.setAttribute('aria-label',label);set(b,'background',value);b.onclick=()=>saveColor(value);menu.querySelector('.swatches').appendChild(b);});
 menu.querySelector('[data-reset]').onclick=()=>saveColor(null);anchor.onclick=()=>{menu.hidden=!menu.hidden;anchor.setAttribute('aria-expanded',String(!menu.hidden));if(!menu.hidden)menu.querySelector('button').focus();};host.append(anchor,menu);old.replaceWith(host);swatches();
}
function align(){document.querySelectorAll('.rk-bc-bar').forEach(bar=>{const view=bar.closest('.view,#view2Body'),text=view?.querySelector('.blocks .blk>.body');if(!text||!text.getClientRects().length)return;const parent=bar.parentElement,p=parent.getBoundingClientRect(),t=text.getBoundingClientRect(),cs=getComputedStyle(parent),l=Math.max(0,t.left-p.left-parseFloat(cs.paddingLeft||0)-parseFloat(cs.borderLeftWidth||0)).toFixed(2)+'px',r=Math.max(0,p.right-parseFloat(cs.paddingRight||0)-parseFloat(cs.borderRightWidth||0)-t.right).toFixed(2)+'px';if(bar.style.marginLeft!==l)bar.style.marginLeft=l;if(bar.style.marginRight!==r)bar.style.marginRight=r;});}
function sync(){
 appearance();align();if(!beta)return;const root=document.getElementById('rkBeta');if(!root)return;
 const k=userId()?'rk:beta-background:v1:'+userId()+':'+sid:'';if(k!==activeKey){activeKey=k;color=null;try{const raw=k&&localStorage.getItem(k);if(/^#[0-9a-f]{6}$/i.test(raw||''))color=raw;}catch(e){}}
 const old=root.querySelector('#rkBetaTheme');if(old)control(old);
 const brand=root.querySelector('.rk-beta-brand'),reference=document.querySelector('#side .brand-t');if(brand&&reference&&!brand.dataset.uiMatched){const cs=getComputedStyle(reference);['fontFamily','fontSize','fontWeight','letterSpacing','textTransform','lineHeight'].forEach(p=>brand.style[p]=cs[p]);brand.dataset.uiMatched='1';}
 document.querySelectorAll('#rkBetaLook [data-beta-signout]').forEach(b=>b.remove());background();
}
function schedule(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;sync();});}
new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
new MutationObserver(schedule).observe(document.body,{attributes:true,attributeFilter:['data-theme','data-palette','data-rk-mode','data-rk-palette','data-font','data-ui','class']});
document.addEventListener('change',schedule);window.addEventListener('resize',schedule);window.addEventListener('storage',schedule);if(document.fonts?.ready)document.fonts.ready.then(schedule);
if(window.ResizeObserver){const sizes=new ResizeObserver(schedule);['view','view2Body','rkBetaView'].forEach(id=>{const el=document.getElementById(id);if(el)sizes.observe(el);});}
document.addEventListener('click',e=>{if(menu&&!menu.hidden&&!e.target.closest('#rkBetaBackground'))closeMenu();});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu&&!menu.hidden){e.preventDefault();closeMenu();anchor.focus();}});schedule();
})();

/* Unified placement for legacy notes and cloud comments. Storage is unchanged. */
(function(){
'use strict';
const ROOT=':is(#view,#view2Body,#rkBetaView)';
const CARD='.noteslot .note,.rk-bc-slot > .rk-bc-thread,.rk-bc-general > .rk-bc-thread,.rk-bc-slot > .rk-bc-compose,.rk-bc-general > .rk-bc-compose';
const ids=new WeakMap(),normalWidths=new WeakMap(),observed=new Set();
let sequence=0,frame=0,active='';
const resize=window.ResizeObserver?new ResizeObserver(schedule):null;
const style=document.createElement('style');style.id='rk-unified-comments-v1';
style.textContent=`
html:root body ${ROOT} .page-note{display:none!important}
html:root body ${ROOT}.rk-bc-sideview:not(.rk-unified-side){max-width:var(--rk-u-normal-max,none)!important}
html:root body ${ROOT}:not(.rk-unified-side) .blocks>.blk{display:block!important;grid-template-columns:none!important}
html:root body ${ROOT}:not(.rk-unified-side) .blocks{width:auto!important;position:relative!important}
html:root body ${ROOT}:not(.rk-unified-side)::after{content:none!important}
html:root body ${ROOT}:not(.rk-unified-side) :is(.rk-bc-slot,.rk-bc-general)>.rk-bc-thread,
html:root body ${ROOT}:not(.rk-unified-side) :is(.rk-bc-slot,.rk-bc-general)>.rk-bc-compose{position:relative!important;top:auto!important;right:auto!important;left:auto!important;width:auto!important;clip-path:none!important}
html:root body ${ROOT}.rk-unified-side{position:relative!important;max-width:1600px!important;--rk-comment-tail:0px!important}
html:root body ${ROOT}.rk-unified-side .blocks{position:static!important;width:calc(100% - 324px)!important;max-width:none!important;box-sizing:border-box!important;margin-inline:0!important}
html:root body ${ROOT}.rk-unified-side .blocks>.blk{display:block!important;position:static!important;min-height:0!important;grid-template-columns:none!important}
html:root body ${ROOT}.rk-unified-side .blocks>.blk>.body{grid-column:auto!important;grid-row:auto!important;min-width:0}
html:root body ${ROOT}.rk-unified-side :is(.noteslot,.rk-bc-slot,.rk-bc-general){display:contents!important;position:static!important}
html:root body ${ROOT}.rk-unified-side .rk-u-card{position:absolute!important;top:var(--rk-u-top,0px)!important;right:var(--rk-u-right,28px)!important;left:auto!important;width:300px!important;max-width:300px!important;min-width:0!important;box-sizing:border-box!important;margin:0!important;z-index:2;clip-path:inset(var(--rk-u-clip-top,0px) 0 var(--rk-u-clip-bottom,0px) 0)!important;overflow-wrap:anywhere}
html:root body ${ROOT}.rk-unified-side .note.rk-u-card{background:var(--rk-bg,var(--bg))!important;color:var(--rk-text,var(--text))!important;border:1px solid var(--rk-line,var(--line))!important;border-left:4px solid var(--rk-secondary,var(--green))!important;box-shadow:none!important;border-radius:4px;padding:10px 12px 8px!important;font-size:15px;line-height:1.45}
html:root body ${ROOT}.rk-unified-side .note.rk-u-card :is(.q,.meta,.link){color:inherit!important}
html:root body ${ROOT}.rk-unified-side .rk-u-card.rk-u-active{outline:1px solid var(--rk-text,var(--text));outline-offset:2px}
html:root body ${ROOT}.rk-unified-side::after{content:''!important;display:block!important;height:var(--rk-u-tail,0px)!important;pointer-events:none}
`;
document.head.appendChild(style);
function schedule(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;update();});}
function key(card){if(!ids.has(card))ids.set(card,'u'+(++sequence));return ids.get(card);}
function set(el,name,value){if(el.style.getPropertyValue(name)!==value)el.style.setProperty(name,value);}
function normal(text){return (text||'').replace(/[«»“”]/g,'').replace(/\s+/g,' ').trim();}
function sideWanted(host){
 const match=location.hash.match(/^#\/beta\/([0-9a-f-]{36})/i);
 const user=window.RK_CLOUD?.user?.id||'local';
 try{
  const value=localStorage.getItem('rk:comments-layout:v1:'+user+':'+(match?match[1]:'author'));
  if(value==='side'||value==='bottom')return value==='side';
 }catch(e){}
 return host.classList.contains('rk-bc-sideview');
}
function pack(items,selected,viewportTop,textBottom){
 let bottom=0;
 const out=items.map(item=>{const top=Math.max(item.anchor,bottom);bottom=top+item.height+12;return {...item,top};});
 const index=out.findIndex(item=>item.key===selected);
 if(index<0)return out;
 const item=out[index];
 item.top=Math.max(item.anchor,Math.min(viewportTop,Math.max(item.anchor,textBottom-item.height)));
 for(let i=index-1;i>=0;i--)out[i].top=Math.min(out[i].top,out[i+1].top-out[i].height-12);
 for(let i=index+1;i<out.length;i++)out[i].top=Math.max(out[i].anchor,out[i-1].top+out[i-1].height+12);
 return out;
}
function viewport(host){
 let top=0,bottom=innerHeight;
 for(let p=host;p&&p!==document.body;p=p.parentElement){
  if(/auto|scroll|hidden|clip/.test(getComputedStyle(p).overflowY)){
   const r=p.getBoundingClientRect();top=Math.max(top,r.top+p.clientTop);bottom=Math.min(bottom,r.top+p.clientTop+p.clientHeight);
  }
 }
 const header=document.querySelector(host.id==='rkBetaView'?'.rk-beta-bar':'.bar');
 if(header){const r=header.getBoundingClientRect();if(r.bottom>top&&r.top<bottom)top=Math.max(top,r.bottom);}
 return {top,bottom};
}
function update(){
 const watch=new Set();
 document.querySelectorAll(ROOT).forEach(host=>{
  if(!normalWidths.has(host)){
   const had=host.classList.contains('rk-bc-sideview');
   if(had)host.classList.remove('rk-bc-sideview');
   normalWidths.set(host,getComputedStyle(host).maxWidth);
   if(had)host.classList.add('rk-bc-sideview');
  }
  set(host,'--rk-u-normal-max',normalWidths.get(host));
  const blocks=host.querySelector('.blocks');
  const cards=[...host.querySelectorAll(CARD)].filter(card=>!card.hidden&&getComputedStyle(card).display!=='none');
  cards.forEach(card=>{if(!card.classList.contains('rk-u-card'))card.classList.add('rk-u-card');key(card);});
  const enabled=sideWanted(host)&&!!blocks&&cards.length>0&&!document.body.classList.contains('mode-edit')&&innerWidth>=1050&&host.clientWidth>=760;
  if(host.classList.contains('rk-unified-side')!==enabled)host.classList.toggle('rk-unified-side',enabled);
  if(!enabled){
   host.style.removeProperty('--rk-u-tail');
   cards.forEach(card=>{card.classList.remove('rk-u-active');['--rk-u-top','--rk-u-clip-top','--rk-u-clip-bottom'].forEach(p=>card.style.removeProperty(p));});
   return;
  }
  watch.add(host);watch.add(blocks);
  const cs=getComputedStyle(host),rect=host.getBoundingClientRect(),origin=rect.top+host.clientTop-host.scrollTop;
  set(host,'--rk-u-right',(parseFloat(cs.paddingRight)||0)+'px');
  const vp=viewport(host),textBottom=blocks.getBoundingClientRect().bottom-origin;
  const marks=[...host.querySelectorAll('mark.rk-bc-mark,mark.ann')];
  const items=cards.map((card,index)=>{
   watch.add(card);
   const block=card.closest('.blk');
   const scoped=block?marks.filter(mark=>block.contains(mark)):marks;
   let anchor=card.classList.contains('rk-bc-thread')?scoped.find(mark=>mark.dataset.bc===card.dataset.id):null;
   if(!anchor&&card.classList.contains('note')){
    const quote=normal(card.querySelector('.q')?.textContent);
    if(quote)anchor=scoped.find(mark=>normal(mark.textContent)===quote);
   }
   anchor=anchor||block?.querySelector(':scope > .body')||blocks;
   return {card,key:key(card),index,anchor:Math.max(0,anchor.getBoundingClientRect().top-origin),height:card.getBoundingClientRect().height};
  }).sort((a,b)=>a.anchor-b.anchor||a.index-b.index);
  const placed=pack(items,active,vp.top+12-origin,textBottom);
  let end=textBottom;
  placed.forEach(item=>{
   const y=origin+item.top;
   set(item.card,'--rk-u-top',item.top.toFixed(2)+'px');
   set(item.card,'--rk-u-clip-top',Math.min(item.height,Math.max(0,vp.top-y)).toFixed(2)+'px');
   set(item.card,'--rk-u-clip-bottom',Math.min(item.height,Math.max(0,y+item.height-vp.bottom)).toFixed(2)+'px');
   if(item.card.classList.contains('rk-u-active')!==(item.key===active))item.card.classList.toggle('rk-u-active',item.key===active);
   end=Math.max(end,item.top+item.height);
  });
  set(host,'--rk-u-tail',Math.max(0,end-textBottom+12).toFixed(2)+'px');
 });
 if(resize){observed.forEach(el=>{if(!watch.has(el)){resize.unobserve(el);observed.delete(el);}});watch.forEach(el=>{if(!observed.has(el)){observed.add(el);resize.observe(el);}});}
}
function activate(e){
 const target=e.target instanceof Element?e.target:null;
 const host=target?.closest(ROOT);if(!host)return;
 const card=target.closest('.rk-u-card');
 if(card){active=key(card);schedule();return;}
 const mark=target.closest('mark.rk-bc-mark,mark.ann');
 if(mark){
  const block=mark.closest('.blk');
  const match=[...host.querySelectorAll(CARD)].find(c=>c.classList.contains('rk-bc-thread')?c.dataset.id===mark.dataset.bc:(c.closest('.blk')===block&&normal(c.querySelector('.q')?.textContent)===normal(mark.textContent)));
  if(match){active=key(match);schedule();}
 }
}
document.addEventListener('pointerdown',activate,true);
document.addEventListener('focusin',activate,true);
document.addEventListener('scroll',schedule,{capture:true,passive:true});
document.addEventListener('input',schedule);
document.addEventListener('change',schedule);
document.addEventListener('load',schedule,true);
window.addEventListener('resize',schedule,{passive:true});
window.addEventListener('storage',schedule);
window.addEventListener('hashchange',()=>{active='';schedule();});
new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,characterData:true});
new MutationObserver(schedule).observe(document.body,{attributes:true,attributeFilter:['class','data-font','data-ui','data-theme','data-palette','data-rk-mode','data-rk-palette']});
if(document.fonts?.ready)document.fonts.ready.then(schedule);
schedule();
})();
