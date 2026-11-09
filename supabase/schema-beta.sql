-- Ракурс · доступ для беты: ссылки на главы, копии глав и комментарии.
-- Выполнить один раз в Supabase → SQL Editor (после schema.sql).

-- Ссылка для беты: какие главы истории открыты и какому аккаунту.
create table if not exists public.rk_shares (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  project_id   text not null,
  book_id      text not null,
  book_title   text not null default '',
  editor_email text not null,
  editor_id    uuid references auth.users(id) on delete set null,
  chapters     text[] not null default '{}',
  active       boolean not null default true,
  look         jsonb not null default '{}'::jsonb,
  colors       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  accepted_at  timestamptz
);
create index if not exists rk_shares_owner on public.rk_shares(owner_id, project_id);
create index if not exists rk_shares_editor on public.rk_shares(editor_id);
create index if not exists rk_shares_email on public.rk_shares(lower(editor_email));

-- Копии глав, открытых бетам. Автор отправляет их из приложения; бета читает только разрешённые.
create table if not exists public.rk_chapters (
  owner_id   uuid not null references auth.users(id) on delete cascade,
  project_id text not null,
  page_id    text not null,
  title      text not null default '',
  data       text not null,
  updated    bigint not null default 0,
  saved_at   timestamptz not null default now(),
  primary key (owner_id, project_id, page_id)
);

-- Комментарии автора и беты. parent_id — ответ в ветке; block_id/o1/o2/quote — привязка к фрагменту.
create table if not exists public.rk_comments (
  id          uuid primary key default gen_random_uuid(),
  share_id    uuid not null references public.rk_shares(id) on delete cascade,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  page_id     text not null,
  parent_id   uuid references public.rk_comments(id) on delete cascade,
  block_id    text,
  o1          integer,
  o2          integer,
  quote       text,
  body        text not null,
  role        text not null check (role in ('author','editor')),
  author_id   uuid not null default auth.uid(),
  author_name text not null default '',
  done        boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists rk_comments_owner_page on public.rk_comments(owner_id, page_id);
create index if not exists rk_comments_share on public.rk_comments(share_id, page_id);

alter table public.rk_shares   enable row level security;
alter table public.rk_chapters enable row level security;
alter table public.rk_comments enable row level security;

-- Бета имеет доступ к ссылке, если она активна и закреплена за её аккаунтом (или за её почтой до первого входа).
create or replace function public.rk_share_is_mine(s public.rk_shares) returns boolean
language sql stable security invoker as $$
  select s.active and (
    s.editor_id = auth.uid()
    or (s.editor_id is null and lower(s.editor_email) = lower(coalesce(auth.jwt()->>'email','')))
  )
$$;

-- Привязка ссылки к аккаунту беты при первом открытии.
create or replace function public.rk_accept_share(sid uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.uid() is null then return false; end if;
  update public.rk_shares
     set editor_id = auth.uid(), accepted_at = coalesce(accepted_at, now())
   where id = sid and active
     and lower(editor_email) = lower(coalesce(auth.jwt()->>'email',''))
     and (editor_id is null or editor_id = auth.uid());
  get diagnostics n = row_count;
  return n > 0 or exists (select 1 from public.rk_shares where id = sid and active and editor_id = auth.uid());
end $$;
grant execute on function public.rk_accept_share(uuid) to authenticated;

-- rk_shares: автор — всё; бета — только чтение своих ссылок.
drop policy if exists "rk_shares_owner" on public.rk_shares;
create policy "rk_shares_owner" on public.rk_shares
  for all to authenticated
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "rk_shares_editor_read" on public.rk_shares;
create policy "rk_shares_editor_read" on public.rk_shares
  for select to authenticated
  using (public.rk_share_is_mine(rk_shares));

-- rk_chapters: автор — всё; бета — чтение только глав из своих активных ссылок.
drop policy if exists "rk_chapters_owner" on public.rk_chapters;
create policy "rk_chapters_owner" on public.rk_chapters
  for all to authenticated
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "rk_chapters_editor_read" on public.rk_chapters;
create policy "rk_chapters_editor_read" on public.rk_chapters
  for select to authenticated
  using (exists (
    select 1 from public.rk_shares s
     where s.owner_id = rk_chapters.owner_id
       and s.project_id = rk_chapters.project_id
       and rk_chapters.page_id = any(s.chapters)
       and public.rk_share_is_mine(s)
  ));

-- rk_comments
drop policy if exists "rk_comments_owner_read" on public.rk_comments;
create policy "rk_comments_owner_read" on public.rk_comments
  for select to authenticated
  using (auth.uid() = owner_id);
drop policy if exists "rk_comments_editor_read" on public.rk_comments;
create policy "rk_comments_editor_read" on public.rk_comments
  for select to authenticated
  using (exists (
    select 1 from public.rk_shares s
     where s.id = rk_comments.share_id
       and rk_comments.page_id = any(s.chapters)
       and public.rk_share_is_mine(s)
  ));
drop policy if exists "rk_comments_owner_insert" on public.rk_comments;
create policy "rk_comments_owner_insert" on public.rk_comments
  for insert to authenticated
  with check (
    role = 'author' and author_id = auth.uid() and owner_id = auth.uid()
    and exists (select 1 from public.rk_shares s where s.id = share_id and s.owner_id = auth.uid())
  );
drop policy if exists "rk_comments_editor_insert" on public.rk_comments;
create policy "rk_comments_editor_insert" on public.rk_comments
  for insert to authenticated
  with check (
    role = 'editor' and author_id = auth.uid() and done = false
    and exists (
      select 1 from public.rk_shares s
       where s.id = share_id and s.owner_id = rk_comments.owner_id
         and rk_comments.page_id = any(s.chapters)
         and public.rk_share_is_mine(s)
    )
  );
drop policy if exists "rk_comments_update" on public.rk_comments;
create policy "rk_comments_update" on public.rk_comments
  for update to authenticated
  using (auth.uid() = owner_id or auth.uid() = author_id)
  with check (auth.uid() = owner_id or auth.uid() = author_id);
drop policy if exists "rk_comments_delete" on public.rk_comments;
create policy "rk_comments_delete" on public.rk_comments
  for delete to authenticated
  using (auth.uid() = owner_id or auth.uid() = author_id);

-- Неизменяемые поля; статус «решено» ставит только автор истории; чужой текст не правится.
create or replace function public.rk_comments_guard() returns trigger language plpgsql as $$
begin
  new.share_id := old.share_id; new.owner_id := old.owner_id; new.page_id := old.page_id;
  new.parent_id := old.parent_id; new.role := old.role; new.author_id := old.author_id;
  new.created_at := old.created_at;
  if auth.uid() is distinct from old.owner_id then new.done := old.done; end if;
  if auth.uid() is distinct from old.author_id then
    new.body := old.body; new.quote := old.quote; new.block_id := old.block_id; new.o1 := old.o1; new.o2 := old.o2;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists rk_comments_guard on public.rk_comments;
create trigger rk_comments_guard before update on public.rk_comments
  for each row execute function public.rk_comments_guard();

create or replace function public.rk_touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists rk_shares_touch on public.rk_shares;
create trigger rk_shares_touch before update on public.rk_shares
  for each row execute function public.rk_touch_updated_at();

drop trigger if exists rk_chapters_touch on public.rk_chapters;
create trigger rk_chapters_touch before update on public.rk_chapters
  for each row execute function public.rk_touch();
