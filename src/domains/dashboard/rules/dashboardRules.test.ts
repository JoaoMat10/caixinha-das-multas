import { describe, expect, it } from 'vitest';

import { memberDescription } from '@/domains/dashboard/rules/dashboardRules';

describe('apresentação do membro', () => {
  it('distingue jogador e equipa técnica sem incluir permissões adicionais', () => {
    expect(
      memberDescription({
        memberType: 'player',
        shirtNumber: 10,
        staffFunction: null,
      }),
    ).toBe('Jogador · camisola 10');
    expect(
      memberDescription({
        memberType: 'staff',
        shirtNumber: null,
        staffFunction: 'Treinador',
      }),
    ).toBe('Equipa técnica · Treinador');
  });
});
