import { Navigate, Outlet, useLocation } from 'react-router-dom';

import type { AuthCapability } from '@/domains/auth/contracts/auth';
import { AuthLoadingScreen } from '@/domains/auth/presentation/AuthLoadingScreen';
import {
  getDefaultAuthenticatedPath,
  hasCapability,
} from '@/domains/auth/rules/authorization';
import { useAuth } from '@/domains/auth/state/useAuth';

export function AnonymousOnlyRoute() {
  const { status, user } = useAuth();

  if (status === 'loading') return <AuthLoadingScreen />;
  if (user) {
    return (
      <Navigate
        replace
        to={
          user.mustChangePassword
            ? '/alterar-password-obrigatoria'
            : getDefaultAuthenticatedPath(user)
        }
      />
    );
  }
  return <Outlet />;
}

export function ProtectedRoute() {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <AuthLoadingScreen />;
  if (!user) {
    return (
      <Navigate replace state={{ from: location.pathname }} to="/entrar" />
    );
  }
  if (user.mustChangePassword) {
    return <Navigate replace to="/alterar-password-obrigatoria" />;
  }
  return <Outlet />;
}

export function PasswordChangeRequiredRoute() {
  const { status, user } = useAuth();

  if (status === 'loading') return <AuthLoadingScreen />;
  if (!user) return <Navigate replace to="/entrar" />;
  if (!user.mustChangePassword) {
    return <Navigate replace to={getDefaultAuthenticatedPath(user)} />;
  }
  return <Outlet />;
}

export function AuthorizedRoute({
  capability,
}: {
  capability: AuthCapability;
}) {
  const { user } = useAuth();
  return user && hasCapability(user, capability) ? (
    <Outlet />
  ) : (
    <Navigate replace to="/sem-acesso" />
  );
}

export function AuthenticatedIndexRoute() {
  const { user } = useAuth();
  return (
    <Navigate
      replace
      to={user ? getDefaultAuthenticatedPath(user) : '/entrar'}
    />
  );
}
