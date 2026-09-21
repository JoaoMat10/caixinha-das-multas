export type TreasuryTotals = {
  seasonId: string;
  fineCount: number;
  totalFinedCents: number;
  totalReceivedCents: number;
  totalDebtCents: number;
};

export type PaymentAction = 'paid' | 'reopened';

export type RecordPayment = {
  memberId: string;
  fineIds: string[];
  action: PaymentAction;
  idempotencyKey: string;
};

export type PaymentBatch = {
  id: string;
  seasonId: string;
  memberId: string;
  action: PaymentAction;
  calculatedTotalCents: number;
};

export interface TreasuryGateway {
  loadTotals(seasonId: string): Promise<TreasuryTotals>;
  recordPayment(input: RecordPayment): Promise<PaymentBatch>;
  deletePendingFine(fineId: string): Promise<void>;
}
