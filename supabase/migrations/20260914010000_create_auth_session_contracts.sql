create or replace function public.get_auth_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  profile public.users%rowtype;
  memberships jsonb;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Sessao invalida.';
  end if;

  select *
  into profile
  from public.users
  where id = current_user_id
    and is_active;

  if not found then
    raise insufficient_privilege using message = 'Sessao invalida.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', sm.id,
        'seasonId', s.id,
        'seasonName', s.name,
        'seasonStatus', s.status,
        'teamId', t.id,
        'teamName', t.name,
        'memberType', sm.member_type,
        'roles', coalesce(
          (
            select jsonb_agg(r.code order by r.code)
            from public.member_roles mr
            join public.roles r on r.id = mr.role_id
            where mr.season_member_id = sm.id
          ),
          '[]'::jsonb
        )
      )
      order by s.starts_on desc nulls last, s.name desc
    ),
    '[]'::jsonb
  )
  into memberships
  from public.season_members sm
  join public.seasons s on s.id = sm.season_id
  join public.teams t on t.id = s.team_id
  where sm.user_id = current_user_id
    and sm.status = 'active'
    and t.is_active;

  return jsonb_build_object(
    'profile', jsonb_build_object(
      'id', profile.id,
      'username', profile.username,
      'displayName', profile.display_name,
      'avatarPath', profile.avatar_path,
      'mustChangePassword', profile.must_change_password
    ),
    'isAppAdmin', exists (
      select 1
      from public.app_admins
      where user_id = current_user_id
    ),
    'memberships', memberships
  );
end;
$$;

revoke all on function public.get_auth_context() from public, anon;
grant execute on function public.get_auth_context() to authenticated;

create or replace function private.sync_password_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    update public.users
    set
      must_change_password = false,
      updated_at = now()
    where id = new.id
      and is_active;
  end if;

  return new;
end;
$$;

revoke all on function private.sync_password_change() from public, anon, authenticated;

create trigger auth_user_password_changed
after update of encrypted_password on auth.users
for each row
execute function private.sync_password_change();
