/* global process */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('PWA', () => {
  it('declara manifest instalável com ícones 192 e 512', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(root, 'public/manifest.webmanifest'), 'utf8'),
    );
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.some((icon) => icon.sizes === '192x192')).toBe(true);
    expect(manifest.icons.some((icon) => icon.sizes === '512x512')).toBe(true);
  });

  it('não interceta escritas nem pedidos Supabase e expõe atualização controlada', () => {
    const worker = fs.readFileSync(
      path.join(root, 'public/service-worker.js'),
      'utf8',
    );
    expect(worker).toContain("request.method !== 'GET'");
    expect(worker).toContain('.supabase.co');
    expect(worker).toContain("event.data?.type === 'SKIP_WAITING'");
    expect(worker).toContain("searchParams.get('v')");
    expect(worker).not.toContain('BackgroundSync');
  });

  it('regista uma versão distinta do service worker em cada build', () => {
    const status = fs.readFileSync(
      path.join(root, 'src/shared/pwa/PwaStatus.tsx'),
      'utf8',
    );
    const config = fs.readFileSync(path.join(root, 'vite.config.ts'), 'utf8');
    const app = fs.readFileSync(path.join(root, 'src/app/App.tsx'), 'utf8');
    expect(status).toContain('service-worker.js?v=${__APP_BUILD_ID__}');
    expect(status).not.toContain('beforeinstallprompt');
    expect(status).not.toContain('Instala a Caixinha');
    expect(config).toContain('__APP_BUILD_ID__');
    expect(app).toContain('<PwaStatus />');
  });
});
