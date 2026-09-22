import { describe, expect, it } from 'vitest';

import type { LeaderboardMember } from '@/domains/leaderboard/contracts/leaderboard';
import { buildLeaderboards } from '@/domains/leaderboard/rules/leaderboardRules';

function member(
  id: string,
  displayName: string,
  fineCount: number,
  totalFinedCents: number,
  totalDebtCents: number,
): LeaderboardMember {
  return {
    id,
    displayName,
    avatarUrl: null,
    memberType: 'player',
    shirtNumber: 1,
    staffFunction: null,
    isCaptain: false,
    fineCount,
    totalFinedCents,
    totalDebtCents,
  };
}

describe('rankings do Mural', () => {
  it('ordena cada métrica e resolve empates por nome e id', () => {
    const result = buildLeaderboards([
      member('b', 'Bruno', 2, 1000, 0),
      member('c', 'Álvaro', 2, 500, 500),
      member('a', 'Álvaro', 2, 1000, 500),
    ]);
    expect(result.byFineCount.map(({ id }) => id)).toEqual(['a', 'c', 'b']);
    expect(result.byTotalFined.map(({ id }) => id)).toEqual(['a', 'b', 'c']);
    expect(result.byCurrentDebt.map(({ id }) => id)).toEqual(['a', 'c']);
  });

  it('remove métricas a zero para permitir estados vazios', () => {
    const result = buildLeaderboards([member('a', 'Ana', 0, 0, 0)]);
    expect(result.byFineCount).toEqual([]);
    expect(result.byTotalFined).toEqual([]);
    expect(result.byCurrentDebt).toEqual([]);
  });
});
