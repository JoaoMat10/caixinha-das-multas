alter table public.fine_categories
  add column is_monthly_commission boolean not null default false;

alter table public.fine_categories
  add constraint fine_categories_monthly_commission_fixed check (
    not is_monthly_commission
    or (
      base_amount_cents = 100
      and amount_per_minute_cents is null
    )
  );

create unique index fine_categories_one_monthly_commission_per_season_key
  on public.fine_categories (season_id)
  where is_monthly_commission;

create function private.protect_monthly_commission_category()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.is_monthly_commission then
    raise exception using errcode = '55000', message = 'A categoria de comissao mensal e gerida pelo sistema.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger fine_categories_protect_monthly_commission
before update or delete on public.fine_categories
for each row execute function private.protect_monthly_commission_category();

alter table public.fines
  add column commission_month date;

alter table public.fines
  add constraint fines_commission_month_first_day check (
    commission_month is null
    or commission_month = date_trunc('month', commission_month)::date
  );

create unique index fines_one_monthly_commission_per_member_key
  on public.fines (season_id, season_member_id, commission_month)
  where commission_month is not null;

create function private.validate_monthly_commission_fine()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_is_monthly_commission boolean;
begin
  select fc.is_monthly_commission
  into strict v_is_monthly_commission
  from public.fine_categories as fc
  where fc.id = new.fine_category_id
    and fc.season_id = new.season_id;

  if v_is_monthly_commission then
    if new.commission_month is null
      or new.multiplier <> 1
      or new.base_amount_cents_snapshot <> 100
      or new.amount_per_minute_cents_snapshot is not null
      or new.minutes <> 0
      or new.final_amount_cents <> 100 then
      raise exception using errcode = '23514', message = 'A comissao mensal deve ser gerada pelo processo mensal protegido.';
    end if;
  elsif new.commission_month is not null then
    raise exception using errcode = '23514', message = 'Apenas a categoria de comissao mensal aceita um mes de referencia.';
  end if;

  return new;
end;
$$;

create trigger fines_validate_monthly_commission
before insert or update on public.fines
for each row execute function private.validate_monthly_commission_fine();

create function private.inherit_monthly_commission_category()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_source_season_id uuid;
begin
  select s.copied_from_season_id
  into v_source_season_id
  from public.seasons as s
  where s.id = new.season_id;

  if v_source_season_id is not null and exists (
    select 1
    from public.fine_categories as source_category
    where source_category.season_id = v_source_season_id
      and lower(btrim(source_category.name)) = lower(btrim(new.name))
      and source_category.is_monthly_commission
  ) then
    new.is_monthly_commission := true;
  end if;

  return new;
end;
$$;

create trigger fine_categories_inherit_monthly_commission
before insert on public.fine_categories
for each row execute function private.inherit_monthly_commission_category();

create function public.generate_monthly_commissions(
  p_season_id uuid,
  p_month date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_category public.fine_categories;
  v_team_id uuid;
  v_created integer;
  v_start_at timestamptz;
  v_end_at timestamptz;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'Autenticacao obrigatoria.';
  end if;
  if p_month is null or p_month <> date_trunc('month', p_month)::date then
    raise exception using errcode = '22023', message = 'Indica o primeiro dia do mes de referencia.';
  end if;
  if p_month < date '2026-09-01' then
    raise exception using errcode = '22023', message = 'A comissao mensal inicia em setembro de 2026.';
  end if;
  if p_month >= date_trunc('month', current_timestamp at time zone 'Europe/Lisbon')::date then
    raise exception using errcode = '22023', message = 'A comissao so pode ser gerada depois do fim do mes.';
  end if;
  if not private.is_season_treasurer(p_season_id, v_actor_id) then
    raise exception using errcode = '42501', message = 'Sem permissao de tesoureiro nesta epoca.';
  end if;
  if not private.is_season_operational(p_season_id) then
    raise exception using errcode = '55000', message = 'A epoca nao esta ativa.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('monthly_commission:' || p_season_id::text || ':' || p_month::text, 0));

  select * into v_category
  from public.fine_categories as fc
  where fc.season_id = p_season_id
    and fc.is_monthly_commission
    and fc.is_active
  for share;
  if not found then
    raise exception using errcode = 'P0002', message = 'Categoria ativa de comissao mensal nao encontrada.';
  end if;

  select s.team_id into strict v_team_id
  from public.seasons as s where s.id = p_season_id;
  v_start_at := p_month::timestamp at time zone 'Europe/Lisbon';
  v_end_at := (p_month + interval '1 month')::timestamp at time zone 'Europe/Lisbon';

  insert into public.fines (
    season_id, season_member_id, fine_category_id, category_name_snapshot,
    base_amount_cents_snapshot, amount_per_minute_cents_snapshot, minutes,
    multiplier, final_amount_cents, occurred_at, notes, status,
    has_ever_been_paid, applied_by, idempotency_key, commission_month
  )
  select
    p_season_id, sm.id, v_category.id, v_category.name,
    100, null, 0, 1, 100, v_end_at - interval '12 hours',
    'Comissao relativa a ' || to_char(p_month, 'MM/YYYY'),
    'pending', false, v_actor_id,
    md5('monthly:' || p_season_id::text || ':' || sm.id::text || ':' || p_month::text)::uuid,
    p_month
  from public.season_members as sm
  where sm.season_id = p_season_id
    and sm.status = 'active'
    and not exists (
      select 1 from public.fines as f
      where f.season_id = p_season_id
        and f.season_member_id = sm.id
        and f.commission_month is null
        and f.occurred_at >= v_start_at
        and f.occurred_at < v_end_at
    )
  on conflict (season_id, season_member_id, commission_month)
    where commission_month is not null do nothing;

  get diagnostics v_created = row_count;
  if v_created > 0 then
    insert into public.audit_events (
      actor_user_id, action, entity_type, entity_id, team_id, season_id, metadata
    ) values (
      v_actor_id, 'monthly_commissions.generated', 'season', p_season_id,
      v_team_id, p_season_id,
      jsonb_build_object('month', p_month, 'created_count', v_created)
    );
  end if;
  return v_created;
end;
$$;

comment on function public.generate_monthly_commissions(uuid, date) is
  'Cria uma comissao fixa de um euro, sem multiplicador, para membros sem multas validas no mes concluido.';

revoke execute on function public.generate_monthly_commissions(uuid, date) from public, anon;
grant execute on function public.generate_monthly_commissions(uuid, date) to authenticated;

notify pgrst, 'reload schema';
