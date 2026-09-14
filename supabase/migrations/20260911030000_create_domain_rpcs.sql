create function public.create_season(
  p_team_id uuid,
  p_name text,
  p_starts_on date,
  p_ends_on date,
  p_status public.season_status,
  p_copy_from_season_id uuid,
  p_idempotency_key uuid
)
returns public.seasons
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_source public.seasons;
  v_season public.seasons;
begin
  if v_actor_id is null or not private.is_app_admin(v_actor_id) then
    raise exception using errcode = '42501', message = 'Apenas o Owner pode criar epocas.';
  end if;

  if p_idempotency_key is null then
    raise exception using errcode = '22004', message = 'A chave de idempotencia e obrigatoria.';
  end if;

  if p_team_id is null or p_name is null or btrim(p_name) = '' then
    raise exception using errcode = '22004', message = 'A equipa e o nome da epoca sao obrigatorios.';
  end if;

  if p_status is null or p_status not in ('draft', 'active') then
    raise exception using errcode = '22023', message = 'Uma nova epoca deve ser criada como rascunho ou ativa.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'create_season:' || p_team_id::text || ':' || v_actor_id::text || ':' || p_idempotency_key::text,
      0
    )
  );

  select *
  into v_season
  from public.seasons as s
  where s.team_id = p_team_id
    and s.created_by = v_actor_id
    and s.idempotency_key = p_idempotency_key;

  if found then
    if v_season.name <> btrim(p_name)
      or v_season.starts_on is distinct from p_starts_on
      or v_season.ends_on is distinct from p_ends_on
      or v_season.status <> p_status
      or v_season.copied_from_season_id is distinct from p_copy_from_season_id then
      raise exception using errcode = '22023', message = 'Chave de idempotencia reutilizada com dados diferentes.';
    end if;

    return v_season;
  end if;

  if not exists (
    select 1
    from public.teams as t
    where t.id = p_team_id
      and t.is_active
  ) then
    raise exception using errcode = 'P0002', message = 'Equipa ativa nao encontrada.';
  end if;

  if p_copy_from_season_id is not null then
    select *
    into v_source
    from public.seasons as s
    where s.id = p_copy_from_season_id
      and s.team_id = p_team_id
    for share;

    if not found then
      raise exception using errcode = 'P0002', message = 'Epoca de origem nao encontrada na equipa.';
    end if;
  end if;

  insert into public.seasons (
    team_id,
    name,
    starts_on,
    ends_on,
    status,
    copied_from_season_id,
    created_by,
    idempotency_key
  )
  values (
    p_team_id,
    btrim(p_name),
    p_starts_on,
    p_ends_on,
    p_status,
    p_copy_from_season_id,
    v_actor_id,
    p_idempotency_key
  )
  returning * into v_season;

  if p_copy_from_season_id is not null then
    insert into public.season_members (
      season_id,
      user_id,
      member_type,
      shirt_number,
      staff_function,
      status
    )
    select
      v_season.id,
      source_member.user_id,
      source_member.member_type,
      source_member.shirt_number,
      source_member.staff_function,
      'active'
    from public.season_members as source_member
    where source_member.season_id = p_copy_from_season_id
      and source_member.status = 'active';

    insert into public.member_roles (
      season_member_id,
      role_id,
      assigned_by
    )
    select
      target_member.id,
      source_role.role_id,
      v_actor_id
    from public.member_roles as source_role
    join public.season_members as source_member
      on source_member.id = source_role.season_member_id
    join public.season_members as target_member
      on target_member.season_id = v_season.id
      and target_member.user_id = source_member.user_id
    where source_member.season_id = p_copy_from_season_id;

    insert into public.fine_categories (
      season_id,
      name,
      description,
      base_amount_cents,
      is_active,
      display_order,
      created_by
    )
    select
      v_season.id,
      source_category.name,
      source_category.description,
      source_category.base_amount_cents,
      source_category.is_active,
      source_category.display_order,
      v_actor_id
    from public.fine_categories as source_category
    where source_category.season_id = p_copy_from_season_id;
  end if;

  insert into public.audit_events (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    team_id,
    season_id,
    metadata
  )
  values (
    v_actor_id,
    case when p_copy_from_season_id is null then 'season.created' else 'season.copied' end,
    'season',
    v_season.id,
    p_team_id,
    v_season.id,
    jsonb_build_object('copied_from_season_id', p_copy_from_season_id)
  );

  return v_season;
