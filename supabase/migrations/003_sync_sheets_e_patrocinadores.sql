-- INVENTUM 2026 — migração incremental: chaves naturais para sincronizar com o
-- Google Sheets (Apps Script faz upsert por esses campos) + tabela nova de
-- patrocinadores/expositores (planilha "POTENCIAIS EXPOSITORES").
-- Rode uma única vez no SQL Editor do Supabase, no projeto que já está em produção.

-- Chaves naturais usadas pelo Apps Script para upsert (on_conflict). Sem isso o
-- Postgres não sabe quando uma linha da planilha já existe no banco.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'activities_atividade_key') then
    alter table activities add constraint activities_atividade_key unique (atividade);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'demands_entidade_key') then
    alter table demands add constraint demands_entidade_key unique (entidade);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pending_texto_key') then
    alter table pending add constraint pending_texto_key unique (texto);
  end if;
end $$;
-- Se algum desses comandos falhar com "duplicate key value", existem duas linhas
-- com o mesmo nome/texto hoje — renomeie uma delas no dashboard e rode de novo.

create table if not exists sponsors (
  id serial primary key,
  entidade text not null default '',
  grau_interesse text not null default '',
  tipo_potencial text not null default '',
  envio_proposta text not null default '',
  estande_potencial text not null default '',
  obs text not null default '',
  resp_contato text not null default '',
  contrapartida text not null default '',
  contato text not null default '',
  datas_contato text not null default '',
  forma text not null default '',
  membro_gt text not null default '',
  ideia text not null default '',
  site text not null default '',
  principal_atracao text not null default '',
  obs_extra text not null default '',
  created_at timestamptz not null default now(),
  unique (entidade)
);

alter table sponsors enable row level security;

drop policy if exists "sponsors_all" on sponsors;
create policy "sponsors_all" on sponsors for all
  using (auth.jwt() ->> 'email' like '%@patobranco.tec.br')
  with check (auth.jwt() ->> 'email' like '%@patobranco.tec.br');

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sponsors') then
    execute 'alter publication supabase_realtime add table sponsors';
  end if;
end $$;
