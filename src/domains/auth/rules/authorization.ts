import type {
  AuthCapability,
  AuthenticatedUser,
} from '@/domains/auth/contracts/auth';

export function hasCapability(
  user: AuthenticatedUser,
  capability: AuthCapability,
) {
  if (capability === 'admin') {
    return user.isAppAdmin;
  }

  if (capability === 'treasurer') {
    return user.memberships.some((membership) =>
      membership.roles.includes('treasurer'),
    );
  }

  return user.memberships.length > 0;
}

export function getDefaultAuthenticatedPath(user: AuthenticatedUser) {
  if (hasCapability(user, 'member')) {
    return '/painel';
  }

  if (hasCapability(user, 'admin')) {
    return '/administracao';
  }

  return '/sem-acesso';
}