end;
$$;

comment on function public.create_season(uuid, text, date, date, public.season_status, uuid, uuid) is
  'Cria uma epoca e copia opcionalmente plantel ativo, roles e catalogo, nunca dados financeiros.';

create function public.save_fine_category(
  p_season_id uuid,
  p_fine_category_id uuid,
  p_name text,
  p_description text,
  p_base_amount_cents integer,
  p_is_active boolean,
  p_display_order integer
)
returns public.fine_categories
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_category public.fine_categories;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'Autenticacao obrigatoria.';
  end if;

  if not private.can_manage_catalog(p_season_id, v_actor_id) then
    raise exception using errcode = '42501', message = 'Sem permissao para gerir o catalogo desta epoca.';
  end if;

  if p_fine_category_id is null then
    insert into public.fine_categories (
      season_id,
      name,
      description,
      base_amount_cents,
      is_active,
      display_order,
      created_by
    )
    values (
      p_season_id,
      btrim(p_name),
      nullif(btrim(p_description), ''),
      p_base_amount_cents,
      p_is_active,
      p_display_order,
      v_actor_id
    )
    returning * into v_category;
  else
    select *
    into v_category
    from public.fine_categories as fc
    where fc.id = p_fine_category_id
    for update;

    if not found or v_category.season_id <> p_season_id then
      raise exception using errcode = 'P0002', message = 'Categoria nao encontrada nesta epoca.';
    end if;

    update public.fine_categories
    set
      name = btrim(p_name),
      description = nullif(btrim(p_description), ''),
      base_amount_cents = p_base_amount_cents,
      is_active = p_is_active,
      display_order = p_display_order
    where id = p_fine_category_id
    returning * into v_category;
  end if;

  return v_category;
end;
$$;

comment on function public.save_fine_category(uuid, uuid, text, text, integer, boolean, integer) is
  'Cria ou altera uma categoria; apenas tesoureiros da epoca e nunca em epocas arquivadas.';

create function public.apply_fine(
  p_season_member_id uuid,
  p_fine_category_id uuid,
  p_occurred_at timestamptz,
  p_notes text,
  p_idempotency_key uuid
)
returns public.fines
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_member public.season_members;
  v_category public.fine_categories;
  v_multiplier smallint;
  v_notes text := nullif(btrim(p_notes), '');
  v_fine public.fines;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'Autenticacao obrigatoria.';
  end if;

  if p_idempotency_key is null then
    raise exception using errcode = '22004', message = 'A chave de idempotencia e obrigatoria.';
  end if;

  if p_season_member_id is null
    or p_fine_category_id is null
    or p_occurred_at is null then
    raise exception using errcode = '22004', message = 'Membro, categoria e data da multa sao obrigatorios.';
  end if;

  select *
  into v_member
  from public.season_members as sm
  where sm.id = p_season_member_id
  for share;

  if not found or v_member.status <> 'active' then
    raise exception using errcode = 'P0002', message = 'Membro ativo nao encontrado.';
  end if;

  if not private.is_season_treasurer(v_member.season_id, v_actor_id) then
    raise exception using errcode = '42501', message = 'Sem permissao de tesoureiro nesta epoca.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'apply_fine:' || v_member.season_id::text || ':' || v_actor_id::text || ':' || p_idempotency_key::text,
      0
    )
  );

  select *
  into v_fine
  from public.fines as f
  where f.season_id = v_member.season_id
    and f.applied_by = v_actor_id
    and f.idempotency_key = p_idempotency_key;

  if found then
    if v_fine.season_member_id <> p_season_member_id
      or v_fine.fine_category_id <> p_fine_category_id
      or v_fine.occurred_at <> p_occurred_at
      or v_fine.notes is distinct from v_notes then
      raise exception using errcode = '22023', message = 'Chave de idempotencia reutilizada com dados diferentes.';
    end if;

    return v_fine;
  end if;

  if not private.is_season_operational(v_member.season_id) then
    raise exception using errcode = '55000', message = 'A epoca nao esta ativa.';
  end if;

  select *
  into v_category
  from public.fine_categories as fc
  where fc.id = p_fine_category_id
    and fc.season_id = v_member.season_id
  for share;

  if not found or not v_category.is_active then
    raise exception using errcode = 'P0002', message = 'Categoria ativa nao encontrada nesta epoca.';
  end if;

  v_multiplier := private.member_multiplier(p_season_member_id);

  insert into public.fines (
    season_id,
    season_member_id,
    fine_category_id,
    category_name_snapshot,
    base_amount_cents_snapshot,
    multiplier,
    final_amount_cents,
    occurred_at,
    notes,
    applied_by,
    idempotency_key
  )
  values (
    v_member.season_id,
    p_season_member_id,
    p_fine_category_id,
    v_category.name,
    v_category.base_amount_cents,
    v_multiplier,
    v_category.base_amount_cents * v_multiplier,
    p_occurred_at,
    v_notes,
    v_actor_id,
    p_idempotency_key
  )
  returning * into v_fine;

  return v_fine;
