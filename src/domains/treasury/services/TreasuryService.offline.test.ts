import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TreasuryGateway } from '@/domains/treasury/contracts/treasury';
import { TreasuryService } from '@/domains/treasury/services/TreasuryService';
import { OFFLINE_WRITE_MESSAGE } from '@/shared/network/requireOnline';

afterEach(() => vi.restoreAllMocks());

describe('escritas financeiras offline', () => {
  it('não chama o gateway quando o dispositivo está sem rede', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const gateway: TreasuryGateway = {
      loadTotals: vi.fn(),
      recordPayment: vi.fn(),
      deletePendingFine: vi.fn(),
    };
    const service = new TreasuryService(gateway);

    expect(() => service.deletePendingFine(crypto.randomUUID())).toThrow(
      OFFLINE_WRITE_MESSAGE,
    );
    expect(gateway.deletePendingFine).not.toHaveBeenCalled();
  });
});
