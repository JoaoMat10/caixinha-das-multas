/* global process */
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import {
  isCloudflareProductionBuild,
  productionEnvironment,
  requiredPublicVariables,
  validateCloudflareProductionEnvironment,
} from '../../scripts/validate-cloudflare-production-env.mjs';

const validEnvironment = {
  CF_PAGES: '1',
  CF_PAGES_BRANCH: 'main',
  ...productionEnvironment,
  VITE_SUPABASE_PUBLISHABLE_KEY:
    'sb_publishable_abcdefghijklmnopqrstuvwxyz012345',
};

describe('gate do build Cloudflare Production', () => {
  it('só é obrigatória no build Pages da branch main', () => {
    expect(isCloudflareProductionBuild({})).toBe(false);
    expect(
      isCloudflareProductionBuild({
        CF_PAGES: '1',
        CF_PAGES_BRANCH: 'feature',
      }),
    ).toBe(false);
    expect(isCloudflareProductionBuild(validEnvironment)).toBe(true);
    expect(validateCloudflareProductionEnvironment({})).toEqual({
      validated: false,
    });
  });

  it('aceita exclusivamente a configuração pública de produção esperada', () => {
    expect(validateCloudflareProductionEnvironment(validEnvironment)).toEqual({
      validated: true,
    });
  });

  it.each(requiredPublicVariables)('recusa a falta de %s', (variable) => {
    const environment = { ...validEnvironment };
    delete environment[variable];

    expect(() => validateCloudflareProductionEnvironment(environment)).toThrow(
      new RegExp(`${variable}: variável obrigatória ausente`),
    );
  });

  it.each([
    ['nome da aplicação incorreto', { VITE_APP_NAME: 'Outra aplicação' }],
    [
      'URL canónica incorreta',
      { VITE_PUBLIC_APP_URL: 'https://outro.pages.dev' },
    ],
    [
      'referência Supabase incorreta',
      { VITE_SUPABASE_URL: 'https://showcasetestref00001.supabase.co' },
    ],
    ['chave antiga ou inválida', { VITE_SUPABASE_PUBLISHABLE_KEY: 'anon-jwt' }],
  ])('recusa %s', (_scenario, overrides) => {
    expect(() =>
      validateCloudflareProductionEnvironment({
        ...validEnvironment,
        ...overrides,
      }),
    ).toThrow(/Gate do build Cloudflare Production recusada/);
  });

  it('nunca inclui o valor da chave nos diagnósticos', () => {
    const invalidKey = 'sb_publishable_valor.secreto-que-nao-pode-aparecer';
    const result = spawnSync(
      process.execPath,
      [
        path.join(
          process.cwd(),
          'scripts/validate-cloudflare-production-env.mjs',
        ),
      ],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          ...validEnvironment,
          VITE_SUPABASE_PUBLISHABLE_KEY: invalidKey,
        },
      },
    );

    expect(result.status).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).not.toContain(invalidKey);
    expect(result.stderr).toContain('VITE_SUPABASE_PUBLISHABLE_KEY');
  });
});
