import { describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '@/domains/auth/contracts/auth';
import {
  getDefaultAuthenticatedPath,
  hasCapability,
} from '@/domains/auth/rules/authorization';

const baseUser: AuthenticatedUser = {
  id: '00000000-0000-4000-8000-000000000003',
  username: 'jogador.a',
  displayName: 'Jogador A',
  avatarPath: null,
  mustChangePassword: false,
  isAppAdmin: false,
  memberships: [],
};

describe('contexto autorizado', () => {
  it('condiciona capacidades às associações e funções recebidas', () => {
    const member = {
      ...baseUser,
      memberships: [
        {
          id: '40000000-0000-4000-8000-000000000004',
          seasonId: '30000000-0000-4000-8000-000000000002',
          seasonName: '2026/27',
          seasonStatus: 'active' as const,
          teamId: '20000000-0000-4000-8000-000000000001',
          teamName: 'Clube A',
          memberType: 'player' as const,
          roles: [],
        },
      ],
    };

    expect(hasCapability(member, 'member')).toBe(true);
    expect(hasCapability(member, 'treasurer')).toBe(false);
    expect(hasCapability(member, 'admin')).toBe(false);
    expect(getDefaultAuthenticatedPath(member)).toBe('/painel');
  });

  it('encaminha administradores sem plantel para a administração', () => {
    const admin = { ...baseUser, isAppAdmin: true };
    expect(getDefaultAuthenticatedPath(admin)).toBe('/administracao');
  });

  it('mantém utilizadores sem contexto numa área neutra', () => {
    expect(getDefaultAuthenticatedPath(baseUser)).toBe('/sem-acesso');
  });
});
