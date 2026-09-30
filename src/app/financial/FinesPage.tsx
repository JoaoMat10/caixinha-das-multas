import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useAuth } from '@/domains/auth';
import type { FineCategory } from '@/domains/fines/contracts/fines';
import {
  cardClass,
  FinancialMessage,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  TreasurerSeasonSelect,
} from '@/app/financial/FinancialUi';
import {
  formatEuros,
  memberLabel,
  parseEuros,
  previewFine,
} from '@/domains/fines/rules/fineRules';
import { previousClosedMonthInLisbon } from '@/domains/fines/rules/monthlyCommission';
import { useFinancialServices } from '@/app/financial/financialContext';

type CategoryForm = {
  id?: string;
  name: string;
  description: string;
  euros: string;
  perMinuteEuros: string;
  displayOrder: string;
  isActive: boolean;
};
const emptyCategory: CategoryForm = {
  name: '',
  description: '',
  euros: '0,10',
  perMinuteEuros: '',
  displayOrder: '0',
  isActive: true,
};

function CatalogSection({
  seasonId,
  writable,
}: {
  seasonId: string;
  writable: boolean;
}) {
  const { fines } = useFinancialServices();
  const queryClient = useQueryClient();
  const categoriesQuery = useQuery({
    queryKey: ['fine-categories', seasonId],
    queryFn: () => fines.loadCategories(seasonId),
  });
  const [form, setForm] = useState<CategoryForm>(emptyCategory);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function edit(category: FineCategory) {
    setForm({
      id: category.id,
      name: category.name,
      description: category.description ?? '',
      euros: (category.baseAmountCents / 100).toFixed(2).replace('.', ','),
      perMinuteEuros:
        category.amountPerMinuteCents === null
          ? ''
          : (category.amountPerMinuteCents / 100).toFixed(2).replace('.', ','),
      displayOrder: String(category.displayOrder),
      isActive: category.isActive,
    });
    setError(null);
    setNotice(null);
  }

  async function save(input = form) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fines.saveCategory({
        seasonId,
        id: input.id,
        name: input.name.trim(),
        description: input.description.trim(),
        baseAmountCents: parseEuros(input.euros),
        amountPerMinuteCents: input.perMinuteEuros.trim()
          ? parseEuros(input.perMinuteEuros)
          : null,
        isActive: input.isActive,
        displayOrder: Number(input.displayOrder),
      });
      await queryClient.invalidateQueries({
        queryKey: ['fine-categories', seasonId],
      });
      setForm(emptyCategory);
      setNotice(
        'Categoria guardada. Alterações de valor aplicam-se apenas a multas futuras.',
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível guardar a categoria.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={cardClass}>
      <h2 className="text-xl font-black">Catálogo da época</h2>
      <p className="text-pitch-600 mt-1 text-sm">
        As categorias usadas mantêm o histórico. A ordem é definida por um
        número crescente.
      </p>
      <FinancialMessage error={error} notice={notice} />
      {categoriesQuery.isPending ? (
        <p role="status">A carregar categorias…</p>
      ) : null}
      {categoriesQuery.isError ? (
        <p role="alert">Não foi possível carregar o catálogo.</p>
      ) : null}
      <ul className="mt-4 space-y-2">
        {categoriesQuery.data?.map((category) => (
          <li
            className="border-pitch-100 flex flex-wrap items-center gap-3 rounded-xl border p-3"
            key={category.id}
          >
            <span className="min-w-0 flex-1">
              <strong>{category.name}</strong>
              <span className="text-pitch-600 block text-sm">
                {category.description || 'Sem descrição'} · ordem{' '}
                {category.displayOrder} ·{' '}
                {category.isActive ? 'ativa' : 'inativa'}
                {category.isMonthlyCommission ? ' · comissão mensal' : ''}
              </span>
            </span>
            <strong>
              {formatEuros(category.baseAmountCents)}
              {category.amountPerMinuteCents === null
                ? ''
                : ` + ${formatEuros(category.amountPerMinuteCents)}/min`}
            </strong>
            {writable && !category.isMonthlyCommission ? (
              <>
                <button
                  className={secondaryButtonClass}
                  onClick={() => edit(category)}
                  type="button"
                >
                  Editar
                </button>
                <button
                  className={secondaryButtonClass}
                  disabled={busy}
                  onClick={() =>
                    void save({
                      id: category.id,
                      name: category.name,
                      description: category.description ?? '',
                      euros: (category.baseAmountCents / 100).toFixed(2),
                      perMinuteEuros:
                        category.amountPerMinuteCents === null
                          ? ''
                          : (category.amountPerMinuteCents / 100).toFixed(2),
                      displayOrder: String(category.displayOrder),
                      isActive: !category.isActive,
                    })
                  }
                  type="button"
                >
                  {category.isActive ? 'Desativar' : 'Reativar'}
                </button>
              </>
            ) : null}
          </li>
        ))}
        {categoriesQuery.data?.length === 0 ? (
          <li className="text-pitch-600 text-sm">
            Ainda não existem categorias nesta época.
          </li>
        ) : null}
      </ul>
      {writable ? (
        <form
          className="mt-6 grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <h3 className="font-bold sm:col-span-2">
            {form.id ? 'Editar categoria' : 'Nova categoria'}
          </h3>
          <label className="text-sm font-semibold">
            Nome
            <input
              className={inputClass}
              required
              maxLength={100}
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
          </label>
          <label className="text-sm font-semibold">
            Valor base (€)
            <input
              className={inputClass}
              required
              inputMode="decimal"
              value={form.euros}
              onChange={(event) =>
                setForm({ ...form, euros: event.target.value })
              }
            />
          </label>
          <label className="text-sm font-semibold">
            Acréscimo por minuto (€)
            <input
              className={inputClass}
              inputMode="decimal"
              placeholder="Sem acréscimo"
              value={form.perMinuteEuros}
              onChange={(event) =>
                setForm({ ...form, perMinuteEuros: event.target.value })
              }
            />
          </label>
          <label className="text-sm font-semibold sm:col-span-2">
            Descrição
            <input
              className={inputClass}
              maxLength={500}
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
            />
          </label>
          <label className="text-sm font-semibold">
            Ordem
            <input
              className={inputClass}
              type="number"
              min="0"
              step="1"
              required
              value={form.displayOrder}
              onChange={(event) =>
                setForm({ ...form, displayOrder: event.target.value })
              }
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              checked={form.isActive}
              onChange={(event) =>
                setForm({ ...form, isActive: event.target.checked })
              }
              type="checkbox"
            />
            Ativa
          </label>
          <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row">
            <button
              className={`${primaryButtonClass} w-full sm:w-auto`}
              disabled={busy}
              type="submit"
            >
              Guardar categoria
            </button>
            {form.id ? (
              <button
                className={`${secondaryButtonClass} w-full sm:w-auto`}
                onClick={() => setForm(emptyCategory)}
                type="button"
              >
                Cancelar edição
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
    </section>
  );
}

function ApplySection({
  seasonId,
  writable,
}: {
  seasonId: string;
  writable: boolean;
}) {
  const { fines } = useFinancialServices();
  const queryClient = useQueryClient();
  const categoriesQuery = useQuery({
    queryKey: ['fine-categories', seasonId],
    queryFn: () => fines.loadCategories(seasonId),
  });
  const membersQuery = useQuery({
    queryKey: ['fine-members', seasonId],
    queryFn: () => fines.loadMembers(seasonId),
  });
  const [memberId, setMemberId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [minutes, setMinutes] = useState('');
  const [preview, setPreview] = useState<{
    memberId: string;
    categoryId: string;
    occurredAt: string;
    notes: string;
    idempotencyKey: string;
    totalCents: number;
    multiplier: number;
    baseCents: number;
    variableCents: number;
    minutes: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const members =
    membersQuery.data?.filter((member) => member.status === 'active') ?? [];
  const categories =
    categoriesQuery.data?.filter(
      (category) => category.isActive && !category.isMonthlyCommission,
    ) ?? [];
  const selectedMember = members.find((member) => member.id === memberId);
  const selectedCategory = categories.find(
    (category) => category.id === categoryId,
  );

  function showPreview() {
    setError(null);
    setNotice(null);
    if (!selectedMember || !selectedCategory || !date) {
      setError('Seleciona membro, categoria e data.');
      return;
    }
    const parsedMinutes = selectedCategory.amountPerMinuteCents
      ? Number(minutes)
      : 0;
    if (
      selectedCategory.amountPerMinuteCents &&
      (!Number.isSafeInteger(parsedMinutes) || parsedMinutes < 1)
    ) {
      setError('Indica o número de minutos de atraso.');
      return;
    }
    const calculation = previewFine(
      selectedMember,
      selectedCategory,
      parsedMinutes,
    );
    setPreview({
      memberId,
      categoryId,
      occurredAt: new Date(`${date}T12:00:00`).toISOString(),
      notes: notes.trim(),
      minutes: parsedMinutes,
      idempotencyKey: crypto.randomUUID(),
      totalCents: calculation.totalCents,
      multiplier: calculation.multiplier,
      baseCents: calculation.baseAmountCents,
      variableCents: calculation.variableAmountCents,
    });
  }

  async function confirm() {
    if (!preview || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const fine = await fines.applyFine(preview);
      await queryClient.invalidateQueries({
        queryKey: ['fine-list', seasonId],
      });
      await queryClient.invalidateQueries({
        queryKey: ['treasury-totals', seasonId],
      });
      setPreview(null);
      setNotes('');
      setMinutes('');
      setNotice(`Multa aplicada: ${formatEuros(fine.finalAmountCents)}.`);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível aplicar a multa. Podes repetir a confirmação.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={cardClass}>
      <h2 className="text-xl font-black">Aplicar multa</h2>
      <p className="text-pitch-600 mt-1 text-sm">
        O valor final é fixado no servidor quando confirmas.
      </p>
      <FinancialMessage error={error} notice={notice} />
      {!writable ? (
        <p className="mt-3 text-sm">
          Esta época está em consulta. Só épocas ativas permitem aplicar multas.
        </p>
      ) : null}
      {writable ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Membro
            <select
              className={inputClass}
              value={memberId}
              onChange={(event) => {
                setMemberId(event.target.value);
                setPreview(null);
              }}
            >
              <option value="">Selecionar membro</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {memberLabel(member)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Categoria
            <select
              className={inputClass}
              value={categoryId}
              onChange={(event) => {
                setCategoryId(event.target.value);
                setMinutes('');
                setPreview(null);
              }}
            >
              <option value="">Selecionar categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name} · {formatEuros(category.baseAmountCents)}
                  {category.amountPerMinuteCents === null
                    ? ''
                    : ` + ${formatEuros(category.amountPerMinuteCents)}/min`}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Data
            <input
              className={inputClass}
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setPreview(null);
              }}
            />
          </label>
          {selectedCategory?.amountPerMinuteCents ? (
            <label className="text-sm font-semibold">
              Minutos de atraso
              <input
                className={inputClass}
                type="number"
                min="1"
                step="1"
                required
                value={minutes}
                onChange={(event) => {
                  setMinutes(event.target.value);
                  setPreview(null);
                }}
              />
            </label>
          ) : null}
          <label className="text-sm font-semibold">
            Observação
            <input
              className={inputClass}
              maxLength={500}
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value);
                setPreview(null);
              }}
            />
          </label>
          <button
            className={`${secondaryButtonClass} w-full sm:col-span-2`}
            disabled={!selectedMember || !selectedCategory || busy}
            onClick={showPreview}
            type="button"
          >
            Ver cálculo antes de confirmar
          </button>
          {preview && selectedMember && selectedCategory ? (
            <div className="bg-gold-100 rounded-xl p-4 sm:col-span-2">
              <h3 className="font-black">Confirmar multa</h3>
              <p>
                {memberLabel(selectedMember)} · {selectedCategory.name}
              </p>
              <p>
                Valor base: {formatEuros(preview.baseCents)} · multiplicador:{' '}
                {preview.multiplier}x
              </p>
              {preview.minutes > 0 ? (
                <p>
                  Acréscimo: {preview.minutes} min ×{' '}
                  {formatEuros(selectedCategory.amountPerMinuteCents ?? 0)} ={' '}
                  {formatEuros(preview.variableCents)}
                </p>
              ) : null}
              <p className="text-lg font-black">
                Total: {formatEuros(preview.totalCents)}
              </p>
              <button
                className={`${primaryButtonClass} mt-3 w-full sm:w-auto`}
                disabled={busy}
                onClick={() => void confirm()}
                type="button"
              >
                Confirmar aplicação
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function MonthlyCommissionSection({ seasonId }: { seasonId: string }) {
  const { fines } = useFinancialServices();
  const queryClient = useQueryClient();
  const lastClosedMonth = previousClosedMonthInLisbon();
  const [month, setMonth] = useState(
    lastClosedMonth >= '2026-09' ? lastClosedMonth : '2026-09',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const available = lastClosedMonth >= '2026-09';

  async function generate() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const created = await fines.generateMonthlyCommissions(seasonId, month);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['fine-list', seasonId] }),
        queryClient.invalidateQueries({
          queryKey: ['treasury-totals', seasonId],
        }),
      ]);
      setNotice(
        created === 0
          ? 'A comissão deste mês já estava calculada.'
          : `${created} comissão(ões) de 1,00 € criada(s).`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível calcular as comissões.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={cardClass}>
      <h2 className="text-xl font-black">Comissão mensal</h2>
      <p className="text-pitch-600 mt-1 text-sm">
        Depois do fim do mês, cobra 1,00 € a cada membro sem multas nesse mês.
        Nunca aplica multiplicador.
      </p>
      <FinancialMessage error={error} notice={notice} />
      {available ? (
        <div className="mt-4 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="min-w-0 text-sm font-semibold">
            Mês de referência
            <input
              className={inputClass}
              type="month"
              min="2026-09"
              max={lastClosedMonth}
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </label>
          <button
            className={`${primaryButtonClass} w-full sm:w-auto`}
            disabled={busy}
            onClick={() => void generate()}
            type="button"
          >
            Calcular comissões
          </button>
        </div>
      ) : (
        <p className="mt-3 text-sm">
          A primeira comissão, relativa a setembro, fica disponível em 1 de
          outubro.
        </p>
      )}
    </section>
  );
}

export function FinesPage() {
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
        <h1 className="text-3xl font-black">Multas</h1>
        <p className="text-pitch-600 mt-2">
          Catálogo e aplicação de multas por época.
        </p>
      </header>
      <TreasurerSeasonSelect
        memberships={memberships}
        seasonId={seasonId}
        onChange={setSeasonId}
      />
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <CatalogSection
          key={`catalog-${seasonId}`}
          seasonId={seasonId}
          writable={selected.seasonStatus !== 'archived'}
        />
        <ApplySection
          key={`apply-${seasonId}`}
          seasonId={seasonId}
          writable={selected.seasonStatus === 'active'}
        />
      </div>
      {selected.seasonStatus === 'active' ? (
        <MonthlyCommissionSection
          key={`commission-${seasonId}`}
          seasonId={seasonId}
        />
      ) : null}
    </div>
  );
}
