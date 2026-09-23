import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath, URL } from 'node:url';

import { PGlite } from '@electric-sql/pglite';

const migrationsDirectory = fileURLToPath(
  new URL('../../supabase/migrations', import.meta.url),
);
const verificationPath = fileURLToPath(
  new URL(
    '../../scripts/sql/supabase-production-post-migration-verification.sql',
    import.meta.url,
  ),
);

const migrations = [
  [
    '20260911010000_create_core_schema.sql',
    '41b1ac8dd7af9dbacc5c922e6588c95d5e6dc12dd712cc4cc569f147ede05f6b',
  ],
  [
    '20260911020000_create_authorization_and_rls.sql',
    '1e34cfa4160f972026c9c1cd3f8bceeebf15cb904b964a075ddc415e5c88d2db',
  ],
  [
    '20260911030000_create_domain_rpcs.sql',
    '577be5299264eb477ddf53da6401a1795a789fc6520d6b50a773467f90a604e7',
  ],
  [
    '20260911040000_create_secure_reporting.sql',
    '459e1f79ac472bda1f70174bdf41285dad8e2ff22ae63404e0b6c94e82b8813f',
  ],
  [
    '20260914010000_create_auth_session_contracts.sql',
    'e1ba80828aab50ec0786d06e22c38859907e1b85221c06cae6f2b67864dabdb6',
  ],
  [
    '20260915010000_create_admin_contracts.sql',
    '7906fb343da426a87d81f985da992f891b3ee3f6fead2029805e140d7c365158',
  ],
  [
    '20260915020000_grant_admin_service_reads.sql',
    '26a0905defaad9a21651f0802d4985c394aff93c468aa46dd4e2d1d216b17848',
  ],
  [
    '20260915030000_harden_admin_password_reset.sql',
    'e379e0433a2de47f4b4bcd43bcee2d63076e9ff9f07f002785be01b478c64997',
  ],
];

const platformBootstrap = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin;

  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    encrypted_password text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.uid()
  returns uuid
  language sql
  stable
  as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;

  create schema storage;
  create table storage.buckets (
    id text primary key,
    name text not null unique,
    public boolean not null default false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text not null references storage.buckets (id),
    name text not null
  );
  alter table storage.objects enable row level security;
  create function storage.foldername(name text)
  returns text[]
  language sql
  immutable
  as $$
    select string_to_array(name, '/');
  $$;

  create schema supabase_migrations;
  create table supabase_migrations.schema_migrations (
    version text primary key
  );

  create function public.rls_auto_enable()
  returns void
  language sql
  security definer
  set search_path = pg_catalog
  as $$ select null; $$;
`;

test('production migration manifest and post-deploy verification remain exact', async () => {
  const database = new PGlite();

  try {
    await database.exec(platformBootstrap);

    for (const [name, expectedHash] of migrations) {
      const sql = await readFile(`${migrationsDirectory}/${name}`, 'utf8');
      const actualHash = createHash('sha256').update(sql).digest('hex');

      assert.equal(actualHash, expectedHash, `${name} checksum changed`);
      await database.exec(sql);
      await database.query(
        'insert into supabase_migrations.schema_migrations (version) values ($1)',
        [name.slice(0, 14)],
      );
    }

    const verificationSql = await readFile(verificationPath, 'utf8');
    const { rows } = await database.query(verificationSql);
    const [result] = rows;
    const report = JSON.parse(result.production_post_migration_verification);
    const securityDefiners = await database.query(`
      select n.nspname as schema_name, p.proname,
        pg_get_function_identity_arguments(p.oid) as arguments
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('private', 'public')
        and p.prosecdef
        and not (n.nspname = 'public' and p.proname = 'rls_auto_enable')
      order by n.nspname, p.proname, arguments
    `);

    assert.equal(
      report.checks.application_security_definers_exact,
      true,
      JSON.stringify(securityDefiners.rows),
    );

    assert.deepEqual(
      report.checks,
      Object.fromEntries(
        Object.keys(report.checks).map((checkName) => [checkName, true]),
      ),
    );
    assert.equal(report.application_data_counts.roles, 2);
    assert.equal(report.application_data_counts.users, 0);
  } finally {
    await database.close();
  }
});
