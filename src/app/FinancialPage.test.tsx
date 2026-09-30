import { screen, within } from '@testing-library/react';
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
import type {
  ApplyFine,
  Fine,
  FineCategory,
  FineFilters,
  FineMember,
  FinesGateway,
  SaveFineCategory,
} from '@/domains/fines/contracts/fines';
import { FinesService } from '@/domains/fines/services/FinesService';
import type {
  RecordPayment,
  TreasuryGateway,
} from '@/domains/treasury/contracts/treasury';
import { TreasuryService } from '@/domains/treasury/services/TreasuryService';
import { render } from '@/test/test-utils';

const seasonId = '30000000-0000-4000-8000-000000000001';
const memberId = '40000000-0000-4000-8000-000000000002';
const categoryId = '50000000-0000-4000-8000-000000000001';
const treasurer: AuthenticatedUser = {
  id: '00000000-0000-4000-8000-000000000002',
  username: 'tesoureiro',
  displayName: 'Tesoureiro',
  avatarPath: null,
  mustChangePassword: false,
  isAppAdmin: false,
  memberships: [
    {
      id: '40000000-0000-4000-8000-000000000001',
      seasonId,
      seasonName: '2026/27',
      seasonStatus: 'active',
      teamId: '20000000-0000-4000-8000-000000000001',
      teamName: 'Clube A',
      memberType: 'player',
      roles: ['treasurer'],
    },
  ],
};
const category: FineCategory = {
  id: categoryId,
  seasonId,
  name: 'Atraso',
  description: null,
  baseAmountCents: 500,
  amountPerMinuteCents: null,
  isActive: true,
  displayOrder: 1,
};
const variableCategory: FineCategory = {
  ...category,
  id: '50000000-0000-4000-8000-000000000002',
  name: 'Atraso sem justificação',
  baseAmountCents: 300,
  amountPerMinuteCents: 10,
  displayOrder: 2,
};
const member: FineMember = {
  id: memberId,
  displayName: 'Capitão',
  memberType: 'player',
  shirtNumber: 10,
  staffFunction: null,
  status: 'active',
  isCaptain: true,
  isTreasurer: false,
};
const initialFine: Fine = {
  id: '60000000-0000-4000-8000-000000000001',
  seasonId,
  seasonMemberId: memberId,
  categoryNameSnapshot: 'Atraso',
  baseAmountCentsSnapshot: 500,
  amountPerMinuteCentsSnapshot: null,
  minutes: 0,
  multiplier: 2,
  finalAmountCents: 1000,
  occurredAt: '2026-09-11T12:00:00Z',
  notes: null,
  status: 'pending',
  hasEverBeenPaid: false,
};

function renderFinancial(path: string) {
  let fineRows: Fine[] = [
    initialFine,
    { ...initialFine, id: '60000000-0000-4000-8000-000000000002' },
  ];
  let categories: FineCategory[] = [category, variableCategory];
  const finesGateway: FinesGateway = {
    loadCategories: vi.fn(() => Promise.resolve(categories)),
    loadMembers: vi.fn(() => Promise.resolve([member])),
    loadFines: vi.fn((filters: FineFilters) => {
      const selected = fineRows.filter(
        (fine) =>
          fine.seasonId === filters.seasonId &&
          (!filters.memberId || fine.seasonMemberId === filters.memberId) &&
          (!filters.status || fine.status === filters.status),
      );
      return Promise.resolve({
        fines: selected.slice(filters.page * 50, filters.page * 50 + 50),
        total: selected.length,
      });
    }),
    saveCategory: vi.fn((input: SaveFineCategory) => {
      const saved: FineCategory = {
        ...category,
        ...input,
        id: input.id ?? crypto.randomUUID(),
      };
      categories = [
        ...categories.filter((item) => item.id !== saved.id),
        saved,
      ];
      return Promise.resolve(saved);
    }),
    applyFine: vi.fn((input: ApplyFine) => {
      const applied: Fine = {
        ...initialFine,
        id: crypto.randomUUID(),
        seasonMemberId: input.memberId,
        occurredAt: input.occurredAt,
        notes: input.notes || null,
      };
      fineRows = [...fineRows, applied];
      return Promise.resolve(applied);
    }),
  };
  const treasuryGateway: TreasuryGateway = {
    loadTotals: vi.fn(() =>
      Promise.resolve({
        seasonId,
        fineCount: fineRows.length,
        totalFinedCents: fineRows.reduce(
          (sum, fine) => sum + fine.finalAmountCents,
          0,
        ),
        totalReceivedCents: fineRows
          .filter((fine) => fine.status === 'paid')
          .reduce((sum, fine) => sum + fine.finalAmountCents, 0),
        totalDebtCents: fineRows
          .filter((fine) => fine.status === 'pending')
          .reduce((sum, fine) => sum + fine.finalAmountCents, 0),
      }),
    ),
    recordPayment: vi.fn((input: RecordPayment) => {
      const selected = fineRows.filter((fine) =>
        input.fineIds.includes(fine.id),
      );
      fineRows = fineRows.map((fine) =>
        input.fineIds.includes(fine.id)
          ? {
              ...fine,
              status: input.action === 'paid' ? 'paid' : 'pending',
              hasEverBeenPaid: true,
            }
          : fine,
      );
      return Promise.resolve({
        id: crypto.randomUUID(),
        seasonId,
        memberId: input.memberId,
        action: input.action,
        calculatedTotalCents: selected.reduce(
          (sum, fine) => sum + fine.finalAmountCents,
          0,
        ),
      });
    }),
    deletePendingFine: vi.fn((fineId: string) => {
      fineRows = fineRows.filter((fine) => fine.id !== fineId);
      return Promise.resolve();
    }),
  };
  const authGateway: AuthGateway = {
    signIn: vi.fn(),
    getSession: vi
      .fn()
      .mockResolvedValue({ userId: treasurer.id, expiresAt: 2_000_000 }),
    loadAuthorizationContext: vi.fn().mockResolvedValue(treasurer),
    updatePassword: vi.fn(),
    signOut: vi.fn(),
    onSessionEvent: vi.fn().mockReturnValue(() => undefined),
  };
  render(
    <AppProviders
      authService={new AuthService(authGateway, () => 1_000)}
      finesService={new FinesService(finesGateway)}
      treasuryService={new TreasuryService(treasuryGateway)}
      queryClient={createAppQueryClient()}
    >
      <RouterProvider router={createTestRouter([path])} />
    </AppProviders>,
  );
  return { finesGateway, treasuryGateway };
}

