import type {
  LeaderboardData,
  LeaderboardMember,
} from '@/domains/leaderboard/contracts/leaderboard';

type Metric = 'fineCount' | 'totalFinedCents' | 'totalDebtCents';

function deterministicRanking(members: LeaderboardMember[], metric: Metric) {
  return [...members]
    .filter((member) => member[metric] > 0)
    .sort((left, right) => {
      const metricDifference = right[metric] - left[metric];
      if (metricDifference !== 0) return metricDifference;
      const nameDifference = left.displayName.localeCompare(
        right.displayName,
        'pt-PT',
        { sensitivity: 'base' },
      );
      if (nameDifference !== 0) return nameDifference;
      return left.id.localeCompare(right.id);
    });
}

export function buildLeaderboards(
  members: LeaderboardMember[],
): LeaderboardData {
  return {
    byFineCount: deterministicRanking(members, 'fineCount'),
    byTotalFined: deterministicRanking(members, 'totalFinedCents'),
    byCurrentDebt: deterministicRanking(members, 'totalDebtCents'),
  };
}
