-- ============================================================
-- Controle Logístico — Rastreamento de motoristas e comprovantes
-- Rode este arquivo inteiro no SQL Editor do Supabase
-- (Painel do Supabase > SQL Editor > New query > colar > Run).
-- Pode ser rodado de novo sem perder dados (é idempotente).
--
-- Perfis:
--   contratante    → enxerga e administra tudo (todas as transportadoras)
--   transportadora → enxerga só os motoristas e rotas da própria transportadora
--   motorista      → enxerga só as próprias rotas, envia localização e
--                    anexa o comprovante de entrega no fim da rota
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Tabelas
-- ------------------------------------------------------------
create table if not exists public.lg_carriers (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text unique,                       -- só dígitos
  telefone text not null default '',
  email text not null default '',
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.lg_users (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  role text not null check (role in ('contratante', 'transportadora', 'motorista')),
  carrier_id uuid references public.lg_carriers(id) on delete restrict,
  cpf text unique,                        -- só dígitos (motoristas)
  telefone text not null default '',
  placa text not null default '',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  constraint lg_users_carrier_required check (role = 'contratante' or carrier_id is not null)
);

create table if not exists public.lg_import_batches (
  id uuid primary key default gen_random_uuid(),
  file_name text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  total int not null default 0,
  inserted int not null default 0,
  updated int not null default 0,
  failed int not null default 0,
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.lg_routes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,            -- identificador da carga no sistema de origem
  carrier_id uuid not null references public.lg_carriers(id) on delete restrict,
  driver_id uuid references public.lg_users(id) on delete set null,
  placa text not null default '',
  origem text not null default '',
  destino text not null default '',
  cliente text not null default '',
  nota_fiscal text not null default '',
  produto text not null default '',
  peso numeric,
  data_prevista date,
  dest_lat double precision,
  dest_lng double precision,
  observacao text not null default '',
  status text not null default 'pendente'
    check (status in ('pendente', 'em_rota', 'entregue', 'cancelada')),
  started_at timestamptz,
  finished_at timestamptz,
  batch_id uuid references public.lg_import_batches(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lg_routes_carrier_idx on public.lg_routes (carrier_id);
create index if not exists lg_routes_driver_idx on public.lg_routes (driver_id);
create index if not exists lg_routes_status_idx on public.lg_routes (status);

create table if not exists public.lg_locations (
  id bigint generated always as identity primary key,
  driver_id uuid not null references public.lg_users(id) on delete cascade,
  route_id uuid references public.lg_routes(id) on delete set null,
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  speed double precision,                 -- m/s, como vem do GPS do aparelho
  heading double precision,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists lg_locations_route_idx on public.lg_locations (route_id, recorded_at);
create index if not exists lg_locations_driver_idx on public.lg_locations (driver_id, recorded_at desc);

-- Última posição conhecida de cada motorista (mantida por trigger)
create table if not exists public.lg_driver_status (
  driver_id uuid primary key references public.lg_users(id) on delete cascade,
  route_id uuid references public.lg_routes(id) on delete set null,
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  speed double precision,
  recorded_at timestamptz not null
);

create table if not exists public.lg_documents (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.lg_routes(id) on delete cascade,
  uploaded_by uuid references auth.users(id) on delete set null,
  storage_path text not null unique,
  file_name text not null default '',
  mime_type text not null default '',
  size_bytes bigint,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);
create index if not exists lg_documents_route_idx on public.lg_documents (route_id);

-- ------------------------------------------------------------
-- Funções auxiliares (security definer evita recursão no RLS)
-- ------------------------------------------------------------
create or replace function public.lg_my_role()
returns text language sql security definer set search_path = public stable as $$
  select role from public.lg_users where id = auth.uid() and ativo;
$$;

create or replace function public.lg_my_carrier()
returns uuid language sql security definer set search_path = public stable as $$
  select carrier_id from public.lg_users where id = auth.uid() and ativo;
$$;

create or replace function public.lg_is_contratante()
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce(public.lg_my_role() = 'contratante', false);
$$;

create or replace function public.lg_can_see_driver(p_driver uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select case public.lg_my_role()
    when 'contratante' then true
    when 'transportadora' then exists (
      select 1 from public.lg_users u
      where u.id = p_driver and u.carrier_id = public.lg_my_carrier())
    when 'motorista' then p_driver = auth.uid()
    else false
  end;
$$;

create or replace function public.lg_can_see_route(p_route uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select case public.lg_my_role()
    when 'contratante' then exists (select 1 from public.lg_routes where id = p_route)
    when 'transportadora' then exists (
      select 1 from public.lg_routes r
      where r.id = p_route and r.carrier_id = public.lg_my_carrier())
    when 'motorista' then exists (
      select 1 from public.lg_routes r
      where r.id = p_route and r.driver_id = auth.uid())
    else false
  end;
$$;

-- Quem pode anexar comprovante: o motorista da rota ou o contratante
create or replace function public.lg_can_upload_route(p_route uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select public.lg_is_contratante() or exists (
    select 1 from public.lg_routes r
    where r.id = p_route and r.driver_id = auth.uid()
      and public.lg_my_role() = 'motorista'
      and r.status in ('pendente', 'em_rota', 'entregue'));
$$;

-- Converte o primeiro segmento do caminho no Storage em uuid sem estourar erro
create or replace function public.lg_path_route(p_name text)
returns uuid language plpgsql immutable as $$
begin
  return split_part(p_name, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;

-- ------------------------------------------------------------
-- Triggers
-- ------------------------------------------------------------
create or replace function public.lg_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists lg_routes_touch on public.lg_routes;
create trigger lg_routes_touch before update on public.lg_routes
  for each row execute function public.lg_touch_updated_at();

create or replace function public.lg_on_location()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.lg_driver_status as s (driver_id, route_id, lat, lng, accuracy, speed, recorded_at)
  values (new.driver_id, new.route_id, new.lat, new.lng, new.accuracy, new.speed, new.recorded_at)
  on conflict (driver_id) do update
    set route_id = excluded.route_id, lat = excluded.lat, lng = excluded.lng,
        accuracy = excluded.accuracy, speed = excluded.speed, recorded_at = excluded.recorded_at
    where s.recorded_at <= excluded.recorded_at;   -- posições antigas (fila offline) não sobrescrevem
  return new;
end;
$$;

drop trigger if exists lg_locations_status on public.lg_locations;
create trigger lg_locations_status after insert on public.lg_locations
  for each row execute function public.lg_on_location();

-- ------------------------------------------------------------
-- Ações do motorista e da transportadora (RPC)
-- ------------------------------------------------------------
create or replace function public.lg_start_route(p_route uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.lg_routes
     set status = 'em_rota', started_at = coalesce(started_at, now())
   where id = p_route and driver_id = auth.uid() and status = 'pendente';
  if not found then
    raise exception 'Rota não encontrada, não atribuída a você ou já iniciada.';
  end if;
end;
$$;

create or replace function public.lg_finish_route(p_route uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.lg_documents where route_id = p_route) then
    raise exception 'Anexe o documento de entrega antes de finalizar a rota.';
  end if;
  update public.lg_routes
     set status = 'entregue', finished_at = now(), started_at = coalesce(started_at, now())
   where id = p_route and status in ('pendente', 'em_rota')
     and (driver_id = auth.uid() or public.lg_is_contratante());
  if not found then
    raise exception 'Rota não encontrada, não atribuída a você ou já finalizada.';
  end if;
end;
$$;

-- Transportadora (ou contratante) define o motorista e a placa de uma rota
create or replace function public.lg_assign_driver(p_route uuid, p_driver uuid, p_placa text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_route public.lg_routes;
begin
  select * into v_route from public.lg_routes where id = p_route;
  if v_route.id is null then raise exception 'Rota não encontrada.'; end if;

  if not (public.lg_is_contratante()
          or (public.lg_my_role() = 'transportadora' and v_route.carrier_id = public.lg_my_carrier())) then
    raise exception 'Sem permissão para alterar esta rota.';
  end if;
  if v_route.status in ('entregue', 'cancelada') then
    raise exception 'Rota já encerrada.';
  end if;
  if p_driver is not null and not exists (
      select 1 from public.lg_users
      where id = p_driver and role = 'motorista' and carrier_id = v_route.carrier_id) then
    raise exception 'O motorista precisa pertencer à transportadora da rota.';
  end if;

  update public.lg_routes
     set driver_id = p_driver,
         placa = coalesce(nullif(trim(p_placa), ''),
                          (select nullif(placa, '') from public.lg_users where id = p_driver),
                          placa)
   where id = p_route;
end;
$$;

-- ------------------------------------------------------------
-- Importação do arquivo do sistema (só contratante)
-- p_rows: array JSON de objetos com as chaves
--   codigo*, transportadora_cnpj, transportadora_nome, motorista_cpf, placa,
--   origem, destino, cliente, nota_fiscal, produto, peso, data_prevista (AAAA-MM-DD),
--   dest_lat, dest_lng, observacao, linha (nº da linha no arquivo, para mensagens)
-- Faz upsert pelo "codigo": reimportar o mesmo arquivo atualiza os dados da carga
-- sem mexer no status, na posição nem nos comprovantes já enviados.
-- ------------------------------------------------------------
create or replace function public.lg_import_routes(
  p_rows jsonb,
  p_file_name text default '',
  p_create_carriers boolean default true
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_batch uuid;
  v_row jsonb;
  v_codigo text;
  v_cnpj text;
  v_cnome text;
  v_cpf text;
  v_carrier uuid;
  v_driver uuid;
  v_driver_carrier uuid;
  v_inserted boolean;
  v_ins int := 0;
  v_upd int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_total int := 0;
  v_line int;
begin
  if not public.lg_is_contratante() then
    raise exception 'Apenas o contratante pode importar cargas.';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Formato inválido: era esperado um array de linhas.';
  end if;

  insert into public.lg_import_batches (file_name, created_by)
  values (coalesce(p_file_name, ''), auth.uid())
  returning id into v_batch;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_total := v_total + 1;
    v_line := coalesce((v_row->>'linha')::int, v_total);
    begin
      v_codigo := nullif(trim(v_row->>'codigo'), '');
      if v_codigo is null then
        raise exception 'Código da carga vazio.';
      end if;

      -- Transportadora: por CNPJ, senão por nome
      v_cnpj := nullif(regexp_replace(coalesce(v_row->>'transportadora_cnpj', ''), '\D', '', 'g'), '');
      v_cnome := nullif(trim(v_row->>'transportadora_nome'), '');
      v_carrier := null;
      if v_cnpj is not null then
        select id into v_carrier from public.lg_carriers where cnpj = v_cnpj;
      end if;
      if v_carrier is null and v_cnome is not null then
        select id into v_carrier from public.lg_carriers
         where lower(nome) = lower(v_cnome) order by created_at limit 1;
      end if;
      if v_carrier is null then
        if v_cnpj is null and v_cnome is null then
          raise exception 'Transportadora não informada.';
        end if;
        if not p_create_carriers then
          raise exception 'Transportadora "%" não cadastrada.', coalesce(v_cnome, v_cnpj);
        end if;
        insert into public.lg_carriers (nome, cnpj)
        values (coalesce(v_cnome, 'Transportadora ' || v_cnpj), v_cnpj)
        returning id into v_carrier;
        v_warnings := v_warnings || jsonb_build_object('linha', v_line, 'codigo', v_codigo,
          'aviso', 'Transportadora "' || coalesce(v_cnome, v_cnpj) || '" criada automaticamente.');
      end if;

      -- Motorista: por CPF (opcional; a transportadora pode atribuir depois)
      v_cpf := nullif(regexp_replace(coalesce(v_row->>'motorista_cpf', ''), '\D', '', 'g'), '');
      v_driver := null;
      if v_cpf is not null then
        select id, carrier_id into v_driver, v_driver_carrier
          from public.lg_users where cpf = v_cpf and role = 'motorista';
        if v_driver is null then
          v_warnings := v_warnings || jsonb_build_object('linha', v_line, 'codigo', v_codigo,
            'aviso', 'Motorista com CPF ' || v_cpf || ' não cadastrado — a rota ficou sem motorista.');
        elsif v_driver_carrier <> v_carrier then
          v_warnings := v_warnings || jsonb_build_object('linha', v_line, 'codigo', v_codigo,
            'aviso', 'Motorista com CPF ' || v_cpf || ' pertence a outra transportadora — a rota ficou sem motorista.');
          v_driver := null;
        end if;
      end if;

      insert into public.lg_routes as r (
        codigo, carrier_id, driver_id, placa, origem, destino, cliente, nota_fiscal, produto,
        peso, data_prevista, dest_lat, dest_lng, observacao, batch_id)
      values (
        v_codigo, v_carrier, v_driver,
        upper(coalesce(trim(v_row->>'placa'), '')),
        coalesce(trim(v_row->>'origem'), ''),
        coalesce(trim(v_row->>'destino'), ''),
        coalesce(trim(v_row->>'cliente'), ''),
        coalesce(trim(v_row->>'nota_fiscal'), ''),
        coalesce(trim(v_row->>'produto'), ''),
        nullif(trim(v_row->>'peso'), '')::numeric,
        nullif(trim(v_row->>'data_prevista'), '')::date,
        nullif(trim(v_row->>'dest_lat'), '')::double precision,
        nullif(trim(v_row->>'dest_lng'), '')::double precision,
        coalesce(trim(v_row->>'observacao'), ''),
        v_batch)
      on conflict (codigo) do update set
        carrier_id    = excluded.carrier_id,
        -- não troca o motorista se o arquivo veio sem; e não mexe em rota já encerrada
        driver_id     = case when r.status in ('entregue', 'cancelada') then r.driver_id
                             else coalesce(excluded.driver_id, r.driver_id) end,
        placa         = coalesce(nullif(excluded.placa, ''), r.placa),
        origem        = excluded.origem,
        destino       = excluded.destino,
        cliente       = excluded.cliente,
        nota_fiscal   = excluded.nota_fiscal,
        produto       = excluded.produto,
        peso          = excluded.peso,
        data_prevista = excluded.data_prevista,
        dest_lat      = excluded.dest_lat,
        dest_lng      = excluded.dest_lng,
        observacao    = excluded.observacao,
        batch_id      = excluded.batch_id
      returning (xmax = 0) into v_inserted;

      if v_inserted then v_ins := v_ins + 1; else v_upd := v_upd + 1; end if;
    exception when others then
      v_errors := v_errors || jsonb_build_object('linha', v_line, 'codigo', coalesce(v_codigo, ''), 'erro', sqlerrm);
    end;
  end loop;

  update public.lg_import_batches
     set total = v_total, inserted = v_ins, updated = v_upd,
         failed = jsonb_array_length(v_errors), errors = v_errors || v_warnings
   where id = v_batch;

  return jsonb_build_object(
    'batch_id', v_batch, 'total', v_total, 'inserted', v_ins, 'updated', v_upd,
    'errors', v_errors, 'warnings', v_warnings);
end;
$$;

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table public.lg_carriers       enable row level security;
alter table public.lg_users          enable row level security;
alter table public.lg_import_batches enable row level security;
alter table public.lg_routes         enable row level security;
alter table public.lg_locations      enable row level security;
alter table public.lg_driver_status  enable row level security;
alter table public.lg_documents      enable row level security;

-- Remove policies antigas para o script poder ser rodado de novo
do $$
declare p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename like 'lg\_%'
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- lg_carriers
create policy lg_carriers_select on public.lg_carriers for select
  using (public.lg_is_contratante() or id = public.lg_my_carrier());
create policy lg_carriers_insert on public.lg_carriers for insert
  with check (public.lg_is_contratante());
create policy lg_carriers_update on public.lg_carriers for update
  using (public.lg_is_contratante());
create policy lg_carriers_delete on public.lg_carriers for delete
  using (public.lg_is_contratante());

-- lg_users (criação/exclusão passam pela Netlify Function com a service_role)
create policy lg_users_select on public.lg_users for select
  using (id = auth.uid()
         or public.lg_is_contratante()
         or (public.lg_my_role() = 'transportadora' and carrier_id = public.lg_my_carrier()));
create policy lg_users_update on public.lg_users for update
  using (public.lg_is_contratante()
         or (public.lg_my_role() = 'transportadora' and role = 'motorista'
             and carrier_id = public.lg_my_carrier()))
  with check (public.lg_is_contratante()
              or (role = 'motorista' and carrier_id = public.lg_my_carrier()));

-- lg_import_batches
create policy lg_batches_select on public.lg_import_batches for select
  using (public.lg_is_contratante());

-- lg_routes (motorista/transportadora alteram só via RPC acima)
create policy lg_routes_select on public.lg_routes for select
  using (public.lg_is_contratante()
         or (public.lg_my_role() = 'transportadora' and carrier_id = public.lg_my_carrier())
         or (public.lg_my_role() = 'motorista' and driver_id = auth.uid()));
create policy lg_routes_insert on public.lg_routes for insert
  with check (public.lg_is_contratante());
create policy lg_routes_update on public.lg_routes for update
  using (public.lg_is_contratante());
create policy lg_routes_delete on public.lg_routes for delete
  using (public.lg_is_contratante());

-- lg_locations
create policy lg_locations_select on public.lg_locations for select
  using (public.lg_can_see_driver(driver_id));
create policy lg_locations_insert on public.lg_locations for insert
  with check (driver_id = auth.uid()
              and public.lg_my_role() = 'motorista'
              and (route_id is null or exists (
                    select 1 from public.lg_routes r
                    where r.id = route_id and r.driver_id = auth.uid())));

-- lg_driver_status (escrito só pelo trigger)
create policy lg_driver_status_select on public.lg_driver_status for select
  using (public.lg_can_see_driver(driver_id));

-- lg_documents
create policy lg_documents_select on public.lg_documents for select
  using (public.lg_can_see_route(route_id));
create policy lg_documents_insert on public.lg_documents for insert
  with check (uploaded_by = auth.uid() and public.lg_can_upload_route(route_id));
create policy lg_documents_delete on public.lg_documents for delete
  using (public.lg_is_contratante());

-- ------------------------------------------------------------
-- Storage: bucket privado para os comprovantes de entrega
-- Caminho dos arquivos: <id-da-rota>/<arquivo>
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('comprovantes', 'comprovantes', false)
on conflict (id) do nothing;

drop policy if exists lg_comprovantes_select on storage.objects;
drop policy if exists lg_comprovantes_insert on storage.objects;
drop policy if exists lg_comprovantes_delete on storage.objects;

create policy lg_comprovantes_select on storage.objects for select
  using (bucket_id = 'comprovantes' and public.lg_can_see_route(public.lg_path_route(name)));
create policy lg_comprovantes_insert on storage.objects for insert
  with check (bucket_id = 'comprovantes' and public.lg_can_upload_route(public.lg_path_route(name)));
create policy lg_comprovantes_delete on storage.objects for delete
  using (bucket_id = 'comprovantes' and public.lg_is_contratante());

-- ------------------------------------------------------------
-- Realtime: o mapa atualiza sozinho quando chega posição nova
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.lg_driver_status;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.lg_routes;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

-- ============================================================
-- BOOTSTRAP DO PRIMEIRO CONTRATANTE
-- ============================================================
-- 1. Authentication > Users > Add user (marque "Auto Confirm User"),
--    ou use um usuário que já exista (ex.: o administrador do portal).
-- 2. Copie o UID e rode:
--
-- insert into public.lg_users (id, nome, email, role)
-- values ('COLE-AQUI-O-UID', 'Nome do Contratante', 'contratante@suaempresa.com', 'contratante');
--
-- A partir daí, o contratante cadastra transportadoras e usuários pela tela
-- /logistica/, e cada transportadora cadastra os próprios motoristas.
