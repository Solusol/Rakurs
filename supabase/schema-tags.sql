begin;
-- Ракурс · теги комментариев для беты.
-- Выполнить один раз в Supabase → SQL Editor (после schema-beta.sql).
-- Словарь тегов ведет автор: он уходит бете вместе со ссылкой (rk_shares.tags).
-- Бета может ставить на свои комментарии только теги из этого словаря.

alter table public.rk_shares   add column if not exists tags jsonb  not null default '[]'::jsonb;
alter table public.rk_comments add column if not exists tags text[] not null default '{}';

create or replace function public.rk_comments_tags_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed jsonb;
begin
  if tg_op = 'UPDATE' and new.tags is not distinct from old.tags then
    return new;
  end if;
  new.tags := coalesce(new.tags, '{}');
  -- автор истории ставит любые теги на любые комментарии
  if auth.uid() is not distinct from new.owner_id then
    return new;
  end if;
  -- остальные меняют теги только у своих комментариев
  if tg_op = 'UPDATE' and auth.uid() is distinct from old.author_id then
    new.tags := old.tags;
    return new;
  end if;
  select coalesce(s.tags, '[]'::jsonb) into allowed
    from public.rk_shares s where s.id = new.share_id;
  if exists (select 1 from unnest(new.tags) t where not (coalesce(allowed, '[]'::jsonb) ? t)) then
    raise exception 'Такого тега нет в списке автора';
  end if;
  return new;
end;
$$;

drop trigger if exists rk_comments_tags_guard on public.rk_comments;
create trigger rk_comments_tags_guard
before insert or update on public.rk_comments
for each row execute function public.rk_comments_tags_guard();

notify pgrst, 'reload schema';
commit;
