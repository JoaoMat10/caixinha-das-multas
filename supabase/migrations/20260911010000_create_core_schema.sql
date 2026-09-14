create schema if not exists private;

comment on schema private is
  'Funcoes internas de autorizacao e dominio, fora dos schemas expostos pela API.';

create type public.season_status as enum ('draft', 'active', 'archived');
create type public.member_type as enum ('player', 'staff');
create type public.member_status as enum ('active', 'inactive');
create type public.fine_status as enum ('pending', 'paid');
create type public.payment_action as enum ('paid', 'reopened');

create table public.users (
  id uuid primary key references auth.users (id) on delete restrict,
  username text not null,
  username_normalized text not null,
  display_name text not null,
  avatar_path text,
  must_change_password boolean not null default true,
  is_active boolean not null default true,
  created_by uuid references public.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_username_not_blank check (btrim(username) <> ''),
  constraint users_username_normalized_format check (
    username_normalized = lower(btrim(username))
    and username_normalized ~ '^[a-z0-9._-]{3,32}$'
  ),
  constraint users_display_name_not_blank check (btrim(display_name) <> ''),
  constraint users_avatar_path_not_blank check (
    avatar_path is null or btrim(avatar_path) <> ''
  )
);

create unique index users_username_normalized_key
  on public.users (username_normalized);

create table public.app_admins (
  user_id uuid primary key references public.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

comment on table public.app_admins is
  'Permissao global privada; nunca representa uma funcao de plantel.';

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  badge_path text,
  is_active boolean not null default true,
  created_by uuid not null references public.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teams_name_not_blank check (btrim(name) <> ''),
  constraint teams_badge_path_not_blank check (
    badge_path is null or btrim(badge_path) <> ''
  )
);

create unique index teams_name_key on public.teams (lower(btrim(name)));

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete restrict,
  name text not null,
  starts_on date,
  ends_on date,
  status public.season_status not null default 'draft',
  copied_from_season_id uuid,
  created_by uuid not null references public.users (id) on delete restrict,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seasons_name_not_blank check (btrim(name) <> ''),
  constraint seasons_dates_ordered check (
    starts_on is null or ends_on is null or starts_on <= ends_on
  ),
  constraint seasons_not_copied_from_self check (
    copied_from_season_id is null or copied_from_season_id <> id
  ),
  constraint seasons_copy_source_same_team_fk
    foreign key (team_id, copied_from_season_id)
    references public.seasons (team_id, id) on delete restrict,
  unique (team_id, name),
  unique (team_id, created_by, idempotency_key),
  unique (team_id, id)
);

create unique index seasons_one_active_per_team_key
  on public.seasons (team_id)
  where status = 'active';

create index seasons_team_status_idx on public.seasons (team_id, status);
create index seasons_copied_from_idx on public.seasons (copied_from_season_id);

create table public.season_members (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete restrict,
  user_id uuid not null references public.users (id) on delete restrict,
  member_type public.member_type not null,
  shirt_number integer,
  staff_function text,
  status public.member_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint season_members_identity_by_type check (
    (
      member_type = 'player'
      and shirt_number between 1 and 999
      and staff_function is null
    )
    or (
      member_type = 'staff'
      and shirt_number is null
      and staff_function is not null
      and btrim(staff_function) <> ''
    )
  ),
  unique (season_id, user_id),
  unique (season_id, id)
);

create index season_members_user_status_idx
  on public.season_members (user_id, status, season_id);

create index season_members_season_status_idx
  on public.season_members (season_id, status);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text not null,
  constraint roles_code_allowed check (code in ('captain', 'treasurer')),
  constraint roles_display_name_not_blank check (btrim(display_name) <> '')
);

insert into public.roles (id, code, display_name)
values
  ('10000000-0000-4000-8000-000000000001', 'captain', 'Capitao'),
  ('10000000-0000-4000-8000-000000000002', 'treasurer', 'Tesoureiro')
on conflict (code) do update set display_name = excluded.display_name;

