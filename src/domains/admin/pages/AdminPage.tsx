import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { AdminAuditSection } from '@/domains/admin/presentation/AdminAuditSection';
import { AdminRosterSection } from '@/domains/admin/presentation/AdminRosterSection';
import { AdminSummary } from '@/domains/admin/presentation/AdminSummary';
import { AdminTeamsSection } from '@/domains/admin/presentation/AdminTeamsSection';
import { AdminUsersSection } from '@/domains/admin/presentation/AdminUsersSection';
import { FormError } from '@/domains/admin/presentation/adminUi';
import { useAdminService } from '@/domains/admin/state/useAdminService';

type AdminView = 'summary' | 'users' | 'teams' | 'roster' | 'audit';

const views: { id: AdminView; label: string }[] = [
  { id: 'summary', label: 'Resumo' },
  { id: 'users', label: 'Utilizadores' },
  { id: 'teams', label: 'Equipas e épocas' },
  { id: 'roster', label: 'Plantéis' },
  { id: 'audit', label: 'Auditoria' },
];

export function AdminPage() {
  const service = useAdminService();
  const [view, setView] = useState<AdminView>('summary');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const overviewQuery = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => service.loadOverview(),
  });

  async function run<T>(
    operation: () => Promise<T>,
    onSuccess?: (result: T) => void,
  ) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await operation();
      onSuccess?.(result);
      await overviewQuery.refetch();
      setNotice('Alteração guardada.');
    } catch (operationError) {
      setError(
        operationError instanceof Error
          ? operationError.message
          : 'Não foi possível guardar a alteração.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (overviewQuery.isPending)
    return <p role="status">A carregar a administração…</p>;
  if (overviewQuery.isError || !overviewQuery.data) {
    return (
      <div role="alert">
        <h1 className="text-2xl font-black">Administração indisponível</h1>
        <p className="mt-2">Não foi possível carregar os dados autorizados.</p>
        <button
          className="mt-4 underline"
          onClick={() => void overviewQuery.refetch()}
          type="button"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const overview = overviewQuery.data;
  return (
    <div className="space-y-6">
      <header>
        <p className="text-pitch-700 text-sm font-bold tracking-widest uppercase">
          Área reservada
        </p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">
          Administração
        </h1>
        <p className="text-pitch-600 mt-2 max-w-3xl">
          Configuração global de contas, equipas, épocas, plantéis e
          fotografias. A permissão Owner permanece privada.
        </p>
      </header>
      <nav
        aria-label="Secções da administração"
        className="flex gap-2 overflow-x-auto pb-1"
      >
        {views.map((item) => (
          <button
            aria-current={view === item.id ? 'page' : undefined}
            className={
              view === item.id
                ? 'bg-pitch-900 min-h-11 shrink-0 rounded-full px-4 text-sm font-bold text-white'
                : 'border-pitch-200 min-h-11 shrink-0 rounded-full border bg-white px-4 text-sm font-bold'
            }
            key={item.id}
            onClick={() => setView(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </nav>
      <FormError message={error} />
      {notice ? (
        <p
          className="rounded-xl bg-emerald-100 p-3 text-sm font-semibold text-emerald-900"
          role="status"
        >
          {notice}
        </p>
      ) : null}
      {view === 'summary' ? <AdminSummary overview={overview} /> : null}
      {view === 'users' ? (
        <AdminUsersSection
          busy={busy}
          overview={overview}
          run={run}
          service={service}
        />
      ) : null}
      {view === 'teams' ? (
        <AdminTeamsSection
          busy={busy}
          overview={overview}
          run={run}
          service={service}
        />
      ) : null}
      {view === 'roster' ? (
        <AdminRosterSection
          busy={busy}
          overview={overview}
          run={run}
          service={service}
        />
      ) : null}
      {view === 'audit' ? <AdminAuditSection overview={overview} /> : null}
    </div>
  );
}
