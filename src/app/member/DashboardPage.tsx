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
import type { PersonalFine } from '@/domains/dashboard/contracts/dashboard';
import { formatMemberDate } from '@/domains/dashboard/rules/dashboardRules';
import { formatEuros } from '@/shared/formatters/money';
import { PageHeader } from '@/shared/components/PageHeader';

function BalanceCard({ label, value }: { label: string; value: string }) {
  return (
    <div className={memberCardClass}>
      <p className="text-pitch-600 text-sm font-semibold">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}

function FineList({
  fines,
  status,
}: {
  fines: PersonalFine[];
  status: 'pending' | 'paid';
}) {
  const pending = status === 'pending';
  return (
    <section className={memberCardClass}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-black">
          {pending ? 'Multas pendentes' : 'Multas pagas'}
        </h2>
        <span className="text-pitch-600 text-sm font-semibold">
          {fines.length} {fines.length === 1 ? 'multa' : 'multas'}
        </span>
      </div>
      {fines.length === 0 ? (
        <p className="text-pitch-600 bg-pitch-50 mt-4 rounded-xl p-4 text-sm">
          {pending
            ? 'Não tens multas pendentes nesta época.'
            : 'Ainda não tens multas pagas nesta época.'}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {fines.map((fine) => (
            <li
              className="border-pitch-100 rounded-xl border p-4"
              key={fine.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-black">{fine.categoryName}</h3>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-bold ${pending ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}
                    >
                      {pending ? 'Pendente' : 'Paga'}
                    </span>
                  </div>
                  <p className="text-pitch-600 mt-1 text-sm">
                    {formatMemberDate(fine.occurredAt)}
                  </p>
                </div>
                <strong className="text-lg">
                  {formatEuros(fine.finalAmountCents)}
                </strong>
              </div>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-pitch-600">Valor base</dt>
                  <dd className="font-bold">
                    {formatEuros(fine.baseAmountCents)}
                  </dd>
                </div>
                <div>
                  <dt className="text-pitch-600">Multiplicador</dt>
                  <dd className="font-bold">{fine.multiplier}x</dd>
                </div>
                <div>
                  <dt className="text-pitch-600">Observação</dt>
                  <dd className="font-bold">
                    {fine.notes || 'Sem observação'}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const { dashboard } = useMemberServices();
  const memberships = user?.memberships ?? [];
  const [seasonId, setSeasonId] = useState(memberships[0]?.seasonId ?? '');
  const membership = memberships.find((item) => item.seasonId === seasonId);
  const query = useQuery({
    queryKey: ['member-dashboard', seasonId, membership?.id],
    queryFn: () => dashboard.load(seasonId, membership?.id ?? ''),
    enabled: Boolean(membership),
  });

  if (!membership)
    return <p role="alert">Não há uma época de membro disponível.</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        description="Totais e histórico financeiro apenas da tua associação nesta época."
        eyebrow={`${membership.teamName} · ${membership.seasonName}`}
        title="O meu painel"
      />
      <MemberSeasonSelect
        memberships={memberships}
        seasonId={seasonId}
        onChange={setSeasonId}
      />
      {query.isPending ? (
        <p className={memberCardClass} role="status">
          A carregar o teu painel…
        </p>
      ) : null}
      {query.isError ? (
        <MemberQueryError retry={() => void query.refetch()} />
      ) : null}
      {query.data ? (
        <>
          <section aria-label="Resumo pessoal" className="space-y-3">
            <div className={`${memberCardClass} member-hero-card`}>
              <MemberIdentity member={query.data.member} />
              <div className="member-hero-balance">
                <span>Dívida atual</span>
                <strong>
                  {formatEuros(query.data.balance.totalDebtCents)}
                </strong>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <BalanceCard
                label="Total histórico"
                value={formatEuros(query.data.balance.totalFinedCents)}
              />
              <BalanceCard
                label="Total liquidado"
                value={formatEuros(query.data.balance.totalPaidCents)}
              />
              <BalanceCard
                label="Multas pendentes"
                value={String(query.data.balance.pendingCount)}
              />
              <BalanceCard
                label="Multas pagas"
                value={String(query.data.balance.paidCount)}
              />
            </div>
          </section>
          {query.data.balance.fineCount === 0 ? (
            <p className={memberCardClass} role="status">
              Ainda não tens multas nesta época.
            </p>
          ) : null}
          <FineList fines={query.data.pendingFines} status="pending" />
          <FineList fines={query.data.paidFines} status="paid" />
        </>
      ) : null}
    </div>
  );
}
