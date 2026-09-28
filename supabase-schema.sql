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
-- 2. Таблица пользователей (пока хранятся в файле проекта src/staff-users.js).
--    Здесь таблица не нужна, поэтому сразу переходим к политикам.
-- ---------------------------------------------------------------

<!--SECTION2-->

-- ---------------------------------------------------------------
-- 3. Политики доступа (для стадии «без входа» разрешаем всем
--    читать/создавать; при подключении авторизации их заменят
--    на политики по ролям).
-- ---------------------------------------------------------------
alter table public.staff_files enable row level security;

create policy "files_all_select" on public.staff_files for select using (true);
create policy "files_all_insert" on public.staff_files for insert with check (true);
create policy "files_all_update" on public.staff_files for update using (true);
create policy "files_all_delete" on public.staff_files for delete using (true);

-- ---------------------------------------------------------------
-- 3. Политики доступа к файлам в Storage bucket «staff».
--    Приватный bucket, созданный через интерфейс Supabase,
--    по умолчанию разрешает работу только залогиненным.
--    Пока вход не подключён, разрешаем анонимам читать,
--    загружать и удалять файлы. Это будет ужесточено
--    при добавлении авторизации.
-- ---------------------------------------------------------------
create policy "storage_files_select" on storage.objects for select using (bucket_id = 'staff');
create policy "storage_files_insert" on storage.objects for insert with check (bucket_id = 'staff');
create policy "storage_files_update" on storage.objects for update using (bucket_id = 'staff');
create policy "storage_files_delete" on storage.objects for delete using (bucket_id = 'staff');