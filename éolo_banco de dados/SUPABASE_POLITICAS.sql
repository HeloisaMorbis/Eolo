-- ============================================================
-- ÉOLO — POLÍTICAS RLS PARA SUPABASE
-- Execute depois do SQL principal das tabelas.
-- ============================================================

-- USUARIOS
drop policy if exists "usuario pode inserir seu proprio cadastro" on public.usuarios;
create policy "usuario pode inserir seu proprio cadastro"
on public.usuarios
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "usuario pode ver seu proprio cadastro" on public.usuarios;
create policy "usuario pode ver seu proprio cadastro"
on public.usuarios
for select
to authenticated
using (id = auth.uid());

drop policy if exists "usuario pode atualizar seu proprio cadastro" on public.usuarios;
create policy "usuario pode atualizar seu proprio cadastro"
on public.usuarios
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());


-- PACIENTES
drop policy if exists "paciente pode inserir seu cadastro" on public.pacientes;
create policy "paciente pode inserir seu cadastro"
on public.pacientes
for insert
to authenticated
with check (usuario_id = auth.uid());

drop policy if exists "paciente pode acessar seu cadastro" on public.pacientes;
create policy "paciente pode acessar seu cadastro"
on public.pacientes
for select
to authenticated
using (usuario_id = auth.uid());

drop policy if exists "paciente pode atualizar seu cadastro" on public.pacientes;
create policy "paciente pode atualizar seu cadastro"
on public.pacientes
for update
to authenticated
using (usuario_id = auth.uid())
with check (usuario_id = auth.uid());


-- FICHA DE SAÚDE
drop policy if exists "paciente pode acessar sua ficha" on public.fichas_saude;
create policy "paciente pode acessar sua ficha"
on public.fichas_saude
for select
to authenticated
using (
  paciente_id in (
    select id from public.pacientes
    where usuario_id = auth.uid()
  )
);

drop policy if exists "paciente pode inserir sua ficha" on public.fichas_saude;
create policy "paciente pode inserir sua ficha"
on public.fichas_saude
for insert
to authenticated
with check (
  paciente_id in (
    select id from public.pacientes
    where usuario_id = auth.uid()
  )
);

drop policy if exists "paciente pode atualizar sua ficha" on public.fichas_saude;
create policy "paciente pode atualizar sua ficha"
on public.fichas_saude
for update
to authenticated
using (
  paciente_id in (
    select id from public.pacientes
    where usuario_id = auth.uid()
  )
)
with check (
  paciente_id in (
    select id from public.pacientes
    where usuario_id = auth.uid()
  )
);


-- BOMBINHAS
drop policy if exists "paciente pode acessar suas bombinhas" on public.bombinhas;
create policy "paciente pode acessar suas bombinhas"
on public.bombinhas
for select
to authenticated
using (
  paciente_id in (
    select id from public.pacientes
    where usuario_id = auth.uid()
  )
);

drop policy if exists "paciente pode inserir suas bombinhas" on public.bombinhas;
create policy "paciente pode inserir suas bombinhas"
on public.bombinhas
for insert
to authenticated
with check (
  paciente_id in (
    select id from public.pacientes
    where usuario_id = auth.uid()
  )
);

drop policy if exists "paciente pode atualizar suas bombinhas" on public.bombinhas;
create policy "paciente pode atualizar suas bombinhas"
on public.bombinhas
for update
to authenticated
using (
  paciente_id in (
    select id from public.pacientes
    where usuario_id = auth.uid()
  )
)
with check (
  paciente_id in (
    select id from public.pacientes
    where usuario_id = auth.uid()
  )
);


-- EVENTOS DAS BOMBINHAS
drop policy if exists "paciente pode acessar eventos de suas bombinhas" on public.eventos_bombinha;
create policy "paciente pode acessar eventos de suas bombinhas"
on public.eventos_bombinha
for select
to authenticated
using (
  bombinha_id in (
    select b.id
    from public.bombinhas b
    join public.pacientes p on p.id = b.paciente_id
    where p.usuario_id = auth.uid()
  )
);

drop policy if exists "paciente pode inserir eventos de suas bombinhas" on public.eventos_bombinha;
create policy "paciente pode inserir eventos de suas bombinhas"
on public.eventos_bombinha
for insert
to authenticated
with check (
  bombinha_id in (
    select b.id
    from public.bombinhas b
    join public.pacientes p on p.id = b.paciente_id
    where p.usuario_id = auth.uid()
  )
);


-- MEDICAMENTOS
drop policy if exists "paciente pode acessar seus medicamentos" on public.medicamentos;
create policy "paciente pode acessar seus medicamentos"
on public.medicamentos
for select
to authenticated
using (
  paciente_id in (
    select id from public.pacientes
    where usuario_id = auth.uid()
  )
);

drop policy if exists "paciente pode inserir seus medicamentos" on public.medicamentos;
create policy "paciente pode inserir seus medicamentos"
on public.medicamentos
for insert
to authenticated
with check (
  paciente_id in (
    select id from public.pacientes
    where usuario_id = auth.uid()
  )
);

drop policy if exists "paciente pode atualizar seus medicamentos" on public.medicamentos;
create policy "paciente pode atualizar seus medicamentos"
on public.medicamentos
for update
to authenticated
using (
  paciente_id in (
    select id from public.pacientes
    where usuario_id = auth.uid()
  )
)
with check (
  paciente_id in (
    select id from public.pacientes
    where usuario_id = auth.uid()
  )
);


-- REGISTROS DIÁRIOS
drop policy if exists "paciente pode acessar seus registros" on public.registros_diarios;
create policy "paciente pode acessar seus registros"
on public.registros_diarios
for select
to authenticated
using (
  paciente_id in (
    select id from public.pacientes
    where usuario_id = auth.uid()
  )
);

drop policy if exists "paciente pode inserir seus registros" on public.registros_diarios;
create policy "paciente pode inserir seus registros"
on public.registros_diarios
for insert
to authenticated
with check (
  paciente_id in (
    select id from public.pacientes
    where usuario_id = auth.uid()
  )
);

drop policy if exists "paciente pode atualizar seus registros" on public.registros_diarios;
create policy "paciente pode atualizar seus registros"
on public.registros_diarios
for update
to authenticated
using (
  paciente_id in (
    select id from public.pacientes
    where usuario_id = auth.uid()
  )
)
with check (
  paciente_id in (
    select id from public.pacientes
    where usuario_id = auth.uid()
  )
);


-- ============================================================
-- FIM
-- ============================================================
