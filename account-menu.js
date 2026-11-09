/* Main-menu account action. Loaded by the cloud configuration entry point. */
(function(){
'use strict';
function start(){
 const menu=document.getElementById('projMenu');
 if(!menu)return;
 let busy=false;
 function sync(){
  const cloud=window.RK_CLOUD;
  let button=document.getElementById('rkMainLogout');
  if(!cloud?.enabled||!cloud.user){if(button)button.remove();return;}
  if(button)return;
  button=document.createElement('button');button.type='button';button.id='rkMainLogout';
  button.textContent='Выйти из аккаунта';
  button.style.cssText='border-top:1px solid var(--line-strong);margin-top:6px;width:100%;';
  button.addEventListener('click',logout);menu.appendChild(button);
 }
 async function logout(event){
  event.preventDefault();event.stopPropagation();
  const cloud=window.RK_CLOUD,button=event.currentTarget;
  if(busy||!cloud?.user)return;
  if(window.RK_CLOUD_UI?.isDirty?.()){window.alert('Сначала сохрани текущую правку, затем выйди из аккаунта.');return;}
  busy=true;button.disabled=true;button.textContent='Выходим…';button.setAttribute('aria-busy','true');
  try{
   await cloud.flushNow();
   if(cloud.state!=='ok'&&!window.confirm('Не удалось подтвердить сохранение всех изменений в облаке. Локальные истории останутся в этом браузере. Всё равно выйти из аккаунта?'))return;
   const {error}=await cloud.client.auth.signOut({scope:'local'});
   if(error)throw error;
   menu.hidden=true;window.location.reload();
  }catch(error){window.alert('Не удалось выйти из аккаунта. Попробуй ещё раз.');console.warn('account logout',error);}
  finally{busy=false;button.disabled=false;button.textContent='Выйти из аккаунта';button.removeAttribute('aria-busy');sync();}
 }
 new MutationObserver(sync).observe(menu,{childList:true,attributes:true,attributeFilter:['hidden']});
 document.getElementById('btnProjects')?.addEventListener('click',sync);
 window.addEventListener('pageshow',sync);sync();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
