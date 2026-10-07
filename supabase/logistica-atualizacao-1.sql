-- ============================================================
-- Atualização 1 — campos do relatório de agendamentos
-- Para quem JÁ rodou o logistica.sql antes. Rode uma vez no SQL Editor
-- (pode rodar de novo sem problema). Não apaga nenhum dado.
-- ============================================================

-- Campos do relatório de agendamentos (adicionados depois; "if not exists" atualiza bancos antigos)
alter table public.lg_routes
  add column if not exists motorista_nome text not null default '',
  add column if not exists motorista_cpf text,                 -- só dígitos (CPF ou documento)
  add column if not exists motorista_telefone text not null default '',
  add column if not exists placas_carreta text not null default '',
  add column if not exists equipamento text not null default '',
  add column if not exists unidade text not null default '',
  add column if not exists operacao text not null default '',
  add column if not exists status_sistema text not null default '',
  add column if not exists ultimo_evento text not null default '',
  add column if not exists tempo_terminal text not null default '',
  add column if not exists periodo_inicio timestamptz,
  add column if not exists periodo_fim timestamptz,
  add column if not exists agendado_por text not null default '',
  add column if not exists agendado_email text not null default '';
create index if not exists lg_routes_motorista_cpf_idx on public.lg_routes (motorista_cpf);

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
  v_cancel boolean;
  v_no_carrier boolean;
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
      -- Linha sem transportadora no arquivo: entra em "SEM TRANSPORTADORA" para o contratante definir
      v_no_carrier := v_cnpj is null and v_cnome is null;
      if v_no_carrier then
        select id into v_carrier from public.lg_carriers where nome = 'SEM TRANSPORTADORA' and cnpj is null limit 1;
        if v_carrier is null then
          insert into public.lg_carriers (nome) values ('SEM TRANSPORTADORA') returning id into v_carrier;
        end if;
        v_warnings := v_warnings || jsonb_build_object('linha', v_line, 'codigo', v_codigo,
          'aviso', 'Sem transportadora no arquivo — a rota ficou em "SEM TRANSPORTADORA". Defina a transportadora no detalhe da rota.');
      end if;
      if v_carrier is null then
        if not p_create_carriers then
          raise exception 'Transportadora "%" não cadastrada.', coalesce(v_cnome, v_cnpj);
        end if;
        insert into public.lg_carriers (nome, cnpj)
        values (coalesce(v_cnome, 'Transportadora ' || v_cnpj), v_cnpj)
        returning id into v_carrier;
        v_warnings := v_warnings || jsonb_build_object('linha', v_line, 'codigo', v_codigo,
          'aviso', 'Transportadora "' || coalesce(v_cnome, v_cnpj) || '" criada automaticamente.');
      end if;

      -- Motorista: pelo CPF/documento. Se ainda não tiver acesso, a rota guarda nome e
      -- documento e é ligada a ele automaticamente quando a transportadora cadastrá-lo.
      v_cpf := nullif(regexp_replace(coalesce(v_row->>'motorista_cpf', ''), '\D', '', 'g'), '');
      v_driver := null;
      if v_cpf is not null then
        select id, carrier_id into v_driver, v_driver_carrier
          from public.lg_users where cpf = v_cpf and role = 'motorista';
        if v_driver is not null and v_driver_carrier <> v_carrier then
          v_warnings := v_warnings || jsonb_build_object('linha', v_line, 'codigo', v_codigo,
            'aviso', 'Motorista com documento ' || v_cpf || ' está cadastrado em outra transportadora — a rota ficou sem motorista.');
          v_driver := null;
        end if;
      end if;

      v_cancel := lower(coalesce(v_row->>'status_sistema', '')) like 'cancel%';

      insert into public.lg_routes as r (
        codigo, carrier_id, driver_id, placa, origem, destino, cliente, nota_fiscal, produto,
        peso, data_prevista, dest_lat, dest_lng, observacao, batch_id,
        motorista_nome, motorista_cpf, motorista_telefone, placas_carreta, equipamento, unidade,
        operacao, status_sistema, ultimo_evento, tempo_terminal, periodo_inicio, periodo_fim,
        agendado_por, agendado_email, status, finished_at)
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
        v_batch,
        coalesce(trim(v_row->>'motorista_nome'), ''),
        v_cpf,
        coalesce(trim(v_row->>'motorista_telefone'), ''),
        upper(coalesce(trim(v_row->>'placas_carreta'), '')),
        coalesce(trim(v_row->>'equipamento'), ''),
        coalesce(trim(v_row->>'unidade'), ''),
        coalesce(trim(v_row->>'operacao'), ''),
        coalesce(trim(v_row->>'status_sistema'), ''),
        coalesce(trim(v_row->>'ultimo_evento'), ''),
        coalesce(trim(v_row->>'tempo_terminal'), ''),
        nullif(trim(v_row->>'periodo_inicio'), '')::timestamptz,
        nullif(trim(v_row->>'periodo_fim'), '')::timestamptz,
        coalesce(trim(v_row->>'agendado_por'), ''),
        coalesce(trim(v_row->>'agendado_email'), ''),
        case when v_cancel then 'cancelada' else 'pendente' end,
        case when v_cancel then now() end)
      on conflict (codigo) do update set
        -- arquivo sem transportadora não desfaz a transportadora definida manualmente
        carrier_id    = case when v_no_carrier then r.carrier_id else excluded.carrier_id end,
        -- não troca o motorista se o arquivo veio sem; e não mexe em rota já encerrada
        driver_id     = case when r.status in ('entregue', 'cancelada') then r.driver_id
                             when v_no_carrier then r.driver_id
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
        batch_id      = excluded.batch_id,
        motorista_nome     = excluded.motorista_nome,
        motorista_cpf      = excluded.motorista_cpf,
        motorista_telefone = excluded.motorista_telefone,
        placas_carreta     = excluded.placas_carreta,
        equipamento        = excluded.equipamento,
        unidade            = excluded.unidade,
        operacao           = excluded.operacao,
        status_sistema     = excluded.status_sistema,
        ultimo_evento      = excluded.ultimo_evento,
        tempo_terminal     = excluded.tempo_terminal,
        periodo_inicio     = excluded.periodo_inicio,
        periodo_fim        = excluded.periodo_fim,
        agendado_por       = excluded.agendado_por,
        agendado_email     = excluded.agendado_email,
        -- cancelado no sistema → cancela aqui também (se ainda não foi entregue)
        status        = case when excluded.status = 'cancelada' and r.status in ('pendente', 'em_rota')
                             then 'cancelada' else r.status end,
        finished_at   = case when excluded.status = 'cancelada' and r.status in ('pendente', 'em_rota')
                             then now() else r.finished_at end
      returning (xmax = 0) into v_inserted;

      if v_inserted then v_ins := v_ins + 1; else v_upd := v_upd + 1; end if;

      -- ainda sem motorista com acesso: tenta ligar pelo documento (cadastro já existente)
      if v_driver is null and v_cpf is not null then
        update public.lg_routes rr set driver_id = u.id
          from public.lg_users u
         where rr.codigo = v_codigo and rr.driver_id is null and rr.status in ('pendente', 'em_rota')
           and u.cpf = v_cpf and u.role = 'motorista' and u.carrier_id = rr.carrier_id;
      end if;
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

-- Quando um motorista é cadastrado (ou ganha CPF/transportadora), as cargas importadas com o
-- documento dele e ainda sem motorista passam a ser dele automaticamente.
create or replace function public.lg_link_driver_routes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'motorista' and new.cpf is not null and new.carrier_id is not null then
    update public.lg_routes
       set driver_id = new.id,
           placa = case when placa = '' then new.placa else placa end
     where driver_id is null
       and motorista_cpf = new.cpf
       and carrier_id = new.carrier_id
       and status in ('pendente', 'em_rota');
  end if;
  return new;
end;
$$;

drop trigger if exists lg_users_link_routes on public.lg_users;
create trigger lg_users_link_routes after insert or update of cpf, carrier_id, role on public.lg_users
  for each row execute function public.lg_link_driver_routes();
