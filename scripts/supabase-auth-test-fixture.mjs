import { createClient } from '@supabase/supabase-js';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { requireLinkedTestProject } from './supabase-test-project.mjs';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(currentDirectory, '..');
const cliEntryPoint = path.join(
  projectDirectory,
  'node_modules',
  'supabase',
  'dist',
  'supabase.js',
);

function encodeBase32(value) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  const bytes = new TextEncoder().encode(value);
  let accumulator = 0;
  let availableBits = 0;
  let encoded = '';

  for (const byte of bytes) {
    accumulator = (accumulator << 8) | byte;
    availableBits += 8;
    while (availableBits >= 5) {
      availableBits -= 5;
      encoded += alphabet[(accumulator >> availableBits) & 31];
    }
  }
  if (availableBits > 0) {
    encoded += alphabet[(accumulator << (5 - availableBits)) & 31];
  }
  return encoded;
}

function sqlLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function runCli(argumentsList) {
  return spawnSync(process.execPath, [cliEntryPoint, ...argumentsList], {
    cwd: projectDirectory,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

export async function runLinkedSql(sql) {
  const temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), 'caixinha-auth-'),
  );
  const sqlFile = path.join(temporaryDirectory, 'fixture.sql');

  try {
    await writeFile(sqlFile, sql, 'utf8');
    const result = runCli(['db', 'query', '--linked', '--file', sqlFile]);
    if (result.status !== 0) {
      const diagnostic = `${result.stderr}\n${result.stdout}`.replace(
        /(?:Aa1|Bb2|Cc3)[A-Za-z0-9_-]+/g,
        '[password]',
      );
      process.stderr.write(diagnostic);
      throw new Error('A preparação SQL da conta de teste falhou.');
    }
    return `${result.stdout}\n${result.stderr}`;
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
}

export async function getLinkedConfiguration() {
  const projectRef = await requireLinkedTestProject(projectDirectory);

  const result = runCli([
    'projects',
    'api-keys',
    '--project-ref',
    projectRef,
    '--output',
    'json',
  ]);
  if (result.status !== 0) {
    throw new Error('Não foi possível obter as chaves do projeto ligado.');
  }

  const keys = JSON.parse(result.stdout.slice(result.stdout.indexOf('[')));
  const publishableKey = keys.find(
    (key) => key.type === 'publishable',
  )?.api_key;
  const serviceRoleKey = keys.find((key) => key.id === 'service_role')?.api_key;
  if (
    typeof publishableKey !== 'string' ||
    !publishableKey.startsWith('sb_publishable_') ||
    typeof serviceRoleKey !== 'string'
  ) {
    throw new Error(
      'O projeto ligado não disponibiliza as chaves necessárias.',
    );
  }

  return {
    url: `https://${projectRef}.supabase.co`,
    publishableKey,
    serviceRoleKey,
  };
}

export async function getLinkedPublicConfiguration() {
  const { url, publishableKey } = await getLinkedConfiguration();
  return { url, publishableKey };
}

export async function prepareAuthTestUser() {
  const configuration = await getLinkedConfiguration();
  const suffix = randomBytes(5).toString('hex');
  const username = `auth.test.${suffix}`;
  const password = `Aa1${randomBytes(18).toString('base64url')}`;
  const technicalEmail = `u-${encodeBase32(username)}@auth.caixinha.invalid`;
  const administrator = createClient(
    configuration.url,
    configuration.serviceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const created = await administrator.auth.admin.createUser({
    email: technicalEmail,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw new Error('Não foi possível criar a conta Auth temporária.');
  }

  const testUser = {
    id: created.data.user.id,
    username,
    password,
    technicalEmail,
    configuration,
  };

  try {
    await runLinkedSql(`
      insert into public.users (
        id,
        username,
        username_normalized,
        display_name,
        must_change_password,
        created_by
      )
      values (
        ${sqlLiteral(testUser.id)}::uuid,
        ${sqlLiteral(username)},
        ${sqlLiteral(username)},
        'Utilizador de teste Auth',
        true,
        '00000000-0000-4000-8000-000000000001'::uuid
      );

      with active_season as (
        select s.id
        from public.seasons s
        join public.teams t on t.id = s.team_id
        where s.status = 'active' and t.is_active
        order by s.starts_on desc
        limit 1
      ), inserted_member as (
        insert into public.season_members (
          season_id,
          user_id,
          member_type,
          staff_function,
          status
        )
        select
          id,
          ${sqlLiteral(testUser.id)}::uuid,
          'staff',
          'Teste Auth',
          'active'
        from active_season
        returning id
      )
      insert into public.member_roles (season_member_id, role_id, assigned_by)
      select
        inserted_member.id,
        roles.id,
        '00000000-0000-4000-8000-000000000001'::uuid
      from inserted_member
      cross join public.roles
      where roles.code = 'treasurer';
    `);
  } catch (error) {
    await administrator.auth.admin.deleteUser(testUser.id);
    throw error;
  }

  return testUser;
}

export async function setAuthTestUserActive(testUser, isActive) {
  await runLinkedSql(`
    update public.users
    set is_active = ${isActive ? 'true' : 'false'}, updated_at = now()
    where id = ${sqlLiteral(testUser.id)}::uuid;
  `);
}

export async function runCleanupWithAuthFinally(cleanupPublic, cleanupAuth) {
  let publicCleanupError;
  let authCleanupError;

  try {
    await cleanupPublic();
  } catch (error) {
    publicCleanupError = error;
  } finally {
    try {
      await cleanupAuth();
    } catch (error) {
      authCleanupError = error;
    }
  }

  if (publicCleanupError && authCleanupError) {
    throw new AggregateError(
      [publicCleanupError, authCleanupError],
      'A limpeza da conta de teste falhou nas tabelas públicas e no Supabase Auth.',
    );
  }
  if (authCleanupError) throw authCleanupError;
  if (publicCleanupError) throw publicCleanupError;
}

export async function cleanupAuthTestUser(testUser) {
  if (!testUser) return;

  const administrator = createClient(
    testUser.configuration.url,
    testUser.configuration.serviceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  await runCleanupWithAuthFinally(
    () =>
      runLinkedSql(`
      delete from public.member_roles
      where season_member_id in (
        select id from public.season_members
        where user_id = ${sqlLiteral(testUser.id)}::uuid
      );
      delete from public.season_members
      where user_id = ${sqlLiteral(testUser.id)}::uuid;
      delete from public.users
      where id = ${sqlLiteral(testUser.id)}::uuid;
    `),
    async () => {
      const deleted = await administrator.auth.admin.deleteUser(testUser.id);
      if (deleted.error) {
        throw new Error('Não foi possível eliminar a conta Auth temporária.', {
          cause: deleted.error,
        });
      }
    },
  );
}

export async function prepareAdminTestOwner({
  usernamePrefix = 'admin.test',
  displayName = 'Owner temporário Fase 04',
} = {}) {
  if (!/^[a-z0-9._-]{3,20}$/.test(usernamePrefix)) {
    throw new Error('O prefixo do Owner temporário é inválido.');
  }
  const configuration = await getLinkedConfiguration();
  const suffix = randomBytes(5).toString('hex');
  const username = `${usernamePrefix}.${suffix}`;
  const password = `Aa1${randomBytes(18).toString('base64url')}`;
  const technicalEmail = `u-${encodeBase32(username)}@auth.caixinha.invalid`;
  const administrator = createClient(
    configuration.url,
    configuration.serviceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const created = await administrator.auth.admin.createUser({
    email: technicalEmail,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw new Error('Não foi possível criar o Owner temporário.');
  }

  const testOwner = {
    id: created.data.user.id,
    username,
    password,
    technicalEmail,
    configuration,
  };
  try {
    await runLinkedSql(`
      insert into public.users (
        id, username, username_normalized, display_name,
        must_change_password, created_by
      ) values (
        ${sqlLiteral(testOwner.id)}::uuid,
        ${sqlLiteral(username)},
        ${sqlLiteral(username)},
        ${sqlLiteral(displayName)},
        false,
        ${sqlLiteral(testOwner.id)}::uuid
      );
      insert into public.app_admins (user_id)
      values (${sqlLiteral(testOwner.id)}::uuid);
    `);
  } catch (error) {
    await administrator.auth.admin.deleteUser(testOwner.id);
    throw error;
  }
  return testOwner;
}

export async function cleanupAdminTestOwner(testOwner) {
  if (!testOwner) return;
  const administrator = createClient(
    testOwner.configuration.url,
    testOwner.configuration.serviceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: createdProfiles, error: profilesError } = await administrator
    .from('users')
    .select('id')
    .eq('created_by', testOwner.id)
    .neq('id', testOwner.id);
  if (profilesError)
    throw new Error('Não foi possível identificar os perfis temporários.');
  const createdIds = (createdProfiles ?? []).map((profile) => profile.id);

  const storageUserIds = [...createdIds, testOwner.id];
  for (const userId of storageUserIds) {
    const listed = await administrator.storage
      .from('private-photos')
      .list(`users/${userId}`, { limit: 1000 });
    if (listed.error) {
      throw new Error('Não foi possível listar as fotografias temporárias.');
    }
    const paths = (listed.data ?? [])
      .filter((entry) => entry.id)
      .map((entry) => `users/${userId}/${entry.name}`);
    if (paths.length > 0) {
      const removed = await administrator.storage
        .from('private-photos')
        .remove(paths);
      if (removed.error) {
        throw new Error(
          'Não foi possível eliminar as fotografias temporárias.',
        );
      }
    }
  }

  await runCleanupWithAuthFinally(
    () =>
      runLinkedSql(`
        begin;
        delete from public.member_roles where season_member_id in (
          select id from public.season_members where user_id = any(array[${createdIds.map((id) => `${sqlLiteral(id)}::uuid`).join(',') || 'null::uuid'}])
        );
        delete from public.season_members where user_id = any(array[${createdIds.map((id) => `${sqlLiteral(id)}::uuid`).join(',') || 'null::uuid'}]);
        delete from public.admin_user_requests
        where actor_user_id = ${sqlLiteral(testOwner.id)}::uuid
           or user_id = any(array[${createdIds.map((id) => `${sqlLiteral(id)}::uuid`).join(',') || 'null::uuid'}]);
        delete from public.admin_password_reset_requests
        where actor_user_id = ${sqlLiteral(testOwner.id)}::uuid
           or user_id = any(array[${createdIds.map((id) => `${sqlLiteral(id)}::uuid`).join(',') || 'null::uuid'}]);
        alter table public.audit_events disable trigger audit_events_are_immutable;
        delete from public.audit_events where actor_user_id = ${sqlLiteral(testOwner.id)}::uuid;
        alter table public.audit_events enable trigger audit_events_are_immutable;
        delete from public.app_admins where user_id = ${sqlLiteral(testOwner.id)}::uuid;
        delete from public.users where id = any(array[${createdIds.map((id) => `${sqlLiteral(id)}::uuid`).join(',') || 'null::uuid'}]);
        delete from public.users where id = ${sqlLiteral(testOwner.id)}::uuid;
        commit;
      `),
    async () => {
      for (const id of createdIds) {
        const deleted = await administrator.auth.admin.deleteUser(id);
        if (deleted.error)
          throw new Error(
            'Não foi possível eliminar uma conta administrativa temporária.',
          );
      }
      const deletedOwner = await administrator.auth.admin.deleteUser(
        testOwner.id,
      );
      if (deletedOwner.error)
        throw new Error('Não foi possível eliminar o Owner temporário.');
    },
  );
}

export async function cleanupStrandedAdminTestOwners() {
  const configuration = await getLinkedConfiguration();
  const administrator = createClient(
    configuration.url,
    configuration.serviceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: owners, error } = await administrator
    .from('users')
    .select('id')
    .like('username_normalized', 'admin.test.%');
  if (error)
    throw new Error('Não foi possível procurar Owners temporários pendentes.');
  for (const owner of owners ?? []) {
    await cleanupAdminTestOwner({ id: owner.id, configuration });
  }
}

export async function assertNoStrandedAdminTestOwners() {
  const configuration = await getLinkedConfiguration();
  const administrator = createClient(
    configuration.url,
    configuration.serviceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { count, error } = await administrator
    .from('users')
    .select('id', { count: 'exact', head: true })
    .or(
      'username_normalized.like.admin.test.%,username_normalized.like.managed.%',
    );
  if (error || count !== 0) {
    throw new Error(
      'Permanecem perfis administrativos temporários no projeto.',
    );
  }
}
