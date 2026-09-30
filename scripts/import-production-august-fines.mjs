import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const cli = path.join(root, 'node_modules', 'supabase', 'dist', 'supabase.js');
const projectRef = 'showcaseprodref00001';
const apply = process.argv.includes('--apply');
const fines = [
  ['alexandre.silva1', 16, '2026-08-08', 1],
  ['yuri.martins77', 14, '2026-08-02', 1],
  ['yuri.martins77', 12, '2026-08-06', 1],
  ['antonio.silva19', 17, '2026-08-04', 1],
  ['william.costa7', 14, '2026-08-03', 1],
  ['william.costa7', 17, '2026-08-07', 1],
  ['diogo.almeida39', 16, '2026-08-01', 1],
  ['diogo.almeida39', 16, '2026-08-05', 1],
  ['diogo.almeida39', 17, '2026-08-04', 1],
  ['ivo.pereira3', 16, '2026-08-02', 1],
  ['xavier.ferreira11', 10, '2026-08-07', 1],
  ['ze.miguel10', 11, '2026-08-09', 1],
  ['ze.miguel10', 17, '2026-08-10', 1],
  ['oscar.rodrigues6', 16, '2026-08-03', 2],
  ['ricardo.azevedo30', 10, '2026-08-01', 1],
  ['ricardo.azevedo30', 14, '2026-08-06', 1],
  ['bernardo.sousa9', 21, '2026-08-04', 1],
  ['bernardo.sousa9', 17, '2026-08-05', 1],
].map(([username, categoryOrder, date, multiplier], index) => ({
  username,
  categoryOrder,
  date,
  multiplier,
  sequence: index + 1,
}));

function runCli(args) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0)
    throw new Error(
      `${String(result.stderr ?? '')}\n${String(result.stdout ?? '')}`,
    );
  return result.stdout;
}

function parseJson(output) {
  const starts = [output.indexOf('['), output.indexOf('{')].filter(
    (index) => index >= 0,
  );
  if (!starts.length) throw new Error('A CLI não devolveu JSON.');
  const start = Math.min(...starts);
  const end = output.lastIndexOf(output[start] === '[' ? ']' : '}');
  return JSON.parse(output.slice(start, end + 1));
}

