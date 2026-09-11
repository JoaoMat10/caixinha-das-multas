import { describe, expect, it } from 'vitest';

import { parsePublicEnvironment } from '@/shared/config/env';

describe('variáveis de ambiente públicas', () => {
  it('usa valores seguros por omissão', () => {
    expect(parsePublicEnvironment({})).toEqual({
      VITE_APP_NAME: 'Caixinha das Multas',
      VITE_PUBLIC_APP_URL: 'http://127.0.0.1:5173',
    });
  });

  it('rejeita um URL público inválido', () => {
    expect(() =>
      parsePublicEnvironment({ VITE_PUBLIC_APP_URL: 'valor-invalido' }),
    ).toThrow();
  });
});
