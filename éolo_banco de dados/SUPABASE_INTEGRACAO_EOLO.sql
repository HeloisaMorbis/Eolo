-- ============================================================
-- ÉOLO — INTEGRAÇÃO COMPLETA COM SUPABASE
-- IDs do sistema = INTEGER
-- Identidade do Supabase Auth = UUID em usuarios.auth_id
-- ============================================================

create extension if not exists pgcrypto;

-- 1) Ponte entre auth.users e a tabela usuarios
alter table public.usuarios add column if not exists auth_id uuid;
alter table public.usuarios add column if not exists email text;
alter table public.usuarios add column if not exists nome text;
alter table public.usuarios add column if not exists tipo_usuario text;
alter table public.usuarios add column if not exists idade integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='usuarios_idade_valida' and conrelid='public.usuarios'::regclass) then
    alter table public.usuarios add constraint usuarios_idade_valida check (idade is null or (idade >= 1 and idade <= 120));
  end if;
end $$;

create unique index if not exists usuarios_auth_id_unique
on public.usuarios(auth_id)
where auth_id is not null;

-- 2) Campos de integração. Os dados completos do protótipo também ficam em JSONB.
alter table public.pacientes add column if not exists nome text;
alter table public.pacientes add column if not exists email text;
alter table public.pacientes add column if not exists dados jsonb default '{}'::jsonb;

alter table public.fichas_saude add column if not exists dados jsonb default '{}'::jsonb;
alter table public.fichas_saude add column if not exists atualizado_em timestamptz default now();

alter table public.bombinhas add column if not exists nome text;
alter table public.bombinhas add column if not exists dispositivo_nome text;
alter table public.bombinhas add column if not exists dados jsonb default '{}'::jsonb;
alter table public.bombinhas add column if not exists atualizado_em timestamptz default now();

alter table public.eventos_bombinha add column if not exists tipo text;
alter table public.eventos_bombinha add column if not exists uptime_s bigint;
alter table public.eventos_bombinha add column if not exists dados jsonb default '{}'::jsonb;
alter table public.eventos_bombinha add column if not exists ocorrido_em timestamptz default now();

alter table public.medicamentos add column if not exists nome text;
alter table public.medicamentos add column if not exists classificacao text;
alter table public.medicamentos add column if not exists dados jsonb default '{}'::jsonb;
alter table public.medicamentos add column if not exists atualizado_em timestamptz default now();

alter table public.registros_diarios add column if not exists dados jsonb default '{}'::jsonb;
alter table public.registros_diarios add column if not exists registrado_em timestamptz default now();

alter table public.crises_asma add column if not exists dados jsonb default '{}'::jsonb;
alter table public.crises_asma add column if not exists registrado_em timestamptz default now();

alter table public.relatorios add column if not exists dados jsonb default '{}'::jsonb;
alter table public.relatorios add column if not exists gerado_em timestamptz default now();

-- 3) RLS
alter table public.usuarios enable row level security;
alter table public.pacientes enable row level security;
alter table public.cuidadores enable row level security;
alter table public.cuidadores_pacientes enable row level security;
alter table public.fichas_saude enable row level security;
alter table public.bombinhas enable row level security;
alter table public.eventos_bombinha enable row level security;
alter table public.medicamentos enable row level security;
alter table public.registros_diarios enable row level security;
alter table public.crises_asma enable row level security;
alter table public.relatorios enable row level security;

-- 4) Remove políticas antigas que comparavam INTEGER diretamente com auth.uid() (UUID)
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname='public'
      and tablename in ('usuarios','pacientes','cuidadores','cuidadores_pacientes','fichas_saude','bombinhas','eventos_bombinha','medicamentos','registros_diarios','crises_asma','relatorios')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- USUARIOS
create policy eolo_usuarios_select on public.usuarios
for select to authenticated
using (auth_id = auth.uid());

create policy eolo_usuarios_insert on public.usuarios
for insert to authenticated
with check (auth_id = auth.uid());

create policy eolo_usuarios_update on public.usuarios
for update to authenticated
using (auth_id = auth.uid())
with check (auth_id = auth.uid());

