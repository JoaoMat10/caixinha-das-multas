import { createSupabaseAuthGateway } from '@/domains/auth/infrastructure/supabaseAuthGateway';
import { UnavailableAuthGateway } from '@/domains/auth/infrastructure/unavailableAuthGateway';
import { AuthService } from '@/domains/auth/services/AuthService';
import { appEnv, getSupabasePublicConfiguration } from '@/shared/config/env';

export function createAuthService() {
  const configuration = getSupabasePublicConfiguration(appEnv);
  const gateway = configuration
    ? createSupabaseAuthGateway(configuration)
    : new UnavailableAuthGateway();

  return new AuthService(gateway);
}
