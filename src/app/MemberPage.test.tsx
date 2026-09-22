import { screen, within } from '@testing-library/react';
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
import type {
  DashboardGateway,
  DashboardSnapshot,
} from '@/domains/dashboard/contracts/dashboard';
import { DashboardService } from '@/domains/dashboard/services/DashboardService';
import type {
  LeaderboardGateway,
  LeaderboardMember,
} from '@/domains/leaderboard/contracts/leaderboard';
import { LeaderboardService } from '@/domains/leaderboard/services/LeaderboardService';
import { render } from '@/test/test-utils';

const seasonId = '30000000-0000-4000-8000-000000000001';
const memberId = '40000000-0000-4000-8000-000000000003';
const member: AuthenticatedUser = {
  id: '00000000-0000-4000-8000-000000000004',
  username: 'capitao.a',
  displayName: 'Carlos Capitão',
  avatarPath: null,
  mustChangePassword: false,
  isAppAdmin: true,
  memberships: [
    {
      id: memberId,
      seasonId,
      seasonName: '2026/27',
      seasonStatus: 'active',
      teamId: '20000000-0000-4000-8000-000000000001',
      teamName: 'Clube Azul',
      memberType: 'player',
      roles: ['captain', 'treasurer'],
    },
  ],
};

const dashboardSnapshot: DashboardSnapshot = {
  member: {
    id: memberId,
    displayName: 'Carlos Capitão',
    avatarUrl: null,
    memberType: 'player',
    shirtNumber: 10,
    staffFunction: null,
    isCaptain: true,
  },
  fineCount: 2,
  totalFinedCents: 1250,
  totalPaidCents: 250,
  totalDebtCents: 1000,
  fines: [
    {
      id: '60000000-0000-4000-8000-000000000001',
      categoryName: 'Atraso histórico',
      baseAmountCents: 500,
      multiplier: 2,
      finalAmountCents: 1000,
      occurredAt: '2026-09-20T12:00:00Z',
      notes: 'Treino da manhã',
      status: 'pending',
    },
    {
      id: '60000000-0000-4000-8000-000000000002',
      categoryName: 'Material',
      baseAmountCents: 250,
      multiplier: 1,
      finalAmountCents: 250,
      occurredAt: '2026-09-10T12:00:00Z',
      notes: null,
      status: 'paid',
    },
  ],
};

function authService() {
  const gateway: AuthGateway = {
    signIn: vi.fn(),
    getSession: vi
      .fn()
      .mockResolvedValue({ userId: member.id, expiresAt: 2_000_000 }),
    loadAuthorizationContext: vi.fn().mockResolvedValue(member),
    updatePassword: vi.fn(),
    signOut: vi.fn(),
    onSessionEvent: vi.fn().mockReturnValue(() => undefined),
  };
  return new AuthService(gateway, () => 1_000);
}

function renderMemberPage(
  path: string,
  dashboardGateway: DashboardGateway,
  leaderboardGateway: LeaderboardGateway = { loadMembers: vi.fn() },
) {
  render(
    <AppProviders
      authService={authService()}
      dashboardService={new DashboardService(dashboardGateway)}
      leaderboardService={new LeaderboardService(leaderboardGateway)}
      queryClient={createAppQueryClient()}
    >
      <RouterProvider router={createTestRouter([path])} />
    </AppProviders>,
  );
}

