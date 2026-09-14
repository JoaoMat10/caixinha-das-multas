create function private.is_active_user(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null
    and exists (
      select 1
      from public.users as u
      where u.id = p_user_id
        and u.is_active
    );
$$;

create function private.is_app_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_user(p_user_id)
    and exists (
      select 1
      from public.app_admins as aa
      where aa.user_id = p_user_id
    );
$$;

create function private.is_season_member(
  p_season_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_user(p_user_id)
    and exists (
      select 1
      from public.season_members as sm
      where sm.season_id = p_season_id
        and sm.user_id = p_user_id
        and sm.status = 'active'
    );
$$;

create function private.is_team_member(
  p_team_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_user(p_user_id)
    and exists (
      select 1
      from public.seasons as s
      join public.season_members as sm on sm.season_id = s.id
      where s.team_id = p_team_id
        and sm.user_id = p_user_id
        and sm.status = 'active'
    );
$$;

create function private.can_read_season(
  p_season_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_app_admin(p_user_id)
    or private.is_season_member(p_season_id, p_user_id);
$$;

create function private.is_season_treasurer(
  p_season_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_user(p_user_id)
    and exists (
      select 1
      from public.season_members as sm
      join public.member_roles as mr on mr.season_member_id = sm.id
      join public.roles as r on r.id = mr.role_id
      where sm.season_id = p_season_id
        and sm.user_id = p_user_id
        and sm.status = 'active'
        and r.code = 'treasurer'
    );
$$;

create function private.is_season_operational(p_season_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.seasons as s
    join public.teams as t on t.id = s.team_id
    where s.id = p_season_id
      and s.status = 'active'
      and t.is_active
  );
$$;

create function private.can_manage_catalog(
  p_season_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_season_treasurer(p_season_id, p_user_id)
    and exists (
      select 1
      from public.seasons as s
      join public.teams as t on t.id = s.team_id
      where s.id = p_season_id
        and s.status in ('draft', 'active')
        and t.is_active
    );
$$;

create function private.can_read_financial_member(
  p_season_member_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_user(p_user_id)
    and exists (
      select 1
      from public.season_members as sm
      where sm.id = p_season_member_id
        and (
          sm.user_id = p_user_id
          or private.is_season_treasurer(sm.season_id, p_user_id)
        )
    );
$$;

create function private.can_read_payment_batch(
  p_payment_batch_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.payment_batches as pb
    where pb.id = p_payment_batch_id
      and private.can_read_financial_member(pb.season_member_id, p_user_id)
  );
$$;

create function private.member_multiplier(p_season_member_id uuid)
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when sm.member_type = 'staff' or exists (
      select 1
      from public.member_roles as mr
      join public.roles as r on r.id = mr.role_id
      where mr.season_member_id = sm.id
        and r.code = 'captain'
    ) then 2::smallint
    else 1::smallint
  end
  from public.season_members as sm
  where sm.id = p_season_member_id;
$$;

revoke all on schema private from public;
grant usage on schema private to authenticated;

revoke execute on all functions in schema private from public;
grant execute on all functions in schema private to authenticated;

alter default privileges in schema private revoke execute on functions from public;

alter table public.users enable row level security;
alter table public.app_admins enable row level security;
alter table public.teams enable row level security;
alter table public.seasons enable row level security;
alter table public.season_members enable row level security;
alter table public.roles enable row level security;
alter table public.member_roles enable row level security;
alter table public.fine_categories enable row level security;
alter table public.fines enable row level security;
alter table public.payment_batches enable row level security;
alter table public.payment_logs enable row level security;
alter table public.audit_events enable row level security;

create policy users_select_self_or_admin
on public.users for select to authenticated
using (id = (select auth.uid()) or (select private.is_app_admin()));

create policy users_insert_admin
on public.users for insert to authenticated
with check ((select private.is_app_admin()) and created_by = (select auth.uid()));

create policy users_update_admin
on public.users for update to authenticated
using ((select private.is_app_admin()))
with check ((select private.is_app_admin()));

create policy app_admins_select_admin
on public.app_admins for select to authenticated
using ((select private.is_app_admin()));

create policy app_admins_insert_admin
on public.app_admins for insert to authenticated
with check ((select private.is_app_admin()));

create policy app_admins_delete_admin
on public.app_admins for delete to authenticated
using ((select private.is_app_admin()));

create policy teams_select_authorized
on public.teams for select to authenticated
using (
  (select private.is_app_admin())
  or (select private.is_team_member(id))
);

create policy teams_insert_admin
on public.teams for insert to authenticated
with check ((select private.is_app_admin()) and created_by = (select auth.uid()));

create policy teams_update_admin
on public.teams for update to authenticated
using ((select private.is_app_admin()))
with check ((select private.is_app_admin()));

create policy seasons_select_authorized
on public.seasons for select to authenticated
using ((select private.can_read_season(id)));

create policy seasons_insert_admin
on public.seasons for insert to authenticated
with check ((select private.is_app_admin()) and created_by = (select auth.uid()));

create policy seasons_update_admin
on public.seasons for update to authenticated
using ((select private.is_app_admin()))
with check ((select private.is_app_admin()));

create policy season_members_select_authorized
on public.season_members for select to authenticated
using ((select private.can_read_season(season_id)));

create policy season_members_insert_admin
on public.season_members for insert to authenticated
with check ((select private.is_app_admin()));

create policy season_members_update_admin
on public.season_members for update to authenticated
using ((select private.is_app_admin()))
with check ((select private.is_app_admin()));

create policy roles_select_authenticated
on public.roles for select to authenticated
using ((select private.is_active_user()));

create policy member_roles_select_authorized
on public.member_roles for select to authenticated
using (
  (select private.can_read_season(
    (select sm.season_id from public.season_members as sm where sm.id = season_member_id)
  ))
);

create policy member_roles_insert_admin
on public.member_roles for insert to authenticated
with check ((select private.is_app_admin()) and assigned_by = (select auth.uid()));

create policy member_roles_update_admin
on public.member_roles for update to authenticated
using ((select private.is_app_admin()))
with check ((select private.is_app_admin()) and assigned_by = (select auth.uid()));

create policy member_roles_delete_admin
on public.member_roles for delete to authenticated
using ((select private.is_app_admin()));

create policy fine_categories_select_authorized
on public.fine_categories for select to authenticated
using ((select private.can_read_season(season_id)));

create policy fine_categories_insert_treasurer
on public.fine_categories for insert to authenticated
with check (
  (select private.can_manage_catalog(season_id))
  and created_by = (select auth.uid())
);

create policy fine_categories_update_treasurer
on public.fine_categories for update to authenticated
using ((select private.can_manage_catalog(season_id)))
with check ((select private.can_manage_catalog(season_id)));

create policy fines_select_owner_or_treasurer
on public.fines for select to authenticated
using ((select private.can_read_financial_member(season_member_id)));

create policy fines_insert_treasurer
on public.fines for insert to authenticated
with check (
  (select private.is_season_treasurer(season_id))
  and (select private.is_season_operational(season_id))
  and applied_by = (select auth.uid())
);

create policy payment_batches_select_owner_or_treasurer
on public.payment_batches for select to authenticated
using ((select private.can_read_financial_member(season_member_id)));

create policy payment_logs_select_owner_or_treasurer
on public.payment_logs for select to authenticated
using ((select private.can_read_payment_batch(payment_batch_id)));

create policy audit_events_select_admin
on public.audit_events for select to authenticated
using ((select private.is_app_admin()));

create policy audit_events_insert_admin
on public.audit_events for insert to authenticated
with check (
  (select private.is_app_admin())
  and actor_user_id = (select auth.uid())
);

revoke all on table public.users from anon, authenticated;
revoke all on table public.app_admins from anon, authenticated;
revoke all on table public.teams from anon, authenticated;
revoke all on table public.seasons from anon, authenticated;
revoke all on table public.season_members from anon, authenticated;
revoke all on table public.roles from anon, authenticated;
revoke all on table public.member_roles from anon, authenticated;
revoke all on table public.fine_categories from anon, authenticated;
revoke all on table public.fines from anon, authenticated;
revoke all on table public.payment_batches from anon, authenticated;
revoke all on table public.payment_logs from anon, authenticated;
revoke all on table public.audit_events from anon, authenticated;

grant select on public.users to authenticated;
grant select on public.app_admins to authenticated;
grant select on public.teams to authenticated;
grant select on public.seasons to authenticated;
grant select on public.season_members to authenticated;
grant select on public.roles to authenticated;
grant select on public.member_roles to authenticated;
grant select on public.fine_categories to authenticated;
grant select on public.fines to authenticated;
grant select on public.payment_batches to authenticated;
grant select on public.payment_logs to authenticated;
grant select on public.audit_events to authenticated;

grant usage on type public.season_status to authenticated;
grant usage on type public.member_type to authenticated;
grant usage on type public.member_status to authenticated;
grant usage on type public.fine_status to authenticated;
grant usage on type public.payment_action to authenticated;