end;
$$;

comment on function public.apply_fine(uuid, uuid, timestamptz, text, uuid) is
  'Aplica uma multa com snapshots e multiplicador calculado no servidor, de forma idempotente.';

create function public.record_payment_batch(
  p_season_member_id uuid,
  p_fine_ids uuid[],
  p_action public.payment_action,
  p_idempotency_key uuid
)
returns public.payment_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_member public.season_members;
  v_batch public.payment_batches;
  v_fine_ids uuid[];
  v_existing_fine_ids uuid[];
  v_fine_count integer;
  v_total_cents integer;
  v_valid_state_count integer;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'Autenticacao obrigatoria.';
  end if;

  if p_idempotency_key is null then
    raise exception using errcode = '22004', message = 'A chave de idempotencia e obrigatoria.';
  end if;

  if p_action is null then
    raise exception using errcode = '22004', message = 'A acao de liquidacao e obrigatoria.';
  end if;

  if p_fine_ids is null or cardinality(p_fine_ids) = 0 then
    raise exception using errcode = '22023', message = 'Seleciona pelo menos uma multa.';
  end if;

  if array_position(p_fine_ids, null) is not null then
    raise exception using errcode = '22004', message = 'A selecao de multas contem um identificador nulo.';
  end if;

  select array_agg(distinct fine_id order by fine_id)
  into v_fine_ids
  from unnest(p_fine_ids) as selected(fine_id);

  if cardinality(v_fine_ids) <> cardinality(p_fine_ids) then
    raise exception using errcode = '22023', message = 'A selecao de multas contem duplicados.';
  end if;

  select *
  into v_member
  from public.season_members as sm
  where sm.id = p_season_member_id
  for share;

  if not found or v_member.status <> 'active' then
    raise exception using errcode = 'P0002', message = 'Membro ativo nao encontrado.';
  end if;

  if not private.is_season_treasurer(v_member.season_id, v_actor_id) then
    raise exception using errcode = '42501', message = 'Sem permissao de tesoureiro nesta epoca.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'payment_batch:' || v_member.season_id::text || ':' || v_actor_id::text || ':' || p_idempotency_key::text,
      0
    )
  );

  select *
  into v_batch
  from public.payment_batches as pb
  where pb.season_id = v_member.season_id
    and pb.recorded_by = v_actor_id
    and pb.idempotency_key = p_idempotency_key;

  if found then
    select array_agg(pl.fine_id order by pl.fine_id)
    into v_existing_fine_ids
    from public.payment_logs as pl
    where pl.payment_batch_id = v_batch.id;

    if v_batch.season_member_id <> p_season_member_id
      or v_batch.action <> p_action
      or v_existing_fine_ids is distinct from v_fine_ids then
      raise exception using errcode = '22023', message = 'Chave de idempotencia reutilizada com dados diferentes.';
    end if;

    return v_batch;
  end if;

  if not private.is_season_operational(v_member.season_id) then
    raise exception using errcode = '55000', message = 'A epoca nao esta ativa.';
  end if;

  perform 1
  from public.fines as f
  where f.id = any(v_fine_ids)
  order by f.id
  for update;

  select
    count(*)::integer,
    coalesce(sum(f.final_amount_cents), 0)::integer,
    count(*) filter (
      where (p_action = 'paid' and f.status = 'pending')
        or (p_action = 'reopened' and f.status = 'paid')
    )::integer
  into v_fine_count, v_total_cents, v_valid_state_count
  from public.fines as f
  where f.id = any(v_fine_ids)
    and f.season_id = v_member.season_id
    and f.season_member_id = p_season_member_id;

  if v_fine_count <> cardinality(v_fine_ids) then
    raise exception using errcode = '22023', message = 'Todas as multas devem pertencer ao membro e a epoca selecionados.';
  end if;

  if v_valid_state_count <> v_fine_count then
    raise exception using errcode = '55000', message = 'Uma ou mais multas nao permitem a transicao pedida.';
  end if;

  insert into public.payment_batches (
    season_id,
    season_member_id,
    action,
    calculated_total_cents,
    recorded_by,
    idempotency_key
  )
  values (
    v_member.season_id,
    p_season_member_id,
    p_action,
    v_total_cents,
    v_actor_id,
    p_idempotency_key
  )
  returning * into v_batch;

  if p_action = 'paid' then
    update public.fines
    set
      status = 'paid',
      has_ever_been_paid = true,
      paid_at = v_batch.recorded_at
    where id = any(v_fine_ids);
  else
    update public.fines
    set
      status = 'pending',
      paid_at = null
    where id = any(v_fine_ids);
  end if;

  insert into public.payment_logs (
    payment_batch_id,
    fine_id,
    action,
    amount_cents_snapshot,
    recorded_by,
    recorded_at
  )
  select
    v_batch.id,
    f.id,
    p_action,
    f.final_amount_cents,
    v_actor_id,
    v_batch.recorded_at
  from public.fines as f
  where f.id = any(v_fine_ids);

  return v_batch;
