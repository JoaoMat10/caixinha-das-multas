import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
  const operationVersion = useRef(0);

  const applyUser = useCallback((nextUser: AuthenticatedUser | null) => {
    setUser(nextUser);
    setStatus(nextUser ? authenticatedStatus(nextUser) : 'anonymous');
    setError(null);
  }, []);

  const invalidatePendingOperations = useCallback(() => {
    operationVersion.current += 1;
  }, []);

  const recover = useCallback(async () => {
    const version = ++operationVersion.current;

    try {
      const nextUser = await service.recoverSession();
      if (version === operationVersion.current) applyUser(nextUser);
    } catch (recoverError) {
      if (version !== operationVersion.current) return;
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
    const version = ++operationVersion.current;
    const nextUser = await service.refreshAuthorizationContext();
    if (version === operationVersion.current) applyUser(nextUser);
  }, [applyUser, service]);

  useEffect(() => {
    const scheduledRecoveries = new Set<number>();
    const scheduleRecovery = () => {
      const timeout = window.setTimeout(() => {
        scheduledRecoveries.delete(timeout);
        void recover();
      }, 0);
      scheduledRecoveries.add(timeout);
    };

    scheduleRecovery();
    const unsubscribe = service.onSessionEvent((event) => {
      if (event === 'initial') return;
      if (event === 'signed-out') {
        for (const timeout of scheduledRecoveries) {
          window.clearTimeout(timeout);
        }
        scheduledRecoveries.clear();
        invalidatePendingOperations();
        setUser(null);
        setStatus('anonymous');
        return;
      }
      scheduleRecovery();
    });

    const validateSession = () => void recover();
    const interval = window.setInterval(validateSession, 60_000);
    window.addEventListener('focus', validateSession);

    return () => {
      invalidatePendingOperations();
      for (const timeout of scheduledRecoveries) {
        window.clearTimeout(timeout);
      }
      unsubscribe();
      window.clearInterval(interval);
      window.removeEventListener('focus', validateSession);
    };
  }, [applyUser, invalidatePendingOperations, recover, service]);

  const login = useCallback(
    async (username: string, password: string) => {
      setIsBusy(true);
      setError(null);
      const version = ++operationVersion.current;
      try {
        const nextUser = await service.login(username, password);
        if (version === operationVersion.current) applyUser(nextUser);
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
    invalidatePendingOperations();
    applyUser(null);
    try {
      await service.logout();
    } finally {
      setIsBusy(false);
    }
  }, [applyUser, invalidatePendingOperations, service]);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      setIsBusy(true);
      setError(null);
      const version = ++operationVersion.current;
      try {
        const nextUser = await service.changePassword({
          currentPassword,
          newPassword,
        });
        if (version === operationVersion.current) applyUser(nextUser);
      } catch (passwordError) {
        if (version === operationVersion.current) {
          setError(
            passwordError instanceof Error
              ? passwordError.message
              : 'Não foi possível alterar a password.',
          );
        }
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
