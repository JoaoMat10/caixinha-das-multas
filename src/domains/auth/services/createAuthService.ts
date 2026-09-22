import type {
  AuthGateway,
  AuthSessionEvent,
  PasswordChange,
} from '@/domains/auth/contracts/auth';
import { UnavailableAuthGateway } from '@/domains/auth/infrastructure/unavailableAuthGateway';
import { AuthService } from '@/domains/auth/services/AuthService';
import {
  appEnv,
  getSupabasePublicConfiguration,
  type SupabasePublicConfiguration,
} from '@/shared/config/env';

class LazySupabaseAuthGateway implements AuthGateway {
  private readonly gateway: Promise<AuthGateway>;

  constructor(configuration: SupabasePublicConfiguration) {
    this.gateway =
      import('@/domains/auth/infrastructure/supabaseAuthGateway').then(
        ({ createSupabaseAuthGateway }) =>
          createSupabaseAuthGateway(configuration),
      );
  }

  async signIn(technicalEmail: string, password: string) {
    return (await this.gateway).signIn(technicalEmail, password);
  }

  async getSession() {
    return (await this.gateway).getSession();
  }

  async loadAuthorizationContext(userId: string) {
    return (await this.gateway).loadAuthorizationContext(userId);
  }

  async updatePassword(change: PasswordChange) {
    return (await this.gateway).updatePassword(change);
  }

  async signOut() {
    return (await this.gateway).signOut();
  }

  onSessionEvent(listener: (event: AuthSessionEvent) => void) {
    let active = true;
    let unsubscribe: () => void = () => undefined;
    void this.gateway.then((gateway) => {
      if (active) unsubscribe = gateway.onSessionEvent(listener);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }
}

export function createAuthService() {
  const configuration = getSupabasePublicConfiguration(appEnv);
  const gateway = configuration
    ? new LazySupabaseAuthGateway(configuration)
    : new UnavailableAuthGateway();

  return new AuthService(gateway);
}
