with expected_tables(name) as (
  values
    ('admin_password_reset_requests'),
    ('admin_user_requests'),
    ('app_admins'),
    ('audit_events'),
    ('fine_categories'),
    ('fines'),
    ('member_roles'),
    ('payment_batches'),
    ('payment_logs'),
    ('roles'),
    ('season_members'),
    ('seasons'),
    ('teams'),
    ('users')
), expected_policies(schema_name, table_name, policy_name, command) as (
  values
    ('public', 'app_admins', 'app_admins_delete_admin', 'DELETE'),
    ('public', 'app_admins', 'app_admins_insert_admin', 'INSERT'),
    ('public', 'app_admins', 'app_admins_select_admin', 'SELECT'),
    ('public', 'audit_events', 'audit_events_insert_admin', 'INSERT'),
    ('public', 'audit_events', 'audit_events_select_admin', 'SELECT'),
    ('public', 'fine_categories', 'fine_categories_insert_treasurer', 'INSERT'),
    ('public', 'fine_categories', 'fine_categories_select_authorized', 'SELECT'),
    ('public', 'fine_categories', 'fine_categories_update_treasurer', 'UPDATE'),
    ('public', 'fines', 'fines_insert_treasurer', 'INSERT'),
    ('public', 'fines', 'fines_select_owner_or_treasurer', 'SELECT'),
    ('public', 'member_roles', 'member_roles_delete_admin', 'DELETE'),
    ('public', 'member_roles', 'member_roles_insert_admin', 'INSERT'),
    ('public', 'member_roles', 'member_roles_select_authorized', 'SELECT'),
    ('public', 'member_roles', 'member_roles_update_admin', 'UPDATE'),
    ('public', 'payment_batches', 'payment_batches_select_owner_or_treasurer', 'SELECT'),
    ('public', 'payment_logs', 'payment_logs_select_owner_or_treasurer', 'SELECT'),
    ('public', 'roles', 'roles_select_authenticated', 'SELECT'),
    ('public', 'season_members', 'season_members_insert_admin', 'INSERT'),
    ('public', 'season_members', 'season_members_select_authorized', 'SELECT'),
    ('public', 'season_members', 'season_members_update_admin', 'UPDATE'),
    ('public', 'seasons', 'seasons_insert_admin', 'INSERT'),
    ('public', 'seasons', 'seasons_select_authorized', 'SELECT'),
    ('public', 'seasons', 'seasons_update_admin', 'UPDATE'),
    ('public', 'teams', 'teams_insert_admin', 'INSERT'),
    ('public', 'teams', 'teams_select_authorized', 'SELECT'),
    ('public', 'teams', 'teams_update_admin', 'UPDATE'),
    ('public', 'users', 'users_insert_admin', 'INSERT'),
    ('public', 'users', 'users_select_self_or_admin', 'SELECT'),
    ('public', 'users', 'users_update_admin', 'UPDATE'),
    ('storage', 'objects', 'private_photos_delete_admin', 'DELETE'),
    ('storage', 'objects', 'private_photos_insert_admin', 'INSERT'),
    ('storage', 'objects', 'private_photos_read_authorized', 'SELECT'),
    ('storage', 'objects', 'private_photos_update_admin', 'UPDATE')
), actual_tables as (
  select c.relname as name, c.relrowsecurity as rls_enabled
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
), actual_policies as (
  select schemaname as schema_name, tablename as table_name,
    policyname as policy_name, cmd as command
  from pg_catalog.pg_policies
  where schemaname in ('public', 'storage')
), application_security_definers as (
  select n.nspname as schema_name, p.proname,
    pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments,
    p.proconfig
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('private', 'public')
    and p.prosecdef
    and not (n.nspname = 'public' and p.proname = 'rls_auto_enable')
), application_data_counts as (
  select 'admin_password_reset_requests' as name, count(*)::integer as rows
  from public.admin_password_reset_requests
  union all select 'admin_user_requests', count(*)::integer from public.admin_user_requests
  union all select 'app_admins', count(*)::integer from public.app_admins
  union all select 'audit_events', count(*)::integer from public.audit_events
  union all select 'fine_categories', count(*)::integer from public.fine_categories
  union all select 'fines', count(*)::integer from public.fines
  union all select 'member_roles', count(*)::integer from public.member_roles
  union all select 'payment_batches', count(*)::integer from public.payment_batches
  union all select 'payment_logs', count(*)::integer from public.payment_logs
  union all select 'roles', count(*)::integer from public.roles
  union all select 'season_members', count(*)::integer from public.season_members
  union all select 'seasons', count(*)::integer from public.seasons
  union all select 'teams', count(*)::integer from public.teams
  union all select 'users', count(*)::integer from public.users
), direct_table_grants as (
  select grantee, table_schema, table_name,
    jsonb_agg(privilege_type order by privilege_type) as privileges
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee in ('anon', 'authenticated', 'service_role')
  group by grantee, table_schema, table_name
), direct_routine_grants as (
  select grantee, routine_schema, routine_name,
    jsonb_agg(privilege_type order by privilege_type) as privileges
  from information_schema.role_routine_grants
  where routine_schema in ('private', 'public')
    and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
  group by grantee, routine_schema, routine_name
)
select jsonb_pretty(jsonb_build_object(
  'checks', jsonb_build_object(
    'nine_migrations_recorded', (
      select count(*) = 9
      from supabase_migrations.schema_migrations
      where version in (
        '20260911010000', '20260911020000', '20260911030000',
        '20260911040000', '20260914010000', '20260915010000',
        '20260915020000', '20260915030000', '20260930010000'
      )
    ),
    'per_minute_columns_ready', (
      select count(*) = 3
      from information_schema.columns
      where table_schema = 'public'
        and (
          (table_name = 'fine_categories' and column_name = 'amount_per_minute_cents')
          or (table_name = 'fines' and column_name in ('amount_per_minute_cents_snapshot', 'minutes'))
        )
    ),
    'public_tables_exact', not exists (
      (select name from expected_tables except select name from actual_tables)
      union all
      (select name from actual_tables except select name from expected_tables)
    ),
    'all_public_tables_rls_enabled', not exists (
      select 1 from actual_tables where not rls_enabled
    ),
    'policies_exact', not exists (
      (select * from expected_policies except select * from actual_policies)
      union all
      (select * from actual_policies except select * from expected_policies)
    ),
    'private_photos_bucket_safe', exists (
      select 1 from storage.buckets
      where id = 'private-photos'
        and name = 'private-photos'
        and public = false
        and file_size_limit = 5242880
        and allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
    ),
    'application_security_definers_exact',
      (select count(*) = 32 from application_security_definers),
    'application_security_definers_safe_search_path', not exists (
      select 1 from application_security_definers
      where proconfig is null or not ('search_path=""' = any(proconfig))
    ),
    'platform_rls_function_safe_search_path', exists (
      select 1
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'rls_auto_enable'
        and p.prosecdef
        and 'search_path=pg_catalog' = any(p.proconfig)
    ),
    'all_relevant_triggers_enabled', not exists (
      select 1
      from pg_catalog.pg_trigger t
      join pg_catalog.pg_class c on c.oid = t.tgrelid
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where not t.tgisinternal
        and n.nspname in ('auth', 'public', 'storage')
        and t.tgenabled <> 'O'
    ),
    'zero_auth_users', (select count(*) = 0 from auth.users),
    'zero_storage_objects', (select count(*) = 0 from storage.objects),
    'only_reference_roles_created', (
      select count(*) = 2
        and array_agg(code order by code) = array['captain', 'treasurer']
      from public.roles
    ),
    'all_other_application_tables_empty', not exists (
      select 1 from application_data_counts where name <> 'roles' and rows <> 0
    ),
    'test_extensions_absent', not exists (
      select 1 from pg_catalog.pg_extension where extname in ('dblink', 'pgtap')
    )
  ),
  'tables', (
    select jsonb_agg(jsonb_build_object('name', name, 'rls', rls_enabled) order by name)
    from actual_tables
  ),
  'policies', (
    select jsonb_agg(jsonb_build_object(
      'schema', schema_name,
      'table', table_name,
      'name', policy_name,
      'command', command
    ) order by schema_name, table_name, policy_name)
    from actual_policies
  ),
  'application_data_counts', (
    select jsonb_object_agg(name, rows order by name) from application_data_counts
  ),
  'direct_table_grants', (
    select coalesce(jsonb_agg(to_jsonb(g) order by grantee, table_name), '[]'::jsonb)
    from direct_table_grants g
  ),
  'direct_routine_grants', (
    select coalesce(jsonb_agg(to_jsonb(g) order by grantee, routine_schema, routine_name), '[]'::jsonb)
    from direct_routine_grants g
  )
)) as production_post_migration_verification;
