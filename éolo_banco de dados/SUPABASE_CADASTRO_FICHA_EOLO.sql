-- ============================================================
-- ÉOLO — CADASTRO + FICHA DE SAÚDE
-- Execute este arquivo UMA VEZ no SQL Editor do Supabase.
-- As tabelas fichas_saude e medicamentos já existem no projeto.
-- Este script apenas garante os campos usados pelo novo fluxo.
-- ============================================================

alter table public.usuarios
  add column if not exists idade integer;

alter table public.usuarios
  add column if not exists cadastro_concluido boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'usuarios_idade_valida'
      and conrelid = 'public.usuarios'::regclass
  ) then
    alter table public.usuarios
      add constraint usuarios_idade_valida
      check (idade is null or (idade >= 1 and idade <= 120));
  end if;
end $$;

-- Conferência
select column_name, data_type
from information_schema.columns
where table_schema='public'
  and table_name='usuarios'
  and column_name in ('idade','cadastro_concluido')
order by column_name;
