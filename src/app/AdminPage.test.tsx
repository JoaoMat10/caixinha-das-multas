import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AppProviders } from '@/app/AppProviders';
import { createAppQueryClient } from '@/app/queryClient';
import { createTestRouter } from '@/app/router';
import type {
  AdminGateway,
  AdminOverview,
} from '@/domains/admin/contracts/admin';
import { AdminService } from '@/domains/admin/services/AdminService';
import type {
  AuthGateway,
  AuthenticatedUser,
} from '@/domains/auth/contracts/auth';
import { AuthService } from '@/domains/auth/services/AuthService';
import { render } from '@/test/test-utils';

const owner: AuthenticatedUser = {
  id: '00000000-0000-4000-8000-000000000001',
  username: 'owner',
  displayName: 'Owner',
  avatarPath: null,
  mustChangePassword: false,
  isAppAdmin: true,
  memberships: [],
};
const overview: AdminOverview = {
  users: [
    {
      id: owner.id,
      username: owner.username,
      displayName: owner.displayName,
      avatarPath: null,
      mustChangePassword: false,
      isActive: true,
      createdAt: '2026-09-15T10:00:00Z',
    },
  ],
  teams: [],
  seasons: [],
  members: [],
  auditEvents: [
    {
      id: crypto.randomUUID(),
      actorUserId: owner.id,
      actorDisplayName: owner.displayName,
      action: 'team.created',
      entityType: 'team',
      entityId: null,
      teamId: null,
      seasonId: null,
      metadata: {},
      occurredAt: '2026-09-15T10:00:00Z',
    },
  ],
};

function authGateway(): AuthGateway {
  return {
    signIn: vi.fn(),
    getSession: vi
      .fn()
      .mockResolvedValue({ userId: owner.id, expiresAt: 2_000_000 }),
    loadAuthorizationContext: vi.fn().mockResolvedValue(owner),
    updatePassword: vi.fn(),
    signOut: vi.fn(),
    onSessionEvent: vi.fn().mockReturnValue(() => undefined),
  };
}

function adminGateway(): AdminGateway {
  return {
    loadOverview: vi.fn().mockResolvedValue(overview),
    createUser: vi
      .fn()
      .mockResolvedValue({ temporaryPassword: 'Aa1temporaria' }),
    updateUser: vi.fn(),
    setUserActive: vi.fn(),
    resetPassword: vi
      .fn()
      .mockResolvedValue({ temporaryPassword: 'Aa1reposta' }),
    saveTeam: vi.fn(),
    saveSeason: vi.fn(),
    saveMember: vi.fn(),
    uploadUserPhoto: vi.fn(),
    removeUserPhoto: vi.fn(),
  };
}

function renderAdmin(adapter = adminGateway()) {
  const router = createTestRouter(['/administracao']);
  render(
    <AppProviders
      adminService={new AdminService(adapter)}
      authService={new AuthService(authGateway(), () => 1_000_000)}
      queryClient={createAppQueryClient()}
    >
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return adapter;
}

describe('Painel Super Admin', () => {
  it('apresenta exclusivamente ao Owner todas as secções administrativas', async () => {
    const user = userEvent.setup();
    renderAdmin();
    expect(
      await screen.findByRole('heading', { name: 'Administração' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Utilizadores ativos')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Auditoria' }));
    expect(screen.getByText('Equipa criada')).toBeInTheDocument();
    expect(screen.queryByText(/email técnico/i)).not.toBeInTheDocument();
  });

  it('cria uma conta e mostra a password temporária apenas na resposta', async () => {
    const user = userEvent.setup();
    const adapter = renderAdmin();
    await screen.findByRole('heading', { name: 'Administração' });
    await user.click(screen.getByRole('button', { name: 'Utilizadores' }));
    await user.type(screen.getByLabelText('Username'), 'novo.jogador');
    await user.type(screen.getByLabelText('Nome apresentado'), 'Novo Jogador');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(await screen.findByText('Aa1temporaria')).toBeInTheDocument();
    expect(adapter.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'novo.jogador',
        displayName: 'Novo Jogador',
      }),
    );
  });

  it('repete a mesma chave quando a resposta de reposição falha', async () => {
    const user = userEvent.setup();
    const adapter = adminGateway();
    vi.mocked(adapter.resetPassword)
      .mockRejectedValueOnce(new Error('Ligação interrompida.'))
      .mockResolvedValueOnce({ temporaryPassword: 'Aa1recuperada' });
    renderAdmin(adapter);
    await screen.findByRole('heading', { name: 'Administração' });
    await user.click(screen.getByRole('button', { name: 'Utilizadores' }));
    const resetButton = screen.getByRole('button', { name: 'Repor password' });

    await user.click(resetButton);
    expect(
      await screen.findByText('Ligação interrompida.'),
    ).toBeInTheDocument();
    await user.click(resetButton);
    expect(await screen.findByText('Aa1recuperada')).toBeInTheDocument();

    const firstInput = vi.mocked(adapter.resetPassword).mock.calls[0]?.[0];
    const secondInput = vi.mocked(adapter.resetPassword).mock.calls[1]?.[0];
    expect(firstInput).toBeDefined();
    expect(secondInput).toBeDefined();
    if (!firstInput || !secondInput) throw new Error('Chamadas em falta.');
    expect(secondInput.idempotencyKey).toBe(firstInput.idempotencyKey);
  });
});
