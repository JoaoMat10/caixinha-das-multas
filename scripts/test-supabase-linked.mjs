import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(currentDirectory, '..');
const testFile = path.join(
  projectDirectory,
  'supabase',
  'tests',
  'database_rls.test.sql',
);

function instrumentTestSuite(source) {
  const planMatch = source.match(/^select extensions\.plan\((\d+)\);\s*$/m);

  if (!planMatch) {
    throw new Error(
      'A suite pgTAP não declara um plano de testes reconhecível.',
    );
  }

  const plannedAssertions = Number(planMatch[1]);
  const withResultTable = source.replace(
    /^begin;\s*$/m,
    `begin;
create temporary table pg_temp.linked_pgtap_results (result text) on commit drop;
grant insert, select on pg_temp.linked_pgtap_results to public;`,
  );
  const withCapturedAssertions = withResultTable.replace(
    /^select extensions\./gm,
    'insert into pg_temp.linked_pgtap_results (result)\nselect extensions.',
  );
  const instrumentedSource = withCapturedAssertions.replace(
    /^select \* from extensions\.finish\(\);\s*$/m,
    `insert into pg_temp.linked_pgtap_results (result)
select * from extensions.finish();

select json_build_object(
  'planned', ${plannedAssertions},
  'executed', count(*) filter (where result ~ '^(ok|not ok) [0-9]+ -'),
  'failures', coalesce(
    json_agg(result) filter (where result like 'not ok %'),
    '[]'::json
  )
) as tap_report
from pg_temp.linked_pgtap_results;`,
  );

  return { instrumentedSource, plannedAssertions };
}

function parseQueryResponse(output) {
  const jsonStart = output.indexOf('{');

  if (jsonStart === -1) {
    throw new Error('O CLI não devolveu uma resposta JSON reconhecível.');
  }

  const payload = JSON.parse(output.slice(jsonStart));
  const report = payload.rows?.[0]?.tap_report;

  if (!report || typeof report !== 'object') {
    throw new Error('A resposta remota não contém o relatório pgTAP agregado.');
  }

  return report;
}

const source = await readFile(testFile, 'utf8');
const { instrumentedSource, plannedAssertions } = instrumentTestSuite(source);
const temporaryDirectory = await mkdtemp(
  path.join(tmpdir(), 'caixinha-pgtap-'),
);
const instrumentedFile = path.join(
  temporaryDirectory,
  'database_rls.linked.test.sql',
);

try {
  await writeFile(instrumentedFile, instrumentedSource, 'utf8');

  const cliEntryPoint = path.join(
    projectDirectory,
    'node_modules',
    'supabase',
    'dist',
    'supabase.js',
  );
  const result = spawnSync(
    process.execPath,
    [cliEntryPoint, 'db', 'query', '--linked', '--file', instrumentedFile],
    {
      cwd: projectDirectory,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exitCode = result.status ?? 1;
  } else {
    const report = parseQueryResponse(result.stdout);
    const failures = Array.isArray(report.failures) ? report.failures : [];

    if (
      report.planned !== plannedAssertions ||
      report.executed !== plannedAssertions ||
      failures.length > 0
    ) {
      console.error('A suite pgTAP remota não passou integralmente.', report);
      process.exitCode = 1;
    } else {
      console.log(
        `pgTAP remoto: ${report.executed}/${report.planned} asserções passaram.`,
      );
    }
  }
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true });
}
