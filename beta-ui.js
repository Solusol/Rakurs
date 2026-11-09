/* Ракурс: компактный интерфейс беты. Подключать после beta.js. */
(function(){
'use strict';
if(!/^#\/beta\/[0-9a-f-]{36}/i.test(location.hash))return;
const style=document.createElement('style');
style.textContent=`
body.rk-beta-mode .rk-beta-readonly,body.rk-beta-mode .rk-beta-user{display:none!important}
body.rk-beta-mode .rk-beta-bar-in>#rkBetaOut{display:none!important}
body.rk-beta-mode .rk-bc-bar{box-sizing:border-box;gap:6px;font-size:13px}
body.rk-beta-mode .rk-bc-bar .chips{gap:5px}
body.rk-beta-mode .rk-bc-bar .chip{font-size:13px!important;padding:5px 10px!important;min-height:32px!important;line-height:1.2}
body.rk-beta-mode .rk-bc-bar>.btn{font-size:13px!important;padding:6px 12px!important;min-height:34px!important;line-height:1.2}
#rkBetaBackground{position:relative;display:inline-flex}
#rkBetaBackgroundMenu{position:absolute;right:0;top:calc(100% + 8px);width:220px;box-sizing:border-box;padding:12px;background:var(--bg);color:var(--text);border:1px solid var(--line-strong);border-radius:8px;box-shadow:0 4px 18px #0004;z-index:70}
#rkBetaBackgroundMenu[hidden]{display:none}
#rkBetaBackgroundMenu .swatches{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}
#rkBetaBackgroundMenu .swatches button{width:36px;height:36px;min-width:36px;border:1px solid var(--line-strong);border-radius:50%;cursor:pointer}
#rkBetaBackgroundMenu .swatches button[aria-pressed=true]{outline:2px solid var(--text);outline-offset:2px}
body.rk-beta-mode .rk-beta-main.rk-custom-bg{background:var(--beta-reader-bg)!important;--text:var(--beta-reader-fg);--rk-text:var(--beta-reader-fg);--muted:var(--beta-reader-fg);--heading:var(--beta-reader-fg);color:var(--beta-reader-fg)}
body.rk-beta-mode .rk-beta-main.rk-custom-bg .view{background:transparent!important;color:var(--beta-reader-fg)}
@media(pointer:coarse){body.rk-beta-mode .rk-bc-bar .chip,body.rk-beta-mode .rk-bc-bar>.btn{min-height:44px!important}}
`;
document.head.appendChild(style);
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
function align(){const view=document.getElementById('rkBetaView');if(!view)return;const bar=view.querySelector('.rk-bc-bar'),text=view.querySelector('.blocks .blk>.body');if(!bar||!text)return;const v=view.getBoundingClientRect(),t=text.getBoundingClientRect(),cs=getComputedStyle(view);const left=Math.max(0,t.left-v.left-parseFloat(cs.paddingLeft||0));const right=Math.max(0,v.right-parseFloat(cs.paddingRight||0)-t.right);const l=left.toFixed(2)+'px',r=right.toFixed(2)+'px';if(bar.style.marginLeft!==l)bar.style.marginLeft=l;if(bar.style.marginRight!==r)bar.style.marginRight=r;}
function sync(){
 const root=document.getElementById('rkBeta');if(!root)return;
 const k=key();if(k&&k!==activeKey){activeKey=k;try{const raw=localStorage.getItem(k);color=/^#[0-9a-f]{6}$/i.test(raw||'')?raw:null;}catch(e){color=null;}}
 const old=root.querySelector('#rkBetaTheme');if(old)backgroundControl(old);
 const brand=root.querySelector('.rk-beta-brand'),reference=document.querySelector('#side .brand-t');
 if(brand&&reference&&!brand.dataset.uiMatched){const cs=getComputedStyle(reference);['fontFamily','fontSize','fontWeight','letterSpacing','textTransform','lineHeight'].forEach(p=>{brand.style[p]=cs[p];});brand.dataset.uiMatched='1';}
 const dialog=document.getElementById('rkBetaLook'),out=root.querySelector('#rkBetaOut');
 if(dialog&&out&&!dialog.querySelector('[data-beta-signout]')){const foot=dialog.querySelector('.dlgbox-foot');if(foot){const b=document.createElement('button');b.type='button';b.className='link-btn';b.dataset.betaSignout='1';b.textContent='Выйти из аккаунта';b.onclick=()=>out.click();foot.appendChild(b);}}
 applyBackground();align();
}
function schedule(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;sync();});}
new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
new MutationObserver(schedule).observe(document.body,{attributes:true,attributeFilter:['data-theme','data-palette']});
window.addEventListener('resize',schedule);
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(schedule);
document.addEventListener('click',e=>{if(menu&&!menu.hidden&&!e.target.closest('#rkBetaBackground'))closeMenu();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu&&!menu.hidden){e.preventDefault();closeMenu();anchor.focus();}});
schedule();
})();
