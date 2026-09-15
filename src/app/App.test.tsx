import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AppProviders } from '@/app/AppProviders';
import { createAppQueryClient } from '@/app/queryClient';
import { createTestRouter } from '@/app/router';
import type {
  AuthGateway,
  AuthenticatedUser,
} from '@/domains/auth/contracts/auth';
import { AuthService } from '@/domains/auth/services/AuthService';
import { render } from '@/test/test-utils';

const member: AuthenticatedUser = {
  id: '00000000-0000-4000-8000-000000000003',
  username: 'jogador.a',
  displayName: 'Jogador A',
  avatarPath: null,
  mustChangePassword: false,
  isAppAdmin: false,
  memberships: [
    {
      id: '40000000-0000-4000-8000-000000000004',
      seasonId: '30000000-0000-4000-8000-000000000002',
      seasonName: '2026/27',
      seasonStatus: 'active',
      teamId: '20000000-0000-4000-8000-000000000001',
      teamName: 'Clube A',
      memberType: 'player',
      roles: [],
    },
  ],
};

function createGateway(
  initialUser: AuthenticatedUser | null,
  overrides: Partial<AuthGateway> = {},
): AuthGateway {
  return {
    signIn: vi.fn().mockResolvedValue({ userId: member.id, expiresAt: 2_000 }),
    getSession: vi
      .fn()
      .mockResolvedValue(
        initialUser ? { userId: initialUser.id, expiresAt: 2_000 } : null,
      ),
    loadAuthorizationContext: vi.fn().mockResolvedValue(initialUser ?? member),
    updatePassword: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    onSessionEvent: vi.fn().mockReturnValue(() => undefined),
    ...overrides,
  };
}

function renderRoute(
  path: string,
  gateway: AuthGateway,
  now: () => number = () => 1_000_000,
) {
  const router = createTestRouter([path]);
  render(
    <AppProviders
      authService={new AuthService(gateway, now)}
      queryClient={createAppQueryClient()}
    >
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

describe('autenticação e rotas da aplicação', () => {
  it('protege uma rota privada e apresenta apenas username e password', async () => {
    renderRoute('/painel', createGateway(null));

    expect(
      await screen.findByRole('heading', { name: 'Entrar' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  });

  it('faz login e condiciona as tabs ao contexto autorizado', async () => {
    const user = userEvent.setup();
    renderRoute('/entrar', createGateway(null));

    await screen.findByRole('heading', { name: 'Entrar' });
    await user.type(screen.getByLabelText('Username'), ' Jogador.A ');
    await user.type(screen.getByLabelText('Password'), 'Temporaria1');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(
      await screen.findByRole('heading', {
        name: 'Painel preparado, sem dados simulados',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Painel' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mural' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Password' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Tesouraria' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Administração' })).toBeNull();
  });

  it('não permite enumerar contas através do erro de login', async () => {
    const user = userEvent.setup();
    const gateway = createGateway(null, {
      signIn: vi.fn().mockRejectedValue(new Error('User not found')),
    });
    renderRoute('/entrar', gateway);

    await screen.findByRole('heading', { name: 'Entrar' });
    await user.type(screen.getByLabelText('Username'), 'desconhecido');
    await user.type(screen.getByLabelText('Password'), 'Errada1');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível iniciar sessão. Confirma os dados e tenta novamente.',
    );
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled();
  });

  it('bloqueia toda a aplicação até substituir a password temporária', async () => {
    const user = userEvent.setup();
    const forced = { ...member, mustChangePassword: true };
    const loadAuthorizationContext = vi
      .fn()
      .mockResolvedValueOnce(forced)
      .mockResolvedValueOnce(member);
    renderRoute('/painel', createGateway(forced, { loadAuthorizationContext }));

    expect(
      await screen.findByRole('heading', { name: 'Define uma nova password' }),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText('Password atual'), 'Temporaria1');
    await user.type(screen.getByLabelText('Nova password'), 'Definitiva2');
    await user.type(
      screen.getByLabelText('Confirmar nova password'),
      'Definitiva2',
    );
    await user.click(
      screen.getByRole('button', { name: 'Guardar nova password' }),
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Painel preparado, sem dados simulados',
      }),
    ).toBeInTheDocument();
  });

  it('impede um membro de abrir rotas de tesouraria', async () => {
    renderRoute('/tesouraria', createGateway(member));
    expect(
      await screen.findByRole('heading', {
        name: 'Ainda não tens acesso a uma área da aplicação.',
      }),
    ).toBeInTheDocument();
  });

  it('impede um membro de ver ou abrir a Administração', async () => {
    renderRoute('/administracao', createGateway(member));
    expect(
      await screen.findByRole('heading', {
        name: 'Ainda não tens acesso a uma área da aplicação.',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Administração' })).toBeNull();
  });

  it('termina a sessão através do logout', async () => {
    const user = userEvent.setup();
    const gateway = createGateway(member);
    renderRoute('/painel', gateway);

    await user.click(await screen.findByRole('button', { name: 'Sair' }));

    expect(
      await screen.findByRole('heading', { name: 'Entrar' }),
    ).toBeInTheDocument();
    expect(gateway.signOut).toHaveBeenCalledOnce();
  });

  it('apresenta uma página de erro para uma rota desconhecida autenticada', async () => {
    renderRoute('/rota-inexistente', createGateway(member));
    expect(
      await screen.findByRole('heading', { name: /página não encontrada/i }),
    ).toBeInTheDocument();
  });
});
