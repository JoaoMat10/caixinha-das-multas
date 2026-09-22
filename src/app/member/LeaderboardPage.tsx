import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import {
  MemberIdentity,
  MemberQueryError,
  MemberSeasonSelect,
  memberCardClass,
} from '@/app/member/MemberUi';
import { useMemberServices } from '@/app/member/memberContext';
import { useAuth } from '@/domains/auth';
import type { LeaderboardMember } from '@/domains/leaderboard/contracts/leaderboard';
import { formatEuros } from '@/shared/formatters/money';

function RankingSection({
  title,
  description,
  members,
  value,
  empty,
}: {
  title: string;
  description: string;
  members: LeaderboardMember[];
  value: (member: LeaderboardMember) => string;
  empty: string;
}) {
  return (
    <section className={memberCardClass}>
      <h2 className="text-xl font-black">{title}</h2>
      <p className="text-pitch-600 mt-1 text-sm">{description}</p>
      {members.length === 0 ? (
        <p className="text-pitch-600 bg-pitch-50 mt-4 rounded-xl p-4 text-sm">
          {empty}
        </p>
      ) : (
        <ol className="mt-4 space-y-3">
          {members.map((member, index) => (
            <li
              className="border-pitch-100 flex items-center gap-3 rounded-xl border p-3"
              key={member.id}
            >
              <span className="bg-pitch-900 grid size-8 shrink-0 place-items-center rounded-full text-sm font-black text-white">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <MemberIdentity compact member={member} />
              </div>
              <strong className="shrink-0 text-right">{value(member)}</strong>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function LeaderboardPage() {
  const { user } = useAuth();
  const { leaderboard } = useMemberServices();
  const memberships = user?.memberships ?? [];
  const [seasonId, setSeasonId] = useState(memberships[0]?.seasonId ?? '');
  const membership = memberships.find((item) => item.seasonId === seasonId);
  const query = useQuery({
    queryKey: ['member-leaderboard', seasonId],
    queryFn: () => leaderboard.load(seasonId),
    enabled: Boolean(membership),
  });

  if (!membership)
    return <p role="alert">Não há uma época de membro disponível.</p>;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-pitch-600 text-sm font-bold tracking-wider uppercase">
          {membership.teamName} · {membership.seasonName}
        </p>
        <h1 className="mt-1 text-3xl font-black">Mural da Vergonha</h1>
        <p className="text-pitch-600 mt-2">
          Rankings coletivos da equipa. O detalhe de cada multa permanece
          privado.
        </p>
      </header>
      <MemberSeasonSelect
        memberships={memberships}
        seasonId={seasonId}
        onChange={setSeasonId}
      />
      {query.isPending ? (
        <p className={memberCardClass} role="status">
          A carregar os rankings…
        </p>
      ) : null}
      {query.isError ? (
        <MemberQueryError retry={() => void query.refetch()} />
      ) : null}
      {query.data ? (
        <div className="grid gap-6 xl:grid-cols-3">
          <RankingSection
            title="Mais multas"
            description="Quantidade total de multas válidas, pagas e pendentes."
            members={query.data.byFineCount}
            value={(member) =>
              `${member.fineCount} ${member.fineCount === 1 ? 'multa' : 'multas'}`
            }
            empty="Ainda não existem multas válidas nesta época."
          />
          <RankingSection
            title="Maior valor acumulado"
            description="Soma histórica das multas válidas, incluindo as já pagas."
            members={query.data.byTotalFined}
            value={(member) => formatEuros(member.totalFinedCents)}
            empty="Ainda não existe valor acumulado nesta época."
          />
          <RankingSection
            title="Maior dívida atual"
            description="Soma apenas das multas que continuam pendentes."
            members={query.data.byCurrentDebt}
            value={(member) => formatEuros(member.totalDebtCents)}
            empty="A equipa não tem dívida pendente nesta época."
          />
        </div>
      ) : null}
      <p className="text-pitch-600 text-xs">
        Em caso de empate, a ordenação usa o nome apresentado e uma regra
        técnica estável que não expõe dados adicionais.
      </p>
    </div>
  );
}
