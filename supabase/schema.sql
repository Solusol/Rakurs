-- Ракурс · схема облачного хранилища. Выполнить один раз в Supabase → SQL Editor.

-- Данные историй: одна строка на историю пользователя.
create table if not exists public.rk_projects (
  user_id   uuid not null references auth.users(id) on delete cascade,
  id        text not null,
  name      text,
  data      text not null,
  updated   bigint not null default 0,
  deleted   boolean not null default false,
  saved_at  timestamptz not null default now(),
  primary key (user_id, id)
);

-- Список историй и флаг первого запуска.
create table if not exists public.rk_meta (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  projects  jsonb not null,
  updated   bigint not null default 0,
  saved_at  timestamptz not null default now()
);

alter table public.rk_projects enable row level security;
alter table public.rk_meta enable row level security;

drop policy if exists "rk_projects_own" on public.rk_projects;
create policy "rk_projects_own" on public.rk_projects
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "rk_meta_own" on public.rk_meta;
create policy "rk_meta_own" on public.rk_meta
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- saved_at обновляется автоматически.
create or replace function public.rk_touch() returns trigger language plpgsql as $$
begin new.saved_at = now(); return new; end $$;

drop trigger if exists rk_projects_touch on public.rk_projects;
create trigger rk_projects_touch before update on public.rk_projects
  for each row execute function public.rk_touch();

drop trigger if exists rk_meta_touch on public.rk_meta;
create trigger rk_meta_touch before update on public.rk_meta
  for each row execute function public.rk_touch();
