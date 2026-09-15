import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  AuthGateway,
  AuthenticatedUser,
} from '@/domains/auth/contracts/auth';
import {
  AuthError,
  AuthService,
  genericLoginError,
  genericPasswordError,
} from '@/domains/auth/services/AuthService';
import { usernameToTechnicalEmail } from '@/domains/auth/rules/username';

const user: AuthenticatedUser = {
  id: '00000000-0000-4000-8000-000000000002',
  username: 'tesoureiro.a',
  displayName: 'Tesoureiro A',
  avatarPath: null,
  mustChangePassword: false,
  isAppAdmin: false,
  memberships: [],
};

function createGateway(): AuthGateway {
  return {
    signIn: vi.fn().mockResolvedValue({ userId: user.id, expiresAt: 2_000 }),
    getSession: vi
      .fn()
      .mockResolvedValue({ userId: user.id, expiresAt: 2_000 }),
    loadAuthorizationContext: vi.fn().mockResolvedValue(user),
    updatePassword: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    onSessionEvent: vi.fn().mockReturnValue(() => undefined),
  };
}

describe('serviço de autenticação', () => {
  let gateway: AuthGateway;
  let service: AuthService;

  beforeEach(() => {
    gateway = createGateway();
    service = new AuthService(gateway, () => 1_000_000);
  });

  it('autentica com o identificador técnico e carrega o perfil', async () => {
    await expect(service.login(' Tesoureiro.A ', 'Temporaria1')).resolves.toBe(
      user,
    );
    expect(gateway.signIn).toHaveBeenCalledWith(
      usernameToTechnicalEmail('tesoureiro.a'),
      'Temporaria1',
    );
    expect(gateway.loadAuthorizationContext).toHaveBeenCalledWith(user.id);
  });

  it('usa a mesma mensagem para username inválido, conta inexistente e conta desativada', async () => {
    await expect(service.login('x', 'Password1')).rejects.toMatchObject({
      message: genericLoginError,
    });

    vi.mocked(gateway.signIn).mockRejectedValueOnce(new Error('not found'));
    await expect(
      service.login('desconhecido', 'Password1'),
    ).rejects.toMatchObject({ message: genericLoginError });

    vi.mocked(gateway.loadAuthorizationContext).mockRejectedValueOnce(
      new Error('inactive'),
    );
    await expect(
      service.login('tesoureiro.a', 'Password1'),
    ).rejects.toMatchObject({ message: genericLoginError });
  });

  it('recupera uma sessão persistida válida', async () => {
    await expect(service.recoverSession()).resolves.toBe(user);
  });

  it('descarta uma sessão expirada', async () => {
    vi.mocked(gateway.getSession).mockResolvedValueOnce({
      userId: user.id,
      expiresAt: 999,
    });

    await expect(service.recoverSession()).resolves.toBeNull();
    expect(gateway.signOut).toHaveBeenCalledOnce();
  });

  it('termina a sessão se o utilizador for desativado depois do login', async () => {
    vi.mocked(gateway.loadAuthorizationContext).mockRejectedValueOnce(
      new Error('inactive'),
    );

    await expect(service.refreshAuthorizationContext()).resolves.toBeNull();
    expect(gateway.signOut).toHaveBeenCalledOnce();
  });

  it('executa logout através do adaptador', async () => {
    await service.logout();
    expect(gateway.signOut).toHaveBeenCalledOnce();
  });

  it('valida a password atual e apresenta erros genéricos', async () => {
    await expect(
      service.changePassword({ currentPassword: '', newPassword: 'Nova12' }),
    ).rejects.toEqual(
      new AuthError('password-change-failed', genericPasswordError),
    );

    vi.mocked(gateway.updatePassword).mockRejectedValueOnce(
      new Error('current password invalid'),
    );
    await expect(
      service.changePassword({
        currentPassword: 'Errada1',
        newPassword: 'Nova12',
      }),
    ).rejects.toMatchObject({ message: genericPasswordError });
  });

  it('refresca o contexto após alterar a password obrigatória', async () => {
    const forcedUser = { ...user, mustChangePassword: true };
    vi.mocked(gateway.loadAuthorizationContext)
      .mockResolvedValueOnce(forcedUser)
      .mockResolvedValueOnce(user);

    await service.login('tesoureiro.a', 'Temporaria1');
    await expect(
      service.changePassword({
        currentPassword: 'Temporaria1',
        newPassword: 'Definitiva2',
      }),
    ).resolves.toBe(user);
    expect(gateway.updatePassword).toHaveBeenCalledWith({
      currentPassword: 'Temporaria1',
      newPassword: 'Definitiva2',
    });
  });
});
