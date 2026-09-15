import { describe, expect, it, vi } from 'vitest';

import type { AdminGateway } from '@/domains/admin/contracts/admin';
import { AdminService } from '@/domains/admin/services/AdminService';

function gateway(): AdminGateway {
  return {
    loadOverview: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    setUserActive: vi.fn(),
    resetPassword: vi.fn(),
    saveTeam: vi.fn(),
    saveSeason: vi.fn(),
    saveMember: vi.fn(),
    uploadUserPhoto: vi.fn(),
    removeUserPhoto: vi.fn(),
  };
}

describe('AdminService', () => {
  it('rejeita usernames inválidos antes do gateway', () => {
    const adapter = gateway();
    const service = new AdminService(adapter);
    expect(() =>
      service.createUser({
        username: 'A B',
        displayName: 'Nome',
        idempotencyKey: crypto.randomUUID(),
      }),
    ).toThrow();
    expect(adapter.createUser).not.toHaveBeenCalled();
  });

  it('valida em separado jogador e equipa técnica', () => {
    const adapter = gateway();
    const service = new AdminService(adapter);
    expect(() =>
      service.saveMember({
        seasonId: crypto.randomUUID(),
        userId: crypto.randomUUID(),
        memberType: 'player',
        shirtNumber: null,
        staffFunction: null,
        status: 'active',
        roles: [],
      }),
    ).toThrow('número de camisola');
    expect(() =>
      service.saveMember({
        seasonId: crypto.randomUUID(),
        userId: crypto.randomUUID(),
        memberType: 'staff',
        shirtNumber: null,
        staffFunction: '',
        status: 'active',
        roles: [],
      }),
    ).toThrow('função');
    expect(adapter.saveMember).not.toHaveBeenCalled();
  });

  it('aceita capitão e tesoureiro em simultâneo', async () => {
    const adapter = gateway();
    vi.mocked(adapter.saveMember).mockResolvedValue(undefined);
    const service = new AdminService(adapter);
    await service.saveMember({
      seasonId: crypto.randomUUID(),
      userId: crypto.randomUUID(),
      memberType: 'player',
      shirtNumber: 10,
      staffFunction: null,
      status: 'active',
      roles: ['captain', 'treasurer'],
    });
    expect(adapter.saveMember).toHaveBeenCalledOnce();
  });

  it('rejeita fotografias acima do limite ou com MIME indevido', () => {
    const adapter = gateway();
    const service = new AdminService(adapter);
    const textFile = new File(['texto'], 'foto.txt', { type: 'text/plain' });
    expect(() =>
      service.uploadUserPhoto(crypto.randomUUID(), textFile),
    ).toThrow('JPEG');
    expect(adapter.uploadUserPhoto).not.toHaveBeenCalled();
  });
});
