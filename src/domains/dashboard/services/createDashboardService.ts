import { createSupabaseDashboardGateway } from '@/domains/dashboard/infrastructure/supabaseDashboardGateway';
import { DashboardService } from '@/domains/dashboard/services/DashboardService';
import { appEnv, getSupabasePublicConfiguration } from '@/shared/config/env';

export function createDashboardService() {
  const configuration = getSupabasePublicConfiguration(appEnv);
  if (!configuration)
    return new DashboardService({
      loadSnapshot: () =>
        Promise.reject(new Error('Supabase não configurado.')),
    });
  return new DashboardService(createSupabaseDashboardGateway(configuration));
}
