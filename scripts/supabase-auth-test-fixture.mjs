import { createClient } from '@supabase/supabase-js';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

async function runLinkedSql(sql) {
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
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
}

async function getLinkedConfiguration() {
  const projectRef = (
    await readFile(
      path.join(projectDirectory, 'supabase', '.temp', 'project-ref'),
      'utf8',
    )
  ).trim();
  if (!/^[a-z0-9]{20}$/.test(projectRef)) {
    throw new Error('A referência do projeto Supabase ligado é inválida.');
  }

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

export async function cleanupAuthTestUser(testUser) {
  if (!testUser) return;

  await runLinkedSql(`
    delete from public.member_roles
    where season_member_id in (
      select id from public.season_members
      where user_id = ${sqlLiteral(testUser.id)}::uuid
    );
    delete from public.season_members
    where user_id = ${sqlLiteral(testUser.id)}::uuid;
    delete from public.users
    where id = ${sqlLiteral(testUser.id)}::uuid;
  `);

  const administrator = createClient(
    testUser.configuration.url,
    testUser.configuration.serviceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const deleted = await administrator.auth.admin.deleteUser(testUser.id);
  if (deleted.error) {
    throw new Error('Não foi possível eliminar a conta Auth temporária.');
  }
}