async function runSql(sql) {
  const directory = await mkdtemp(path.join(tmpdir(), 'caixinha-august-'));
  const file = path.join(directory, 'query.sql');
  try {
    await writeFile(file, sql, 'utf8');
    return parseJson(
      runCli([
        'db',
        'query',
        '--linked',
        '--project-ref',
        projectRef,
        '--output',
        'json',
        '--file',
        file,
      ]),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function literal(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function assertTarget() {
  const linked = (
    await readFile(path.join(root, 'supabase', '.temp', 'project-ref'), 'utf8')
  ).trim();
  if (linked === projectRef)
    throw new Error('O checkout não pode estar ligado à produção.');
  const projects = parseJson(runCli(['projects', 'list', '--output', 'json']));
  if (
    !projects.some(
      (item) =>
        item.id === projectRef && item.name === 'caixinha-showcase-producao',
    )
  )
    throw new Error('Projeto de produção não confirmado.');
}

function inventorySql() {
  return `select json_build_object(
    'migrationReady', exists (
      select 1 from information_schema.columns where table_schema = 'public'
        and table_name = 'fines' and column_name = 'commission_month'
    ),
    'members', (select count(*) from public.season_members sm join public.seasons s on s.id=sm.season_id join public.teams t on t.id=s.team_id where t.name='Clube Desportivo Exemplo' and s.name='2026/2027' and sm.status='active'),
    'catalog', (select count(*) from public.fine_categories fc join public.seasons s on s.id=fc.season_id join public.teams t on t.id=s.team_id where t.name='Clube Desportivo Exemplo' and s.name='2026/2027'),
    'commissionCategories', (select count(*) from public.fine_categories fc join public.seasons s on s.id=fc.season_id join public.teams t on t.id=s.team_id where t.name='Clube Desportivo Exemplo' and s.name='2026/2027' and fc.is_monthly_commission),
    'fines', (select count(*) from public.fines),
    'paidFines', (select count(*) from public.fines where status='paid'),
    'batches', (select count(*) from public.payment_batches),
    'logs', (select count(*) from public.payment_logs),
    'commissionFines', (select count(*) from public.fines where commission_month is not null),
    'received', (select coalesce(sum(final_amount_cents),0) from public.fines where status='paid'),
    'history', coalesce((
      select json_agg(json_build_object(
        'username', u.username_normalized,
        'categoryOrder', fc.display_order,
        'date', to_char(f.occurred_at at time zone 'Europe/Lisbon', 'YYYY-MM-DD'),
        'multiplier', f.multiplier,
        'status', f.status,
        'hasEverBeenPaid', f.has_ever_been_paid
      ) order by u.username_normalized, f.occurred_at, fc.display_order)
      from public.fines f
      join public.season_members sm on sm.id=f.season_member_id
      join public.users u on u.id=sm.user_id
      join public.fine_categories fc on fc.id=f.fine_category_id
      where f.commission_month is null
    ), '[]'::json)
  ) as state;`;
}

async function inventory() {
  return (await runSql(inventorySql())).rows[0].state;
}

function assertBefore(state) {
  if (!state.migrationReady || state.members !== 29 || state.catalog !== 23)
    throw new Error(
      'Schema, plantel ou catálogo não correspondem ao estado aprovado.',
    );
  if (state.fines || state.batches || state.logs || state.commissionCategories)
    throw new Error(
      'A importação exige um livro financeiro e comissão ainda vazios.',
    );
}

function assertAfter(state) {
  if (
    !state.migrationReady ||
    state.members !== 29 ||
    state.catalog !== 24 ||
    state.commissionCategories !== 1 ||
    state.fines !== 18 ||
    state.paidFines !== 18 ||
    state.batches !== 11 ||
    state.logs !== 18 ||
    state.commissionFines !== 0 ||
    state.received !== 3700
  )
    throw new Error(`Auditoria final divergente: ${JSON.stringify(state)}`);

  const expectedHistory = fines
    .map(({ username, categoryOrder, date, multiplier }) => ({
      username,
      categoryOrder,
      date,
      multiplier,
      status: 'paid',
      hasEverBeenPaid: true,
    }))
    .sort(
      (left, right) =>
        left.username.localeCompare(right.username) ||
        left.date.localeCompare(right.date) ||
        left.categoryOrder - right.categoryOrder,
    );
  const actualHistory = [...state.history].sort(
    (left, right) =>
      left.username.localeCompare(right.username) ||
      left.date.localeCompare(right.date) ||
      left.categoryOrder - right.categoryOrder,
  );
  const mismatch = expectedHistory.findIndex((expected, index) =>
    Object.entries(expected).some(
      ([key, value]) => actualHistory[index]?.[key] !== value,
    ),
  );
  if (actualHistory.length !== expectedHistory.length || mismatch >= 0) {
    throw new Error(`O detalhe histórico diverge na posição ${mismatch + 1}.`);
  }
}

function importSql() {
  return `
    begin;
    do $import$
    declare
      v_season_id uuid;
      v_team_id uuid;
      v_actor_id uuid;
      v_commission_id uuid;
      v_item record;
    begin
      select s.id, s.team_id into strict v_season_id, v_team_id
      from public.seasons s join public.teams t on t.id=s.team_id
      where t.name='Clube Desportivo Exemplo' and s.name='2026/2027' and s.status='active';
      select u.id into strict v_actor_id from public.users u
      join public.season_members sm on sm.user_id=u.id and sm.season_id=v_season_id
      join public.member_roles mr on mr.season_member_id=sm.id
      join public.roles r on r.id=mr.role_id and r.code='treasurer'
      where u.username_normalized='jorge.sousa4' and u.is_active;
      perform set_config('request.jwt.claim.sub', v_actor_id::text, true);
      if exists(select 1 from public.fines) or exists(select 1 from public.payment_batches) then
        raise exception 'O livro financeiro deixou de estar vazio.';
      end if;

      insert into public.fine_categories(season_id,name,description,base_amount_cents,amount_per_minute_cents,is_monthly_commission,is_active,display_order,created_by)
      values(v_season_id,'Comissão mensal sem multas','Aplicada a partir de setembro de 2026, no primeiro dia do mês seguinte.',100,null,true,true,24,v_actor_id)
      returning id into v_commission_id;
      insert into public.audit_events(actor_user_id,action,entity_type,entity_id,team_id,season_id,metadata)
      values(v_actor_id,'fine_category.created','fine_category',v_commission_id,v_team_id,v_season_id,jsonb_build_object('monthly_commission',true,'base_amount_cents',100));

      for v_item in select * from jsonb_to_recordset(${literal(JSON.stringify(fines))}::jsonb) as item(username text,"categoryOrder" integer,date date,multiplier integer,sequence integer)
      loop
        insert into public.fines(
          season_id,season_member_id,fine_category_id,category_name_snapshot,
          base_amount_cents_snapshot,amount_per_minute_cents_snapshot,minutes,
          multiplier,final_amount_cents,occurred_at,notes,status,has_ever_been_paid,
          applied_by,idempotency_key
        )
        select v_season_id,sm.id,fc.id,fc.name,fc.base_amount_cents,null,0,
          v_item.multiplier,fc.base_amount_cents*v_item.multiplier,
          (v_item.date + time '12:00') at time zone 'Europe/Lisbon',
          'Importação do histórico de agosto de 2026','pending',false,v_actor_id,
          md5('august-2026:'||v_item.sequence::text)::uuid
        from public.users u join public.season_members sm on sm.user_id=u.id and sm.season_id=v_season_id
        join public.fine_categories fc on fc.season_id=v_season_id and fc.display_order=v_item."categoryOrder"
        where u.username_normalized=v_item.username and not fc.is_monthly_commission;
        if not found then raise exception 'Mapeamento não encontrado: %', v_item.username; end if;
      end loop;

      for v_item in
        select sm.id as member_id, array_agg(f.id order by f.occurred_at) as fine_ids,
          u.username_normalized as username
        from public.fines f join public.season_members sm on sm.id=f.season_member_id
        join public.users u on u.id=sm.user_id
        where f.season_id=v_season_id and f.status='pending'
        group by sm.id,u.username_normalized
      loop
        perform public.record_payment_batch(v_item.member_id,v_item.fine_ids,'paid',md5('august-paid:'||v_item.username)::uuid);
      end loop;
      insert into public.audit_events(actor_user_id,action,entity_type,entity_id,team_id,season_id,metadata)
      values(v_actor_id,'historical_fines.imported','season',v_season_id,v_team_id,v_season_id,jsonb_build_object('month','2026-08','fine_count',18,'paid',true,'commission_applied',false));
    end;
    $import$;
    commit;
    select json_build_object('imported',18,'paid',18,'commissionFines',0) as result;
  `;
}

await assertTarget();
const before = await inventory();
if (before.fines === 18 && before.paidFines === 18) {
  assertAfter(before);
  console.log(JSON.stringify({ mode: 'verified', ...before }, null, 2));
  process.exit(0);
}
assertBefore(before);
if (!apply) {
  console.log(
    JSON.stringify(
      {
        mode: 'dry-run',
        target: projectRef,
        historicalFines: fines.length,
        expectedReceivedCents: 3700,
        augustCommissionFines: 0,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
await runSql(importSql());
const after = await inventory();
assertAfter(after);
console.log(
  JSON.stringify({ mode: 'apply', result: 'completed', ...after }, null, 2),
);
