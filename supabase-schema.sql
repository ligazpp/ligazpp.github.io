-- =============================================================
-- Схема Supabase для служебной страницы сотрудников «Лиги».
-- Выполните этот скрипт в SQL Editor проекта Supabase
-- (Dashboard → SQL Editor → New query → Run).
-- =============================================================

-- ---------------------------------------------------------------
-- 1. Таблица файлов (метаданные загруженных файлов).
--    Сам файл хранится в Storage bucket «staff»
--    (Dashboard → Storage → New bucket, name: staff, public: НЕ включать).
-- ---------------------------------------------------------------
create table if not exists public.staff_files (
    id          uuid primary key default gen_random_uuid(),
    name        text not null,
    size_bytes  bigint not null default 0,
    author      text not null default 'Сотрудник',
    storage_path text not null,
    file_type   text,
    created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- 2. Пользователи живут в Supabase Auth (аутентификация), а не в таблице.
--    Список сотрудников создаётся здесь же — см. пункт 6.
-- ---------------------------------------------------------------

-- ---------------------------------------------------------------
-- 3. Политики доступа к таблице файлов:
--    работать может только вошедший пользователь (auth.role() = 'authenticated').
-- ---------------------------------------------------------------
alter table public.staff_files enable row level security;

drop policy if exists "files_all_select" on public.staff_files;
drop policy if exists "files_all_insert" on public.staff_files;
drop policy if exists "files_all_update" on public.staff_files;
drop policy if exists "files_all_delete" on public.staff_files;

create policy "files_auth_select" on public.staff_files
  for select using (auth.role() = 'authenticated');
create policy "files_auth_insert" on public.staff_files
  for insert with check (auth.role() = 'authenticated');
create policy "files_auth_update" on public.staff_files
  for update using (auth.role() = 'authenticated');
create policy "files_auth_delete" on public.staff_files
  for delete using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------
-- 4. Политики доступа к файлам в Storage bucket «staff»:
--    только вошедшие могут читать, загружать, удалять.
-- ---------------------------------------------------------------
drop policy if exists "storage_files_select" on storage.objects;
drop policy if exists "storage_files_insert" on storage.objects;
drop policy if exists "storage_files_update" on storage.objects;
drop policy if exists "storage_files_delete" on storage.objects;

create policy "storage_files_select" on storage.objects
  for select using (auth.role() = 'authenticated' and bucket_id = 'staff');
create policy "storage_files_insert" on storage.objects
  for insert with check (auth.role() = 'authenticated' and bucket_id = 'staff');
create policy "storage_files_update" on storage.objects
  for update using (auth.role() = 'authenticated' and bucket_id = 'staff');
create policy "storage_files_delete" on storage.objects
  for delete using (auth.role() = 'authenticated' and bucket_id = 'staff');

-- ---------------------------------------------------------------
-- 5. Профили сотрудников: дополнительная информация о вошедших
--    (полное имя для подписи файлов).
-- ---------------------------------------------------------------
create table if not exists public.staff_profiles (
    id         uuid primary key references auth.users (id) on delete cascade,
    full_name  text not null,
    role       text not null default 'staff'
);

-- Сам файл (в Git) не должен содержать пароли. Пароль задаётся
-- один раз в панели Supabase (Authentication → Users → Add user),
-- а здесь — только связка с профилем. Пример ниже — ЗАКОММЕНТИРОВАН.
--
-- Как создать первого пользователя — администратора:
--   1. Dashboard → Authentication → Users → Add user
--      Email:    afilin@liga.local
--      Password: (задать свой)
--   2. Выполните в SQL Editor (после создания пользователя):
--      insert into public.staff_profiles (id, full_name, role)
--      select id, 'Филин Александр Сергеевич', 'admin'
--      from auth.users
--      where email = 'afilin@liga.local'
--      on conflict (id) do nothing;

alter table public.staff_profiles enable row level security;

drop policy if exists "profiles_auth_select" on public.staff_profiles;
create policy "profiles_auth_select" on public.staff_profiles
  for select using (auth.role() = 'authenticated');