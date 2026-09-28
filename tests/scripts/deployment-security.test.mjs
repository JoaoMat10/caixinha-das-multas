/* global process */
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const readTree = (directory) =>
  fs
    .readdirSync(path.join(root, directory), { recursive: true })
    .filter((entry) => fs.statSync(path.join(root, directory, entry)).isFile())
    .map((entry) => fs.readFileSync(path.join(root, directory, entry), 'utf8'))
    .join('\n');

const productionSupabaseOrigin = 'https://showcaseprodref00001.supabase.co';

function cspDirectives(headers) {
  const value = headers.match(/^ {2}Content-Security-Policy: (.+)$/m)?.[1];
  expect(value).toBeDefined();
  return Object.fromEntries(
    value.split(';').map((directive) => {
      const [name, ...sources] = directive.trim().split(/\s+/);
      return [name, sources];
    }),
  );
}

function cacheControlFor(headers, route) {
  const escapedRoute = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return headers.match(
    new RegExp(`^${escapedRoute}\\r?\\n  Cache-Control: ([^\\r\\n]+)$`, 'm'),
  )?.[1];
}

describe('deploy estático e headers de segurança', () => {
  it('fixa um runtime Node compatível e um pipeline local completo', () => {
    expect(read('.node-version').trim()).toBe('24.19.0');

    const packageJson = JSON.parse(read('package.json'));
    expect(packageJson.scripts.verify).toBe(
      'npm run format:check && npm run lint && npm run typecheck && npm test && npm run test:db && npm run build && npm run test:pages',
    );
    expect(packageJson.scripts.build).toContain(
      'node scripts/validate-cloudflare-production-env.mjs',
    );
    expect(packageJson.scripts.build).toContain(
      'node scripts/finalize-pages-build.mjs',
    );
  });

  it('limita o fallback SPA às rotas funcionais conhecidas', () => {
    const wrangler = read('wrangler.toml');
    const redirects = read('public/_redirects').trim().split(/\r?\n/);
    const routes = [
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

    expect(wrangler).toContain('name = "caixinha-das-multas"');
    expect(wrangler).toContain('pages_build_output_dir = "./dist"');
    expect(fs.existsSync(path.join(root, 'public/404.html'))).toBe(true);
    expect(redirects).toEqual(
      routes.map((route) => `${route} /index.html 200`),
    );
    expect(redirects).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/^\/\*/)]),
    );
  });

  it('define uma CSP restritiva compatível com o Supabase', () => {
    const headers = read('public/_headers');
    const directives = cspDirectives(headers);
    const offlineStyle = read('public/offline.html').match(
      /<style>([\s\S]*?)<\/style>/,
    )?.[1];
    expect(offlineStyle).toBeDefined();
    const offlineStyleHash = `'sha256-${createHash('sha256')
      .update(offlineStyle)
      .digest('base64')}'`;

    expect(directives).toEqual({
      'default-src': ["'self'"],
      'base-uri': ["'self'"],
      'object-src': ["'none'"],
      'frame-ancestors': ["'none'"],
      'form-action': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'", offlineStyleHash],
      'img-src': ["'self'", productionSupabaseOrigin],
      'font-src': ["'self'"],
      'connect-src': ["'self'", productionSupabaseOrigin],
      'manifest-src': ["'self'"],
      'worker-src': ["'self'"],
      'media-src': ["'none'"],
      'upgrade-insecure-requests': [],
    });
    expect(headers).not.toContain('*.supabase.co');
    expect(headers).not.toContain('showcasetestref00001');
    expect(headers).not.toContain('data:');
    expect(headers).not.toContain('blob:');
    expect(headers).not.toContain('wss:');
    expect(headers).not.toContain("'unsafe-eval'");
    expect(headers).not.toContain("script-src 'self' 'unsafe-inline'");
  });

  it('aplica proteção do browser e políticas de cache adequadas à PWA', () => {
    const headers = read('public/_headers');
    expect(headers).toContain('X-Content-Type-Options: nosniff');
    expect(headers).toContain('X-Frame-Options: DENY');
    expect(headers).toContain('Referrer-Policy: no-referrer');
    expect(headers).toContain('Permissions-Policy:');
    expect(headers).toContain('Strict-Transport-Security: max-age=31536000');
    expect(cacheControlFor(headers, '/assets/*')).toBeUndefined();
    expect(cacheControlFor(headers, '/icons/*')).toBe('public, max-age=86400');
    expect(cacheControlFor(headers, '/manifest.webmanifest')).toBe(
      'public, max-age=3600, must-revalidate',
    );
    expect(cacheControlFor(headers, '/service-worker.js')).toBe(
      'no-cache, no-store, must-revalidate',
    );

    const htmlRoutes = [
      '/',
      '/*.html',
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
    for (const route of htmlRoutes) {
      expect(cacheControlFor(headers, route)).toBe('no-cache, must-revalidate');
    }
  });

  it('não admite nomes de segredos em variáveis VITE públicas', () => {
    const publicVariables = read('.env.example')
      .split(/\r?\n/)
      .filter((line) => line.startsWith('VITE_'));

    expect(publicVariables).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(/SERVICE_ROLE|SECRET|PASSWORD|PRIVATE|TOKEN/i),
      ]),
    );
  });

  it('não inclui credenciais privilegiadas nem execução dinâmica no frontend', () => {
    const frontend = `${readTree('src')}\n${readTree('public')}`;

    expect(frontend).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|service_role/i);
    expect(frontend).not.toMatch(
      /dangerouslySetInnerHTML|\beval\s*\(|new Function\s*\(/,
    );
    expect(frontend).not.toMatch(/console\.(log|debug|info)\s*\(/);
  });
});
