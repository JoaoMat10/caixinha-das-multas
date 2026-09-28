/* global process, fetch, setTimeout */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { after, before, test } from 'node:test';

const root = process.cwd();
const outputDirectory = path.join(root, 'dist');
const wranglerPath = path.join(
  root,
  'node_modules',
  'wrangler',
  'bin',
  'wrangler.js',
);
const knownRoutes = [
  '/entrar',
  '/alterar-password-obrigatoria',
  '/painel',
  '/mural',
  '/multas',
  '/tesouraria',
  '/administracao',
  '/definicoes/password',
  '/sem-acesso',
];

let server;
let baseUrl;
let serverOutput = '';
let persistenceDirectory;

function listFiles(directory) {
  return fs
    .readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name));
}

function cacheControlFor(headers, route) {
  const escapedRoute = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return headers.match(
    new RegExp(`^${escapedRoute}\\r?\\n  Cache-Control: ([^\\r\\n]+)$`, 'm'),
  )?.[1];
}

async function reservePort() {
  return new Promise((resolve, reject) => {
    const listener = net.createServer();
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', () => {
      const address = listener.address();
      listener.close((error) => {
        if (error) reject(error);
        else resolve(address.port);
      });
    });
  });
}

async function waitForServer(url) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Wrangler terminou antes de iniciar.\n${serverOutput}`);
    }

    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // O servidor ainda está a iniciar.
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Wrangler não iniciou dentro do limite.\n${serverOutput}`);
}

before(async () => {
  assert.ok(fs.existsSync(path.join(outputDirectory, 'index.html')));
  assert.ok(fs.existsSync(wranglerPath), 'Wrangler local não está instalado');

  const port = await reservePort();
  baseUrl = `http://127.0.0.1:${port}`;
  persistenceDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'caixinha-pages-'),
  );
  server = spawn(
    process.execPath,
    [
      wranglerPath,
      'pages',
      'dev',
      outputDirectory,
      '--compatibility-date',
      '2026-09-23',
      '--ip',
      '127.0.0.1',
      '--port',
      String(port),
      '--persist-to',
      persistenceDirectory,
      '--log-level',
      'error',
      '--show-interactive-dev-session=false',
    ],
    {
      cwd: persistenceDirectory,
      env: {
        ...process.env,
        CI: 'true',
        WRANGLER_SEND_METRICS: 'false',
        XDG_CONFIG_HOME: persistenceDirectory,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  server.stdout.on('data', (chunk) => {
    serverOutput += chunk.toString();
  });
  server.stderr.on('data', (chunk) => {
    serverOutput += chunk.toString();
  });

  await waitForServer(baseUrl);
});

after(async () => {
  if (server && server.exitCode === null) {
    server.kill();
    await new Promise((resolve) => server.once('exit', resolve));
  }
  if (persistenceDirectory) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    fs.rmSync(persistenceDirectory, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
  }
});

test('o output final contém apenas rewrites SPA explícitos', () => {
  const redirects = fs
    .readFileSync(path.join(outputDirectory, '_redirects'), 'utf8')
    .trim()
    .split(/\r?\n/);

  assert.deepEqual(
    redirects,
    knownRoutes.map((route) => `${route} /index.html 200`),
  );
  assert.ok(fs.existsSync(path.join(outputDirectory, '404.html')));
  assert.ok(!redirects.some((redirect) => redirect.startsWith('/* ')));
});

test('os headers imutáveis enumeram apenas assets existentes com hash', () => {
  const headers = fs.readFileSync(
    path.join(outputDirectory, '_headers'),
    'utf8',
  );
  const assets = listFiles(path.join(outputDirectory, 'assets'))
    .map((filePath) =>
      path.relative(outputDirectory, filePath).replaceAll('\\', '/'),
    )
    .sort();

  assert.ok(assets.length > 0);
  assert.equal(cacheControlFor(headers, '/assets/*'), undefined);
  for (const asset of assets) {
    assert.match(
      path.posix.basename(asset),
      /-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/,
    );
    assert.equal(
      cacheControlFor(headers, `/${asset}`),
      'public, max-age=31536000, immutable',
    );
  }
  assert.equal(cacheControlFor(headers, '/assets/nao-existe.js'), undefined);
  assert.equal(
    cacheControlFor(headers, '/manifest.webmanifest'),
    'public, max-age=3600, must-revalidate',
  );
  assert.equal(
    cacheControlFor(headers, '/service-worker.js'),
    'no-cache, no-store, must-revalidate',
  );
});

test('o output não contém source maps nem segredos', () => {
  const files = listFiles(outputDirectory);
  const sourceMaps = files.filter((filePath) => filePath.endsWith('.map'));
  const text = files
    .filter((filePath) =>
      /\.(?:css|html|js|json|txt|webmanifest)$/.test(filePath),
    )
    .map((filePath) => fs.readFileSync(filePath, 'utf8'))
    .join('\n');

  assert.deepEqual(sourceMaps, []);
  assert.doesNotMatch(
    text,
    /SUPABASE_SERVICE_ROLE_KEY|sb_secret_|service_role/i,
  );
});

test('o Wrangler local serve a raiz e as rotas SPA conhecidas', async () => {
  const indexResponse = await fetch(baseUrl);
  const indexBody = await indexResponse.text();
  assert.equal(indexResponse.status, 200);

  for (const route of knownRoutes) {
    const response = await fetch(`${baseUrl}${route}`);
    assert.equal(response.status, 200, route);
    assert.equal(await response.text(), indexBody, route);
    assert.equal(
      response.headers.get('cache-control'),
      'no-cache, must-revalidate',
    );
  }
});

test('um asset inexistente devolve 404 sem o documento da SPA', async () => {
  const indexBody = await (await fetch(baseUrl)).text();
  const response = await fetch(`${baseUrl}/assets/nao-existe.js`);
  const body = await response.text();

  assert.equal(response.status, 404);
  assert.notEqual(body, indexBody);
  assert.doesNotMatch(body, /<script[^>]+type=["']module["']/i);
  assert.notEqual(
    response.headers.get('cache-control'),
    'public, max-age=31536000, immutable',
  );
});
