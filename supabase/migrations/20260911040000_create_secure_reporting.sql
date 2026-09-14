create view public.my_season_balances
with (security_invoker = true)
as
select
  sm.season_id,
  sm.id as season_member_id,
  count(f.id)::bigint as fine_count,
  coalesce(sum(f.final_amount_cents), 0)::bigint as total_fined_cents,
  coalesce(sum(f.final_amount_cents) filter (where f.status = 'paid'), 0)::bigint as total_paid_cents,
  coalesce(sum(f.final_amount_cents) filter (where f.status = 'pending'), 0)::bigint as total_debt_cents
from public.season_members as sm
left join public.fines as f on f.season_member_id = sm.id
where sm.user_id = (select auth.uid())
group by sm.season_id, sm.id;

comment on view public.my_season_balances is
  'Saldo do utilizador autenticado por epoca, incluindo epocas sem multas.';

create view public.treasury_season_totals
with (security_invoker = true)
as
select
  s.id as season_id,
  count(f.id)::bigint as fine_count,
  coalesce(sum(f.final_amount_cents), 0)::bigint as total_fined_cents,
  coalesce(sum(f.final_amount_cents) filter (where f.status = 'paid'), 0)::bigint as total_received_cents,
  coalesce(sum(f.final_amount_cents) filter (where f.status = 'pending'), 0)::bigint as total_debt_cents
from public.seasons as s
left join public.fines as f on f.season_id = s.id
where (select private.is_season_treasurer(s.id))
group by s.id;

comment on view public.treasury_season_totals is
  'Totais financeiros por epoca, visiveis apenas ao respetivo tesoureiro.';

create view public.pending_fines_by_member
with (security_invoker = true)
as
select
  f.season_id,
  f.season_member_id,
  f.id as fine_id,
  f.category_name_snapshot,
  f.base_amount_cents_snapshot,
  f.multiplier,
  f.final_amount_cents,
  f.occurred_at
from public.fines as f
where f.status = 'pending';

comment on view public.pending_fines_by_member is
  'Multas pendentes limitadas pela RLS ao proprio membro ou ao tesoureiro da epoca.';

create function private.get_season_member_directory(p_season_id uuid)
returns table (
  season_member_id uuid,
  display_name text,
  avatar_path text,
  member_type public.member_type,
  shirt_number integer,
  staff_function text,
  member_status public.member_status,
  is_captain boolean,
  is_treasurer boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.can_read_season(p_season_id) then
    raise exception using errcode = '42501', message = 'Sem acesso ao plantel desta epoca.';
  end if;

  return query
  select
    sm.id,
    u.display_name,
    u.avatar_path,
    sm.member_type,
    sm.shirt_number,
    sm.staff_function,
    sm.status,
    exists (
      select 1
      from public.member_roles as mr
      join public.roles as r on r.id = mr.role_id
      where mr.season_member_id = sm.id
        and r.code = 'captain'
    ),
    exists (
      select 1
      from public.member_roles as mr
      join public.roles as r on r.id = mr.role_id
      where mr.season_member_id = sm.id
        and r.code = 'treasurer'
    )
  from public.season_members as sm
  join public.users as u on u.id = sm.user_id
  where sm.season_id = p_season_id
  order by
    case when sm.member_type = 'player' then 0 else 1 end,
    sm.shirt_number nulls last,
    u.display_name;
end;
$$;

create function public.get_season_member_directory(p_season_id uuid)
returns table (
  season_member_id uuid,
  display_name text,
  avatar_path text,
  member_type public.member_type,
  shirt_number integer,
  staff_function text,
  member_status public.member_status,
  is_captain boolean,
  is_treasurer boolean
)
language sql
stable
set search_path = ''
as $$
  select * from private.get_season_member_directory(p_season_id);
$$;

comment on function public.get_season_member_directory(uuid) is
  'Plantel autorizado sem username, email tecnico ou permissao global de administracao.';

create function private.get_season_leaderboard(p_season_id uuid)
returns table (
  season_member_id uuid,
  display_name text,
  member_type public.member_type,
  shirt_number integer,
  staff_function text,
  is_captain boolean,
  fine_count bigint,
  total_fined_cents bigint,
  total_debt_cents bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_season_member(p_season_id) then
    raise exception using errcode = '42501', message = 'Sem acesso ao ranking desta epoca.';
  end if;

  return query
  select
    sm.id,
    u.display_name,
    sm.member_type,
    sm.shirt_number,
    sm.staff_function,
    exists (
      select 1
      from public.member_roles as mr
      join public.roles as r on r.id = mr.role_id
      where mr.season_member_id = sm.id
        and r.code = 'captain'
    ),
    count(f.id)::bigint,
    coalesce(sum(f.final_amount_cents), 0)::bigint,
    coalesce(sum(f.final_amount_cents) filter (where f.status = 'pending'), 0)::bigint
  from public.season_members as sm
  join public.users as u on u.id = sm.user_id
  left join public.fines as f on f.season_member_id = sm.id
  where sm.season_id = p_season_id
  group by
    sm.id,
    u.display_name,
    sm.member_type,
    sm.shirt_number,
    sm.staff_function
  order by count(f.id) desc, u.display_name;
end;
$$;

create function public.get_season_leaderboard(p_season_id uuid)
returns table (
  season_member_id uuid,
  display_name text,
  member_type public.member_type,
  shirt_number integer,
  staff_function text,
  is_captain boolean,
  fine_count bigint,
  total_fined_cents bigint,
  total_debt_cents bigint
)
language sql
stable
set search_path = ''
as $$
  select * from private.get_season_leaderboard(p_season_id);
$$;

comment on function public.get_season_leaderboard(uuid) is
  'Metricas agregadas do Mural da Vergonha sem detalhes de multas nem permissao global.';

revoke all on public.my_season_balances from public, anon;
revoke all on public.treasury_season_totals from public, anon;
revoke all on public.pending_fines_by_member from public, anon;

grant select on public.my_season_balances to authenticated;
grant select on public.treasury_season_totals to authenticated;
grant select on public.pending_fines_by_member to authenticated;

revoke execute on function private.get_season_member_directory(uuid) from public;
revoke execute on function private.get_season_leaderboard(uuid) from public;
grant execute on function private.get_season_member_directory(uuid) to authenticated;
grant execute on function private.get_season_leaderboard(uuid) to authenticated;

revoke execute on function public.get_season_member_directory(uuid) from public, anon;
revoke execute on function public.get_season_leaderboard(uuid) from public, anon;
grant execute on function public.get_season_member_directory(uuid) to authenticated;
grant execute on function public.get_season_leaderboard(uuid) to authenticated;

notify pgrst, 'reload schema';
