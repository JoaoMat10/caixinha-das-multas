import { createSupabaseLeaderboardGateway } from '@/domains/leaderboard/infrastructure/supabaseLeaderboardGateway';
import { LeaderboardService } from '@/domains/leaderboard/services/LeaderboardService';
import { appEnv, getSupabasePublicConfiguration } from '@/shared/config/env';

export function createLeaderboardService() {
  const configuration = getSupabasePublicConfiguration(appEnv);
  if (!configuration)
    return new LeaderboardService({
      loadMembers: () => Promise.reject(new Error('Supabase não configurado.')),
    });
  return new LeaderboardService(
    createSupabaseLeaderboardGateway(configuration),
  );
}
