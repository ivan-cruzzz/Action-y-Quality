-- ============================================================
-- ACTION & QUALITY — ПОЛНЫЙ СБРОС БАЗЫ (осторожно: удаляет все данные!)
-- Применять ТОЛЬКО если: (а) проект новый и данные не нужны, или
-- (б) миграции применялись частично и появились ошибки "already exists".
-- После этого файла запустите ALL-IN-ONE.sql — и база готова.
-- ============================================================

drop schema public cascade;
create schema public;

-- вернуть стандартные права (Supabase требует)
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
