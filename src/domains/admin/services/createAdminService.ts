import { createSupabaseAdminGateway } from '@/domains/admin/infrastructure/supabaseAdminGateway';
import { UnavailableAdminGateway } from '@/domains/admin/infrastructure/unavailableAdminGateway';
import { AdminService } from '@/domains/admin/services/AdminService';
import { appEnv, getSupabasePublicConfiguration } from '@/shared/config/env';

export function createAdminService() {
  const configuration = getSupabasePublicConfiguration(appEnv);
  return new AdminService(
    configuration
      ? createSupabaseAdminGateway(configuration)
      : new UnavailableAdminGateway(),
  );
}