-- PACIENTES
create policy eolo_pacientes_select on public.pacientes
for select to authenticated
using (exists (select 1 from public.usuarios u where u.id=pacientes.usuario_id and u.auth_id=auth.uid()));

create policy eolo_pacientes_insert on public.pacientes
for insert to authenticated
with check (exists (select 1 from public.usuarios u where u.id=pacientes.usuario_id and u.auth_id=auth.uid()));

create policy eolo_pacientes_update on public.pacientes
for update to authenticated
using (exists (select 1 from public.usuarios u where u.id=pacientes.usuario_id and u.auth_id=auth.uid()))
with check (exists (select 1 from public.usuarios u where u.id=pacientes.usuario_id and u.auth_id=auth.uid()));

-- FICHA
create policy eolo_ficha_select on public.fichas_saude
for select to authenticated
using (exists (select 1 from public.pacientes p join public.usuarios u on u.id=p.usuario_id where p.id=fichas_saude.paciente_id and u.auth_id=auth.uid()));

create policy eolo_ficha_insert on public.fichas_saude
for insert to authenticated
with check (exists (select 1 from public.pacientes p join public.usuarios u on u.id=p.usuario_id where p.id=fichas_saude.paciente_id and u.auth_id=auth.uid()));

create policy eolo_ficha_update on public.fichas_saude
for update to authenticated
using (exists (select 1 from public.pacientes p join public.usuarios u on u.id=p.usuario_id where p.id=fichas_saude.paciente_id and u.auth_id=auth.uid()))
with check (exists (select 1 from public.pacientes p join public.usuarios u on u.id=p.usuario_id where p.id=fichas_saude.paciente_id and u.auth_id=auth.uid()));

-- BOMBINHAS
create policy eolo_bombinhas_select on public.bombinhas
for select to authenticated
using (exists (select 1 from public.pacientes p join public.usuarios u on u.id=p.usuario_id where p.id=bombinhas.paciente_id and u.auth_id=auth.uid()));

create policy eolo_bombinhas_insert on public.bombinhas
for insert to authenticated
with check (exists (select 1 from public.pacientes p join public.usuarios u on u.id=p.usuario_id where p.id=bombinhas.paciente_id and u.auth_id=auth.uid()));

create policy eolo_bombinhas_update on public.bombinhas
for update to authenticated
using (exists (select 1 from public.pacientes p join public.usuarios u on u.id=p.usuario_id where p.id=bombinhas.paciente_id and u.auth_id=auth.uid()))
with check (exists (select 1 from public.pacientes p join public.usuarios u on u.id=p.usuario_id where p.id=bombinhas.paciente_id and u.auth_id=auth.uid()));

-- EVENTOS
create policy eolo_eventos_select on public.eventos_bombinha
for select to authenticated
using (exists (select 1 from public.bombinhas b join public.pacientes p on p.id=b.paciente_id join public.usuarios u on u.id=p.usuario_id where b.id=eventos_bombinha.bombinha_id and u.auth_id=auth.uid()));

create policy eolo_eventos_insert on public.eventos_bombinha
for insert to authenticated
with check (exists (select 1 from public.bombinhas b join public.pacientes p on p.id=b.paciente_id join public.usuarios u on u.id=p.usuario_id where b.id=eventos_bombinha.bombinha_id and u.auth_id=auth.uid()));

-- MEDICAMENTOS
create policy eolo_medicamentos_select on public.medicamentos
for select to authenticated
using (exists (select 1 from public.pacientes p join public.usuarios u on u.id=p.usuario_id where p.id=medicamentos.paciente_id and u.auth_id=auth.uid()));

create policy eolo_medicamentos_insert on public.medicamentos
for insert to authenticated
with check (exists (select 1 from public.pacientes p join public.usuarios u on u.id=p.usuario_id where p.id=medicamentos.paciente_id and u.auth_id=auth.uid()));

create policy eolo_medicamentos_update on public.medicamentos
for update to authenticated
using (exists (select 1 from public.pacientes p join public.usuarios u on u.id=p.usuario_id where p.id=medicamentos.paciente_id and u.auth_id=auth.uid()))
with check (exists (select 1 from public.pacientes p join public.usuarios u on u.id=p.usuario_id where p.id=medicamentos.paciente_id and u.auth_id=auth.uid()));

