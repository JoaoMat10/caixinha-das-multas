import { describe, expect, it, vi } from 'vitest';

import {
  deriveAdminResetPassword,
  executeAdminPasswordReset,
  isValidAdminPasswordResetSecret,
  type AdminPasswordResetInput,
} from '@/shared/rules/adminPasswordReset';

const resetSecret = 'segredo-hmac-administrativo-com-32-bytes';

const input: AdminPasswordResetInput = {
  actorUserId: '00000000-0000-4000-8000-000000000001',
  userId: '00000000-0000-4000-8000-000000000002',
  idempotencyKey: '00000000-0000-4000-8000-000000000003',
};

describe('reposição administrativa de password', () => {
  it('deriva a mesma password forte apenas para a mesma operação', async () => {
    const first = await deriveAdminResetPassword(resetSecret, input);
    const replay = await deriveAdminResetPassword(resetSecret, input);
    const other = await deriveAdminResetPassword(resetSecret, {
      ...input,
      idempotencyKey: '00000000-0000-4000-8000-000000000004',
    });

    expect(first).toBe(replay);
    expect(first).not.toBe(other);
    expect(first).toMatch(/^Aa1[A-Za-z0-9_-]{18}$/);
  });

  it('recupera uma falha parcial repetindo exatamente a mesma password', async () => {
    const appliedPasswords: string[] = [];
    let completionAttempts = 0;
    const dependencies = {
      secret: resetSecret,
      prepare: vi.fn().mockResolvedValue(undefined),
      updateAuth: vi.fn((password: string) => {
        appliedPasswords.push(password);
        return Promise.resolve();
      }),
      complete: vi.fn(() => {
        completionAttempts += 1;
        if (completionAttempts === 1)
          return Promise.reject(new Error('falha PostgreSQL'));
        return Promise.resolve({ completed: true });
      }),
    };

    await expect(
      executeAdminPasswordReset(input, dependencies),
    ).rejects.toThrow('falha PostgreSQL');
    const recovered = await executeAdminPasswordReset(input, dependencies);

    expect(appliedPasswords).toHaveLength(2);
    expect(appliedPasswords[0]).toBe(appliedPasswords[1]);
    expect(recovered.temporaryPassword).toBe(appliedPasswords[0]);
    expect(dependencies.prepare).toHaveBeenCalledTimes(2);
    expect(dependencies.complete).toHaveBeenCalledTimes(2);
  });

  it('mantém a password recuperável quando a resposta é repetida', async () => {
    const dependencies = {
      secret: resetSecret,
      prepare: vi.fn().mockResolvedValue(undefined),
      updateAuth: vi.fn().mockResolvedValue(undefined),
      complete: vi.fn().mockResolvedValue({ completed: true }),
    };

    const first = await executeAdminPasswordReset(input, dependencies);
    const replay = await executeAdminPasswordReset(input, dependencies);

    expect(replay.temporaryPassword).toBe(first.temporaryPassword);
    expect(dependencies.updateAuth).toHaveBeenCalledTimes(2);
  });

  it('recusa um segredo HMAC ausente ou curto', async () => {
    expect(isValidAdminPasswordResetSecret(undefined)).toBe(false);
    expect(isValidAdminPasswordResetSecret('curto')).toBe(false);
    expect(isValidAdminPasswordResetSecret(resetSecret)).toBe(true);
    await expect(deriveAdminResetPassword('curto', input)).rejects.toThrow(
      'Segredo de reposição indisponível.',
    );
  });
});
