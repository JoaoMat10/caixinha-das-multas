import type {
  DashboardData,
  DashboardGateway,
} from '@/domains/dashboard/contracts/dashboard';

export class DashboardService {
  constructor(private readonly gateway: DashboardGateway) {}

  async load(seasonId: string, memberId: string): Promise<DashboardData> {
    if (!seasonId || !memberId)
      throw new Error('Época e membro são obrigatórios.');
    const snapshot = await this.gateway.loadSnapshot(seasonId, memberId);
    const pendingFines = snapshot.fines.filter(
      (fine) => fine.status === 'pending',
    );
    const paidFines = snapshot.fines.filter((fine) => fine.status === 'paid');
    return {
      member: snapshot.member,
      balance: {
        fineCount: snapshot.fineCount,
        pendingCount: pendingFines.length,
        paidCount: paidFines.length,
        totalFinedCents: snapshot.totalFinedCents,
        totalPaidCents: snapshot.totalPaidCents,
        totalDebtCents: snapshot.totalDebtCents,
      },
      pendingFines,
      paidFines,
    };
  }
}
