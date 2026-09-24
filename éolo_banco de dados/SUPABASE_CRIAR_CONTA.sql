-- ============================================================
-- ÉOLO — CADASTRO DE CONTA
-- Adiciona a idade do usuário à tabela usuarios.
-- Execute este arquivo UMA VEZ no SQL Editor do Supabase.
-- ============================================================

alter table public.usuarios
  add column if not exists idade integer;

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
  and column_name='idade';
