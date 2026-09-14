import type {
  AuthGateway,
  AuthSessionEvent,
} from '@/domains/auth/contracts/auth';

const configurationMessage =
  'A autenticação ainda não está configurada neste ambiente.';

export class UnavailableAuthGateway implements AuthGateway {
  signIn(): Promise<never> {
    return Promise.reject(new Error(configurationMessage));
  }

  getSession(): Promise<never> {
    return Promise.reject(new Error(configurationMessage));
  }

  loadAuthorizationContext(): Promise<never> {
    return Promise.reject(new Error(configurationMessage));
  }

  updatePassword(): Promise<never> {
    return Promise.reject(new Error(configurationMessage));
  }

  signOut(): Promise<never> {
    return Promise.reject(new Error(configurationMessage));
  }

  onSessionEvent(listener: (event: AuthSessionEvent) => void) {
    void listener;
    return () => undefined;
  }
}
