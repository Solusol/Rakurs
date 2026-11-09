/* Ракурс: общая панель комментариев и личное оформление беты. */
(function(){
'use strict';
const isBeta=/^#\/beta\/[0-9a-f-]{36}/i.test(location.hash);
const style=document.createElement('style');
style.textContent=`
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
body.rk-beta-mode .rk-beta-main.rk-custom-bg{background:var(--beta-reader-bg)!important;--text:var(--beta-reader-fg);--rk-text:var(--beta-reader-fg);--muted:var(--beta-reader-fg);--heading:var(--beta-reader-fg);color:var(--beta-reader-fg)}
body.rk-beta-mode .rk-beta-main.rk-custom-bg .view{background:transparent!important;color:var(--beta-reader-fg)}
html body .modal.look .tile:has(input[type=radio]:checked){border:2px solid var(--text)!important;outline:0!important;box-shadow:inset 0 0 0 2px var(--bg)!important;background:color-mix(in srgb,var(--text) 16%,var(--bg))!important}
html body .modal.look .tile:has(input[type=radio]:checked)::after{content:'Выбран';position:absolute;top:4px;right:4px;padding:2px 5px;border-radius:4px;background:var(--text);color:var(--bg);font:12px/1.2 var(--hand);letter-spacing:.02em;pointer-events:none}
html body .modal.look .tile:has(input[type=radio]:focus-visible){outline:2px dashed var(--text)!important;outline-offset:3px!important}
`;
 document.head.appendChild(style);
const palettes={base:{dark:'#262626',light:'#E5E0CF',heading:'#723424',primary:'#5D6444',secondary:'#516D79',hover:'#AC6F40'},indigo:{dark:'#131316',light:'#B4D2EE',heading:'#424185',primary:'#4453A4',secondary:'#E2BF7B',hover:'#E1A656'},terra:{dark:'#151315',light:'#D0B78E',heading:'#B05721',primary:'#746A2C',secondary:'#46374A',hover:'#B05721'}};
function syncAppearance(){
 const b=document.body,pal=b.dataset.palette||b.dataset.rkPalette||'base',p=palettes[pal]||palettes.base;
 const mode=isBeta?b.dataset.theme:(b.dataset.rkMode||b.dataset.theme),light=mode==='light',bg=light?p.light:p.dark,fg=light?p.dark:p.light;
 const heading=pal==='indigo'&&!light?p.hover:pal==='terra'&&light?p.secondary:p.heading;
 const primary=pal==='terra'?(light?p.secondary:p.heading):p.primary;
 const hover=pal==='terra'&&!light?p.light:p.hover;
 const line='color-mix(in srgb,'+fg+' 35%,transparent)';
 const values={'--rk-bg':bg,'--rk-text':fg,'--rk-heading':heading,'--rk-primary':primary,'--rk-secondary':p.secondary,'--rk-hover':hover,'--rk-dark':p.dark,'--rk-light':p.light,'--rk-line':line,'--rk-accent':light?primary:fg,'--rk-crumb':light?primary:fg,'--rk-on-primary':p.light,'--rk-on-heading':p.light,'--rk-on-folder':p.light,'--balance-title':light?p.heading:p.light,'--balance-line':line,'--balance-strong':line,'--rk-text-page-surface':bg,'--bg':bg,'--bg-2':bg,'--bg-3':bg,'--text':fg,'--muted':fg,'--dim':fg,'--heading':heading,'--heading-2':heading,'--panel':bg,'--panel-text':fg,'--paper':bg,'--paper-2':fg,'--paper-text':fg,'--chrome':bg,'--chrome-2':bg,'--card':bg,'--well':bg,'--panel-soft':bg,'--panel-shade':bg,'--rust':p.heading,'--rust-2':p.heading,'--green':primary,'--green-2':p.secondary,'--green-soft':primary,'--hover':hover,'--hover-2':hover,'--line':line,'--line-strong':line,'--panel-line':line,'--sel':p.secondary,'--mark':p.secondary,'--mark-hot':hover,'--mark-line':p.secondary};
 Object.entries(values).forEach(([name,value])=>{if(b.style.getPropertyValue(name)!==value||b.style.getPropertyPriority(name)!=='important')b.style.setProperty(name,value,'important');});
 b.style.colorScheme=light?'light':'dark';
}
new MutationObserver(syncAppearance).observe(document.body,{attributes:true,attributeFilter:['data-theme','data-palette','data-rk-mode','data-rk-palette']});
syncAppearance();
let activeKey='',color=null,menu=null,anchor=null,frame=0;
const shareId=location.hash.split('/')[2];
function key(){const u=window.RK_CLOUD&&window.RK_CLOUD.user;return u&&u.id?'rk:beta-background:v1:'+u.id+':'+shareId:'';}
function contrast(hex){const c=hex.slice(1).match(/../g).map(x=>{const v=parseInt(x,16)/255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);});return c[0]*.2126+c[1]*.7152+c[2]*.0722>.179?'#191a18':'#f7f3e8';}
function applyBackground(){const main=document.querySelector('#rkBeta .rk-beta-main');if(!main)return;main.classList.toggle('rk-custom-bg',!!color);if(color){main.style.setProperty('--beta-reader-bg',color);main.style.setProperty('--beta-reader-fg',contrast(color));}else{main.style.removeProperty('--beta-reader-bg');main.style.removeProperty('--beta-reader-fg');}}
function saveBackground(value){try{if(!activeKey)throw Error();if(value)localStorage.setItem(activeKey,value);else localStorage.removeItem(activeKey);color=value;applyBackground();refreshSwatches();}catch(e){if(menu)menu.querySelector('[role=status]').textContent='Не удалось сохранить цвет в этом браузере.';}}
function refreshSwatches(){if(menu)menu.querySelectorAll('[data-color]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.color===color)));}
function closeMenu(){if(menu)menu.hidden=true;if(anchor)anchor.setAttribute('aria-expanded','false');}
function backgroundControl(old){
 const host=document.createElement('div');host.id='rkBetaBackground';
 const button=document.createElement('button');button.type='button';button.className='icon-btn';button.title='Цвет фона';button.setAttribute('aria-label','Цвет фона');button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','rkBetaBackgroundMenu');
 button.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 0 18h1.5a2.5 2.5 0 0 0 1.8-4.2 1.5 1.5 0 0 1 1.1-2.6H18a3 3 0 0 0 3-3A8.2 8.2 0 0 0 12 3Z"/><circle cx="7" cy="10" r="1"/><circle cx="10" cy="6.5" r="1"/><circle cx="14" cy="6.5" r="1"/><circle cx="17" cy="10" r="1"/></svg>';
 menu=document.createElement('div');menu.id='rkBetaBackgroundMenu';menu.hidden=true;menu.setAttribute('role','group');menu.setAttribute('aria-label','Выбор цвета фона');
 menu.innerHTML='<div>Цвет фона</div><div class="swatches"></div><button type="button" class="btn" data-reset>Как в теме</button><p role="status"></p>';
 const options=[['#d0b78e','Песочный'],['#e5e0cf','Кремовый'],['#f7f3e8','Бумага'],['#c6d3cc','Шалфейный'],['#c4d3df','Серо-голубой'],['#262626','Тёмный']];
 options.forEach(([value,label])=>{const b=document.createElement('button');b.type='button';b.dataset.color=value;b.title=label;b.setAttribute('aria-label',label);b.style.background=value;b.onclick=()=>saveBackground(value);menu.querySelector('.swatches').appendChild(b);});
 menu.querySelector('[data-reset]').onclick=()=>saveBackground(null);
 button.onclick=()=>{menu.hidden=!menu.hidden;button.setAttribute('aria-expanded',String(!menu.hidden));if(!menu.hidden)menu.querySelector('button').focus();};
 host.append(button,menu);old.replaceWith(host);anchor=button;refreshSwatches();
}
function alignComments(){
 document.querySelectorAll('.rk-bc-bar').forEach(bar=>{
  const view=bar.closest('.view,#view2Body');if(!view)return;
  const text=view.querySelector('.blocks .blk>.body');if(!text||!text.getClientRects().length)return;
  const parent=bar.parentElement;if(!parent)return;
  const p=parent.getBoundingClientRect(),t=text.getBoundingClientRect(),cs=getComputedStyle(parent);
  const left=Math.max(0,t.left-p.left-parseFloat(cs.paddingLeft||0)-parseFloat(cs.borderLeftWidth||0));
  const right=Math.max(0,p.right-parseFloat(cs.paddingRight||0)-parseFloat(cs.borderRightWidth||0)-t.right);
  const l=left.toFixed(2)+'px',r=right.toFixed(2)+'px';
  if(bar.style.marginLeft!==l)bar.style.marginLeft=l;if(bar.style.marginRight!==r)bar.style.marginRight=r;
 });
}
function sync(){
 alignComments();if(!isBeta)return;
 const root=document.getElementById('rkBeta');if(!root)return;
 const k=key();if(k&&k!==activeKey){activeKey=k;try{const raw=localStorage.getItem(k);color=/^#[0-9a-f]{6}$/i.test(raw||'')?raw:null;}catch(e){color=null;}}
 const old=root.querySelector('#rkBetaTheme');if(old)backgroundControl(old);
 const brand=root.querySelector('.rk-beta-brand'),reference=document.querySelector('#side .brand-t');
 if(brand&&reference&&!brand.dataset.uiMatched){const cs=getComputedStyle(reference);['fontFamily','fontSize','fontWeight','letterSpacing','textTransform','lineHeight'].forEach(p=>{brand.style[p]=cs[p];});brand.dataset.uiMatched='1';}
 const dialog=document.getElementById('rkBetaLook'),out=root.querySelector('#rkBetaOut');
 if(dialog&&out&&!dialog.querySelector('[data-beta-signout]')){const foot=dialog.querySelector('.dlgbox-foot');if(foot){const b=document.createElement('button');b.type='button';b.className='link-btn';b.dataset.betaSignout='1';b.textContent='Выйти из аккаунта';b.onclick=()=>out.click();foot.appendChild(b);}}
 applyBackground();
}
function schedule(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;sync();});}
new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
new MutationObserver(schedule).observe(document.body,{attributes:true,attributeFilter:['data-theme','data-palette','data-font','data-ui','class']});
if(window.ResizeObserver){const sizes=new ResizeObserver(schedule);['view','view2Body','rkBetaView'].forEach(id=>{const el=document.getElementById(id);if(el)sizes.observe(el);});}
window.addEventListener('resize',schedule);
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(schedule);
document.addEventListener('click',e=>{if(menu&&!menu.hidden&&!e.target.closest('#rkBetaBackground'))closeMenu();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu&&!menu.hidden){e.preventDefault();closeMenu();anchor.focus();}});
schedule();
})();
