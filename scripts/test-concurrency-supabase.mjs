import { createClient } from '@supabase/supabase-js';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertNoStrandedFinancialTestUsers,
  cleanupFinancialTestUser,
  prepareAuthTestUser,
  runLinkedSql,
} from './supabase-auth-test-fixture.mjs';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(currentDirectory, '..');
const cliEntryPoint = path.join(
  projectDirectory,
  'node_modules',
  'supabase',
  'dist',
  'supabase.js',
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sqlUuid(value) {
  if (!/^[0-9a-f-]{36}$/i.test(value))
    throw new Error('O teste recebeu um UUID inválido.');
  return `'${value}'::uuid`;
}

function runIndependentSession(file, databaseUrl, databasePassword) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [cliEntryPoint, 'db', 'query', '--db-url', databaseUrl, '--file', file],
      {
        cwd: projectDirectory,
        env: { ...process.env, PGPASSWORD: databasePassword },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function connectionUrlForRole(roleName) {
  const poolerUrl = new URL(
    (
      await readFile(
        path.join(projectDirectory, 'supabase', '.temp', 'pooler-url'),
        'utf8',
      )
    ).trim(),
  );
  const expectedProjectRef = process.env.SUPABASE_TEST_PROJECT_REF;
  if (
    poolerUrl.protocol !== 'postgresql:' ||
    poolerUrl.password ||
    !poolerUrl.hostname.endsWith('.supabase.com') ||
    !poolerUrl.username.endsWith(`.${expectedProjectRef}`)
  ) {
    throw new Error('O URL do pooler não corresponde ao projeto de teste.');
  }
  poolerUrl.username = `${roleName}.${expectedProjectRef}`;
  return poolerUrl.toString();
}

function sessionEvidence(result, index) {
  const diagnostic = `${result.stdout}\n${result.stderr}`
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      '[uuid]',
    )
    .replace(/financial\.test\.[a-f0-9]{10}/gi, '[temporary-user]')
    .trim()
    .slice(-2000);
  return `Sessão ${index + 1}: exit=${result.code}; ${diagnostic || 'sem diagnóstico'}`;
}

let testUser;
let client;
let testError;
const cleanupErrors = [];
let databaseRoleName;
let helperFunctionName;
let databaseRoleCreated = false;
const temporaryDirectory = await mkdtemp(
  path.join(tmpdir(), 'caixinha-concurrency-'),
);

try {
  testUser = await prepareAuthTestUser({
    usernamePrefix: 'financial.test',
    displayName: 'Concorrência PostgreSQL',
    mustChangePassword: false,
  });
  client = createClient(
    testUser.configuration.url,
    testUser.configuration.publishableKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const login = await client.auth.signInWithPassword({
    email: testUser.technicalEmail,
    password: testUser.password,
  });
  assert(!login.error, 'O login da conta de concorrência falhou.');

  const context = await client.rpc('get_auth_context');
  assert(!context.error, 'Não foi possível obter o contexto de concorrência.');
  const membership = context.data.memberships.find(
    (item) => item.seasonStatus === 'active',
  );
  assert(membership, 'Não foi encontrado um membership ativo.');

  const categories = await client
    .from('fine_categories')
    .select('id')
    .eq('season_id', membership.seasonId)
    .eq('is_active', true)
    .order('display_order')
    .limit(1);
  assert(
    !categories.error && categories.data?.[0],
    'Não foi encontrada uma categoria ativa.',
  );

  const fineResult = await client.rpc('apply_fine', {
    p_season_member_id: membership.id,
    p_fine_category_id: categories.data[0].id,
    p_occurred_at: new Date().toISOString(),
    p_notes: 'Teste de concorrência com sessões independentes',
    p_idempotency_key: randomUUID(),
  });
  assert(!fineResult.error, 'Não foi possível criar a multa concorrente.');
  const fine = fineResult.data;
  const firstKey = randomUUID();
  const secondKey = randomUUID();
  const databaseObjectSuffix = randomBytes(6).toString('hex');
  databaseRoleName = `caixinha_concurrency_${databaseObjectSuffix}`;
  helperFunctionName = `caixinha_concurrency_payment_${databaseObjectSuffix}`;
  const firstFile = path.join(temporaryDirectory, 'first.sql');
  const secondFile = path.join(temporaryDirectory, 'second.sql');
  await Promise.all([
    writeFile(
      firstFile,
      `with session_context as materialized (
         select set_config('request.jwt.claim.sub', '${testUser.id}', true)
       )
       select public.${helperFunctionName}(
         ${sqlUuid(membership.id)}, ${sqlUuid(fine.id)},
         ${sqlUuid(firstKey)}, 2
       )
       from session_context`,
      'utf8',
    ),
    writeFile(
      secondFile,
      `with session_context as materialized (
         select set_config('request.jwt.claim.sub', '${testUser.id}', true)
       )
       select public.${helperFunctionName}(
         ${sqlUuid(membership.id)}, ${sqlUuid(fine.id)},
         ${sqlUuid(secondKey)}, 0.5
       )
       from session_context`,
      'utf8',
    ),
  ]);

  const databaseRolePassword = `Aa1${randomBytes(24).toString('base64url')}`;
  await runLinkedSql(`
    begin;
    create role ${databaseRoleName}
      login password '${databaseRolePassword}'
      valid until '${new Date(Date.now() + 15 * 60 * 1000).toISOString()}';
    grant authenticated to ${databaseRoleName};
    create function public.${helperFunctionName}(
      p_member_id uuid,
      p_fine_id uuid,
      p_idempotency_key uuid,
      p_delay_seconds double precision
    ) returns uuid
    language plpgsql
    security definer
    set search_path = ''
    as $function$
    declare
      result_id uuid;
    begin
      perform 1
      from public.fines
      where id = p_fine_id
      for update;
      perform pg_catalog.pg_sleep(p_delay_seconds);
      select id into result_id
      from public.record_payment_batch(
        p_member_id,
        array[p_fine_id]::uuid[],
        'paid',
        p_idempotency_key
      );
      return result_id;
    end
    $function$;
    revoke all on function public.${helperFunctionName}(
      uuid, uuid, uuid, double precision
    ) from public, anon, authenticated;
    grant execute on function public.${helperFunctionName}(
      uuid, uuid, uuid, double precision
    ) to ${databaseRoleName};
    commit;
  `);
  databaseRoleCreated = true;
  const databaseUrl = await connectionUrlForRole(databaseRoleName);

  const results = await Promise.all([
    runIndependentSession(firstFile, databaseUrl, databaseRolePassword),
    runIndependentSession(secondFile, databaseUrl, databaseRolePassword),
  ]);
  const succeeded = results.filter((result) => result.code === 0);
  const rejected = results.filter((result) => result.code !== 0);
  if (succeeded.length !== 1 || rejected.length !== 1) {
    process.stderr.write(`${results.map(sessionEvidence).join('\n')}\n`);
  }
  assert(
    succeeded.length === 1,
    'A dupla liquidação não teve um único sucesso.',
  );
  assert(
    rejected.length === 1,
    'A dupla liquidação não teve uma única rejeição.',
  );
  const rejectedForExpectedTransition = /nao permitem a transicao/i.test(
    `${rejected[0].stdout}\n${rejected[0].stderr}`,
  );
  if (!rejectedForExpectedTransition) {
    process.stderr.write(`${sessionEvidence(rejected[0], 0)}\n`);
  }
  assert(
    rejectedForExpectedTransition,
    'A sessão rejeitada não falhou pela transição financeira esperada.',
  );

  const [fineState, batches, logs] = await Promise.all([
    client.from('fines').select('status').eq('id', fine.id).single(),
    client
      .from('payment_batches')
      .select('id', { count: 'exact' })
      .in('idempotency_key', [firstKey, secondKey]),
    client
      .from('payment_logs')
      .select('id', { count: 'exact' })
      .eq('fine_id', fine.id),
  ]);
  assert(fineState.data?.status === 'paid', 'A multa não terminou liquidada.');
  assert(!batches.error && batches.count === 1, 'Foi criado mais de um batch.');
  assert(!logs.error && logs.count === 1, 'Foi criado mais de um log.');
  console.log(
    'Concorrência PostgreSQL real: 1 sucesso, 1 rejeição, 1 batch e 1 log.',
  );
} catch (error) {
  testError = error;
} finally {
  await client?.auth.signOut();
  try {
    await cleanupFinancialTestUser(testUser);
    await assertNoStrandedFinancialTestUsers();
  } catch (error) {
    cleanupErrors.push(error);
  }
  if (databaseRoleCreated) {
    try {
      await runLinkedSql(`
        begin;
        drop function public.${helperFunctionName}(
          uuid, uuid, uuid, double precision
        );
        revoke authenticated from ${databaseRoleName};
        drop role ${databaseRoleName};
        commit;
      `);
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  await rm(temporaryDirectory, { force: true, recursive: true });
}

if (cleanupErrors.length > 0) {
  throw new AggregateError(
    testError ? [testError, ...cleanupErrors] : cleanupErrors,
    'A limpeza do teste de concorrência falhou.',
  );
}
if (testError) throw testError;
