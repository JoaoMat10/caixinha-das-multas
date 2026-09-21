import { describe, expect, it, vi } from 'vitest';

import type { DashboardGateway } from '@/domains/dashboard/contracts/dashboard';
import { DashboardService } from '@/domains/dashboard/services/DashboardService';

describe('DashboardService', () => {
  it('conta estados sem incluir multas pagas na dívida fornecida pelo contrato seguro', async () => {
    const gateway: DashboardGateway = {
      loadSnapshot: vi.fn().mockResolvedValue({
        member: {
          id: 'member',
          displayName: 'Membro',
          avatarUrl: null,
          memberType: 'staff',
          shirtNumber: null,
          staffFunction: 'Adjunto',
          isCaptain: false,
        },
        fineCount: 2,
        totalFinedCents: 1500,
        totalPaidCents: 500,
        totalDebtCents: 1000,
        fines: [
          {
            id: 'pending',
            categoryName: 'Atraso',
            baseAmountCents: 500,
            multiplier: 2,
            finalAmountCents: 1000,
            occurredAt: '2026-09-20T12:00:00Z',
            notes: null,
            status: 'pending',
          },
          {
            id: 'paid',
            categoryName: 'Material',
            baseAmountCents: 500,
            multiplier: 1,
            finalAmountCents: 500,
            occurredAt: '2026-09-19T12:00:00Z',
            notes: null,
            status: 'paid',
          },
        ],
      }),
    };
    const result = await new DashboardService(gateway).load('season', 'member');
    expect(result.balance).toEqual({
      fineCount: 2,
      pendingCount: 1,
      paidCount: 1,
      totalFinedCents: 1500,
      totalPaidCents: 500,
      totalDebtCents: 1000,
    });
    expect(result.pendingFines.map(({ id }) => id)).toEqual(['pending']);
    expect(result.paidFines.map(({ id }) => id)).toEqual(['paid']);
  });
});