-- REGISTROS DIÁRIOS
create policy eolo_registros_select on public.registros_diarios
for select to authenticated
using (exists (select 1 from public.pacientes p join public.usuarios u on u.id=p.usuario_id where p.id=registros_diarios.paciente_id and u.auth_id=auth.uid()));

create policy eolo_registros_insert on public.registros_diarios
for insert to authenticated
with check (exists (select 1 from public.pacientes p join public.usuarios u on u.id=p.usuario_id where p.id=registros_diarios.paciente_id and u.auth_id=auth.uid()));

create policy eolo_registros_update on public.registros_diarios
for update to authenticated
using (exists (select 1 from public.pacientes p join public.usuarios u on u.id=p.usuario_id where p.id=registros_diarios.paciente_id and u.auth_id=auth.uid()))
with check (exists (select 1 from public.pacientes p join public.usuarios u on u.id=p.usuario_id where p.id=registros_diarios.paciente_id and u.auth_id=auth.uid()));

-- CRISES
create policy eolo_crises_select on public.crises_asma
for select to authenticated
using (exists (select 1 from public.pacientes p join public.usuarios u on u.id=p.usuario_id where p.id=crises_asma.paciente_id and u.auth_id=auth.uid()));

create policy eolo_crises_insert on public.crises_asma
for insert to authenticated
with check (exists (select 1 from public.pacientes p join public.usuarios u on u.id=p.usuario_id where p.id=crises_asma.paciente_id and u.auth_id=auth.uid()));

-- RELATÓRIOS
create policy eolo_relatorios_select on public.relatorios
for select to authenticated
using (exists (select 1 from public.pacientes p join public.usuarios u on u.id=p.usuario_id where p.id=relatorios.paciente_id and u.auth_id=auth.uid()));

create policy eolo_relatorios_insert on public.relatorios
for insert to authenticated
with check (exists (select 1 from public.pacientes p join public.usuarios u on u.id=p.usuario_id where p.id=relatorios.paciente_id and u.auth_id=auth.uid()));

-- CUIDADORES: acesso somente aos vínculos próprios
create policy eolo_cuidadores_select on public.cuidadores
for select to authenticated
using (exists (select 1 from public.usuarios u where u.id=cuidadores.usuario_id and u.auth_id=auth.uid()));

create policy eolo_cuidadores_insert on public.cuidadores
for insert to authenticated
with check (exists (select 1 from public.usuarios u where u.id=cuidadores.usuario_id and u.auth_id=auth.uid()));

create policy eolo_vinculos_select on public.cuidadores_pacientes
for select to authenticated
using (
  exists (select 1 from public.cuidadores c join public.usuarios u on u.id=c.usuario_id where c.id=cuidadores_pacientes.cuidador_id and u.auth_id=auth.uid())
  or
  exists (select 1 from public.pacientes p join public.usuarios u on u.id=p.usuario_id where p.id=cuidadores_pacientes.paciente_id and u.auth_id=auth.uid())
);

-- 5) Atualiza automaticamente o timestamp das tabelas que possuem atualizado_em.
create or replace function public.eolo_atualizar_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists trg_eolo_ficha_timestamp on public.fichas_saude;
create trigger trg_eolo_ficha_timestamp before update on public.fichas_saude for each row execute function public.eolo_atualizar_timestamp();

drop trigger if exists trg_eolo_bombinha_timestamp on public.bombinhas;
create trigger trg_eolo_bombinha_timestamp before update on public.bombinhas for each row execute function public.eolo_atualizar_timestamp();

drop trigger if exists trg_eolo_medicamento_timestamp on public.medicamentos;
create trigger trg_eolo_medicamento_timestamp before update on public.medicamentos for each row execute function public.eolo_atualizar_timestamp();

-- ============================================================
-- Depois de executar este arquivo:
-- 1. Crie/registre um usuário pelo próprio Éolo.
-- 2. O JavaScript cria a linha em usuarios e pacientes automaticamente.
-- 3. Ficha, medicamentos, bombinhas, eventos BLE e registros passam a ser sincronizados.
-- ============================================================
