import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const cli = path.join(root, 'node_modules', 'supabase', 'dist', 'supabase.js');
const projectRef = 'showcaseprodref00001';
const teamName = 'Clube Desportivo Exemplo';
const seasonName = '2026/2027';
const treasurerUsername = 'jorge.sousa4';
const apply = process.argv.includes('--apply');

const categories = [
  [1, 'Atraso à concentração do jogo com justificação', 100, null],
  [2, 'Atraso à concentração do jogo sem justificação', 300, 10],
  [3, 'Fumar no relvado, incluindo jogos fora', 500, null],
  [4, 'Levar cartão amarelo sem justificação válida', 500, null],
  [5, 'Levar cartão vermelho sem justificação válida', 1000, null],
  [6, 'Falta injustificada ao treino', 300, null],
  [7, 'Deixar material pessoal espalhado no balneário/campo', 200, null],
  [8, 'Não colocar a roupa suja no cesto', 400, null],
  [9, 'Lesão/queixa por falta de caneleiras', 500, null],
  [10, 'Usar acessórios à mostra durante treinos/jogos', 100, null],
  [11, 'Urinar nos chuveiros', 500, null],
  [12, 'Urinar fora das zonas específicas', 300, null],
  [13, 'Estragar equipamento do clube', 500, null],
  [14, 'Não usar chinelos no banho', 100, null],
  [15, 'Desrespeitar colegas/treinadores/direção', 1000, null],
  [16, 'Vestir/usar equipamentos de outros clubes', 200, null],
  [17, 'Usar chuteiras na enfermaria', 200, null],
  [18, 'Não utilizar fato de treino completo em dias de jogo', 500, null],
  [19, 'Esquecer material para os jogos, casa/fora', 500, null],
  [20, 'Usar o telemóvel à mesa durante o almoço', 100, null],
  [21, 'Telemóvel tocar/interromper durante palestras', 200, null],
  [22, 'Fumar no balneário', 500, null],
  [23, 'Não assinar a convocatória', 500, null],
].map(([displayOrder, name, baseAmountCents, amountPerMinuteCents]) => ({
  displayOrder,
  name,
  description: displayOrder === 6 ? 'Falar com treinador e capitães.' : null,
  baseAmountCents,
  amountPerMinuteCents,
}));

function runCli(args) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.status !== 0)
    throw new Error(
      `Supabase CLI falhou: ${String(result.stderr ?? '')}\n${String(result.stdout ?? '')}`,
    );
  return result.stdout;
}

function parseJson(output) {
  const start = output.indexOf('[');
  const objectStart = output.indexOf('{');
  const index =
    start === -1
      ? objectStart
      : objectStart === -1
        ? start
        : Math.min(start, objectStart);
  if (index < 0) throw new Error('A CLI não devolveu JSON válido.');
  return JSON.parse(output.slice(index));
}

async function runSql(sql) {
  const directory = await mkdtemp(path.join(tmpdir(), 'caixinha-catalog-'));
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
  const linkedRef = (
    await readFile(path.join(root, 'supabase', '.temp', 'project-ref'), 'utf8')
  ).trim();
  if (linkedRef === projectRef)
    throw new Error('O checkout principal não pode ficar ligado à produção.');

  const projects = parseJson(runCli(['projects', 'list', '--output', 'json']));
  const project = projects.find((item) => item.id === projectRef);
  if (!project || project.name !== 'caixinha-showcase-producao')
    throw new Error('O project ref não corresponde à produção esperada.');
}

function inventorySql() {
  return `
    select json_build_object(
      'migrationReady', exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'fine_categories'
          and column_name = 'amount_per_minute_cents'
      ),
      'teamCount', (select count(*) from public.teams where name = ${literal(teamName)}),
      'seasonCount', (
        select count(*) from public.seasons s join public.teams t on t.id = s.team_id
        where t.name = ${literal(teamName)} and s.name = ${literal(seasonName)} and s.status = 'active'
      ),
      'memberCount', (
        select count(*) from public.season_members sm
        join public.seasons s on s.id = sm.season_id
        join public.teams t on t.id = s.team_id
        where t.name = ${literal(teamName)} and s.name = ${literal(seasonName)} and sm.status = 'active'
      ),
      'treasurerCount', (
        select count(*) from public.users u
        join public.season_members sm on sm.user_id = u.id
        join public.member_roles mr on mr.season_member_id = sm.id
        join public.roles r on r.id = mr.role_id
        join public.seasons s on s.id = sm.season_id
        join public.teams t on t.id = s.team_id
        where u.username_normalized = ${literal(treasurerUsername)}
          and t.name = ${literal(teamName)} and s.name = ${literal(seasonName)}
          and r.code = 'treasurer'
      ),
      'financialRows', (
        (select count(*) from public.fines)
        + (select count(*) from public.payment_batches)
        + (select count(*) from public.payment_logs)
      ),
      'categories', coalesce((
        select json_agg(json_build_object(
          'name', fc.name,
          'description', fc.description,
          'baseAmountCents', fc.base_amount_cents,
          'amountPerMinuteCents', fc.amount_per_minute_cents,
          'isActive', fc.is_active,
          'displayOrder', fc.display_order
        ) order by fc.display_order)
        from public.fine_categories fc
        join public.seasons s on s.id = fc.season_id
        join public.teams t on t.id = s.team_id
        where t.name = ${literal(teamName)} and s.name = ${literal(seasonName)}
      ), '[]'::json)
    ) as state;
  `;
}