create table public.member_roles (
  season_member_id uuid not null references public.season_members (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete restrict,
  assigned_by uuid not null references public.users (id) on delete restrict,
  assigned_at timestamptz not null default now(),
  primary key (season_member_id, role_id)
);

create index member_roles_role_member_idx
  on public.member_roles (role_id, season_member_id);

create table public.fine_categories (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete restrict,
  name text not null,
  description text,
  base_amount_cents integer not null,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_by uuid not null references public.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fine_categories_name_not_blank check (btrim(name) <> ''),
  constraint fine_categories_description_not_blank check (
    description is null or btrim(description) <> ''
  ),
  constraint fine_categories_minimum_amount check (base_amount_cents >= 10),
  constraint fine_categories_display_order_non_negative check (display_order >= 0),
  unique (season_id, id)
);

create unique index fine_categories_name_per_season_key
  on public.fine_categories (season_id, lower(btrim(name)));

create index fine_categories_season_active_order_idx
  on public.fine_categories (season_id, is_active, display_order, name);

create table public.fines (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null,
  season_member_id uuid not null,
  fine_category_id uuid not null,
  category_name_snapshot text not null,
  base_amount_cents_snapshot integer not null,
  multiplier smallint not null,
  final_amount_cents integer not null,
  occurred_at timestamptz not null,
  notes text,
  status public.fine_status not null default 'pending',
  has_ever_been_paid boolean not null default false,
  applied_by uuid not null references public.users (id) on delete restrict,
  paid_at timestamptz,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fines_member_same_season_fk
    foreign key (season_id, season_member_id)
    references public.season_members (season_id, id) on delete restrict,
  constraint fines_category_same_season_fk
    foreign key (season_id, fine_category_id)
    references public.fine_categories (season_id, id) on delete restrict,
  constraint fines_category_snapshot_not_blank check (
    btrim(category_name_snapshot) <> ''
  ),
  constraint fines_base_amount_positive check (base_amount_cents_snapshot >= 10),
  constraint fines_multiplier_allowed check (multiplier in (1, 2)),
  constraint fines_final_amount_calculated check (
    final_amount_cents = base_amount_cents_snapshot * multiplier
  ),
  constraint fines_notes_not_blank check (notes is null or btrim(notes) <> ''),
  constraint fines_payment_state_consistent check (
    (
      status = 'pending'
      and paid_at is null
    )
    or (
      status = 'paid'
      and paid_at is not null
      and has_ever_been_paid
    )
  ),
  unique (season_id, applied_by, idempotency_key)
);

create index fines_season_member_status_idx
  on public.fines (season_id, season_member_id, status);

create index fines_season_occurred_at_idx
  on public.fines (season_id, occurred_at desc);

create index fines_category_idx on public.fines (fine_category_id);
create index fines_applied_by_idx on public.fines (applied_by);

create table public.payment_batches (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null,
  season_member_id uuid not null,
  action public.payment_action not null,
  calculated_total_cents integer not null,
  recorded_by uuid not null references public.users (id) on delete restrict,
  recorded_at timestamptz not null default now(),
  idempotency_key uuid not null,
  constraint payment_batches_member_same_season_fk
    foreign key (season_id, season_member_id)
    references public.season_members (season_id, id) on delete restrict,
  constraint payment_batches_total_positive check (calculated_total_cents > 0),
  unique (season_id, recorded_by, idempotency_key),
  unique (id, action, recorded_by, recorded_at)
);

create index payment_batches_member_recorded_idx
  on public.payment_batches (season_id, season_member_id, recorded_at desc);

create table public.payment_logs (
  id uuid primary key default gen_random_uuid(),
  payment_batch_id uuid not null,
  fine_id uuid not null references public.fines (id) on delete restrict,
  action public.payment_action not null,
  amount_cents_snapshot integer not null,
  recorded_by uuid not null references public.users (id) on delete restrict,
  recorded_at timestamptz not null default now(),
  constraint payment_logs_batch_context_fk
    foreign key (payment_batch_id, action, recorded_by, recorded_at)
    references public.payment_batches (id, action, recorded_by, recorded_at) on delete restrict,
  constraint payment_logs_amount_positive check (amount_cents_snapshot > 0),
  unique (payment_batch_id, fine_id)
);

create index payment_logs_fine_recorded_idx
  on public.payment_logs (fine_id, recorded_at desc);

create index payment_logs_recorded_by_idx on public.payment_logs (recorded_by);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.users (id) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  team_id uuid references public.teams (id) on delete restrict,
  season_id uuid references public.seasons (id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint audit_events_action_not_blank check (btrim(action) <> ''),
  constraint audit_events_entity_type_not_blank check (btrim(entity_type) <> ''),
  constraint audit_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index audit_events_actor_occurred_idx
  on public.audit_events (actor_user_id, occurred_at desc);

create index audit_events_team_occurred_idx
  on public.audit_events (team_id, occurred_at desc)
  where team_id is not null;

create index audit_events_season_occurred_idx
  on public.audit_events (season_id, occurred_at desc)
  where season_id is not null;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function private.protect_fine_immutable_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.season_id is distinct from old.season_id
    or new.season_member_id is distinct from old.season_member_id
    or new.fine_category_id is distinct from old.fine_category_id
    or new.category_name_snapshot is distinct from old.category_name_snapshot
    or new.base_amount_cents_snapshot is distinct from old.base_amount_cents_snapshot
    or new.multiplier is distinct from old.multiplier
    or new.final_amount_cents is distinct from old.final_amount_cents
    or new.occurred_at is distinct from old.occurred_at
    or new.notes is distinct from old.notes
    or new.applied_by is distinct from old.applied_by
    or new.idempotency_key is distinct from old.idempotency_key
    or new.created_at is distinct from old.created_at then
    raise exception using errcode = '55000', message = 'Os dados historicos da multa sao imutaveis.';
  end if;

  if old.has_ever_been_paid and not new.has_ever_been_paid then
    raise exception using errcode = '55000', message = 'O historico de pagamento da multa nao pode ser removido.';
  end if;

  return new;
end;
$$;

create function private.prevent_immutable_ledger_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '55000', message = 'O registo contabilistico e imutavel.';
end;
$$;

create trigger users_set_updated_at
before update on public.users
for each row execute function private.set_updated_at();

create trigger teams_set_updated_at
before update on public.teams
for each row execute function private.set_updated_at();

create trigger seasons_set_updated_at
before update on public.seasons
for each row execute function private.set_updated_at();

create trigger season_members_set_updated_at
before update on public.season_members
for each row execute function private.set_updated_at();

create trigger fine_categories_set_updated_at
before update on public.fine_categories
for each row execute function private.set_updated_at();

create trigger fines_set_updated_at
before update on public.fines
for each row execute function private.set_updated_at();

create trigger fines_protect_immutable_fields
before update on public.fines
for each row execute function private.protect_fine_immutable_fields();

create trigger payment_batches_are_immutable
before update or delete on public.payment_batches
for each row execute function private.prevent_immutable_ledger_mutation();

create trigger payment_logs_are_immutable
before update or delete on public.payment_logs
for each row execute function private.prevent_immutable_ledger_mutation();

create trigger audit_events_are_immutable
before update or delete on public.audit_events
for each row execute function private.prevent_immutable_ledger_mutation();
