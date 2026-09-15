import type {
  AuthGateway,
  AuthSessionEvent,
  PasswordChange,
} from '@/domains/auth/contracts/auth';
import { passwordSchema } from '@/domains/auth/rules/password';
import {
  isValidUsername,
  usernameToTechnicalEmail,
} from '@/domains/auth/rules/username';

export const genericLoginError =
  'Não foi possível iniciar sessão. Confirma os dados e tenta novamente.';
export const genericPasswordError =
  'Não foi possível alterar a password. Confirma os dados e tenta novamente.';

export class AuthError extends Error {
  constructor(
    public readonly code:
      | 'login-failed'
      | 'session-expired'
      | 'password-change-failed'
      | 'configuration-failed',
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export class AuthService {
  constructor(
    private readonly gateway: AuthGateway,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async login(username: string, password: string) {
    if (!isValidUsername(username) || password.length === 0) {
      throw new AuthError('login-failed', genericLoginError);
    }

    try {
      const session = await this.gateway.signIn(
        usernameToTechnicalEmail(username),
        password,
      );
      return await this.loadUserForSession(session.userId);
    } catch {
      await this.safeSignOut();
      throw new AuthError('login-failed', genericLoginError);
    }
  }

  async recoverSession() {
    let session;

    try {
      session = await this.gateway.getSession();
    } catch (error) {
      throw new AuthError(
        'configuration-failed',
        error instanceof Error ? error.message : 'Configuração indisponível.',
      );
    }

    if (!session) {
      return null;
    }

    if (session.expiresAt * 1000 <= this.now()) {
      await this.safeSignOut();
      return null;
    }

    try {
      return await this.loadUserForSession(session.userId);
    } catch {
      await this.safeSignOut();
      return null;
    }
  }

  async refreshAuthorizationContext() {
    const session = await this.gateway.getSession();

    if (!session || session.expiresAt * 1000 <= this.now()) {
      await this.safeSignOut();
      return null;
    }

    try {
      return await this.loadUserForSession(session.userId);
    } catch {
      await this.safeSignOut();
      return null;
    }
  }

  async changePassword(change: PasswordChange) {
    if (
      !passwordSchema.safeParse(change.newPassword).success ||
      change.currentPassword.length === 0 ||
      change.currentPassword === change.newPassword
    ) {
      throw new AuthError('password-change-failed', genericPasswordError);
    }

    try {
      await this.gateway.updatePassword(change);
      const user = await this.refreshAuthorizationContext();

      if (!user) {
        throw new Error('A sessão deixou de estar disponível.');
      }

      return user;
    } catch {
      throw new AuthError('password-change-failed', genericPasswordError);
    }
  }

  async logout() {
    await this.gateway.signOut();
  }

  onSessionEvent(listener: (event: AuthSessionEvent) => void) {
    return this.gateway.onSessionEvent(listener);
  }

  private async loadUserForSession(userId: string) {
    const user = await this.gateway.loadAuthorizationContext(userId);

    if (user.id !== userId) {
      throw new Error('Contexto de autorização inconsistente.');
    }

    return user;
  }

  private async safeSignOut() {
    try {
      await this.gateway.signOut();
    } catch {
      // O erro original permanece genérico e a sessão expira no servidor.
    }
  }
}