async function inventory() {
  return (await runSql(inventorySql())).rows[0].state;
}

function assertInventory(state, allowEmpty) {
  if (!state.migrationReady)
    throw new Error('A migração por minuto ainda não está aplicada.');
  if (
    state.teamCount !== 1 ||
    state.seasonCount !== 1 ||
    state.memberCount !== 29
  )
    throw new Error(
      'A equipa, época ou plantel não correspondem ao inventário aprovado.',
    );
  if (state.treasurerCount !== 1)
    throw new Error(
      'O tesoureiro Jorge Sousa não foi encontrado de forma inequívoca.',
    );
  if (state.financialRows !== 0)
    throw new Error('Foram encontrados movimentos financeiros inesperados.');
  if (allowEmpty && state.categories.length === 0) return;
  if (state.categories.length !== categories.length)
    throw new Error('O catálogo existente não tem exatamente 23 categorias.');
  for (let index = 0; index < categories.length; index += 1) {
    const actual = state.categories[index];
    const expected = categories[index];
    for (const key of [
      'name',
      'description',
      'baseAmountCents',
      'amountPerMinuteCents',
      'displayOrder',
    ])
      if (actual[key] !== expected[key])
        throw new Error(`Categoria ${index + 1} divergente em ${key}.`);
    if (!actual.isActive)
      throw new Error(`Categoria ${index + 1} não está ativa.`);
  }
}

function importSql() {
  const payload = literal(JSON.stringify(categories));
  return `
    begin;
    do $catalog$
    declare
      v_season_id uuid;
      v_actor_id uuid;
      v_item record;
    begin
      select s.id into strict v_season_id
      from public.seasons s join public.teams t on t.id = s.team_id
      where t.name = ${literal(teamName)} and s.name = ${literal(seasonName)} and s.status = 'active';

      select u.id into strict v_actor_id
      from public.users u
      join public.season_members sm on sm.user_id = u.id and sm.season_id = v_season_id
      join public.member_roles mr on mr.season_member_id = sm.id
      join public.roles r on r.id = mr.role_id and r.code = 'treasurer'
      where u.username_normalized = ${literal(treasurerUsername)} and u.is_active;

      perform set_config('request.jwt.claim.sub', v_actor_id::text, true);
      if exists (select 1 from public.fine_categories where season_id = v_season_id) then
        raise exception 'O catálogo deixou de estar vazio antes da escrita.';
      end if;

      for v_item in
        select * from jsonb_to_recordset(${payload}::jsonb) as item(
          "displayOrder" integer,
          name text,
          description text,
          "baseAmountCents" integer,
          "amountPerMinuteCents" integer
        ) order by "displayOrder"
      loop
        perform public.save_fine_category(
          v_season_id, null, v_item.name, coalesce(v_item.description, ''),
          v_item."baseAmountCents", true, v_item."displayOrder",
          v_item."amountPerMinuteCents"
        );
      end loop;
    end;
    $catalog$;
    commit;
    select json_build_object('operationId', ${literal(randomUUID())}, 'created', 23) as result;
  `;
}

await assertTarget();
const before = await inventory();
assertInventory(before, true);

if (!apply) {
  console.log(
    JSON.stringify(
      {
        mode: 'dry-run',
        target: projectRef,
        categories: categories.length,
        existing: before.categories.length,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (before.categories.length !== 0)
  throw new Error('A escrita só é permitida sobre um catálogo vazio.');

await runSql(importSql());
const after = await inventory();
assertInventory(after, false);
console.log(
  JSON.stringify(
    {
      mode: 'apply',
      result: 'completed',
      categories: after.categories.length,
      financialRows: after.financialRows,
    },
    null,
    2,
  ),
);
