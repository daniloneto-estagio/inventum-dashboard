-- INVENTUM 2026 — migração incremental: data/hora de início e fim (período real
-- de ocorrência, usado na detecção de conflito) e estimativa de público (número
-- informado na planilha, separado do campo de texto "Público estimado" que já
-- existia). Rode uma única vez no SQL Editor do Supabase, no projeto que já está
-- em produção.

alter table activities add column if not exists data_inicio timestamptz;
alter table activities add column if not exists data_fim timestamptz;
alter table activities add column if not exists estimativa_publico text;
