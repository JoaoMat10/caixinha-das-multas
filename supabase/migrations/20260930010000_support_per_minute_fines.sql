alter table public.fine_categories
  add column amount_per_minute_cents integer;

alter table public.fine_categories
  add constraint fine_categories_minimum_per_minute_amount
  check (amount_per_minute_cents is null or amount_per_minute_cents >= 10);

alter table public.fines
  add column amount_per_minute_cents_snapshot integer,
  add column minutes integer not null default 0;

alter table public.fines
  drop constraint fines_final_amount_calculated;

alter table public.fines
  add constraint fines_variable_amount_consistent check (
    (
      amount_per_minute_cents_snapshot is null
      and minutes = 0
    )
    or (
      amount_per_minute_cents_snapshot >= 10
      and minutes >= 1
    )
  ),
  add constraint fines_final_amount_calculated check (
    final_amount_cents = (
      base_amount_cents_snapshot
      + coalesce(amount_per_minute_cents_snapshot * minutes, 0)
    ) * multiplier
  );

create or replace function public.create_season(
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
    select 1 from public.teams as t
    where t.id = p_team_id and t.is_active
  ) then
    raise exception using errcode = 'P0002', message = 'Equipa ativa nao encontrada.';
  end if;

  if p_copy_from_season_id is not null then
    select * into v_source
    from public.seasons as s
    where s.id = p_copy_from_season_id and s.team_id = p_team_id
    for share;
    if not found then
      raise exception using errcode = 'P0002', message = 'Epoca de origem nao encontrada na equipa.';
    end if;
  end if;

  insert into public.seasons (
    team_id, name, starts_on, ends_on, status, copied_from_season_id,
    created_by, idempotency_key
  ) values (
    p_team_id, btrim(p_name), p_starts_on, p_ends_on, p_status,
    p_copy_from_season_id, v_actor_id, p_idempotency_key
  ) returning * into v_season;

  if p_copy_from_season_id is not null then
    insert into public.season_members (
      season_id, user_id, member_type, shirt_number, staff_function, status
    )
    select v_season.id, source_member.user_id, source_member.member_type,
      source_member.shirt_number, source_member.staff_function, 'active'
    from public.season_members as source_member
    where source_member.season_id = p_copy_from_season_id
      and source_member.status = 'active';

    insert into public.member_roles (season_member_id, role_id, assigned_by)
    select target_member.id, source_role.role_id, v_actor_id
    from public.member_roles as source_role
    join public.season_members as source_member
      on source_member.id = source_role.season_member_id
    join public.season_members as target_member
      on target_member.season_id = v_season.id
      and target_member.user_id = source_member.user_id
    where source_member.season_id = p_copy_from_season_id;

    insert into public.fine_categories (
      season_id, name, description, base_amount_cents,
      amount_per_minute_cents, is_active, display_order, created_by
    )
    select v_season.id, source_category.name, source_category.description,
      source_category.base_amount_cents,
      source_category.amount_per_minute_cents, source_category.is_active,
      source_category.display_order, v_actor_id
    from public.fine_categories as source_category
    where source_category.season_id = p_copy_from_season_id;
  end if;

  insert into public.audit_events (
    actor_user_id, action, entity_type, entity_id, team_id, season_id, metadata
  ) values (
    v_actor_id,
    case when p_copy_from_season_id is null then 'season.created' else 'season.copied' end,
    'season', v_season.id, p_team_id, v_season.id,
    jsonb_build_object('copied_from_season_id', p_copy_from_season_id)
  );

  return v_season;
end;
$$;

drop function public.save_fine_category(uuid, uuid, text, text, integer, boolean, integer);

create function public.save_fine_category(
  p_season_id uuid,
  p_fine_category_id uuid,
  p_name text,
  p_description text,
  p_base_amount_cents integer,
  p_is_active boolean,
  p_display_order integer,
  p_amount_per_minute_cents integer default null
)
returns public.fine_categories
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_team_id uuid;
  v_category public.fine_categories;
  v_previous_category public.fine_categories;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'Autenticacao obrigatoria.';
  end if;
  if not private.can_manage_catalog(p_season_id, v_actor_id) then
    raise exception using errcode = '42501', message = 'Sem permissao para gerir o catalogo desta epoca.';
  end if;

  select s.team_id into strict v_team_id
  from public.seasons as s where s.id = p_season_id;

  if p_fine_category_id is null then
    insert into public.fine_categories (
      season_id, name, description, base_amount_cents,
      amount_per_minute_cents, is_active, display_order, created_by
    ) values (
      p_season_id, btrim(p_name), nullif(btrim(p_description), ''),
      p_base_amount_cents, p_amount_per_minute_cents, p_is_active,
      p_display_order, v_actor_id
    ) returning * into v_category;
  else
    select * into v_category
    from public.fine_categories as fc
    where fc.id = p_fine_category_id for update;
    if not found or v_category.season_id <> p_season_id then
      raise exception using errcode = 'P0002', message = 'Categoria nao encontrada nesta epoca.';
    end if;
    v_previous_category := v_category;
    update public.fine_categories set
      name = btrim(p_name),
      description = nullif(btrim(p_description), ''),
      base_amount_cents = p_base_amount_cents,
      amount_per_minute_cents = p_amount_per_minute_cents,
      is_active = p_is_active,
      display_order = p_display_order
    where id = p_fine_category_id
    returning * into v_category;
  end if;

  insert into public.audit_events (
    actor_user_id, action, entity_type, entity_id, team_id, season_id, metadata
  ) values (
    v_actor_id,
    case when p_fine_category_id is null then 'fine_category.created' else 'fine_category.updated' end,
    'fine_category', v_category.id, v_team_id, p_season_id,
    case when p_fine_category_id is null then
      jsonb_build_object('new_values', jsonb_build_object(
        'name', v_category.name,
        'description', v_category.description,
        'base_amount_cents', v_category.base_amount_cents,
        'amount_per_minute_cents', v_category.amount_per_minute_cents,
        'is_active', v_category.is_active,
        'display_order', v_category.display_order
      ))
    else jsonb_build_object(
      'previous_values', jsonb_build_object(
        'name', v_previous_category.name,
        'description', v_previous_category.description,
        'base_amount_cents', v_previous_category.base_amount_cents,
        'amount_per_minute_cents', v_previous_category.amount_per_minute_cents,
        'is_active', v_previous_category.is_active,
        'display_order', v_previous_category.display_order
      ),
      'new_values', jsonb_build_object(
        'name', v_category.name,
        'description', v_category.description,
        'base_amount_cents', v_category.base_amount_cents,
        'amount_per_minute_cents', v_category.amount_per_minute_cents,
        'is_active', v_category.is_active,
        'display_order', v_category.display_order
      )
    ) end
  );
  return v_category;
