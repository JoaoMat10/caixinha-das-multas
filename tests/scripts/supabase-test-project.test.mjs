import { describe, expect, it, vi } from 'vitest';

import { runCleanupWithAuthFinally } from '../../scripts/supabase-auth-test-fixture.mjs';
import { validateTestProjectReference } from '../../scripts/supabase-test-project.mjs';

const linkedProjectRef = 'abcdefghijklmnopqrst';

describe('proteção do projeto Supabase remoto de testes', () => {
  it('recusa a execução sem referência explícita', () => {
    expect(() =>
      validateTestProjectReference(undefined, linkedProjectRef),
    ).toThrow(/SUPABASE_TEST_PROJECT_REF é obrigatória/);
  });

  it('recusa uma referência explícita diferente do projeto ligado', () => {
    expect(() =>
      validateTestProjectReference('tsrqponmlkjihgfedcba', linkedProjectRef),
    ).toThrow(/não coincide/);
  });

  it('aceita apenas a referência explícita que coincide com o projeto ligado', () => {
    expect(
      validateTestProjectReference(linkedProjectRef, linkedProjectRef),
    ).toBe(linkedProjectRef);
  });
});

describe('limpeza do fixture Auth remoto', () => {
  it('elimina a identidade Auth mesmo quando a limpeza pública falha', async () => {
    const publicError = new Error('falha pública');
    const cleanupPublic = vi.fn().mockRejectedValue(publicError);
    const cleanupAuth = vi.fn().mockResolvedValue(undefined);

    await expect(
      runCleanupWithAuthFinally(cleanupPublic, cleanupAuth),
    ).rejects.toBe(publicError);
    expect(cleanupAuth).toHaveBeenCalledOnce();
  });
});
