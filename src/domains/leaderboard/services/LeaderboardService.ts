import type { LeaderboardGateway } from '@/domains/leaderboard/contracts/leaderboard';
import { buildLeaderboards } from '@/domains/leaderboard/rules/leaderboardRules';

export class LeaderboardService {
  constructor(private readonly gateway: LeaderboardGateway) {}

  async load(seasonId: string) {
    if (!seasonId) throw new Error('Época obrigatória.');
    return buildLeaderboards(await this.gateway.loadMembers(seasonId));
  }
}