describe('experiência do membro', () => {
  it('mostra totais, snapshots e separação entre pendentes e pagas', async () => {
    const loadSnapshot = vi.fn().mockResolvedValue(dashboardSnapshot);
    renderMemberPage('/painel', { loadSnapshot });
    expect(
      await screen.findByRole('heading', { name: 'O meu painel' }),
    ).toBeInTheDocument();
    expect(await screen.findByLabelText('Capitão')).toHaveTextContent('C');
    expect(loadSnapshot).toHaveBeenCalledWith(seasonId, memberId);
    expect(screen.getByText('Jogador · camisola 10')).toBeInTheDocument();
    const summary = screen.getByRole('region', { name: 'Resumo pessoal' });
    expect(summary).toHaveTextContent('Dívida atual');
    expect(summary).toHaveTextContent(/10,00/);
    expect(summary).toHaveTextContent('Total histórico');
    expect(summary).toHaveTextContent(/12,50/);
    expect(summary).toHaveTextContent('Total liquidado');
    expect(summary).toHaveTextContent(/2,50/);
    const pending = screen
      .getByRole('heading', {
        name: 'Multas pendentes',
      })
      .closest('section');
    expect(pending).toHaveTextContent('Atraso histórico');
    expect(pending).toHaveTextContent('Valor base5,00');
    expect(pending).toHaveTextContent('Multiplicador2x');
    expect(pending).toHaveTextContent('Treino da manhã');
    const paid = screen
      .getByRole('heading', {
        name: 'Multas pagas',
      })
      .closest('section');
    expect(paid).toHaveTextContent('Material');
    expect(paid).toHaveTextContent('Paga');
    expect(screen.queryByText(/Owner|Super Admin|Tesoureiro/)).toBeNull();
  });

  it('apresenta o estado vazio sem esconder as duas secções', async () => {
    renderMemberPage('/painel', {
      loadSnapshot: vi.fn().mockResolvedValue({
        ...dashboardSnapshot,
        fineCount: 0,
        totalFinedCents: 0,
        totalPaidCents: 0,
        totalDebtCents: 0,
        fines: [],
      }),
    });
    expect(
      await screen.findByText('Ainda não tens multas nesta época.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Não tens multas pendentes nesta época.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Ainda não tens multas pagas nesta época.'),
    ).toBeInTheDocument();
  });

  it('apresenta um erro recuperável', async () => {
    renderMemberPage('/painel', {
      loadSnapshot: vi.fn().mockRejectedValue(new Error('falha controlada')),
    });
    expect(
      await screen.findByRole('alert', undefined, { timeout: 3_000 }),
    ).toHaveTextContent('Não foi possível carregar os dados');
    expect(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    ).toBeInTheDocument();
  });

  it('mantém um estado de carregamento enquanto os dados não chegam', async () => {
    renderMemberPage('/painel', {
      loadSnapshot: vi.fn(
        () => new Promise<DashboardSnapshot>(() => undefined),
      ),
    });
    expect(await screen.findByText('A carregar o teu painel…')).toHaveAttribute(
      'role',
      'status',
    );
  });

  it('ordena os três rankings e distingue jogador, capitão e equipa técnica', async () => {
    const leaderboardMembers: LeaderboardMember[] = [
      {
        id: '1',
        displayName: 'Teresa Treinadora',
        avatarUrl: null,
        memberType: 'staff',
        shirtNumber: null,
        staffFunction: 'Treinadora',
        isCaptain: false,
        fineCount: 2,
        totalFinedCents: 2000,
        totalDebtCents: 0,
      },
      {
        id: '2',
        displayName: 'Carlos Capitão',
        avatarUrl: null,
        memberType: 'player',
        shirtNumber: 10,
        staffFunction: null,
        isCaptain: true,
        fineCount: 1,
        totalFinedCents: 1000,
        totalDebtCents: 1000,
      },
    ];
    renderMemberPage(
      '/mural',
      { loadSnapshot: vi.fn() },
      { loadMembers: vi.fn().mockResolvedValue(leaderboardMembers) },
    );
    const countHeading = await screen.findByRole('heading', {
      name: 'Mais multas',
    });
    const countRanking = countHeading.parentElement;
    expect(within(countRanking!).getAllByRole('listitem')[0]).toHaveTextContent(
      'Teresa Treinadora',
    );
    expect(screen.getAllByText('Equipa técnica · Treinadora').length).toBe(2);
    expect(screen.getAllByLabelText('Capitão').length).toBeGreaterThan(0);
    const debtRanking = screen.getByRole('heading', {
      name: 'Maior dívida atual',
    }).parentElement;
    expect(debtRanking).toHaveTextContent('Carlos Capitão');
    expect(debtRanking).not.toHaveTextContent('Teresa Treinadora');
    expect(screen.queryByText(/Owner|Super Admin|@capitao/)).toBeNull();
  });
});
