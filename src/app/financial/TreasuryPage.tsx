import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useAuth } from '@/domains/auth';
import type { Fine } from '@/domains/fines/contracts/fines';
import {
  cardClass,
  FinancialMessage,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  TreasurerSeasonSelect,
} from '@/app/financial/FinancialUi';
import { formatEuros, memberLabel } from '@/domains/fines/rules/fineRules';
import { useFinancialServices } from '@/app/financial/financialContext';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';

function TreasurySeason({
  seasonId,
  writable,
}: {
  seasonId: string;
  writable: boolean;
}) {
  const { fines, treasury } = useFinancialServices();
  const queryClient = useQueryClient();
  const [memberId, setMemberId] = useState('');
  const [status, setStatus] = useState<'all' | 'pending' | 'paid'>('all');
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchKey, setBatchKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    action: 'reopen' | 'remove';
    fine: Fine;
  } | null>(null);
  const membersQuery = useQuery({
    queryKey: ['fine-members', seasonId],
    queryFn: () => fines.loadMembers(seasonId),
  });
  const totalsQuery = useQuery({
    queryKey: ['treasury-totals', seasonId],
    queryFn: () => treasury.loadTotals(seasonId),
  });
  const listQuery = useQuery({
    queryKey: ['fine-list', seasonId, memberId, status, page],
    queryFn: () =>
      fines.loadFines({
        seasonId,
        memberId: memberId || undefined,
        status: status === 'all' ? undefined : status,
        page,
      }),
  });
  const members = membersQuery.data ?? [];
  const memberNames = new Map(
    members.map((member) => [member.id, memberLabel(member)]),
  );
  const displayedFines = listQuery.data?.fines ?? [];
  const selectedFines = displayedFines.filter((fine) =>
    selectedIds.includes(fine.id),
  );
  const selectedTotal = selectedFines.reduce(
    (total, fine) => total + fine.finalAmountCents,
    0,
  );

  function changeFilters(
    nextMemberId: string,
    nextStatus: 'all' | 'pending' | 'paid',
  ) {
    setMemberId(nextMemberId);
    setStatus(nextStatus);
    setPage(0);
    setSelectedIds([]);
    setBatchKey(null);
  }

  function toggleFine(fineId: string) {
    setSelectedIds((current) =>
      current.includes(fineId)
        ? current.filter((id) => id !== fineId)
        : [...current, fineId],
    );
    setBatchKey(null);
  }

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['fine-list', seasonId] }),
      queryClient.invalidateQueries({
        queryKey: ['treasury-totals', seasonId],
      }),
    ]);
  }

  async function settle() {
    if (busy || !memberId || selectedIds.length === 0) return;
    const key = batchKey ?? crypto.randomUUID();
    setBatchKey(key);
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const batch = await treasury.recordPayment({
        memberId,
        fineIds: selectedIds,
        action: 'paid',
        idempotencyKey: key,
      });
      setSelectedIds([]);
      setBatchKey(null);
      await refresh();
      setNotice(
        `Liquidação registada. Total calculado pelo servidor: ${formatEuros(batch.calculatedTotalCents)}.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível liquidar. Podes repetir com a mesma seleção.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function reopen(fine: Fine) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const batch = await treasury.recordPayment({
        memberId: fine.seasonMemberId,
        fineIds: [fine.id],
        action: 'reopened',
        idempotencyKey: crypto.randomUUID(),
      });
      await refresh();
      setConfirmation(null);
      setNotice(
        `Multa reaberta. Valor retirado do recebido: ${formatEuros(batch.calculatedTotalCents)}.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível reabrir a multa.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(fine: Fine) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await treasury.deletePendingFine(fine.id);
      await refresh();
      setConfirmation(null);
      setNotice('Multa pendente eliminada.');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível eliminar a multa.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section
        className="grid gap-3 sm:grid-cols-3"
        aria-label="Totais da tesouraria"
      >
        {[
          ['Total multado', totalsQuery.data?.totalFinedCents],
          ['Recebido · saldo disponível', totalsQuery.data?.totalReceivedCents],
          ['Dívida atual', totalsQuery.data?.totalDebtCents],
        ].map(([label, value]) => (
          <div className={cardClass} key={String(label)}>
            <p className="text-pitch-600 text-sm font-semibold">{label}</p>
            <p className="mt-2 text-2xl font-black">
              {typeof value === 'number' ? formatEuros(value) : '—'}
            </p>
          </div>
        ))}
      </section>
      {totalsQuery.isError ? (
        <p role="alert">Não foi possível carregar os totais autorizados.</p>
      ) : null}
      <FinancialMessage error={error} notice={notice} />
      <section className={cardClass}>
        <h2 className="text-xl font-black">Multas da época</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Membro
            <select
              className={inputClass}
              value={memberId}
              onChange={(event) => changeFilters(event.target.value, status)}
            >
              <option value="">Todos os membros</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {memberLabel(member)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Estado
            <select
              className={inputClass}
              value={status}
              onChange={(event) =>
                changeFilters(
                  memberId,
                  event.target.value as 'all' | 'pending' | 'paid',
                )
              }
            >
              <option value="all">Todos os estados</option>
              <option value="pending">Pendente</option>
              <option value="paid">Paga</option>
            </select>
          </label>
        </div>
        {writable && memberId && selectedIds.length ? (
          <div className="bg-gold-100 mt-4 rounded-xl p-4">
            <p className="font-bold">
              {selectedIds.length} multa(s) pendente(s) selecionada(s) ·{' '}
              {formatEuros(selectedTotal)}
            </p>
            <p className="text-pitch-700 text-sm">
              O servidor confirma o total e regista todas no mesmo batch.
            </p>
            <button
              className={`${primaryButtonClass} mt-3`}
              disabled={busy}
              onClick={() => void settle()}
              type="button"
            >
              Liquidar seleção
            </button>
          </div>
        ) : null}
        {listQuery.isPending ? (
          <p className="mt-4" role="status">
            A carregar multas…
          </p>
        ) : null}
        {listQuery.isError ? (
          <p className="mt-4" role="alert">
            Não foi possível carregar as multas.
          </p>
        ) : null}
        <ul className="mt-4 space-y-3">
          {displayedFines.map((fine) => (
            <li
              className="border-pitch-200 rounded-xl border p-4"
              key={fine.id}
            >
              <div className="flex flex-wrap items-start gap-3">
                {writable && memberId && fine.status === 'pending' ? (
                  <input
                    aria-label={`Selecionar multa ${fine.categoryNameSnapshot}`}
                    checked={selectedIds.includes(fine.id)}
                    className="mt-1 size-5"
                    disabled={busy}
                    onChange={() => toggleFine(fine.id)}
                    type="checkbox"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="font-bold">
                    {fine.categoryNameSnapshot} ·{' '}
                    {memberNames.get(fine.seasonMemberId) ?? 'Membro'}
                  </p>
                  <p className="text-pitch-600 text-sm">
                    {new Date(fine.occurredAt).toLocaleDateString('pt-PT')} ·
                    base {formatEuros(fine.baseAmountCentsSnapshot)}
                    {fine.amountPerMinuteCentsSnapshot === null
                      ? ''
                      : ` + ${formatEuros(fine.amountPerMinuteCentsSnapshot)} × ${fine.minutes} min`}{' '}
                    × {fine.multiplier} ·{' '}
                    {fine.status === 'paid' ? 'Paga' : 'Pendente'}
                  </p>
                  {fine.notes ? (
                    <p className="text-pitch-700 mt-1 text-sm">{fine.notes}</p>
                  ) : null}
                </div>
                <strong className="text-lg">
                  {formatEuros(fine.finalAmountCents)}
                </strong>
              </div>
              {writable ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {fine.status === 'paid' ? (
                    <button
                      className={secondaryButtonClass}
                      disabled={busy}
                      onClick={() =>
                        setConfirmation({ action: 'reopen', fine })
                      }
                      type="button"
                    >
                      Reabrir
                    </button>
                  ) : null}
                  {fine.status === 'pending' && !fine.hasEverBeenPaid ? (
                    <button
                      className={secondaryButtonClass}
                      disabled={busy}
                      onClick={() =>
                        setConfirmation({ action: 'remove', fine })
                      }
                      type="button"
                    >
                      Eliminar
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
          {listQuery.data?.fines.length === 0 ? (
            <li className="text-pitch-600 text-sm">
              Sem multas para estes filtros.
            </li>
          ) : null}
        </ul>
        {listQuery.data ? (
          <div className="mt-4 flex items-center gap-3 text-sm">
            <button
              className={secondaryButtonClass}
              disabled={page === 0}
              onClick={() => {
                setPage(page - 1);
                setSelectedIds([]);
                setBatchKey(null);
              }}
              type="button"
            >
              Anterior
            </button>
            <span>
              Página {page + 1} · {listQuery.data.total} multa(s)
            </span>
            <button
              className={secondaryButtonClass}
              disabled={(page + 1) * 50 >= listQuery.data.total}
              onClick={() => {
                setPage(page + 1);
                setSelectedIds([]);
                setBatchKey(null);
              }}
              type="button"
            >
              Seguinte
            </button>
          </div>
        ) : null}
      </section>
      <ConfirmDialog
        busy={busy}
        confirmLabel={
          confirmation?.action === 'remove' ? 'Eliminar multa' : 'Reabrir multa'
        }
        description={
          confirmation
            ? confirmation.action === 'remove'
              ? `«${confirmation.fine.categoryNameSnapshot}» de ${formatEuros(confirmation.fine.finalAmountCents)} será eliminada definitivamente. Esta ação não pode ser anulada.`
              : `«${confirmation.fine.categoryNameSnapshot}» de ${formatEuros(confirmation.fine.finalAmountCents)} volta a ficar pendente e o recebido será corrigido.`
            : ''
        }
        destructive={confirmation?.action === 'remove'}
        onCancel={() => setConfirmation(null)}
        onConfirm={() => {
          if (!confirmation) return;
          void (confirmation.action === 'remove'
            ? remove(confirmation.fine)
            : reopen(confirmation.fine));
        }}
        open={Boolean(confirmation)}
        title={
          confirmation?.action === 'remove'
            ? 'Eliminar multa?'
            : 'Reabrir multa?'
        }
      />
    </div>
  );
}

export function TreasuryPage() {
  const { user } = useAuth();
  const memberships =
    user?.memberships.filter((membership) =>
      membership.roles.includes('treasurer'),
    ) ?? [];
  const [seasonId, setSeasonId] = useState(memberships[0]?.seasonId ?? '');
  const selected = memberships.find(
    (membership) => membership.seasonId === seasonId,
  );
  if (!selected)
    return <p role="alert">Não há época de tesouraria disponível.</p>;
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-black">Tesouraria</h1>
        <p className="text-pitch-600 mt-2">
          Multas, liquidações e saldo da época.
        </p>
      </header>
      <TreasurerSeasonSelect
        memberships={memberships}
        seasonId={seasonId}
        onChange={setSeasonId}
      />
      <TreasurySeason
        key={seasonId}
        seasonId={seasonId}
        writable={selected.seasonStatus === 'active'}
      />
    </div>
  );
}
