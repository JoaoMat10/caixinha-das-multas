import { describe, expect, it } from 'vitest';

import { previousClosedMonthInLisbon } from '@/domains/fines/rules/monthlyCommission';

describe('mês fechado da comissão', () => {
  it('disponibiliza setembro logo no início de outubro em Lisboa', () => {
    expect(previousClosedMonthInLisbon(new Date('2026-09-30T23:15:00Z'))).toBe(
      '2026-09',
    );
  });

  it('atravessa corretamente a mudança de ano', () => {
    expect(previousClosedMonthInLisbon(new Date('2027-01-01T12:00:00Z'))).toBe(
      '2026-12',
    );
  });
});
