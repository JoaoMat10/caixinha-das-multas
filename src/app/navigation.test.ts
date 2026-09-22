import { describe, expect, it } from 'vitest';

import { getPrimaryNavigationItems } from '@/app/navigation';
import type { AuthenticatedUser } from '@/domains/auth/contracts/auth';

const baseUser: AuthenticatedUser = {
  id: '00000000-0000-4000-8000-000000000001',
  username: 'membro',
  displayName: 'Membro',
  avatarPath: null,
  mustChangePassword: false,
  isAppAdmin: false,
  memberships: [
    {
      id: '00000000-0000-4000-8000-000000000002',
      seasonId: '00000000-0000-4000-8000-000000000003',
      seasonName: '2026/27',
      seasonStatus: 'active',
      teamId: '00000000-0000-4000-8000-000000000004',
      teamName: 'Clube',
      memberType: 'player',
      roles: [],
    },
  ],
};

describe('navegação por permissões', () => {
  it('mostra apenas Painel e Mural a um membro normal', () => {
    expect(
      getPrimaryNavigationItems(baseUser).map((item) => item.label),
    ).toEqual(['Painel', 'Mural']);
  });

  it('acrescenta Multas e Tesouraria a um tesoureiro', () => {
    const user = {
      ...baseUser,
      memberships: [
        { ...baseUser.memberships[0]!, roles: ['treasurer' as const] },
      ],
    };
    expect(getPrimaryNavigationItems(user).map((item) => item.label)).toEqual([
      'Painel',
      'Mural',
      'Multas',
      'Tesouraria',
    ]);
  });

  it('apresenta Administração apenas ao Owner sem conceder Tesouraria', () => {
    const user = { ...baseUser, isAppAdmin: true };
    expect(getPrimaryNavigationItems(user).map((item) => item.label)).toEqual([
      'Painel',
      'Mural',
      'Administração',
    ]);
  });
});
