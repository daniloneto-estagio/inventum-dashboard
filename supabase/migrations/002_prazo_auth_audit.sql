-- INVENTUM 2026 — migração incremental: prazos, auditoria de edição e login individual.
-- Rode uma única vez no SQL Editor do Supabase, no projeto que JÁ está em produção
-- (quem está criando o projeto do zero não precisa disso: supabase/schema.sql já
-- inclui essas colunas e policies desde o início).

alter table activities add column if not exists prazo date;
alter table activities add column if not exists last_modified_by_email text;
alter table activities add column if not exists last_modified_by_name text;
alter table activities add column if not exists last_modified_by_avatar text;
alter table activities add column if not exists last_modified_at timestamptz;

alter table pending add column if not exists prazo date;
alter table pending add column if not exists last_modified_by_email text;
alter table pending add column if not exists last_modified_by_name text;
alter table pending add column if not exists last_modified_by_avatar text;
alter table pending add column if not exists last_modified_at timestamptz;

-- Troca as policies abertas (senha única checada no app) por policies que exigem
-- login individual via Supabase Auth, restrito ao domínio da equipe.
drop policy if exists "frentes_all" on frentes;
create policy "frentes_all" on frentes for all
  using (auth.jwt() ->> 'email' like '%@patobranco.tec.br')
  with check (auth.jwt() ->> 'email' like '%@patobranco.tec.br');

drop policy if exists "activities_all" on activities;
create policy "activities_all" on activities for all
  using (auth.jwt() ->> 'email' like '%@patobranco.tec.br')
  with check (auth.jwt() ->> 'email' like '%@patobranco.tec.br');

drop policy if exists "demands_all" on demands;
create policy "demands_all" on demands for all
  using (auth.jwt() ->> 'email' like '%@patobranco.tec.br')
  with check (auth.jwt() ->> 'email' like '%@patobranco.tec.br');

drop policy if exists "pending_all" on pending;
create policy "pending_all" on pending for all
  using (auth.jwt() ->> 'email' like '%@patobranco.tec.br')
  with check (auth.jwt() ->> 'email' like '%@patobranco.tec.br');
