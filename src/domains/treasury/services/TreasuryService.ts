import type {
  RecordPayment,
  TreasuryGateway,
} from '@/domains/treasury/contracts/treasury';

export class TreasuryService {
  constructor(private readonly gateway: TreasuryGateway) {}

  loadTotals(seasonId: string) {
    return this.gateway.loadTotals(seasonId);
  }

  recordPayment(input: RecordPayment) {
    if (
      !input.memberId ||
      !input.idempotencyKey ||
      input.fineIds.length === 0 ||
      new Set(input.fineIds).size !== input.fineIds.length
    )
      throw new Error('Seleciona multas únicas de um membro.');
    return this.gateway.recordPayment(input);
  }

  deletePendingFine(fineId: string) {
    if (!fineId) throw new Error('Multa inválida.');
    return this.gateway.deletePendingFine(fineId);
  }
}
