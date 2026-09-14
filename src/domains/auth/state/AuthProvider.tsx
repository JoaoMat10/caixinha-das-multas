import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import type { AuthenticatedUser } from '@/domains/auth/contracts/auth';
import type { AuthService } from '@/domains/auth/services/AuthService';
import {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
} from '@/domains/auth/state/authContext';

function authenticatedStatus(user: AuthenticatedUser): AuthStatus {
  return user.mustChangePassword ? 'must-change-password' : 'authenticated';
}

export function AuthProvider({
  children,
  service,
}: PropsWithChildren<{ service: AuthService }>) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const applyUser = useCallback((nextUser: AuthenticatedUser | null) => {
    setUser(nextUser);
    setStatus(nextUser ? authenticatedStatus(nextUser) : 'anonymous');
    setError(null);
  }, []);

  const recover = useCallback(async () => {
    try {
      applyUser(await service.recoverSession());
    } catch (recoverError) {
      setUser(null);
      setStatus('configuration-error');
      setError(
        recoverError instanceof Error
          ? recoverError.message
          : 'A autenticação não está disponível.',
      );
    }
  }, [applyUser, service]);

  const refresh = useCallback(async () => {
    applyUser(await service.refreshAuthorizationContext());
  }, [applyUser, service]);

  useEffect(() => {
    let active = true;

    const recoverIfActive = async () => {
      if (active) await recover();
    };

    void recoverIfActive();
    const unsubscribe = service.onSessionEvent((event) => {
      if (!active || event === 'initial') return;
      if (event === 'signed-out') {
        applyUser(null);
        return;
      }
      void recoverIfActive();
    });

    const validateSession = () => void recoverIfActive();
    const interval = window.setInterval(validateSession, 60_000);
    window.addEventListener('focus', validateSession);

    return () => {
      active = false;
      unsubscribe();
      window.clearInterval(interval);
      window.removeEventListener('focus', validateSession);
    };
  }, [applyUser, recover, service]);

  const login = useCallback(
    async (username: string, password: string) => {
      setIsBusy(true);
      setError(null);
      try {
        applyUser(await service.login(username, password));
      } catch (loginError) {
        setError(
          loginError instanceof Error
            ? loginError.message
            : 'Não foi possível iniciar sessão.',
        );
        throw loginError;
      } finally {
        setIsBusy(false);
      }
    },
    [applyUser, service],
  );

  const logout = useCallback(async () => {
    setIsBusy(true);
    try {
      await service.logout();
      applyUser(null);
    } finally {
      setIsBusy(false);
    }
  }, [applyUser, service]);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      setIsBusy(true);
      setError(null);
      try {
        applyUser(
          await service.changePassword({ currentPassword, newPassword }),
        );
      } catch (passwordError) {
        setError(
          passwordError instanceof Error
            ? passwordError.message
            : 'Não foi possível alterar a password.',
        );
        throw passwordError;
      } finally {
        setIsBusy(false);
      }
    },
    [applyUser, service],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      error,
      isBusy,
      login,
      logout,
      changePassword,
      refresh,
    }),
    [changePassword, error, isBusy, login, logout, refresh, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
