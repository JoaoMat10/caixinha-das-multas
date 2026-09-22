import type {
  AuthCapability,
  AuthenticatedUser,
} from '@/domains/auth/contracts/auth';
import { hasCapability } from '@/domains/auth/rules/authorization';
import type { AppIconName } from '@/shared/components/AppIcon';

type NavigationItem = {
  to: string;
  label: string;
  shortLabel?: string;
  icon: AppIconName;
  placement: 'primary' | 'secondary';
  capability?: AuthCapability;
};

const navigationItems: NavigationItem[] = [
  {
    to: '/painel',
    label: 'Painel',
    icon: 'home',
    placement: 'primary',
    capability: 'member',
  },
  {
    to: '/mural',
    label: 'Mural',
    icon: 'trophy',
    placement: 'primary',
    capability: 'member',
  },
  {
    to: '/multas',
    label: 'Multas',
    icon: 'fine',
    placement: 'primary',
    capability: 'treasurer',
  },
  {
    to: '/tesouraria',
    label: 'Tesouraria',
    shortLabel: 'Caixa',
    icon: 'wallet',
    placement: 'primary',
    capability: 'treasurer',
  },
  {
    to: '/administracao',
    label: 'Administração',
    shortLabel: 'Admin',
    icon: 'admin',
    placement: 'primary',
    capability: 'admin',
  },
  {
    to: '/definicoes/password',
    label: 'Password',
    icon: 'settings',
    placement: 'secondary',
  },
];

export function getAuthorizedNavigationItems(user: AuthenticatedUser) {
  return navigationItems.filter(
    (item) => !item.capability || hasCapability(user, item.capability),
  );
}

export function getPrimaryNavigationItems(user: AuthenticatedUser) {
  return getAuthorizedNavigationItems(user).filter(
    (item) => item.placement === 'primary',
  );
}

export function getSecondaryNavigationItems(user: AuthenticatedUser) {
  return getAuthorizedNavigationItems(user).filter(
    (item) => item.placement === 'secondary',
  );
}