describe('interface de multas e tesouraria', () => {
  it('mostra base, multiplicador e total antes de aplicar e chama a RPC sem valor livre', async () => {
    const user = userEvent.setup();
    const { finesGateway } = renderFinancial('/multas');
    await screen.findByRole('heading', { name: 'Aplicar multa' });
    await screen.findByRole('option', { name: /Capitão/ });
    await user.selectOptions(screen.getByLabelText('Membro'), memberId);
    await user.selectOptions(screen.getByLabelText('Categoria'), categoryId);
    await user.click(
      screen.getByRole('button', { name: 'Ver cálculo antes de confirmar' }),
    );
    const confirmation = screen.getByRole('heading', {
      name: 'Confirmar multa',
    }).parentElement;
    expect(confirmation).toHaveTextContent('Valor base: 5,00');
    expect(confirmation).toHaveTextContent('multiplicador: 2x');
    expect(confirmation).toHaveTextContent('Total: 10,00');
    await user.click(
      screen.getByRole('button', { name: 'Confirmar aplicação' }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Multa aplicada',
    );
    expect(finesGateway.applyFine).toHaveBeenCalledOnce();
    expect(finesGateway.applyFine).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId,
        categoryId,
        idempotencyKey: expect.any(String),
      }),
    );
  });

  it('pede minutos e calcula base mais acréscimo antes do multiplicador', async () => {
    const user = userEvent.setup();
    const { finesGateway } = renderFinancial('/multas');
    await screen.findByRole('heading', { name: 'Aplicar multa' });
    await screen.findByRole('option', { name: /Capitão/ });
    await user.selectOptions(screen.getByLabelText('Membro'), memberId);
    await user.selectOptions(
      screen.getByLabelText('Categoria'),
      variableCategory.id,
    );
    await user.type(screen.getByLabelText('Minutos de atraso'), '7');
    await user.click(
      screen.getByRole('button', { name: 'Ver cálculo antes de confirmar' }),
    );
    const confirmation = screen.getByRole('heading', {
      name: 'Confirmar multa',
    }).parentElement;
    expect(confirmation).toHaveTextContent('Valor base: 3,00');
    expect(confirmation).toHaveTextContent('7 min × 0,10');
    expect(confirmation).toHaveTextContent('Total: 7,40');
    await user.click(
      screen.getByRole('button', { name: 'Confirmar aplicação' }),
    );
    expect(finesGateway.applyFine).toHaveBeenCalledWith(
      expect.objectContaining({ minutes: 7 }),
    );
  });

  it('filtra um membro, liquida um batch, reabre e elimina apenas uma multa nunca paga', async () => {
    const user = userEvent.setup();
    const { treasuryGateway } = renderFinancial('/tesouraria');
    await screen.findByRole('heading', { name: 'Multas da época' });
    await screen.findByRole('option', { name: /Capitão/ });
    await user.selectOptions(screen.getByLabelText('Membro'), memberId);
    const checkboxes = await screen.findAllByRole('checkbox', {
      name: /Selecionar multa/,
    });
    if (!checkboxes[0]) throw new Error('Multa pendente não encontrada.');
    await user.click(checkboxes[0]);
    await user.click(screen.getByRole('button', { name: 'Liquidar seleção' }));
    expect(
      await screen.findByText(/Total calculado pelo servidor: 10,00/),
    ).toBeInTheDocument();
    expect(treasuryGateway.recordPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId,
        fineIds: [initialFine.id],
        action: 'paid',
      }),
    );
    expect(
      screen.getByText('Recebido · saldo disponível').parentElement,
    ).toHaveTextContent('10,00');
    await user.click(await screen.findByRole('button', { name: 'Reabrir' }));
    expect(
      screen.getByRole('dialog', { name: 'Reabrir multa?' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reabrir multa' }));
    expect(
      await screen.findByText(/Valor retirado do recebido/),
    ).toBeInTheDocument();
    expect(treasuryGateway.recordPayment).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'reopened' }),
    );
    expect(
      screen.getByText('Recebido · saldo disponível').parentElement,
    ).toHaveTextContent('0,00');
    const list = screen.getByRole('heading', {
      name: 'Multas da época',
    }).parentElement;
    expect(
      within(list!).getAllByRole('button', { name: 'Eliminar' }),
    ).toHaveLength(1);
    await user.click(within(list!).getByRole('button', { name: 'Eliminar' }));
    expect(
      screen.getByRole('dialog', { name: 'Eliminar multa?' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Eliminar multa' }));
    expect(
      await screen.findByText('Multa pendente eliminada.'),
    ).toBeInTheDocument();
    expect(treasuryGateway.deletePendingFine).toHaveBeenCalledWith(
      '60000000-0000-4000-8000-000000000002',
    );
  });
});
