import { createSupabaseTreasuryGateway } from '@/domains/treasury/infrastructure/supabaseTreasuryGateway';
import { TreasuryService } from '@/domains/treasury/services/TreasuryService';
import { appEnv, getSupabasePublicConfiguration } from '@/shared/config/env';

export function createTreasuryService() {
  const configuration = getSupabasePublicConfiguration(appEnv);
  if (!configuration)
    return new TreasuryService({
      loadTotals: () => Promise.reject(new Error('Supabase não configurado.')),
      recordPayment: () =>
        Promise.reject(new Error('Supabase não configurado.')),
      deletePendingFine: () =>
        Promise.reject(new Error('Supabase não configurado.')),
    });
  return new TreasuryService(createSupabaseTreasuryGateway(configuration));
}
