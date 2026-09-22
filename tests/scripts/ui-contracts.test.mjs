/* global process */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();
const styles = fs.readFileSync(path.join(root, 'src/styles/index.css'), 'utf8');
const router = fs.readFileSync(path.join(root, 'src/app/router.tsx'), 'utf8');

describe('contratos responsivos da interface', () => {
  it('respeita safe areas e reserva conteúdo acima da navegação móvel', () => {
    expect(styles).toContain('env(safe-area-inset-top)');
    expect(styles).toContain('env(safe-area-inset-bottom)');
    expect(styles).toMatch(/padding:[^;]*7\.25rem[^;]*safe-area-inset-bottom/);
  });

  it('define navegação tátil e adaptação desktop', () => {
    expect(styles).toContain('min-height: 3.75rem');
    expect(styles).toContain('@media (min-width: 1024px)');
    expect(styles).toContain('overflow-x: hidden');
  });

  it('carrega páginas e providers por rota', () => {
    expect(router).toContain('lazy(() =>');
    expect(router).toContain('MemberRouteProvider');
    expect(router).toContain('FinancialRouteProvider');
    expect(router).toContain('AdminRouteProvider');
  });
});
