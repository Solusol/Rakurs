/* Настройки облака «Ракурса» (Supabase).
   url — адрес проекта вида https://xxxxx.supabase.co
   anonKey — публичный ключ (anon / publishable). Он рассчитан на использование в браузере;
   доступ к чужим данным закрывают правила RLS в базе (см. supabase/schema.sql).
   Секретный ключ service_role сюда вставлять нельзя. */
window.RK_CLOUD_CONFIG = {
  url: 'https://sndscosvwxzjripggrib.supabase.co',
  anonKey: 'sb_publishable_3qw0ENZ9yuXM4f1SC5xNsA_oHWbvGM6'
};
/* Load account-menu UI separately from cloud storage and synchronization. */
(function(){
 const script=document.createElement('script');
 script.src=new URL('account-menu.js?v=20261109-logout-1',document.currentScript.src).href;
 script.defer=true;
 document.head.appendChild(script);
})();
