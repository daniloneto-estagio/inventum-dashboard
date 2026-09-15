-- INVENTUM 2026 — schema do banco compartilhado (Supabase / Postgres)
-- Cole este arquivo inteiro no SQL Editor do painel Supabase e rode uma única vez.
-- Depois disso, rode supabase/seed.sql para trazer os dados da planilha original.

create table if not exists frentes (
  id serial primary key,
  nome text not null,
  cor text not null default 'slate',
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists activities (
  id serial primary key,
  atividade text not null default '' unique,
  tipo text not null default '',
  realizado_por text not null default '',
  tipo_local text not null default '',
  local text not null default '',
  codigo_mapa text not null default '',
  detalhes text not null default '',
  publico text not null default '',
  infraestrutura text not null default '',
  situacao text not null default '',
  responsavel text not null default '',
  status text not null default '',
  horario text not null default '',
  dias jsonb not null default '{}'::jsonb,
  frente_id integer references frentes(id) on delete set null,
  prazo date,
  last_modified_by_email text,
  last_modified_by_name text,
  last_modified_by_avatar text,
  last_modified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists demands (
  id serial primary key,
  entidade text not null default '' unique,
  necessidade text not null default '',
  proposta text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists pending (
  id serial primary key,
  texto text not null default '' unique,
  concluida boolean not null default false,
  prazo date,
  last_modified_by_email text,
  last_modified_by_name text,
  last_modified_by_avatar text,
  last_modified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists sponsors (
  id serial primary key,
  entidade text not null default '' unique,
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
  created_at timestamptz not null default now()
);

create index if not exists activities_frente_id_idx on activities(frente_id);

-- RLS habilitado: o acesso é individual via login Google (Supabase Auth), restrito
-- a contas do domínio da equipe. Qualquer usuário autenticado desse domínio pode
-- ler/escrever nas 5 tabelas (sem posse por linha, é um painel de equipe).
alter table frentes enable row level security;
alter table activities enable row level security;
alter table demands enable row level security;
alter table pending enable row level security;
alter table sponsors enable row level security;

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

drop policy if exists "sponsors_all" on sponsors;
create policy "sponsors_all" on sponsors for all
  using (auth.jwt() ->> 'email' like '%@patobranco.tec.br')
  with check (auth.jwt() ->> 'email' like '%@patobranco.tec.br');

-- Habilita Supabase Realtime para as 5 tabelas (edições aparecem ao vivo pra todo mundo).
-- Alguns projetos Supabase já colocam tabelas novas na publicação automaticamente,
-- então checamos antes de adicionar (evita erro "already member of publication" ao rodar de novo).
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'frentes') then
    execute 'alter publication supabase_realtime add table frentes';
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'activities') then
    execute 'alter publication supabase_realtime add table activities';
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'demands') then
    execute 'alter publication supabase_realtime add table demands';
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pending') then
    execute 'alter publication supabase_realtime add table pending';
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sponsors') then
    execute 'alter publication supabase_realtime add table sponsors';
  end if;
end $$;