end;
$$;

comment on function public.record_payment_batch(uuid, uuid[], public.payment_action, uuid) is
  'Liquida ou reabre multas completas de um unico membro numa operacao atomica e idempotente.';

create function public.delete_pending_fine(p_fine_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_fine public.fines;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'Autenticacao obrigatoria.';
  end if;

  select *
  into v_fine
  from public.fines as f
  where f.id = p_fine_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Multa nao encontrada.';
  end if;

  if not private.is_season_treasurer(v_fine.season_id, v_actor_id) then
    raise exception using errcode = '42501', message = 'Sem permissao de tesoureiro nesta epoca.';
  end if;

  if not private.is_season_operational(v_fine.season_id) then
    raise exception using errcode = '55000', message = 'A epoca nao esta ativa.';
  end if;

  if v_fine.status <> 'pending' or v_fine.has_ever_been_paid then
    raise exception using errcode = '55000', message = 'So e possivel eliminar multas pendentes que nunca foram pagas.';
  end if;

  delete from public.fines where id = p_fine_id;
  return p_fine_id;
end;
$$;

comment on function public.delete_pending_fine(uuid) is
  'Elimina fisicamente apenas uma multa pendente que nunca foi paga, por um tesoureiro da epoca.';

revoke execute on function public.create_season(uuid, text, date, date, public.season_status, uuid, uuid) from public, anon;
revoke execute on function public.save_fine_category(uuid, uuid, text, text, integer, boolean, integer) from public, anon;
revoke execute on function public.apply_fine(uuid, uuid, timestamptz, text, uuid) from public, anon;
revoke execute on function public.record_payment_batch(uuid, uuid[], public.payment_action, uuid) from public, anon;
revoke execute on function public.delete_pending_fine(uuid) from public, anon;

grant execute on function public.create_season(uuid, text, date, date, public.season_status, uuid, uuid) to authenticated;
grant execute on function public.save_fine_category(uuid, uuid, text, text, integer, boolean, integer) to authenticated;
grant execute on function public.apply_fine(uuid, uuid, timestamptz, text, uuid) to authenticated;
grant execute on function public.record_payment_batch(uuid, uuid[], public.payment_action, uuid) to authenticated;
grant execute on function public.delete_pending_fine(uuid) to authenticated;

notify pgrst, 'reload schema';
