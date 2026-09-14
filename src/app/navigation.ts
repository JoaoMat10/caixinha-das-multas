import type {
  AuthCapability,
  AuthenticatedUser,
} from '@/domains/auth/contracts/auth';
import { hasCapability } from '@/domains/auth/rules/authorization';

type NavigationItem = {
  to: string;
  label: string;
  capability?: AuthCapability;
};

const navigationItems: NavigationItem[] = [
  { to: '/painel', label: 'Painel', capability: 'member' },
  { to: '/multas', label: 'Multas', capability: 'treasurer' },
  { to: '/tesouraria', label: 'Tesouraria', capability: 'treasurer' },
  { to: '/mural', label: 'Mural', capability: 'member' },
  { to: '/administracao', label: 'Administração', capability: 'admin' },
  { to: '/definicoes/password', label: 'Password' },
];

export function getAuthorizedNavigationItems(user: AuthenticatedUser) {
  return navigationItems.filter(
    (item) => !item.capability || hasCapability(user, item.capability),
  );
}
