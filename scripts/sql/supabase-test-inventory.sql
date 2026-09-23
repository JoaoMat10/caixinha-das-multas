with public_table_inventory as (
  select jsonb_object_agg(
    table_name,
    jsonb_build_object('rows', row_count, 'fingerprint', fingerprint)
    order by table_name
  ) as value
  from (
    select 'admin_password_reset_requests' as table_name, count(*)::integer as row_count,
      md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by t.actor_user_id::text, t.idempotency_key::text), '')) as fingerprint
    from public.admin_password_reset_requests t
    union all
    select 'admin_user_requests', count(*)::integer,
      md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by t.actor_user_id::text, t.idempotency_key::text), ''))
    from public.admin_user_requests t
    union all
    select 'app_admins', count(*)::integer,
      md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by t.user_id::text), ''))
    from public.app_admins t
    union all
    select 'audit_events', count(*)::integer,
      md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by t.id::text), ''))
    from public.audit_events t
    union all
    select 'fine_categories', count(*)::integer,
      md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by t.id::text), ''))
    from public.fine_categories t
    union all
    select 'fines', count(*)::integer,
      md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by t.id::text), ''))
    from public.fines t
    union all
    select 'member_roles', count(*)::integer,
      md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by t.season_member_id::text || ':' || t.role_id::text), ''))
    from public.member_roles t
    union all
    select 'payment_batches', count(*)::integer,
      md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by t.id::text), ''))
    from public.payment_batches t
    union all
    select 'payment_logs', count(*)::integer,
      md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by t.id::text), ''))
    from public.payment_logs t
    union all
    select 'roles', count(*)::integer,
      md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by t.id::text), ''))
    from public.roles t
    union all
    select 'season_members', count(*)::integer,
      md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by t.id::text), ''))
    from public.season_members t
    union all
    select 'seasons', count(*)::integer,
      md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by t.id::text), ''))
    from public.seasons t
    union all
    select 'teams', count(*)::integer,
      md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by t.id::text), ''))
    from public.teams t
    union all
    select 'users', count(*)::integer,
      md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by t.id::text), ''))
    from public.users t
  ) tables
), relevant_triggers as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'schema', n.nspname,
        'table', c.relname,
        'name', t.tgname,
        'enabled', t.tgenabled
      )
      order by n.nspname, c.relname, t.tgname
    ),
    '[]'::jsonb
  ) as value
  from pg_catalog.pg_trigger t
  join pg_catalog.pg_class c on c.oid = t.tgrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where not t.tgisinternal
    and n.nspname in ('auth', 'public', 'storage')
), relevant_policies as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'schema', schemaname,
        'table', tablename,
        'name', policyname,
        'command', cmd,
        'roles', roles
      )
      order by schemaname, tablename, policyname
    ),
    '[]'::jsonb
  ) as value
  from pg_catalog.pg_policies
  where schemaname in ('public', 'storage')
), rls_inventory as (
  select jsonb_build_object(
    'enabled_tables', coalesce(
      jsonb_agg(c.relname order by c.relname) filter (where c.relrowsecurity),
      '[]'::jsonb
    ),
    'disabled_tables', coalesce(
      jsonb_agg(c.relname order by c.relname) filter (where not c.relrowsecurity),
      '[]'::jsonb
    )
  ) as value
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
), security_function_inventory as (
  select jsonb_build_object(
    'security_definer_count', count(*)::integer,
    'unsafe_search_path_count', count(*) filter (
      where p.proconfig is null
        or not ('search_path=""' = any(p.proconfig))
    )::integer,
    'unsafe_functions', coalesce(
      jsonb_agg(
        n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
        order by n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)
      ) filter (
        where p.proconfig is null
          or not ('search_path=""' = any(p.proconfig))
      ),
      '[]'::jsonb
    ),
    'fingerprint', md5(coalesce(string_agg(
      pg_get_function_identity_arguments(p.oid) || ':' || pg_get_functiondef(p.oid),
      '|' order by n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)
    ), ''))
  ) as value
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('private', 'public')
    and p.prosecdef
), temporary_profiles as (
  select jsonb_build_object(
    'count', count(*)::integer,
    'usernames', coalesce(jsonb_agg(username order by username), '[]'::jsonb)
  ) as value
  from public.users
  where username_normalized like any (
    array['auth.test.%', 'admin.test.%', 'managed.%', 'financial.test.%']
  )
), auth_inventory as (
  select jsonb_build_object(
    'users', count(*)::integer,
    'id_fingerprint', md5(coalesce(string_agg(id::text, '|' order by id::text), ''))
  ) as value
  from auth.users
), storage_inventory as (
  select jsonb_build_object(
    'objects', count(*)::integer,
    'fingerprint', md5(coalesce(string_agg(bucket_id || ':' || name, '|' order by bucket_id, name), ''))
  ) as value
  from storage.objects
), extension_inventory as (
  select jsonb_build_object(
    'pgtap_installed', exists (
      select 1 from pg_catalog.pg_extension where extname = 'pgtap'
    )
  ) as value
)
select jsonb_pretty(jsonb_build_object(
  'public_tables', public_table_inventory.value,
  'temporary_profiles', temporary_profiles.value,
  'auth', auth_inventory.value,
  'storage', storage_inventory.value,
  'triggers', relevant_triggers.value,
  'policies', relevant_policies.value,
  'rls', rls_inventory.value,
  'security_functions', security_function_inventory.value,
  'extensions', extension_inventory.value
)) as inventory
from public_table_inventory,
  temporary_profiles,
  auth_inventory,
  storage_inventory,
  relevant_triggers,
  relevant_policies,
  rls_inventory,
  security_function_inventory,
  extension_inventory;
