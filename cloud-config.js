/* Настройки облака «Ракурса» (Supabase).
   url — адрес проекта вида https://xxxxx.supabase.co
   anonKey — публичный ключ (anon / publishable). Он рассчитан на использование в браузере;
   доступ к чужим данным закрывают правила RLS в базе (см. supabase/schema.sql).
   Секретный ключ service_role сюда вставлять нельзя. */
window.RK_CLOUD_CONFIG = {
  url: '',
  anonKey: ''
};
