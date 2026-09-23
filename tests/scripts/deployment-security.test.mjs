/* global process */
import fs from 'node:fs';
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

describe('deploy estático e headers de segurança', () => {
  it('fixa um runtime Node compatível e um pipeline local completo', () => {
    expect(read('.node-version').trim()).toBe('24.19.0');

    const packageJson = JSON.parse(read('package.json'));
    expect(packageJson.scripts.verify).toBe(
      'npm run format:check && npm run lint && npm run typecheck && npm test && npm run test:db && npm run build',
    );
  });

  it('configura o Pages sem sobrepor o fallback SPA nativo', () => {
    const wrangler = read('wrangler.toml');

    expect(wrangler).toContain('name = "caixinha-das-multas"');
    expect(wrangler).toContain('pages_build_output_dir = "./dist"');
    expect(fs.existsSync(path.join(root, 'public/404.html'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'public/_redirects'))).toBe(false);
  });

  it('define uma CSP restritiva compatível com o Supabase', () => {
    const headers = read('public/_headers');
    expect(headers).toContain("default-src 'self'");
    expect(headers).toContain("object-src 'none'");
    expect(headers).toContain("frame-ancestors 'none'");
    expect(headers).toContain("script-src 'self'");
    expect(headers).toContain("style-src 'self'");
    expect(headers).toContain('https://*.supabase.co');
    expect(headers).toContain('wss://*.supabase.co');
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
    expect(headers).toMatch(
      /\/assets\/\*[\s\S]*Cache-Control: public, max-age=31536000, immutable/,
    );
    expect(headers).toMatch(
      /\/service-worker\.js[\s\S]*Cache-Control: no-cache, no-store, must-revalidate/,
    );
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
