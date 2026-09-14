import { describe, expect, it } from 'vitest';

import {
  isValidUsername,
  normalizeUsername,
  usernameToTechnicalEmail,
} from '@/domains/auth/rules/username';

describe('username de autenticação', () => {
  it('normaliza espaços e maiúsculas de forma estável', () => {
    expect(normalizeUsername('  Tesoureiro.A  ')).toBe('tesoureiro.a');
    expect(usernameToTechnicalEmail(' Tesoureiro.A ')).toBe(
      usernameToTechnicalEmail('tesoureiro.a'),
    );
  });

  it('gera um identificador técnico determinístico sem expor o username', () => {
    const technicalEmail = usernameToTechnicalEmail('jogador.a');

    expect(technicalEmail).toMatch(/^u-[a-z2-7]+@auth\.caixinha\.invalid$/);
    expect(technicalEmail).not.toContain('jogador.a');
  });

  it('rejeita usernames fora do contrato', () => {
    expect(isValidUsername('ab')).toBe(false);
    expect(isValidUsername('utilizador@email.pt')).toBe(false);
    expect(() => usernameToTechnicalEmail('nome com espaços')).toThrow();
  });
});