end;
$$;

comment on function public.save_fine_category(uuid, uuid, text, text, integer, boolean, integer, integer) is
  'Cria ou altera uma categoria fixa ou com acrescimo por minuto e regista a operacao na auditoria.';

drop function public.apply_fine(uuid, uuid, timestamptz, text, uuid);

create function public.apply_fine(
  p_season_member_id uuid,
  p_fine_category_id uuid,
  p_occurred_at timestamptz,
  p_notes text,
  p_idempotency_key uuid,
  p_minutes integer default 0
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
  v_minutes integer := coalesce(p_minutes, 0);
  v_fine public.fines;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'Autenticacao obrigatoria.';
  end if;
  if p_idempotency_key is null then
    raise exception using errcode = '22004', message = 'A chave de idempotencia e obrigatoria.';
  end if;
  if p_season_member_id is null or p_fine_category_id is null or p_occurred_at is null then
    raise exception using errcode = '22004', message = 'Membro, categoria e data da multa sao obrigatorios.';
  end if;

  select * into v_member
  from public.season_members as sm
  where sm.id = p_season_member_id for share;
  if not found or v_member.status <> 'active' then
    raise exception using errcode = 'P0002', message = 'Membro ativo nao encontrado.';
  end if;
  if not private.is_season_treasurer(v_member.season_id, v_actor_id) then
    raise exception using errcode = '42501', message = 'Sem permissao de tesoureiro nesta epoca.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'apply_fine:' || v_member.season_id::text || ':' || v_actor_id::text || ':' || p_idempotency_key::text, 0
  ));

  select * into v_fine
  from public.fines as f
  where f.season_id = v_member.season_id
    and f.applied_by = v_actor_id
    and f.idempotency_key = p_idempotency_key;
  if found then
    if v_fine.season_member_id <> p_season_member_id
      or v_fine.fine_category_id <> p_fine_category_id
      or v_fine.occurred_at <> p_occurred_at
      or v_fine.notes is distinct from v_notes
      or v_fine.minutes <> v_minutes then
      raise exception using errcode = '22023', message = 'Chave de idempotencia reutilizada com dados diferentes.';
    end if;
    return v_fine;
  end if;

  if not private.is_season_operational(v_member.season_id) then
    raise exception using errcode = '55000', message = 'A epoca nao esta ativa.';
  end if;

  select * into v_category
  from public.fine_categories as fc
  where fc.id = p_fine_category_id and fc.season_id = v_member.season_id
  for share;
  if not found or not v_category.is_active then
    raise exception using errcode = 'P0002', message = 'Categoria ativa nao encontrada nesta epoca.';
  end if;

  if v_category.amount_per_minute_cents is null and v_minutes <> 0 then
    raise exception using errcode = '22023', message = 'Esta categoria nao aceita minutos.';
  end if;
  if v_category.amount_per_minute_cents is not null and v_minutes < 1 then
    raise exception using errcode = '22023', message = 'Indica pelo menos um minuto para esta categoria.';
  end if;

  v_multiplier := private.member_multiplier(p_season_member_id);
  insert into public.fines (
    season_id, season_member_id, fine_category_id, category_name_snapshot,
    base_amount_cents_snapshot, amount_per_minute_cents_snapshot, minutes,
    multiplier, final_amount_cents, occurred_at, notes, applied_by,
    idempotency_key
  ) values (
    v_member.season_id, p_season_member_id, p_fine_category_id,
    v_category.name, v_category.base_amount_cents,
    v_category.amount_per_minute_cents, v_minutes, v_multiplier,
    (v_category.base_amount_cents + coalesce(v_category.amount_per_minute_cents * v_minutes, 0)) * v_multiplier,
    p_occurred_at, v_notes, v_actor_id, p_idempotency_key
  ) returning * into v_fine;
  return v_fine;
end;
$$;

comment on function public.apply_fine(uuid, uuid, timestamptz, text, uuid, integer) is
  'Aplica uma multa fixa ou por minuto com snapshots e multiplicador calculado no servidor, de forma idempotente.';

revoke execute on function public.save_fine_category(uuid, uuid, text, text, integer, boolean, integer, integer) from public, anon;
revoke execute on function public.apply_fine(uuid, uuid, timestamptz, text, uuid, integer) from public, anon;
grant execute on function public.save_fine_category(uuid, uuid, text, text, integer, boolean, integer, integer) to authenticated;
grant execute on function public.apply_fine(uuid, uuid, timestamptz, text, uuid, integer) to authenticated;

notify pgrst, 'reload schema';
