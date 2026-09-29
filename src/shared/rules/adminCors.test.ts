import { describe, expect, it } from 'vitest';

import {
  adminCorsBaseHeaders,
  parseAdminAllowedOrigins,
  resolveAdminCors,
} from '@/shared/rules/adminCors';

const productionOrigin = 'https://caixinha-showcase.pages.dev';

describe('CORS da função administrativa', () => {
  it('devolve apenas a origem exata autorizada e varia por Origin', () => {
    expect(resolveAdminCors(productionOrigin, productionOrigin)).toEqual({
      status: 'allowed',
      headers: {
        ...adminCorsBaseHeaders,
        'Access-Control-Allow-Origin': productionOrigin,
      },
    });
  });

  it.each([null, '', 'https://preview.pages.dev'])(
    'recusa a origem ausente ou não autorizada: %s',
    (origin) => {
      expect(resolveAdminCors(origin, productionOrigin)).toEqual({
        status: 'forbidden',
        headers: adminCorsBaseHeaders,
      });
    },
  );

  it.each([
    undefined,
    '',
    '*',
    'https://caixinha-showcase.pages.dev/caminho',
    'http://caixinha-showcase.pages.dev',
  ])('falha fechada perante configuração inválida: %s', (configured) => {
    expect(resolveAdminCors(productionOrigin, configured)).toEqual({
      status: 'unavailable',
      headers: adminCorsBaseHeaders,
    });
  });

  it('aceita uma lista exata por ambiente e elimina duplicados', () => {
    expect(
      parseAdminAllowedOrigins(
        `${productionOrigin}, http://127.0.0.1:5173, ${productionOrigin}`,
      ),
    ).toEqual([productionOrigin, 'http://127.0.0.1:5173']);
  });
});
